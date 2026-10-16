import type { SupabaseClient } from "@supabase/supabase-js";

export const activeDriverLiveWindowMs = 45_000;
export const activeDriverRefreshMs = 12_000;
const staleSignedOnWarningWindowMs = 15 * 60_000;

export type AdminActiveDriver = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  emergencyGrade: boolean;
  headingDegrees: number | null;
  speedMps: number | null;
  clientRecordedAt: string | null;
  recordedAt: string;
  expiresAt: string | null;
  emergencyStatus: string | null;
  vehicle: string | null;
};

export type AdminStaleSignedOnInstructor = {
  id: string;
  name: string;
  email: string | null;
  lastUpdate: string | null;
  accuracyMeters: number | null;
  reason: "missing_ping" | "stale_ping" | "expired_ping" | "low_accuracy";
};

export type AdminActiveDriverLocationPayload = {
  drivers: AdminActiveDriver[];
  staleSignedOnInstructors: AdminStaleSignedOnInstructor[];
  generatedAt: string;
  liveWindowSeconds: number;
  errors: string[];
};

type ActiveSlotRow = {
  instructor_id: string;
};

type InstructorLiveLocationRow = {
  id: string;
  instructor_id: string;
  latitude: number;
  longitude: number;
  accuracy_meters: number | null;
  heading_degrees?: number | null;
  speed_mps?: number | null;
  client_recorded_at?: string | null;
  source: string | null;
  recorded_at: string;
  expires_at: string | null;
  is_active?: boolean | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
};

type InstructorRow = {
  user_id: string;
  display_name: string | null;
  car_make: string | null;
  car_model: string | null;
  car_registration: string | null;
};

type SafetyEventRow = {
  instructor_id: string;
  event_type: string | null;
  severity: string | null;
  status: string | null;
};

function isMissingLiveGpsColumnError(error: { code?: string | null; message?: string | null } | null | undefined) {
  const message = error?.message ?? "";
  return error?.code === "42703" || /column .* does not exist|schema cache/i.test(message);
}

function asRows<T>(data: unknown): T[] {
  return Array.isArray(data) ? (data as T[]) : [];
}

function buildVehicle(instructor?: InstructorRow) {
  const vehicle = [instructor?.car_make, instructor?.car_model, instructor?.car_registration].filter(Boolean).join(" ");
  return vehicle || null;
}

function setLatestLocation(target: Map<string, InstructorLiveLocationRow>, location: InstructorLiveLocationRow) {
  const existing = target.get(location.instructor_id);
  if (!existing || new Date(location.recorded_at).getTime() > new Date(existing.recorded_at).getTime()) {
    target.set(location.instructor_id, location);
  }
}

function locationIsFresh(location: InstructorLiveLocationRow, nowMs: number) {
  if (location.is_active === false) return false;

  const recordedAtMs = new Date(location.recorded_at).getTime();
  if (!Number.isFinite(recordedAtMs) || nowMs - recordedAtMs > activeDriverLiveWindowMs) {
    return false;
  }

  if (location.expires_at && new Date(location.expires_at).getTime() <= nowMs) {
    return false;
  }

  return true;
}

function staleReason(location: InstructorLiveLocationRow | undefined, nowMs: number): AdminStaleSignedOnInstructor["reason"] {
  if (!location) return "missing_ping";
  if (location.expires_at && new Date(location.expires_at).getTime() <= nowMs) return "expired_ping";
  const recordedAtMs = new Date(location.recorded_at).getTime();
  if (!Number.isFinite(recordedAtMs) || nowMs - recordedAtMs > activeDriverLiveWindowMs) return "stale_ping";
  if (typeof location.accuracy_meters === "number" && location.accuracy_meters > 1) return "low_accuracy";
  return "stale_ping";
}

async function readLatestWorkLocationRows(client: SupabaseClient, instructorIds: string[], sinceIso: string) {
  if (!instructorIds.length) {
    return { rows: [] as InstructorLiveLocationRow[], error: null as string | null };
  }

  const selectWithLatestColumns =
    "id,instructor_id,latitude,longitude,accuracy_meters,heading_degrees,speed_mps,client_recorded_at,source,recorded_at,expires_at,is_active";
  const query = client
    .from("instructor_live_locations")
    .select(selectWithLatestColumns)
    .in("instructor_id", instructorIds)
    .gte("recorded_at", sinceIso)
    .order("recorded_at", { ascending: false })
    .limit(1000);
  const result = await query;

  if (!result.error) {
    return { rows: asRows<InstructorLiveLocationRow>(result.data), error: null };
  }

  if (!isMissingLiveGpsColumnError(result.error)) {
    return { rows: [] as InstructorLiveLocationRow[], error: result.error.message };
  }

  const fallback = await client
    .from("instructor_live_locations")
    .select("id,instructor_id,latitude,longitude,accuracy_meters,source,recorded_at,expires_at")
    .in("instructor_id", instructorIds)
    .gte("recorded_at", sinceIso)
    .order("recorded_at", { ascending: false })
    .limit(1000);

  return {
    rows: asRows<InstructorLiveLocationRow>(fallback.data),
    error: fallback.error ? fallback.error.message : "Live GPS metadata migration has not been applied yet."
  };
}

async function readSafetyEvents(client: SupabaseClient, instructorIds: string[]) {
  if (!instructorIds.length) return new Map<string, SafetyEventRow>();

  const { data, error } = await client
    .from("instructor_safety_events")
    .select("instructor_id,event_type,severity,status")
    .in("instructor_id", instructorIds)
    .in("status", ["open", "investigating", "monitoring"])
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return new Map<string, SafetyEventRow>();

  const events = new Map<string, SafetyEventRow>();
  for (const event of asRows<SafetyEventRow>(data)) {
    if (!events.has(event.instructor_id)) events.set(event.instructor_id, event);
  }
  return events;
}

export async function readAdminActiveDriverLocations(
  client: SupabaseClient,
  now = new Date()
): Promise<AdminActiveDriverLocationPayload> {
  const nowMs = now.getTime();
  const nowIso = now.toISOString();
  const recentSinceIso = new Date(nowMs - staleSignedOnWarningWindowMs).toISOString();
  const errors: string[] = [];

  const activeSlotResult = await client
    .from("availability_slots")
    .select("instructor_id")
    .eq("is_booked", false)
    .lte("starts_at", nowIso)
    .gt("ends_at", nowIso)
    .limit(1000);

  if (activeSlotResult.error) {
    return {
      drivers: [],
      staleSignedOnInstructors: [],
      generatedAt: nowIso,
      liveWindowSeconds: activeDriverLiveWindowMs / 1000,
      errors: [activeSlotResult.error.message]
    };
  }

  const activeInstructorIds = [...new Set(asRows<ActiveSlotRow>(activeSlotResult.data).map((slot) => slot.instructor_id).filter(Boolean))];
  const { rows: locationRows, error: locationError } = await readLatestWorkLocationRows(client, activeInstructorIds, recentSinceIso);
  if (locationError) errors.push(locationError);

  const latestLocationByInstructor = new Map<string, InstructorLiveLocationRow>();
  for (const row of locationRows) {
    if (typeof row.latitude !== "number" || typeof row.longitude !== "number") continue;
    setLatestLocation(latestLocationByInstructor, row);
  }

  const [profilesResult, instructorsResult, safetyEvents] = await Promise.all([
    activeInstructorIds.length ? client.from("profiles").select("id,full_name,email,phone").in("id", activeInstructorIds) : Promise.resolve({ data: [] }),
    activeInstructorIds.length ? client.from("instructor_profiles").select("user_id,display_name,car_make,car_model,car_registration").in("user_id", activeInstructorIds) : Promise.resolve({ data: [] }),
    readSafetyEvents(client, activeInstructorIds)
  ]);

  if ("error" in profilesResult && profilesResult.error) errors.push(profilesResult.error.message);
  if ("error" in instructorsResult && instructorsResult.error) errors.push(instructorsResult.error.message);

  const profileById = new Map(asRows<ProfileRow>(profilesResult.data).map((profile) => [profile.id, profile]));
  const instructorById = new Map(asRows<InstructorRow>(instructorsResult.data).map((instructor) => [instructor.user_id, instructor]));

  const drivers: AdminActiveDriver[] = [];
  const staleSignedOnInstructors: AdminStaleSignedOnInstructor[] = [];

  for (const instructorId of activeInstructorIds) {
    const profile = profileById.get(instructorId);
    const instructor = instructorById.get(instructorId);
    const name = instructor?.display_name || profile?.full_name || profile?.email || "Unnamed instructor";
    const latestLocation = latestLocationByInstructor.get(instructorId);

    if (!latestLocation || !locationIsFresh(latestLocation, nowMs)) {
      staleSignedOnInstructors.push({
        id: instructorId,
        name,
        email: profile?.email ?? null,
        lastUpdate: latestLocation?.recorded_at ?? null,
        accuracyMeters: latestLocation?.accuracy_meters ?? null,
        reason: staleReason(latestLocation, nowMs)
      });
      continue;
    }

    const safetyEvent = safetyEvents.get(instructorId);

    drivers.push({
      id: instructorId,
      name,
      email: profile?.email ?? null,
      phone: profile?.phone ?? null,
      source: latestLocation.source,
      latitude: latestLocation.latitude,
      longitude: latestLocation.longitude,
      accuracyMeters: latestLocation.accuracy_meters,
      emergencyGrade: typeof latestLocation.accuracy_meters === "number" && latestLocation.accuracy_meters <= 1,
      headingDegrees: latestLocation.heading_degrees ?? null,
      speedMps: latestLocation.speed_mps ?? null,
      clientRecordedAt: latestLocation.client_recorded_at ?? null,
      recordedAt: latestLocation.recorded_at,
      expiresAt: latestLocation.expires_at,
      emergencyStatus: safetyEvent ? `${safetyEvent.severity ?? "Safety"} ${safetyEvent.event_type ?? "event"}` : null,
      vehicle: buildVehicle(instructor)
    });
  }

  drivers.sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
  staleSignedOnInstructors.sort((a, b) => {
    const aTime = a.lastUpdate ? new Date(a.lastUpdate).getTime() : 0;
    const bTime = b.lastUpdate ? new Date(b.lastUpdate).getTime() : 0;
    return bTime - aTime;
  });

  return {
    drivers,
    staleSignedOnInstructors,
    generatedAt: nowIso,
    liveWindowSeconds: activeDriverLiveWindowMs / 1000,
    errors
  };
}
