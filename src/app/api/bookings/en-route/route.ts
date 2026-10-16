import { sendInstructorEnRouteEmail } from "@/lib/email";
import { getAppOrigin, isRateLimited, jsonNoStore, rateLimitResponse, readJsonBody, safeEmail, safeText } from "@/lib/security";
import { sendSms } from "@/lib/sms";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { canUseMarketplaceRole, getMarketplaceRoleState } from "@/lib/account-route-guard";
import { getLessonRouteExpiryTime, isLessonRouteAccessActive, lessonRouteExpiredResponseMessage } from "@/lib/lesson-route-access";
import { arrivalDistanceThresholdMeters, distanceInMeters, recordInstructorArrivalAndCredit } from "@/lib/lesson-punctuality";
import {
  normaliseGpsAccuracy,
  normaliseGpsCoordinate,
  normaliseGpsHeading,
  normaliseGpsSpeed,
  parseGpsRecordedAt
} from "@/lib/live-gps-utils";

type EnRouteRequest = {
  bookingId: string;
  latitude?: unknown;
  longitude?: unknown;
  accuracy?: unknown;
  heading?: unknown;
  speed?: unknown;
  source?: unknown;
  clientRecordedAt?: unknown;
  silent?: unknown;
};

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

type ProfileRow = {
  full_name: string | null;
  email: string | null;
  phone: string | null;
};

type InstructorRow = {
  display_name: string | null;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isMissingLiveGpsColumnError(error: { code?: string | null; message?: string | null } | null | undefined) {
  const message = error?.message ?? "";
  return error?.code === "42703" || /column .* does not exist|schema cache/i.test(message);
}

export async function POST(request: Request) {
  if (isRateLimited(request, "booking-en-route", 10)) {
    return rateLimitResponse();
  }

  const input = await readJsonBody<EnRouteRequest>(request);
  const bookingId = safeText(input?.bookingId, "", 80);
  const latitude = normaliseGpsCoordinate(input?.latitude, "lat");
  const longitude = normaliseGpsCoordinate(input?.longitude, "lng");
  const accuracy = normaliseGpsAccuracy(input?.accuracy);
  const heading = normaliseGpsHeading(input?.heading);
  const speed = normaliseGpsSpeed(input?.speed);
  const clientRecordedAt = parseGpsRecordedAt(input?.clientRecordedAt);
  const source = safeText(input?.source, "browser_geolocation", 40) || "browser_geolocation";
  const silent = input?.silent === true;
  const hasValidLocation =
    latitude !== null &&
    longitude !== null &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180;

  if (!uuidPattern.test(bookingId)) {
    return jsonNoStore({ error: "A valid booking reference is required." }, { status: 400 });
  }

  const signedInSupabase = await createClient();
  if (!signedInSupabase) {
    return jsonNoStore({ error: "Authentication is not configured." }, { status: 503 });
  }

  const {
    data: { user }
  } = await signedInSupabase.auth.getUser();

  if (!user) {
    return jsonNoStore({ error: "Sign in before marking a lesson en route." }, { status: 401 });
  }

  const roleState = await getMarketplaceRoleState(signedInSupabase, user.id);
  if (!canUseMarketplaceRole(roleState, "instructor")) {
    return jsonNoStore({ error: "Use an approved instructor account before sending en-route alerts." }, { status: 403 });
  }

  const { data: booking } = await signedInSupabase
    .from("bookings")
    .select("id,learner_id,instructor_id,starts_at,ends_at,pickup_postcode,pickup_latitude,pickup_longitude,status")
    .eq("id", bookingId)
    .maybeSingle();

  const bookingRow = booking as BookingRow | null;

  if (!bookingRow || bookingRow.instructor_id !== user.id) {
    return jsonNoStore({ error: "You can only send en-route alerts for your own accepted bookings." }, { status: 403 });
  }

  if (String(bookingRow.status ?? "").toLowerCase().includes("cancel")) {
    return jsonNoStore({ error: "Cannot send an en-route alert for a cancelled booking." }, { status: 409 });
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

  const supabase = createAdminClient() ?? signedInSupabase;
  let arrivalResult: Awaited<ReturnType<typeof recordInstructorArrivalAndCredit>> | null = null;
  if (supabase) {
    const routeExpiresAt = getLessonRouteExpiryTime({
      status: bookingRow.status,
      startsAt: bookingRow.starts_at,
      endsAt: bookingRow.ends_at
    });

    if (hasValidLocation) {
      const routeExpiresAtIso = routeExpiresAt === null ? bookingRow.ends_at : new Date(routeExpiresAt).toISOString();
      const liveLocationPayload = {
        booking_id: bookingRow.id,
        instructor_id: bookingRow.instructor_id,
        learner_id: bookingRow.learner_id,
        latitude,
        longitude,
        accuracy_meters: accuracy === null ? null : Math.round(Math.max(0, accuracy)),
        heading_degrees: heading,
        speed_mps: speed,
        source,
        client_recorded_at: clientRecordedAt,
        expires_at: routeExpiresAtIso
      };
      const insertResult = await supabase.from("location_shares").insert(liveLocationPayload);

      if (insertResult.error && isMissingLiveGpsColumnError(insertResult.error)) {
        await supabase.from("location_shares").insert({
          booking_id: bookingRow.id,
          instructor_id: bookingRow.instructor_id,
          learner_id: bookingRow.learner_id,
          latitude,
          longitude,
          accuracy_meters: liveLocationPayload.accuracy_meters,
          expires_at: routeExpiresAtIso
        });
      } else if (insertResult.error) {
        throw new Error(insertResult.error.message);
      }

      if (bookingRow.pickup_latitude !== null && bookingRow.pickup_longitude !== null) {
        const distanceToPickup = distanceInMeters(
          { latitude, longitude },
          { latitude: bookingRow.pickup_latitude, longitude: bookingRow.pickup_longitude }
        );
        const threshold = Math.max(arrivalDistanceThresholdMeters, (accuracy ?? 0) + 25);

        if (distanceToPickup <= threshold) {
          try {
            arrivalResult = await recordInstructorArrivalAndCredit({
              supabase,
              bookingId: bookingRow.id,
              instructorId: user.id,
              latitude,
              longitude,
              accuracy: accuracy ?? undefined
            });
          } catch (error) {
            console.warn("[booking-en-route] arrival auto-record failed", {
              bookingId: bookingRow.id,
              message: error instanceof Error ? error.message : String(error)
            });
          }
        }
      }
    }

    await supabase
      .from("bookings")
      .update({ status: "instructor_en_route" })
      .eq("id", bookingRow.id)
      .eq("instructor_id", user.id);

    await supabase
      .from("lesson_booking_records")
      .update({ status: "instructor_en_route" })
      .eq("marketplace_booking_id", bookingRow.id)
      .eq("instructor_id", user.id);
  }

  if (silent) {
    return jsonNoStore({
      ok: true,
      channel: "none",
      arrival: arrivalResult,
      message: hasValidLocation ? "Instructor live location updated." : "Instructor route status refreshed."
    });
  }

  const [{ data: learnerProfile }, { data: instructorProfile }] = await Promise.all([
    supabase.from("profiles").select("full_name,email,phone").eq("id", bookingRow.learner_id).maybeSingle(),
    supabase.from("instructor_profiles").select("display_name").eq("user_id", user.id).maybeSingle()
  ]);
  const learner = learnerProfile as ProfileRow | null;
  const instructor = instructorProfile as InstructorRow | null;
  const learnerPhone = safeText(learner?.phone, "", 40);
  const learnerEmail = safeEmail(learner?.email);
  const instructorName = instructor?.display_name || user.user_metadata?.full_name || user.email || "Your LDA instructor";
  const lessonSummary = `${formatDateTime(bookingRow.starts_at)} from ${bookingRow.pickup_postcode || "your pickup point"}`;
  const trackingUrl = `${getAppOrigin(request)}/tracking?booking=${encodeURIComponent(bookingId)}&from=learner-dashboard`;
  const smsBody = `LDA update: ${instructorName} is on the way for your lesson ${lessonSummary}. Track here: ${trackingUrl}`;
  let smsResult: unknown = null;
  let emailResult: unknown = null;
  let channel: "sms" | "email" | "none" = "none";

  try {
    smsResult = await sendSms({ to: learnerPhone, body: smsBody });
    if (!(smsResult as { skipped?: boolean })?.skipped) {
      channel = "sms";
    }
  } catch (error) {
    smsResult = { error: error instanceof Error ? error.message : "SMS failed." };
  }

  if (channel !== "sms" && learnerEmail) {
    emailResult = await sendInstructorEnRouteEmail({
      learnerEmail,
      instructorName,
      bookingReference: bookingId,
      lessonSummary,
      trackingUrl
    });
    channel = "email";
  }

  if (supabase) {
    await supabase.from("notifications").insert({
      user_id: bookingRow.learner_id,
      booking_id: bookingId,
      title: "Instructor on the way",
      body: `${instructorName} is heading to your pickup point.`,
      notification_type: "driver_en_route"
    });
  }

  return jsonNoStore({
    ok: true,
    channel,
    arrival: arrivalResult,
    smsResult,
    emailResult,
    message:
      channel === "sms"
        ? "Learner SMS sent."
        : channel === "email"
          ? "Learner email sent because no SMS number was available."
          : "No learner phone or email was available, but an in-app notification was recorded."
  });
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
