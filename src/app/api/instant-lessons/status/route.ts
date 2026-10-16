import { sendBookingConfirmationEmails } from "@/lib/email";
import { demoInstructors } from "@/lib/marketplace-content";
import { isRateLimited, jsonNoStore, rateLimitResponse, safeEmail, safeText } from "@/lib/security";
import { getStripeRuntimeMode, getStripeSecretKey } from "@/lib/stripe-env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { canUseMarketplaceRole, getMarketplaceRoleState } from "@/lib/account-route-guard";
import { getLdaTestInstructorEmail, restrictToLdaTestInstructorEmail } from "@/lib/lda-demo-accounts";
import { shouldBypassInstructorAvailabilityPauseForTest } from "@/lib/test-instructor-visibility";
import { preserveSmartMatchLessonNote } from "@/lib/smart-match-handoff";

const assignAfterMs = 8_000;
const enRouteAfterAcceptedMs = 10_000;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const protectedPaymentStatuses = new Set(["refunded", "refund_pending", "refund_requested", "disputed"]);

const instantPickupPoint = {
  lat: 51.6523,
  lng: -0.1995
};

const instantInstructorPoint = {
  lat: 51.6152,
  lng: -0.1765
};

type InstantInstructorLivePoint = {
  point: Pick<typeof instantInstructorPoint, "lat" | "lng"> | null;
  recordedAt: string | null;
  accuracyMeters: number | null;
  headingDegrees: number | null;
  speedMps: number | null;
};

const emptyInstantInstructorLivePoint: InstantInstructorLivePoint = {
  point: null,
  recordedAt: null,
  accuracyMeters: null,
  headingDegrees: null,
  speedMps: null
};

function canAutoAssign() {
  return process.env.LDA_ON_DEMAND_AUTO_ASSIGN !== "0" && process.env.LDA_ON_DEMAND_AUTO_ASSIGN !== "false";
}

async function assertInstantStatusAccess(record: Record<string, any>, reference: string, sessionId: string) {
  const learnerId = safeText(record.learner_id, "", 120);
  const supabase = await createClient();
  const {
    data: { user }
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

  if (learnerId) {
    if (!supabase || !user) {
      return { ok: false, status: 401, error: "Sign in to view this on-demand lesson." };
    }

    const roleState = await getMarketplaceRoleState(supabase, user.id);
    if (!canUseMarketplaceRole(roleState, "learner") || user.id !== learnerId) {
      return { ok: false, status: 403, error: "This on-demand lesson is not available on this account." };
    }

    return { ok: true };
  }

  if (user && supabase) {
    const roleState = await getMarketplaceRoleState(supabase, user.id);
    if (!canUseMarketplaceRole(roleState, "learner")) {
      return { ok: false, status: 403, error: "Use a learner account to view an on-demand lesson." };
    }
  }

  if (!sessionId) {
    return { ok: false, status: 403, error: "Payment confirmation is required to view this guest on-demand lesson." };
  }

  const sessionCheck = await verifyPaidSession(sessionId, reference);
  if (!sessionCheck.session) {
    return { ok: false, status: 403, error: sessionCheck.error ?? "Payment confirmation could not be verified for this lesson." };
  }

  return { ok: true };
}

function preferredOnDemandInstructorEmail() {
  const configuredEmail = restrictToLdaTestInstructorEmail(
    process.env.LDA_ON_DEMAND_INSTRUCTOR_EMAIL || process.env.LDA_DEMO_INSTRUCTOR_EMAIL
  );

  return safeEmail(
    configuredEmail || (getStripeRuntimeMode() !== "live" ? getLdaTestInstructorEmail() : "")
  );
}

function normaliseTransmissionPreference(value?: string | null): "automatic" | "manual" {
  return String(value ?? "").trim().toLowerCase() === "manual" ? "manual" : "automatic";
}

function inferTransmissionPreference(
  record?: Record<string, any> | null,
  session?: Record<string, any> | null
): "automatic" | "manual" {
  const metadataPreference = safeText(session?.metadata?.transmission, "", 20);
  if (metadataPreference) {
    return normaliseTransmissionPreference(metadataPreference);
  }

  const summary = safeText(record?.lesson_summary, "", 500).toLowerCase();
  if (summary.includes("requested transmission: manual")) {
    return "manual";
  }
  if (summary.includes("requested transmission: automatic")) {
    return "automatic";
  }

  return "automatic";
}

function transmissionMatches(instructorTransmission: unknown, preference: "automatic" | "manual") {
  const normalised = String(instructorTransmission ?? "").trim().toLowerCase();
  return normalised === preference || normalised === "both";
}

function smartMatchRequirementsFromRecord(record?: Record<string, any> | null) {
  const summary = safeText(record?.lesson_summary, "", 1200).toLowerCase();
  const marker = "accessibility and learning preferences attached:";
  const start = summary.indexOf(marker);
  if (start === -1) return [];

  const afterMarker = summary.slice(start + marker.length);
  const sentence = afterMarker.split(".")[0] ?? "";
  return sentence
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function smartMatchCandidateScore(candidate: any, requirements: string[]) {
  if (!requirements.length) return 0;

  const teachingStyles = Array.isArray(candidate.smart_match_teaching_styles) ? candidate.smart_match_teaching_styles : [];
  const specialisms = Array.isArray(candidate.smart_match_specialisms) ? candidate.smart_match_specialisms : [];
  const profileText = [
    candidate.display_name,
    candidate.car_make,
    candidate.car_model,
    candidate.transmission,
    candidate.smart_match_inclusive_enabled ? "inclusive learning accessibility support" : "",
    ...teachingStyles,
    ...specialisms
  ]
    .join(" ")
    .toLowerCase();

  return requirements.reduce((score, requirement) => {
    const words = requirement.split(/\W+/).filter((word) => word.length > 2);
    return score + words.filter((word) => profileText.includes(word)).length;
  }, candidate.smart_match_inclusive_enabled ? 2 : 0);
}

async function getActiveOnDemandInstructorIds(supabase: any) {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("availability_slots")
    .select("instructor_id")
    .eq("is_booked", false)
    .lte("starts_at", nowIso)
    .gt("ends_at", nowIso)
    .limit(100);

  if (error) {
    if (!isMissingRelationLookupError(error)) {
      logBookingStoreError("active on-demand availability lookup", "on-demand", error);
    }
    return [];
  }

  return Array.from(new Set((data ?? []).map((row: { instructor_id?: string | null }) => safeText(row.instructor_id, "", 120)).filter(Boolean)));
}

async function verifyPaidSession(sessionId: string, expectedReference: string) {
  const stripeSecret = getStripeSecretKey();
  if (!stripeSecret.value) {
    return process.env.NODE_ENV === "production"
      ? { paid: false, error: "Payment confirmation is temporarily unavailable." }
      : { paid: true, paymentIntentId: "" };
  }

  const url = new URL(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`);
  url.searchParams.set("expand[]", "payment_intent");

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${stripeSecret.value}`
    }
  });
  const session = await response.json();

  if (!response.ok) {
    return { paid: false, error: "Payment confirmation could not be verified." };
  }

  if (session.metadata?.booking_reference && session.metadata.booking_reference !== expectedReference) {
    return { paid: false, error: "Payment confirmation does not match this booking reference." };
  }

  return {
    paid: session.payment_status === "paid",
    paymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? "",
    session
  };
}

function logBookingStoreError(action: string, reference: string, error: { code?: string; message?: string; details?: string; hint?: string }) {
  console.error(`[instant-lessons.status] ${action} failed`, {
    bookingReference: reference,
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint
  });
}

function isMissingColumnLookupError(error: unknown) {
  const candidate = error as { code?: string; message?: string } | null;
  return candidate?.code === "42703" || /column .* does not exist/i.test(candidate?.message ?? "");
}

function isMissingLiveLocationMetadataColumn(error: unknown) {
  const candidate = error as { message?: string } | null;
  return isMissingColumnLookupError(error) && /accuracy_meters|heading_degrees|speed_mps|client_recorded_at/i.test(candidate?.message ?? "");
}

function isMissingRelationLookupError(error: unknown) {
  const candidate = error as { code?: string; message?: string } | null;
  return candidate?.code === "42P01" || /relation .* does not exist/i.test(candidate?.message ?? "");
}

async function resolveAssignableInstructor(
  supabase: any,
  transmissionPreference: "automatic" | "manual" = "automatic",
  excludedInstructorIds: string[] = [],
  record?: Record<string, any> | null
) {
  const fallback =
    demoInstructors.find((instructor) => instructor.transmission === transmissionPreference) ??
    demoInstructors[0];
  const fallbackInstructor = {
    id: fallback?.name === "Marcus Reed" ? "instant-demo-marcus-reed" : fallback?.name === "Priya Shah" ? "instant-demo-priya-shah" : "instant-demo-amelia-khan",
    name: fallback?.name ?? "LDA instructor",
    email: "instructor@ldrivingacademy.co.uk",
    car: fallback?.car ?? null,
    autoAccept: true,
    isLiveInstructor: false
  };
  const preferredEmail = preferredOnDemandInstructorEmail();
  const activeInstructorIds = await getActiveOnDemandInstructorIds(supabase);

  if (!activeInstructorIds.length && getStripeRuntimeMode() === "live") {
    return null;
  }

  if (preferredEmail) {
    const { data: preferredProfile, error: preferredProfileError } = await supabase
      .from("profiles")
      .select("id,email")
      .ilike("email", preferredEmail)
      .maybeSingle();

    if (!preferredProfileError && preferredProfile?.id && uuidPattern.test(String(preferredProfile.id))) {
      const preferredInstructorLookup = await supabase
        .from("instructor_profiles")
        .select("user_id,display_name,car_make,car_model,transmission,verification_status,compliance_status,learner_availability_paused,auto_accept_bookings,smart_match_inclusive_enabled,smart_match_teaching_styles,smart_match_specialisms")
        .eq("user_id", preferredProfile.id)
        .maybeSingle();

      const preferredFallbackLookup =
        preferredInstructorLookup.error && isMissingColumnLookupError(preferredInstructorLookup.error)
          ? await supabase
              .from("instructor_profiles")
              .select("user_id,display_name,car_make,car_model,verification_status")
              .eq("user_id", preferredProfile.id)
              .maybeSingle()
          : null;

      const preferredInstructor = preferredFallbackLookup ? preferredFallbackLookup.data : preferredInstructorLookup.data;
      const preferredError = preferredFallbackLookup ? preferredFallbackLookup.error : preferredInstructorLookup.error;
      const bypassPausedAvailability = shouldBypassInstructorAvailabilityPauseForTest(preferredProfile.email);
      const preferredInstructorCleared =
        bypassPausedAvailability ||
        (preferredInstructor?.verification_status === "approved" &&
          (!preferredInstructor.compliance_status || preferredInstructor.compliance_status === "clear") &&
          !preferredInstructor.learner_availability_paused);

      if (
        !preferredError &&
        preferredInstructor?.user_id &&
        uuidPattern.test(String(preferredInstructor.user_id)) &&
        !excludedInstructorIds.includes(String(preferredInstructor.user_id)) &&
        activeInstructorIds.includes(String(preferredInstructor.user_id)) &&
        preferredInstructorCleared &&
        transmissionMatches(preferredInstructor.transmission, transmissionPreference)
      ) {
        const car = [safeText(preferredInstructor.car_make, "", 60), safeText(preferredInstructor.car_model, "", 80)]
          .filter(Boolean)
          .join(" ");

        return {
          id: String(preferredInstructor.user_id),
          name: safeText(preferredInstructor.display_name, "LDA instructor", 120),
          email: safeEmail(preferredProfile.email),
          car: car || fallbackInstructor.car,
          autoAccept: preferredInstructor.auto_accept_bookings === true,
          isLiveInstructor: true
        };
      }
    }
  }

  const primaryInstructorLookup = activeInstructorIds.length
    ? await supabase
    .from("instructor_profiles")
    .select("user_id,display_name,car_make,car_model,transmission,verification_status,compliance_status,learner_availability_paused,auto_accept_bookings,smart_match_inclusive_enabled,smart_match_teaching_styles,smart_match_specialisms")
    .eq("verification_status", "approved")
    .eq("compliance_status", "clear")
    .eq("learner_availability_paused", false)
    .in("user_id", activeInstructorIds)
    .in("transmission", [transmissionPreference, "both"])
    .limit(12)
    : { data: [], error: null };

  const fallbackInstructorLookup =
    primaryInstructorLookup.error && isMissingColumnLookupError(primaryInstructorLookup.error)
      ? await supabase
          .from("instructor_profiles")
          .select("user_id,display_name,car_make,car_model,verification_status")
          .eq("verification_status", "approved")
          .limit(1)
          .maybeSingle()
      : null;

  const smartMatchRequirements = smartMatchRequirementsFromRecord(record);
  const rankedPrimaryCandidates = [...(primaryInstructorLookup.data ?? [])].sort(
    (a, b) => smartMatchCandidateScore(b, smartMatchRequirements) - smartMatchCandidateScore(a, smartMatchRequirements)
  );
  let instructorProfile = fallbackInstructorLookup
    ? fallbackInstructorLookup.data
    : rankedPrimaryCandidates.find((candidate: any) => !excludedInstructorIds.includes(String(candidate.user_id)));
  let error = fallbackInstructorLookup ? fallbackInstructorLookup.error : primaryInstructorLookup.error;

  if (!fallbackInstructorLookup && !error && !instructorProfile) {
    const anyAvailableInstructorLookup = activeInstructorIds.length
      ? await supabase
      .from("instructor_profiles")
      .select("user_id,display_name,car_make,car_model,transmission,verification_status,compliance_status,learner_availability_paused,auto_accept_bookings,smart_match_inclusive_enabled,smart_match_teaching_styles,smart_match_specialisms")
      .eq("verification_status", "approved")
      .eq("compliance_status", "clear")
      .eq("learner_availability_paused", false)
      .in("user_id", activeInstructorIds)
      .in("transmission", [transmissionPreference, "both"])
      .limit(12)
      : { data: [], error: null };

    instructorProfile = [...(anyAvailableInstructorLookup.data ?? [])]
      .sort((a, b) => smartMatchCandidateScore(b, smartMatchRequirements) - smartMatchCandidateScore(a, smartMatchRequirements))
      .find((candidate: any) => !excludedInstructorIds.includes(String(candidate.user_id)));
    error = anyAvailableInstructorLookup.error;
  }

  if (error || !instructorProfile?.user_id || !uuidPattern.test(String(instructorProfile.user_id))) {
    if (error) logBookingStoreError("live instructor lookup", "on-demand", error);
    if (getStripeRuntimeMode() === "live") {
      return null;
    }
    return fallbackInstructor;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", instructorProfile.user_id)
    .maybeSingle();

  const car = [safeText(instructorProfile.car_make, "", 60), safeText(instructorProfile.car_model, "", 80)]
    .filter(Boolean)
    .join(" ");

  return {
    id: String(instructorProfile.user_id),
    name: safeText(instructorProfile.display_name, "LDA instructor", 120),
    email: safeEmail(profile?.email),
    car: car || fallbackInstructor.car,
    autoAccept: instructorProfile.auto_accept_bookings === true,
    isLiveInstructor: true
  };
}

async function repairGenericInstantInstructor(supabase: any, currentRecord: any, reference: string, request: Request) {
  const currentInstructorId = safeText(currentRecord.instructor_id, "", 120);
  const currentInstructorEmail = safeEmail(currentRecord.instructor_email);
  const isGenericInstructor =
    !uuidPattern.test(currentInstructorId) ||
    currentInstructorEmail === "instructor@ldrivingacademy.co.uk" ||
    currentInstructorId === "instant-demo-amelia-khan";

  if (!isGenericInstructor || currentRecord.payment_status !== "paid") {
    return currentRecord;
  }

  const transmissionPreference = inferTransmissionPreference(currentRecord);
  const instructor = await resolveAssignableInstructor(supabase, transmissionPreference, [], currentRecord);
  if (!instructor || !uuidPattern.test(instructor.id) || instructor.id === currentInstructorId) {
    return currentRecord;
  }

  const { data: repairedRecord, error: repairError } = await supabase
    .from("lesson_booking_records")
    .update({
      instructor_id: instructor.id,
      instructor_name: instructor.name,
      instructor_email: instructor.email,
      car: instructor.car,
      lesson_summary: preserveSmartMatchLessonNote(
        `On-demand LDA ${transmissionPreference} lesson accepted by ${instructor.name}. Your instructor is preparing to travel to your pickup point.`,
        currentRecord.lesson_summary
      )
    })
    .eq("booking_reference", reference)
    .select("*")
    .maybeSingle();

  if (repairError) {
    logBookingStoreError("generic instant assignment repair", reference, repairError);
    return currentRecord;
  }

  const nextRecord = repairedRecord ?? currentRecord;
  await notifyInstantAssignment(supabase, nextRecord, reference, request);
  return nextRecord;
}

async function notifyInstantAssignment(supabase: any, record: any, reference: string, request: Request) {
  const instructorId = safeText(record.instructor_id, "", 120);
  const instructorEmail = safeEmail(record.instructor_email);
  const learnerId = safeText(record.learner_id, "", 120);
  const learnerLabel = safeEmail(record.learner_email) || "A guest learner";
  const pickup = safeText(record.pickup_postcode, "On-demand pickup", 120);

  const notificationRows = [];

  if (uuidPattern.test(instructorId)) {
    notificationRows.push({
      user_id: instructorId,
      booking_id: null,
      title: "New on-demand LDA booking",
      body: `${learnerLabel} booked an on-demand lesson. Pickup: ${pickup}. Reference: ${reference}.`,
      notification_type: "instant_booking_assigned"
    });
  }

  if (uuidPattern.test(learnerId)) {
    notificationRows.push({
      user_id: learnerId,
      booking_id: null,
      title: "On-demand LDA lesson accepted",
      body: `${record.instructor_name || "Your instructor"} accepted your on-demand lesson. Reference: ${reference}.`,
      notification_type: "instant_booking_accepted"
    });
  }

  if (notificationRows.length) {
    const { error } = await supabase.from("notifications").insert(notificationRows);
    if (error) logBookingStoreError("instant assignment notifications", reference, error);
  }

  if (instructorEmail) {
    const origin = new URL(request.url).origin || process.env.NEXT_PUBLIC_APP_URL || "https://ldrivingacademy.co.uk";
    await sendBookingConfirmationEmails({
      bookingReference: reference,
      learnerEmail: "",
      instructorEmail,
      instructorName: safeText(record.instructor_name, "LDA instructor", 120),
      lessonSummary: safeText(record.lesson_summary, "New on-demand LDA lesson booking.", 180),
      manageUrl: `${origin}/instructor-calendar`
    });
  }
}

async function notifyInstantOffer(supabase: any, record: any, reference: string, request: Request) {
  const instructorId = safeText(record.instructor_id, "", 120);
  const instructorEmail = safeEmail(record.instructor_email);
  const learnerLabel = safeEmail(record.learner_email) || "A guest learner";
  const pickup = safeText(record.pickup_postcode, "On-demand pickup", 120);

  if (uuidPattern.test(instructorId)) {
    const { error } = await supabase.from("notifications").insert({
      user_id: instructorId,
      booking_id: null,
      title: "On-demand booking request",
      body: `${learnerLabel} is waiting for an on-demand lesson. Accept or decline from your instructor dashboard. Pickup: ${pickup}. Reference: ${reference}.`,
      notification_type: "instant_booking_offer"
    });

    if (error) logBookingStoreError("instant offer notification", reference, error);
  }

  if (instructorEmail) {
    const origin = new URL(request.url).origin || process.env.NEXT_PUBLIC_APP_URL || "https://ldrivingacademy.co.uk";
    await sendBookingConfirmationEmails({
      bookingReference: reference,
      learnerEmail: "",
      instructorEmail,
      instructorName: safeText(record.instructor_name, "LDA instructor", 120),
      lessonSummary: safeText(record.lesson_summary, "New on-demand LDA lesson request.", 180),
      manageUrl: `${origin}/instructor-dashboard`
    });
  }
}

async function getDeclinedInstantInstructorIds(supabase: any, reference: string) {
  const { data, error } = await supabase
    .from("instant_lesson_instructor_offers")
    .select("instructor_id")
    .eq("booking_reference", reference)
    .eq("status", "declined");

  if (error) {
    if (!isMissingRelationLookupError(error)) {
      logBookingStoreError("declined instant offer lookup", reference, error);
    }
    return [];
  }

  return (data ?? []).map((row: { instructor_id?: string | null }) => safeText(row.instructor_id, "", 120)).filter(Boolean);
}

async function hasPendingInstantOffer(supabase: any, reference: string, instructorId: string) {
  const { data, error } = await supabase
    .from("instant_lesson_instructor_offers")
    .select("id,status")
    .eq("booking_reference", reference)
    .eq("instructor_id", instructorId)
    .eq("status", "pending")
    .maybeSingle();

  if (error) {
    if (!isMissingRelationLookupError(error)) {
      logBookingStoreError("pending instant offer lookup", reference, error);
    }
    return false;
  }

  return Boolean(data);
}

async function assignInstantInstructor(supabase: any, currentRecord: any, reference: string, request: Request) {
  const transmissionPreference = inferTransmissionPreference(currentRecord);
  const currentInstructorId = safeText(currentRecord.instructor_id, "", 120);

  if (
    String(currentRecord.status ?? "") === "pending_assignment" &&
    uuidPattern.test(currentInstructorId) &&
    (await hasPendingInstantOffer(supabase, reference, currentInstructorId))
  ) {
    return currentRecord;
  }

  const declinedInstructorIds = await getDeclinedInstantInstructorIds(supabase, reference);
  const instructor = await resolveAssignableInstructor(supabase, transmissionPreference, declinedInstructorIds, currentRecord);
  if (!instructor) {
    const { data: waitingRecord, error: waitingError } = await supabase
      .from("lesson_booking_records")
      .update({
        instructor_id: null,
        instructor_name: "Waiting for instructor",
        instructor_email: null,
        car: null,
        status: "waiting_for_instructor",
        lesson_summary: preserveSmartMatchLessonNote(
          `Instant on-demand LDA lesson. Requested transmission: ${transmissionPreference}. LDA is waiting for a suitable instructor to become available.`,
          currentRecord.lesson_summary
        )
      })
      .eq("booking_reference", reference)
      .select("*")
      .maybeSingle();

    if (waitingError) {
      logBookingStoreError("waiting for active instant instructor", reference, waitingError);
    }

    return waitingRecord ?? currentRecord;
  }
  const shouldAutoAccept = instructor.autoAccept || !instructor.isLiveInstructor;
  const nextStatus = shouldAutoAccept ? "instructor_en_route" : "pending_assignment";
  const nextSummary = shouldAutoAccept
    ? preserveSmartMatchLessonNote(
        `On-demand LDA ${transmissionPreference} lesson accepted by ${instructor.name}. Your instructor is on the way to your pickup point.`,
        currentRecord.lesson_summary
      )
    : preserveSmartMatchLessonNote(
        `On-demand LDA ${transmissionPreference} lesson offered to ${instructor.name}. Waiting for instructor acceptance.`,
        currentRecord.lesson_summary
      );

  if (!shouldAutoAccept && uuidPattern.test(instructor.id)) {
    const { error: offerError } = await supabase.from("instant_lesson_instructor_offers").upsert(
      {
        booking_reference: reference,
        instructor_id: instructor.id,
        status: "pending",
        offered_at: new Date().toISOString(),
        responded_at: null,
        response_note: null
      },
      { onConflict: "booking_reference,instructor_id" }
    );

    if (offerError && !isMissingRelationLookupError(offerError)) {
      logBookingStoreError("instant instructor offer", reference, offerError);
    }
  }

  const { data: assignedRecord, error: assignError } = await supabase
    .from("lesson_booking_records")
    .update({
      instructor_id: instructor.id,
      instructor_name: instructor.name,
      instructor_email: instructor.email,
      lesson_summary: nextSummary,
      car: instructor.car,
      status: nextStatus
    })
    .eq("booking_reference", reference)
    .in("status", ["checkout_started", "waiting_for_instructor", "pending_assignment"])
    .select("*")
    .maybeSingle();

  if (assignError) {
    logBookingStoreError("auto assignment", reference, assignError);
    return currentRecord;
  }

  const nextRecord = assignedRecord ?? currentRecord;
  if (shouldAutoAccept) {
    await notifyInstantAssignment(supabase, nextRecord, reference, request);
  } else {
    await notifyInstantOffer(supabase, nextRecord, reference, request);
  }
  return nextRecord;
}

function statusFromStripeSession(session: Record<string, any>, reference: string, sessionId: string) {
  const createdAt = Number(session.created ?? 0) > 0 ? Number(session.created) * 1000 : Date.now();
  const accepted = canAutoAssign() && Date.now() - createdAt >= assignAfterMs && demoInstructors.length > 0;
  const enRoute = accepted && Date.now() - createdAt >= assignAfterMs + enRouteAfterAcceptedMs;
  const transmissionPreference = inferTransmissionPreference(null, session);
  const instructor = accepted
    ? demoInstructors.find((candidate) => candidate.transmission === transmissionPreference) ?? demoInstructors[0]
    : null;
  const learnerEmail = session.customer_email || session.metadata?.learner_email || null;
  const learnerPhone = session.metadata?.learner_phone || null;
  const status = enRoute ? "instructor_en_route" : accepted ? "accepted" : "waiting_for_instructor";

  return {
    reference,
    status,
    paymentStatus: session.payment_status === "paid" ? "paid" : "requires_payment",
    cancelAllowed: !accepted,
    learnerEmail,
    learnerPhone,
    instructorName: instructor?.name ?? "Waiting for instructor",
    instructorEmail: instructor ? "instructor@ldrivingacademy.co.uk" : null,
    lessonSummary: accepted
      ? `On-demand LDA ${transmissionPreference} lesson accepted by ${instructor?.name}. Your instructor is preparing to travel to your pickup point.`
      : `Instant on-demand LDA lesson. Requested transmission: ${transmissionPreference}. LDA is matching the closest suitable instructor with availability.`,
    car: instructor?.car ?? null,
    pricePence: Number(session.amount_total ?? 0),
    stripeCheckoutSessionId: sessionId,
    message: instantLessonStatusMessage(status, !accepted),
    ...realInstantTrackingPayloadFromRecord(null, status)
  };
}

function instantLessonStatusMessage(status: string, cancelAllowed: boolean) {
  if (status === "instructor_en_route" || status === "en_route" || status === "in_progress") {
    return "Your instructor is on the way.";
  }

  if (status === "accepted" || status === "upcoming") {
    return "Your instructor has accepted this on-demand lesson.";
  }

  if (cancelAllowed) {
    return "Waiting for an instructor to accept your on-demand lesson.";
  }

  return "Your on-demand lesson status has been updated.";
}

function demoInstantTrackingPayload(status: string) {
  const enRoute = status === "instructor_en_route" || status === "en_route" || status === "in_progress";

  return {
    pickupLabel: "Your live location",
    pickupPostcode: "On-demand pickup",
    pickupPoint: instantPickupPoint,
    instructorPoint: enRoute ? instantInstructorPoint : null,
    instructorLocationRecordedAt: enRoute ? new Date().toISOString() : null,
    instructorAccuracyMeters: null,
    instructorHeadingDegrees: null,
    instructorSpeedMps: null
  };
}

function normaliseCoordinate(value: unknown) {
  const coordinate = Number(value);
  return Number.isFinite(coordinate) ? coordinate : null;
}

function normaliseOptionalNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function realInstantTrackingPayloadFromRecord(
  record: Record<string, any> | null,
  status: string,
  instructorLive: InstantInstructorLivePoint = emptyInstantInstructorLivePoint
) {
  const pickupLat = normaliseCoordinate(record?.pickup_latitude ?? record?.pickup_lat);
  const pickupLng = normaliseCoordinate(record?.pickup_longitude ?? record?.pickup_lng);
  const pickupLabel = safeText(record?.pickup_label ?? record?.pickup_postcode, "Your pickup point", 160);
  const pickupPostcode = safeText(record?.pickup_postcode, "On-demand pickup", 80);
  const enRoute = status === "instructor_en_route" || status === "en_route" || status === "in_progress";
  const instructorPoint = instructorLive.point;

  return {
    pickupLabel,
    pickupPostcode,
    pickupPoint: pickupLat !== null && pickupLng !== null ? { lat: pickupLat, lng: pickupLng } : null,
    instructorPoint: enRoute ? instructorPoint : null,
    instructorLocationRecordedAt: enRoute && instructorPoint ? instructorLive.recordedAt ?? new Date().toISOString() : null,
    instructorAccuracyMeters: enRoute ? instructorLive.accuracyMeters : null,
    instructorHeadingDegrees: enRoute ? instructorLive.headingDegrees : null,
    instructorSpeedMps: enRoute ? instructorLive.speedMps : null
  };
}

async function realInstantTrackingPayload(supabase: any, record: Record<string, any>, status: string) {
  const instructorId = safeText(record.instructor_id, "", 120);
  let instructorLive: InstantInstructorLivePoint = emptyInstantInstructorLivePoint;

  if (supabase && uuidPattern.test(instructorId) && (status === "instructor_en_route" || status === "en_route" || status === "in_progress")) {
    let liveLocationLookup = await supabase
      .from("instructor_live_locations")
      .select("latitude,longitude,accuracy_meters,heading_degrees,speed_mps,recorded_at,client_recorded_at")
      .eq("instructor_id", instructorId)
      .gt("expires_at", new Date().toISOString())
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (liveLocationLookup.error && isMissingLiveLocationMetadataColumn(liveLocationLookup.error)) {
      liveLocationLookup = await supabase
        .from("instructor_live_locations")
        .select("latitude,longitude,recorded_at")
        .eq("instructor_id", instructorId)
        .gt("expires_at", new Date().toISOString())
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle();
    }

    if (!liveLocationLookup.error) {
      const data = liveLocationLookup.data;
      const lat = normaliseCoordinate(data?.latitude);
      const lng = normaliseCoordinate(data?.longitude);
      if (lat !== null && lng !== null) {
        instructorLive = {
          point: { lat, lng },
          recordedAt: safeText(data?.client_recorded_at ?? data?.recorded_at, new Date().toISOString(), 80),
          accuracyMeters: normaliseOptionalNumber(data?.accuracy_meters),
          headingDegrees: normaliseOptionalNumber(data?.heading_degrees),
          speedMps: normaliseOptionalNumber(data?.speed_mps)
        };
      }
    } else if (!isMissingRelationLookupError(liveLocationLookup.error) && !isMissingColumnLookupError(liveLocationLookup.error)) {
      logBookingStoreError("instructor live location lookup", safeText(record.booking_reference, "on-demand", 80), liveLocationLookup.error);
    }
  }

  return realInstantTrackingPayloadFromRecord(record, status, instructorLive);
}

async function progressAcceptedInstantBooking(supabase: any, currentRecord: any, reference: string) {
  const status = String(currentRecord.status ?? "");
  const transmissionPreference = inferTransmissionPreference(currentRecord);
  const instructorId = safeText(currentRecord.instructor_id, "", 120);
  const isDemoFallbackInstructor = !uuidPattern.test(instructorId);
  const acceptedAt = new Date(currentRecord.updated_at ?? currentRecord.created_at ?? Date.now()).getTime();
  const canProgress =
    currentRecord.payment_status === "paid" &&
    ["accepted", "upcoming"].includes(status) &&
    isDemoFallbackInstructor &&
    canAutoAssign() &&
    Date.now() - acceptedAt >= enRouteAfterAcceptedMs;

  if (!canProgress) {
    return currentRecord;
  }

  const { data: enRouteRecord, error: enRouteError } = await supabase
    .from("lesson_booking_records")
    .update({
      lesson_summary: preserveSmartMatchLessonNote(
        `On-demand LDA ${transmissionPreference} lesson accepted by ${currentRecord.instructor_name || "your LDA instructor"}. Your instructor is on the way to your pickup point.`,
        currentRecord.lesson_summary
      ),
      status: "instructor_en_route"
    })
    .eq("booking_reference", reference)
    .in("status", ["accepted", "upcoming"])
    .select("*")
    .maybeSingle();

  if (enRouteError) logBookingStoreError("auto en route", reference, enRouteError);
  return enRouteRecord ?? currentRecord;
}

export async function GET(request: Request) {
  if (isRateLimited(request, "instant-status", 60)) {
    return rateLimitResponse();
  }

  const url = new URL(request.url);
  const reference = safeText(url.searchParams.get("reference"), "", 80);
  const sessionId = safeText(url.searchParams.get("session_id"), "", 140);
  const sessionSupabase = await createClient();
  const {
    data: { user: sessionUser }
  } = sessionSupabase ? await sessionSupabase.auth.getUser() : { data: { user: null } };
  const demo = url.searchParams.get("demo") === "1" && !sessionUser;

  if (!reference) {
    return jsonNoStore({ error: "Booking reference is required." }, { status: 400 });
  }

  if (demo) {
    return jsonNoStore({
      reference,
      status: "waiting_for_instructor",
      paymentStatus: "paid",
      cancelAllowed: true,
      instructorName: "Waiting for instructor",
      lessonSummary: "Demo on-demand LDA lesson. Waiting for an instructor to accept.",
      pricePence: 0,
      message: "Waiting for an instructor to accept your on-demand lesson.",
      ...demoInstantTrackingPayload("waiting_for_instructor")
    });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    if (sessionId) {
      const sessionCheck = await verifyPaidSession(sessionId, reference);
      if (sessionCheck.session) {
        if (!sessionCheck.paid) {
          return jsonNoStore({
            reference,
            status: "payment_pending",
            paymentStatus: "requires_payment",
            message: sessionCheck.error ?? "Waiting for payment confirmation.",
            cancelAllowed: true
          });
        }

        return jsonNoStore(statusFromStripeSession(sessionCheck.session, reference, sessionId));
      }
    }

    return jsonNoStore({ error: "Booking status is temporarily unavailable." }, { status: 503 });
  }

  const { data: record, error } = await supabase
    .from("lesson_booking_records")
    .select("*")
    .eq("booking_reference", reference)
    .maybeSingle();

  if (error) {
    logBookingStoreError("booking read", reference, error);
    if (sessionId) {
      const sessionCheck = await verifyPaidSession(sessionId, reference);
      if (sessionCheck.session) {
        if (!sessionCheck.paid) {
          return jsonNoStore({
            reference,
            status: "payment_pending",
            paymentStatus: "requires_payment",
            message: sessionCheck.error ?? "Waiting for payment confirmation.",
            cancelAllowed: true
          });
        }

        return jsonNoStore(statusFromStripeSession(sessionCheck.session, reference, sessionId));
      }
    }

    return jsonNoStore({ error: "Booking status store is temporarily unavailable." }, { status: 503 });
  }

  if (!record) {
    if (!sessionId) {
      return jsonNoStore({ error: "Booking reference was not found." }, { status: 404 });
    }

    const sessionCheck = await verifyPaidSession(sessionId, reference);
    if (!sessionCheck.paid || !sessionCheck.session) {
      return jsonNoStore({
        reference,
        status: "payment_pending",
        paymentStatus: "requires_payment",
        message: sessionCheck.error ?? "Waiting for payment confirmation.",
        cancelAllowed: true
      });
    }

    const session = sessionCheck.session;
    const transmissionPreference = inferTransmissionPreference(null, session);
    const { data: recoveredRecord, error: recoverError } = await supabase
      .from("lesson_booking_records")
      .insert({
        booking_reference: reference,
        learner_id: session.metadata?.learner_id || null,
        learner_email: session.customer_email || session.metadata?.learner_email || null,
        learner_phone: session.metadata?.learner_phone || null,
        instructor_id: null,
        instructor_name: "Waiting for instructor",
        instructor_email: null,
        lesson_summary: `Instant on-demand LDA lesson. Requested transmission: ${transmissionPreference}. LDA will assign the closest suitable instructor with availability after payment.`,
        pickup_postcode: safeText(session.metadata?.pickup, "", 180) || null,
        lesson_price_pence: Number(session.amount_total ?? 0),
        car: null,
        status: "waiting_for_instructor",
        payment_status: "paid",
        stripe_checkout_session_id: sessionId
      })
      .select("*")
      .maybeSingle();

    if (recoverError || !recoveredRecord) {
      if (recoverError) logBookingStoreError("paid booking recovery", reference, recoverError);
      return jsonNoStore(statusFromStripeSession(session, reference, sessionId));
    }

    let currentRecord = recoveredRecord;

    const paidAt = new Date(currentRecord.updated_at ?? currentRecord.created_at ?? Date.now()).getTime();
    const isWaiting = ["checkout_started", "waiting_for_instructor", "pending_assignment"].includes(String(currentRecord.status));

    if (isWaiting && canAutoAssign() && Date.now() - paidAt >= assignAfterMs) {
      currentRecord = await assignInstantInstructor(supabase, currentRecord, reference, request);
    }

    currentRecord = await progressAcceptedInstantBooking(supabase, currentRecord, reference);

    const status = String(currentRecord.status ?? "waiting_for_instructor");
    const cancelAllowed = ["checkout_started", "waiting_for_instructor", "pending_assignment", "payment_pending"].includes(status);

    return jsonNoStore({
      reference,
      status,
      paymentStatus: currentRecord.payment_status,
      cancelAllowed,
      learnerEmail: currentRecord.learner_email,
      learnerPhone: currentRecord.learner_phone,
      instructorName: currentRecord.instructor_name,
      instructorEmail: currentRecord.instructor_email,
      lessonSummary: currentRecord.lesson_summary,
      car: currentRecord.car,
      pricePence: currentRecord.lesson_price_pence,
      stripeCheckoutSessionId: currentRecord.stripe_checkout_session_id,
      message: instantLessonStatusMessage(status, cancelAllowed),
      ...(await realInstantTrackingPayload(supabase, currentRecord, status))
    });
  }

  let currentRecord = record;
  const access = await assertInstantStatusAccess(currentRecord, reference, sessionId);
  if (!access.ok) {
    return jsonNoStore({ error: access.error }, { status: access.status });
  }

  if (sessionId && record.payment_status !== "paid" && !protectedPaymentStatuses.has(String(record.payment_status ?? ""))) {
    const sessionCheck = await verifyPaidSession(sessionId, reference);

    if (!sessionCheck.paid) {
      return jsonNoStore({
        reference,
        status: "payment_pending",
        paymentStatus: record.payment_status,
        message: sessionCheck.error ?? "Waiting for payment confirmation.",
        cancelAllowed: true
      });
    }

    const { data: paidRecord, error: paidError } = await supabase
      .from("lesson_booking_records")
      .update({
        status: "waiting_for_instructor",
        payment_status: "paid",
        stripe_checkout_session_id: sessionId
      })
      .eq("booking_reference", reference)
      .select("*")
      .maybeSingle();

    if (paidError) logBookingStoreError("payment confirmation update", reference, paidError);
    currentRecord = paidRecord ?? currentRecord;
  }

  const paidAt = new Date(currentRecord.updated_at ?? currentRecord.created_at ?? Date.now()).getTime();
  const isWaiting =
    currentRecord.payment_status === "paid" &&
    ["checkout_started", "waiting_for_instructor", "pending_assignment"].includes(String(currentRecord.status));

  if (isWaiting && canAutoAssign() && Date.now() - paidAt >= assignAfterMs) {
    currentRecord = await assignInstantInstructor(supabase, currentRecord, reference, request);
  }

  currentRecord = await repairGenericInstantInstructor(supabase, currentRecord, reference, request);
  currentRecord = await progressAcceptedInstantBooking(supabase, currentRecord, reference);

  const status = String(currentRecord.status ?? "waiting_for_instructor");
  const cancelAllowed = ["checkout_started", "waiting_for_instructor", "pending_assignment", "payment_pending"].includes(status);

  return jsonNoStore({
    reference,
    status,
    paymentStatus: currentRecord.payment_status,
    cancelAllowed,
    learnerEmail: currentRecord.learner_email,
    learnerPhone: currentRecord.learner_phone,
    instructorName: currentRecord.instructor_name,
    instructorEmail: currentRecord.instructor_email,
    lessonSummary: currentRecord.lesson_summary,
    car: currentRecord.car,
    pricePence: currentRecord.lesson_price_pence,
    stripeCheckoutSessionId: currentRecord.stripe_checkout_session_id,
    message: instantLessonStatusMessage(status, cancelAllowed),
    ...(await realInstantTrackingPayload(supabase, currentRecord, status))
  });
}
