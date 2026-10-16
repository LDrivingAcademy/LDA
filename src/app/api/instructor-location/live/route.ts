import { canUseMarketplaceRole, getMarketplaceRoleState } from "@/lib/account-route-guard";
import { isRateLimited, jsonNoStore, rateLimitResponse, readJsonBody, safeText } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  activeDriverLiveWindowMs,
} from "@/lib/admin-active-driver-locations";
import {
  normaliseGpsAccuracy,
  normaliseGpsCoordinate,
  normaliseGpsHeading,
  normaliseGpsSpeed,
  parseGpsRecordedAt
} from "@/lib/live-gps-utils";

type InstructorLiveLocationRequest = {
  latitude?: unknown;
  longitude?: unknown;
  accuracy?: unknown;
  heading?: unknown;
  speed?: unknown;
  clientRecordedAt?: unknown;
  source?: unknown;
};

function normaliseSource(value: unknown) {
  const source = safeText(value, "working_day", 30);
  return source === "start_work" || source === "log_on" ? source : "working_day";
}

function isMissingLiveGpsColumnError(error: { code?: string | null; message?: string | null } | null | undefined) {
  const message = error?.message ?? "";
  return error?.code === "42703" || /column .* does not exist|schema cache/i.test(message);
}

async function hasActiveWorkWindow(supabase: ReturnType<typeof createAdminClient>, instructorId: string) {
  if (!supabase) return false;

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("availability_slots")
    .select("id")
    .eq("instructor_id", instructorId)
    .eq("is_booked", false)
    .lte("starts_at", now)
    .gt("ends_at", now)
    .limit(1);

  if (error) {
    console.warn("[instructor-location.live] active work lookup failed", {
      instructorId,
      message: error.message
    });
    return false;
  }

  return Boolean(data?.length);
}

export async function POST(request: Request) {
  if (isRateLimited(request, "instructor-live-location", 90)) {
    return rateLimitResponse();
  }

  const input = await readJsonBody<InstructorLiveLocationRequest>(request);
  const latitude = normaliseGpsCoordinate(input?.latitude, "lat");
  const longitude = normaliseGpsCoordinate(input?.longitude, "lng");
  const accuracy = normaliseGpsAccuracy(input?.accuracy);
  const heading = normaliseGpsHeading(input?.heading);
  const speed = normaliseGpsSpeed(input?.speed);
  const clientRecordedAt = parseGpsRecordedAt(input?.clientRecordedAt);

  if (
    latitude === null ||
    longitude === null ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return jsonNoStore({ error: "A valid live location is required while you are logged on for work." }, { status: 400 });
  }

  const signedInSupabase = await createClient();
  if (!signedInSupabase) {
    return jsonNoStore({ error: "Authentication is not configured." }, { status: 503 });
  }

  const {
    data: { user }
  } = await signedInSupabase.auth.getUser();

  if (!user) {
    return jsonNoStore({ error: "Sign in as an instructor before sharing live work location." }, { status: 401 });
  }

  const roleState = await getMarketplaceRoleState(signedInSupabase, user.id);
  if (!canUseMarketplaceRole(roleState, "instructor")) {
    return jsonNoStore({ error: "Use an approved instructor account before sharing live work location." }, { status: 403 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return jsonNoStore({ error: "Live work location is temporarily unavailable." }, { status: 503 });
  }

  if (!(await hasActiveWorkWindow(supabase, user.id))) {
    return jsonNoStore({ error: "Log On or start work before sharing a working-day location." }, { status: 409 });
  }

  const recordedAt = new Date();
  const expiresAt = new Date(recordedAt.getTime() + activeDriverLiveWindowMs);
  const liveLocationPayload = {
    instructor_id: user.id,
    latitude,
    longitude,
    accuracy_meters: accuracy === null ? null : Math.max(0, accuracy),
    heading_degrees: heading,
    speed_mps: speed,
    client_recorded_at: clientRecordedAt,
    source: normaliseSource(input?.source),
    recorded_at: recordedAt.toISOString(),
    expires_at: expiresAt.toISOString(),
    is_active: true
  };
  const { error } = await supabase.from("instructor_live_locations").insert(liveLocationPayload);

  if (error) {
    if (isMissingLiveGpsColumnError(error)) {
      const fallbackInsert = await supabase.from("instructor_live_locations").insert({
        instructor_id: user.id,
        latitude,
        longitude,
        accuracy_meters: liveLocationPayload.accuracy_meters,
        source: liveLocationPayload.source,
        recorded_at: liveLocationPayload.recorded_at,
        expires_at: liveLocationPayload.expires_at
      });

      if (!fallbackInsert.error) {
        return jsonNoStore({
          ok: true,
          expiresAt: expiresAt.toISOString(),
          message: "Live work location updated."
        });
      }

      return jsonNoStore({ error: fallbackInsert.error.message }, { status: 409 });
    }
    return jsonNoStore({ error: error.message }, { status: 409 });
  }

  return jsonNoStore({
    ok: true,
    expiresAt: expiresAt.toISOString(),
    message: "Live work location updated."
  });
}
