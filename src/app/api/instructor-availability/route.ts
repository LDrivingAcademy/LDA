import { canUseMarketplaceRole, getMarketplaceRoleState } from "@/lib/account-route-guard";
import { isRateLimited, jsonNoStore, rateLimitResponse, readJsonBody, safeText } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { InstructorFinanceProfile } from "@/lib/instructor-finance-profile";
import { getInstructorSetupReadiness, instructorSetupPauseReason } from "@/lib/instructor-setup-readiness";
import {
  getInstructorFutureComplianceBlockMessage,
  getInstructorFutureComplianceStatus,
  readInstructorFutureComplianceDocuments
} from "@/lib/instructor-future-compliance";
import {
  flattenInstructorVerificationRequirements,
  getInstructorVerificationRequirements
} from "@/lib/instructor-verification-requirements";
import { getCurrentTermsStatus } from "@/lib/terms-acceptance";
import { CURRENT_TERMS_MESSAGE } from "@/lib/terms-version";
import { shouldBypassInstructorAvailabilityPauseForTest } from "@/lib/test-instructor-visibility";

type InstructorAvailabilityRequest = {
  action?: "add_slot" | "remove_slot" | "start_work" | "end_work" | "log_on" | "log_off";
  slotId?: string;
  date?: string;
  start?: string;
  end?: string;
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isIsoDay(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isClockTime(value: string) {
  return /^\d{2}:\d{2}$/.test(value);
}

function londonDateTimeToUtc(date: string, time: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(utcGuess);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const londonAsUtc = Date.UTC(value("year"), value("month") - 1, value("day"), value("hour"), value("minute"), value("second"));
  const offsetMs = londonAsUtc - utcGuess.getTime();

  return new Date(Date.UTC(year, month - 1, day, hour, minute, 0) - offsetMs);
}

function londonEndOfDay(now = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const date = formatter.format(now);
  return londonDateTimeToUtc(date, "23:59");
}

async function assertApprovedAvailableInstructor(supabase: any, userId: string) {
  const { data: accountProfile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle();
  const bypassPausedAvailability = shouldBypassInstructorAvailabilityPauseForTest(accountProfile?.email);

  if (bypassPausedAvailability) {
    return { ok: true };
  }

  const { data: profile, error } = await supabase
    .from("instructor_profiles")
    .select("verification_status,compliance_status,learner_availability_paused,learner_availability_pause_reason")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !profile) {
    return { ok: false, status: 403, error: "LDA could not confirm your instructor profile." };
  }

  if (
    profile.verification_status !== "approved" ||
    (profile.compliance_status && profile.compliance_status !== "clear") ||
    profile.learner_availability_paused
  ) {
    return {
      ok: false,
      status: 403,
      error:
        safeText(profile.learner_availability_pause_reason, "", 180) ||
        "Your instructor profile is not currently cleared for learner-facing availability."
    };
  }

  return { ok: true };
}

async function assertApprovedInstructorCanControlWorkState(
  supabase: any,
  userId: string,
  options: { requireSetupComplete: boolean }
) {
  const { data: accountProfile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle();
  const bypassPausedAvailability = shouldBypassInstructorAvailabilityPauseForTest(accountProfile?.email);

  if (bypassPausedAvailability) {
    return { ok: true };
  }

  const { data: profile, error } = await supabase
    .from("instructor_profiles")
    .select("verification_status,compliance_status,hourly_rate_pence,base_postcode,areas_covered,transmission,car_make,car_model,stripe_account_id,learner_availability_paused,learner_availability_pause_reason")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !profile) {
    return { ok: false, status: 403, error: "LDA could not confirm your instructor profile." };
  }

  if (profile.verification_status !== "approved" || (profile.compliance_status && profile.compliance_status !== "clear")) {
    return { ok: false, status: 403, error: "Your instructor profile is not currently cleared for learner-facing availability." };
  }

  if (!options.requireSetupComplete) {
    return { ok: true };
  }

  if (bypassPausedAvailability) {
    return { ok: true };
  }

  const authUserResult = await supabase.auth.admin.getUserById(userId);
  const finance = (authUserResult.data?.user?.user_metadata?.lda_instructor_finance ?? {}) as InstructorFinanceProfile;
  const readiness = getInstructorSetupReadiness(profile, finance);

  if (!readiness.complete || (profile.learner_availability_paused && profile.learner_availability_pause_reason === instructorSetupPauseReason)) {
    return {
      ok: false,
      status: 403,
      error: "Complete your approved instructor setup before learner-facing availability goes live."
    };
  }

  return { ok: true };
}

async function hasOverlappingAvailability(supabase: any, instructorId: string, startsAt: string, endsAt: string, excludeSlotId?: string) {
  let query = supabase
    .from("availability_slots")
    .select("id")
    .eq("instructor_id", instructorId)
    .eq("is_booked", false)
    .lt("starts_at", endsAt)
    .gt("ends_at", startsAt)
    .limit(1);

  if (excludeSlotId) {
    query = query.neq("id", excludeSlotId);
  }

  const { data, error } = await query;
  if (error) {
    console.warn("[instructor-availability] overlap lookup failed", {
      instructorId,
      message: error.message
    });
    return false;
  }

  return Boolean(data?.length);
}

async function expireInstructorLiveLocations(supabase: any, instructorId: string) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("instructor_live_locations")
    .update({ expires_at: now, is_active: false })
    .eq("instructor_id", instructorId)
    .gt("expires_at", now);

  if (error) {
    const message = String(error.message ?? "");
    if (error.code === "42703" || /column .*does not exist|schema cache/i.test(message)) {
      const fallback = await supabase
        .from("instructor_live_locations")
        .update({ expires_at: now })
        .eq("instructor_id", instructorId)
        .gt("expires_at", now);

      if (!fallback.error) return;
    }

    console.warn("[instructor-availability] live location expiry failed", { instructorId, message });
  }
}

export async function POST(request: Request) {
  if (isRateLimited(request, "instructor-availability", 40)) {
    return rateLimitResponse();
  }

  const input = await readJsonBody<InstructorAvailabilityRequest>(request);
  const action = input?.action;

  const signedInSupabase = await createClient();
  if (!signedInSupabase) {
    return jsonNoStore({ error: "Authentication is not configured." }, { status: 503 });
  }

  const {
    data: { user }
  } = await signedInSupabase.auth.getUser();

  if (!user) {
    return jsonNoStore({ error: "Sign in as an instructor first." }, { status: 401 });
  }

  const roleState = await getMarketplaceRoleState(signedInSupabase, user.id);
  if (!canUseMarketplaceRole(roleState, "instructor")) {
    return jsonNoStore({ error: "Use an approved instructor account to manage availability." }, { status: 403 });
  }

  const termsStatus = await getCurrentTermsStatus(signedInSupabase, user.id);
  if (!termsStatus.accepted) {
    return jsonNoStore({ error: CURRENT_TERMS_MESSAGE }, { status: 403 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return jsonNoStore({ error: "Instructor availability is temporarily unavailable." }, { status: 503 });
  }

  const approval = action === "log_on" || action === "log_off"
    ? await assertApprovedInstructorCanControlWorkState(supabase, user.id, { requireSetupComplete: action === "log_on" })
    : await assertApprovedAvailableInstructor(supabase, user.id);
  if (!approval.ok) {
    return jsonNoStore({ error: approval.error }, { status: approval.status });
  }

  if (action === "log_off") {
    const now = new Date();
    const { error: slotError } = await supabase
      .from("availability_slots")
      .update({ ends_at: now.toISOString() })
      .eq("instructor_id", user.id)
      .eq("is_booked", false)
      .lte("starts_at", now.toISOString())
      .gt("ends_at", now.toISOString());

    if (slotError) {
      return jsonNoStore({ error: slotError.message }, { status: 409 });
    }

    await expireInstructorLiveLocations(supabase, user.id);

    return jsonNoStore({
      ok: true,
      isLive: false,
      availabilityPaused: false,
      message: "You are now logged off. You will no longer receive work."
    });
  }

  if (action === "remove_slot") {
    const slotId = safeText(input?.slotId, "", 80);
    if (!isUuid(slotId)) {
      return jsonNoStore({ error: "A valid availability slot is required." }, { status: 400 });
    }

    const { error } = await supabase
      .from("availability_slots")
      .delete()
      .eq("id", slotId)
      .eq("instructor_id", user.id)
      .eq("is_booked", false);

    if (error) {
      return jsonNoStore({ error: error.message }, { status: 409 });
    }

    return jsonNoStore({ ok: true, message: "Availability slot removed." });
  }

  if (action === "end_work") {
    const now = new Date();
    const { error } = await supabase
      .from("availability_slots")
      .update({ ends_at: now.toISOString() })
      .eq("instructor_id", user.id)
      .eq("is_booked", false)
      .lte("starts_at", now.toISOString())
      .gt("ends_at", now.toISOString());

    if (error) {
      return jsonNoStore({ error: error.message }, { status: 409 });
    }

    await expireInstructorLiveLocations(supabase, user.id);

    return jsonNoStore({ ok: true, message: "Working day ended. You are no longer live for on-demand matching." });
  }

  let startsAt: Date;
  let endsAt: Date;

  if (action === "start_work" || action === "log_on") {
    startsAt = new Date();
    endsAt = londonEndOfDay(startsAt);
    if (endsAt.getTime() - startsAt.getTime() < 30 * 60 * 1000) {
      endsAt = new Date(startsAt.getTime() + 2 * 60 * 60 * 1000);
    }
  } else if (action === "add_slot") {
    const date = safeText(input?.date, "", 20);
    const start = safeText(input?.start, "", 10);
    const end = safeText(input?.end, "", 10);

    if (!isIsoDay(date) || !isClockTime(start) || !isClockTime(end)) {
      return jsonNoStore({ error: "Choose a valid date, start time, and end time." }, { status: 400 });
    }

    startsAt = londonDateTimeToUtc(date, start);
    endsAt = londonDateTimeToUtc(date, end);
  } else {
    return jsonNoStore({ error: "Unsupported availability action." }, { status: 400 });
  }

  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
    return jsonNoStore({ error: "Availability end time must be after the start time." }, { status: 400 });
  }

  if (endsAt <= new Date()) {
    return jsonNoStore({ error: "Availability must end in the future." }, { status: 400 });
  }

  const startsIso = startsAt.toISOString();
  const endsIso = endsAt.toISOString();

  const requirementSections = await getInstructorVerificationRequirements(supabase);
  const requiredDocumentTypes = flattenInstructorVerificationRequirements(requirementSections)
    .filter((document) => document.requirement === "required")
    .map((document) => document.type);
  const documentsByInstructor = await readInstructorFutureComplianceDocuments(supabase, [user.id]);
  const futureCompliance = getInstructorFutureComplianceStatus(
    documentsByInstructor.get(user.id) ?? [],
    requiredDocumentTypes,
    endsAt
  );

  if (!futureCompliance.ok) {
    return jsonNoStore({ error: getInstructorFutureComplianceBlockMessage(futureCompliance) }, { status: 409 });
  }

  if (await hasOverlappingAvailability(supabase, user.id, startsIso, endsIso)) {
    if (action === "log_on") {
      const { error: profileError } = await supabase
        .from("instructor_profiles")
        .update({
          learner_availability_paused: false,
          learner_availability_pause_reason: null,
          updated_at: new Date().toISOString()
        })
        .eq("user_id", user.id);

      if (profileError) {
        return jsonNoStore({ error: profileError.message }, { status: 409 });
      }

      return jsonNoStore({
        ok: true,
        isLive: true,
        availabilityPaused: false,
        message: "You are now logged on. Live location is active while you are working."
      });
    }

    return jsonNoStore({ error: "This availability overlaps an existing open slot." }, { status: 409 });
  }

  const { data: slot, error } = await supabase
    .from("availability_slots")
    .insert({
      instructor_id: user.id,
      starts_at: startsIso,
      ends_at: endsIso,
      is_booked: false
    })
    .select("id,starts_at,ends_at,is_booked")
    .maybeSingle();

  if (error || !slot) {
    return jsonNoStore({ error: error?.message ?? "Availability could not be saved." }, { status: 409 });
  }

  if (action === "log_on") {
    const { error: profileError } = await supabase
      .from("instructor_profiles")
      .update({
        learner_availability_paused: false,
        learner_availability_pause_reason: null,
        updated_at: new Date().toISOString()
      })
      .eq("user_id", user.id);

    if (profileError) {
      return jsonNoStore({ error: profileError.message }, { status: 409 });
    }
  }

  return jsonNoStore({
    ok: true,
    isLive: action === "start_work" || action === "log_on" ? true : undefined,
    availabilityPaused: action === "log_on" ? false : undefined,
    message: action === "start_work" || action === "log_on" ? "You are now logged on. Live location is active while you are working." : "Availability slot saved.",
    slot
  });
}
