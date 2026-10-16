import { jsonNoStore, safeText } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { canUseMarketplaceRole, getMarketplaceRoleState } from "@/lib/account-route-guard";
import { isLessonRouteAccessActive, lessonRouteExpiredResponseMessage } from "@/lib/lesson-route-access";
import { readLiveLocationServerCache, writeLiveLocationServerCache } from "@/lib/live-location-server-cache";

type BookingRow = {
  id: string;
  learner_id: string;
  instructor_id: string;
  starts_at: string;
  ends_at: string;
  pickup_postcode: string | null;
  pickup_latitude: number | null;
  pickup_longitude: number | null;
  status: string | null;
};

type LocationShareRow = {
  latitude: number;
  longitude: number;
  accuracy_meters?: number | null;
  heading_degrees?: number | null;
  speed_mps?: number | null;
  recorded_at: string;
};

type LiveTrackingResponse = {
  lesson: {
    bookingReference: string;
    instructorName: string;
    pickupLabel: string;
    pickupPostcode: string;
    startsAt: string;
    status: string | null;
    pickupPoint: { lat: number; lng: number } | null;
    instructorPoint: { lat: number; lng: number } | null;
    instructorLocationRecordedAt: string | null;
    instructorAccuracyMeters: number | null;
    instructorHeadingDegrees: number | null;
    instructorSpeedMps: number | null;
  };
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isMissingLiveGpsColumnError(error: { code?: string | null; message?: string | null } | null | undefined) {
  const message = error?.message ?? "";
  return error?.code === "42703" || /column .* does not exist|schema cache/i.test(message);
}

async function getLatestLocationShare(input: {
  client: NonNullable<ReturnType<typeof createAdminClient> | Awaited<ReturnType<typeof createClient>>>;
  booking: BookingRow;
}) {
  const query = input.client
    .from("location_shares")
    .select("latitude,longitude,accuracy_meters,heading_degrees,speed_mps,recorded_at")
    .eq("booking_id", input.booking.id)
    .eq("instructor_id", input.booking.instructor_id)
    .eq("learner_id", input.booking.learner_id)
    .gt("expires_at", new Date().toISOString())
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const result = await query;
  if (!result.error || !isMissingLiveGpsColumnError(result.error)) {
    return result;
  }

  return input.client
    .from("location_shares")
    .select("latitude,longitude,recorded_at")
    .eq("booking_id", input.booking.id)
    .eq("instructor_id", input.booking.instructor_id)
    .eq("learner_id", input.booking.learner_id)
    .gt("expires_at", new Date().toISOString())
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();
}

export async function GET(request: Request) {
  if (!hasSupabaseConfig()) {
    return jsonNoStore({ error: "Tracking is not configured." }, { status: 503 });
  }

  const url = new URL(request.url);
  const bookingReference = safeText(url.searchParams.get("booking"), "", 80);

  if (!uuidPattern.test(bookingReference)) {
    return jsonNoStore({ error: "A live booking reference is required." }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) {
    return jsonNoStore({ error: "Tracking is not configured." }, { status: 503 });
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonNoStore({ error: "Sign in to view live tracking." }, { status: 401 });
  }

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("id,learner_id,instructor_id,starts_at,ends_at,pickup_postcode,pickup_latitude,pickup_longitude,status")
    .eq("id", bookingReference)
    .maybeSingle();

  if (bookingError) {
    return jsonNoStore({ error: "Live tracking could not load this booking." }, { status: 500 });
  }

  const bookingRow = booking as BookingRow | null;
  if (!bookingRow || (bookingRow.learner_id !== user.id && bookingRow.instructor_id !== user.id)) {
    return jsonNoStore({ error: "This booking is not available on this account." }, { status: 404 });
  }

  const roleState = await getMarketplaceRoleState(supabase, user.id);
  const isLearnerViewer = bookingRow.learner_id === user.id;
  const expectedRole = isLearnerViewer ? "learner" : "instructor";

  if (!canUseMarketplaceRole(roleState, expectedRole)) {
    return jsonNoStore({ error: "This live tracking view is not available for this account type." }, { status: 403 });
  }

  if (
    !isLessonRouteAccessActive({
      status: bookingRow.status,
      startsAt: bookingRow.starts_at,
      endsAt: bookingRow.ends_at
    })
  ) {
    return jsonNoStore({ error: lessonRouteExpiredResponseMessage() }, { status: 410 });
  }

  const secureCacheKey = `tracking:${user.id}:${bookingRow.id}:${bookingRow.status ?? "unknown"}`;
  const cachedResponse = readLiveLocationServerCache<LiveTrackingResponse>(secureCacheKey);
  if (cachedResponse) {
    return jsonNoStore(cachedResponse);
  }

  const readClient = createAdminClient() ?? supabase;
  const [profileResult, locationResult] = await Promise.all([
    readClient.from("profiles").select("full_name,email").eq("id", bookingRow.instructor_id).maybeSingle(),
    getLatestLocationShare({ client: readClient, booking: bookingRow })
  ]);

  if (locationResult.error) {
    return jsonNoStore({ error: "Instructor live location could not load." }, { status: 500 });
  }

  const instructor = profileResult.data as { full_name?: string | null; email?: string | null } | null;
  const latestLocation = locationResult.data as LocationShareRow | null;
  const pickupLabel = bookingRow.pickup_postcode || "your pickup";

  const response: LiveTrackingResponse = {
    lesson: {
      bookingReference: bookingRow.id,
      instructorName: instructor?.full_name || instructor?.email || "Your LDA instructor",
      pickupLabel,
      pickupPostcode: pickupLabel,
      startsAt: bookingRow.starts_at,
      status: bookingRow.status,
      pickupPoint:
        typeof bookingRow.pickup_latitude === "number" && typeof bookingRow.pickup_longitude === "number"
          ? { lat: bookingRow.pickup_latitude, lng: bookingRow.pickup_longitude }
          : null,
      instructorPoint: latestLocation ? { lat: latestLocation.latitude, lng: latestLocation.longitude } : null,
      instructorLocationRecordedAt: latestLocation?.recorded_at ?? null,
      instructorAccuracyMeters: latestLocation?.accuracy_meters ?? null,
      instructorHeadingDegrees: latestLocation?.heading_degrees ?? null,
      instructorSpeedMps: latestLocation?.speed_mps ?? null
    }
  };

  writeLiveLocationServerCache(secureCacheKey, response, 3000);

  return jsonNoStore(response);
}
