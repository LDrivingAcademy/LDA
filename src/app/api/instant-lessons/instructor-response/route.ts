import {
  getAppOrigin,
  isRateLimited,
  jsonNoStore,
  rateLimitResponse,
  readJsonBody,
  safeEmail,
  safeText
} from "@/lib/security";
import { canUseMarketplaceRole, getMarketplaceRoleState } from "@/lib/account-route-guard";
import { sendBookingConfirmationEmails, sendInstantBookingConfirmationEmail, sendInstructorEnRouteEmail } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isLessonRouteAccessActive, lessonRouteExpiredResponseMessage } from "@/lib/lesson-route-access";
import {
  getInstructorFutureComplianceStatus,
  readInstructorFutureComplianceDocuments
} from "@/lib/instructor-future-compliance";
import {
  flattenInstructorVerificationRequirements,
  getInstructorVerificationRequirements
} from "@/lib/instructor-verification-requirements";
import { preserveSmartMatchLessonNote } from "@/lib/smart-match-handoff";

type InstructorInstantResponseRequest = {
  action?: "accept" | "decline" | "en_route" | "auto_accept";
  reference?: string;
  autoAccept?: boolean;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normaliseTransmissionPreference(record?: Record<string, any> | null): "automatic" | "manual" {
  const summary = safeText(record?.lesson_summary, "", 500).toLowerCase();
  return summary.includes("requested transmission: manual") || summary.includes("manual lesson") ? "manual" : "automatic";
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

  return (summary.slice(start + marker.length).split(".")[0] ?? "")
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

function isMissingRelationLookupError(error: unknown) {
  const candidate = error as { code?: string; message?: string } | null;
  return candidate?.code === "42P01" || /relation .* does not exist/i.test(candidate?.message ?? "");
}

function isMissingColumnLookupError(error: unknown) {
  const candidate = error as { code?: string; message?: string } | null;
  return candidate?.code === "42703" || /column .* does not exist/i.test(candidate?.message ?? "");
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
      console.error("[instant-lessons.instructor-response] active availability lookup failed", {
        message: error.message,
        code: error.code
      });
    }
    return [];
  }

  return Array.from(new Set((data ?? []).map((row: { instructor_id?: string | null }) => safeText(row.instructor_id, "", 120)).filter(Boolean)));
}

async function insertNotification(supabase: any, row: Record<string, unknown>) {
  const { error } = await supabase.from("notifications").insert(row);
  if (error) {
    console.error("[instant-lessons.instructor-response] notification failed", {
      message: error.message,
      code: error.code
    });
  }
}

async function markOfferStatus(
  supabase: any,
  reference: string,
  instructorId: string,
  status: "accepted" | "declined"
) {
  const { error } = await supabase
    .from("instant_lesson_instructor_offers")
    .update({
      status,
      responded_at: new Date().toISOString()
    })
    .eq("booking_reference", reference)
    .eq("instructor_id", instructorId)
    .eq("status", "pending");

  if (error && !isMissingRelationLookupError(error)) {
    console.error("[instant-lessons.instructor-response] offer status update failed", {
      reference,
      instructorId,
      status,
      message: error.message,
      code: error.code
    });
  }
}

async function declinedInstructorIds(supabase: any, reference: string) {
  const { data, error } = await supabase
    .from("instant_lesson_instructor_offers")
    .select("instructor_id")
    .eq("booking_reference", reference)
    .eq("status", "declined");

  if (error) {
    if (!isMissingRelationLookupError(error)) {
      console.error("[instant-lessons.instructor-response] declined lookup failed", {
        reference,
        message: error.message,
        code: error.code
      });
    }
    return [];
  }

  return (data ?? []).map((row: { instructor_id?: string | null }) => safeText(row.instructor_id, "", 120)).filter(Boolean);
}

async function resolveNextInstructor(supabase: any, record: Record<string, any>, excludedIds: string[]) {
  const transmission = normaliseTransmissionPreference(record);
  const activeInstructorIds = await getActiveOnDemandInstructorIds(supabase);

  if (!activeInstructorIds.length) {
    return null;
  }

  const primaryLookup = await supabase
    .from("instructor_profiles")
    .select("user_id,display_name,car_make,car_model,transmission,verification_status,learner_availability_paused,auto_accept_bookings,smart_match_inclusive_enabled,smart_match_teaching_styles,smart_match_specialisms")
    .eq("verification_status", "approved")
    .eq("learner_availability_paused", false)
    .in("user_id", activeInstructorIds)
    .limit(20);
  const fallbackLookup =
    primaryLookup.error && isMissingColumnLookupError(primaryLookup.error)
      ? await supabase
          .from("instructor_profiles")
          .select("user_id,display_name,car_make,car_model,transmission,verification_status,learner_availability_paused,auto_accept_bookings")
          .eq("verification_status", "approved")
          .eq("learner_availability_paused", false)
          .in("user_id", activeInstructorIds)
          .limit(20)
      : null;
  const data = fallbackLookup ? fallbackLookup.data : primaryLookup.data;
  const error = fallbackLookup ? fallbackLookup.error : primaryLookup.error;

  if (error) {
    console.error("[instant-lessons.instructor-response] instructor lookup failed", {
      message: error.message,
      code: error.code
    });
    return null;
  }

  const requirements = smartMatchRequirementsFromRecord(record);
  const candidates = [...(data ?? [])]
    .sort((a, b) => smartMatchCandidateScore(b, requirements) - smartMatchCandidateScore(a, requirements))
    .filter((instructor: any) =>
      uuidPattern.test(String(instructor.user_id)) &&
      !excludedIds.includes(String(instructor.user_id)) &&
      transmissionMatches(instructor.transmission, transmission)
    );

  const candidateIds = candidates.map((instructor: any) => String(instructor.user_id));
  const requirementSections = await getInstructorVerificationRequirements(supabase);
  const requiredDocumentTypes = flattenInstructorVerificationRequirements(requirementSections)
    .filter((document) => document.requirement === "required")
    .map((document) => document.type);
  const documentsByInstructor = await readInstructorFutureComplianceDocuments(supabase, candidateIds);
  const now = new Date();
  const candidate = candidates.find((instructor: any) => {
    const instructorId = String(instructor.user_id);
    const status = getInstructorFutureComplianceStatus(
      documentsByInstructor.get(instructorId) ?? [],
      requiredDocumentTypes,
      now
    );
    return status.ok;
  });

  if (!candidate) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", candidate.user_id)
    .maybeSingle();

  const car = [safeText(candidate.car_make, "", 60), safeText(candidate.car_model, "", 80)]
    .filter(Boolean)
    .join(" ");

  return {
    id: String(candidate.user_id),
    name: safeText(candidate.display_name, "LDA instructor", 120),
    email: safeEmail(profile?.email),
    car,
    autoAccept: candidate.auto_accept_bookings === true,
    transmission
  };
}

async function offerOrAcceptNextInstructor(supabase: any, record: Record<string, any>, request: Request) {
  const reference = safeText(record.booking_reference, "", 80);
  if (
    !isLessonRouteAccessActive({
      status: record.status,
      startsAt: record.starts_at,
      endsAt: record.ends_at,
      createdAt: record.created_at,
      updatedAt: record.updated_at
    })
  ) {
    return { status: "expired", instructorName: null };
  }

  const excluded = await declinedInstructorIds(supabase, reference);
  const instructor = await resolveNextInstructor(supabase, record, excluded);

  if (!instructor) {
    await supabase
      .from("lesson_booking_records")
      .update({
        instructor_id: null,
        instructor_name: "Waiting for instructor",
        instructor_email: null,
        car: null,
        status: "waiting_for_instructor",
        lesson_summary: preserveSmartMatchLessonNote(
          "Instant on-demand LDA lesson. LDA is matching the next suitable instructor with availability.",
          record.lesson_summary
        )
      })
      .eq("booking_reference", reference);
    return { status: "waiting_for_instructor", instructorName: null };
  }

  if (instructor.autoAccept) {
    const { data: acceptedRecord } = await supabase
      .from("lesson_booking_records")
      .update({
        instructor_id: instructor.id,
        instructor_name: instructor.name,
        instructor_email: instructor.email,
        car: instructor.car,
        status: "instructor_en_route",
        lesson_summary: preserveSmartMatchLessonNote(
          `On-demand LDA ${instructor.transmission} lesson accepted by ${instructor.name}. Your instructor is on the way to your pickup point.`,
          record.lesson_summary
        )
      })
      .eq("booking_reference", reference)
      .select("*")
      .maybeSingle();

    await insertNotification(supabase, {
      user_id: instructor.id,
      booking_id: null,
      title: "On-demand booking auto-accepted",
      body: `LDA auto-accepted on-demand booking ${reference} because auto-accept is enabled. Open Route from your dashboard to travel to the learner pickup point.`,
      notification_type: "instant_booking_auto_accepted"
    });

    const learnerId = safeText(acceptedRecord?.learner_id, "", 120);
    if (uuidPattern.test(learnerId)) {
      await insertNotification(supabase, {
        user_id: learnerId,
        booking_id: null,
        title: "Instructor on the way",
        body: `${instructor.name} accepted your on-demand lesson and is heading to your pickup point. Reference: ${reference}.`,
        notification_type: "driver_en_route"
      });
    }

    const learnerEmail = safeEmail(acceptedRecord?.learner_email);
    if (learnerEmail) {
      await sendInstantBookingConfirmationEmail({
        reference,
        learnerEmail,
        learnerName: safeText(acceptedRecord?.learner_name, "Learner", 120),
        instructorName: instructor.name,
        lessonSummary: safeText(
          acceptedRecord?.lesson_summary,
          `On-demand LDA ${instructor.transmission} lesson accepted by ${instructor.name}. Your instructor is on the way to your pickup point.`,
          180
        ),
        trackingUrl: `${getAppOrigin(request)}/lesson-now/confirmed?reference=${encodeURIComponent(reference)}`,
        idempotencyKey: `instant-accepted-${reference}`
      });
    }

    return { status: "instructor_en_route", instructorName: instructor.name };
  }

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
    console.error("[instant-lessons.instructor-response] offer create failed", {
      reference,
      message: offerError.message,
      code: offerError.code
    });
  }

  await supabase
    .from("lesson_booking_records")
    .update({
      instructor_id: instructor.id,
      instructor_name: instructor.name,
      instructor_email: instructor.email,
      car: instructor.car,
      status: "pending_assignment",
      lesson_summary: preserveSmartMatchLessonNote(
        `On-demand LDA ${instructor.transmission} lesson offered to ${instructor.name}. Waiting for instructor acceptance.`,
        record.lesson_summary
      )
    })
    .eq("booking_reference", reference);

  await insertNotification(supabase, {
    user_id: instructor.id,
    booking_id: null,
    title: "On-demand booking request",
    body: `A learner is waiting for an on-demand lesson. Accept or decline from your instructor dashboard. Reference: ${reference}.`,
    notification_type: "instant_booking_offer"
  });

  if (instructor.email) {
    await sendBookingConfirmationEmails({
      bookingReference: reference,
      learnerEmail: "",
      instructorEmail: instructor.email,
      instructorName: instructor.name,
      lessonSummary: `New on-demand LDA ${instructor.transmission} lesson request.`,
      manageUrl: `${getAppOrigin(request)}/instructor-dashboard`
    });
  }

  return { status: "pending_assignment", instructorName: instructor.name };
}

export async function POST(request: Request) {
  if (isRateLimited(request, "instant-instructor-response", 20)) {
    return rateLimitResponse();
  }

  const input = await readJsonBody<InstructorInstantResponseRequest>(request);
  const action = input?.action;
  const reference = safeText(input?.reference, "", 80);

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
    return jsonNoStore({ error: "Use an approved instructor account for on-demand booking responses." }, { status: 403 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return jsonNoStore({ error: "On-demand instructor responses are temporarily unavailable." }, { status: 503 });
  }

  if (action === "auto_accept") {
    const { error } = await supabase
      .from("instructor_profiles")
      .update({ auto_accept_bookings: input?.autoAccept === true, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);

    if (error) {
      return jsonNoStore({ error: error.message }, { status: 500 });
    }

    return jsonNoStore({
      ok: true,
      autoAccept: input?.autoAccept === true,
      message: input?.autoAccept === true ? "Auto-accept is now on for on-demand lessons." : "Auto-accept is now off for on-demand lessons."
    });
  }

  if (!reference || !action) {
    return jsonNoStore({ error: "Booking reference and action are required." }, { status: 400 });
  }

  const { data: record, error: recordError } = await supabase
    .from("lesson_booking_records")
    .select("*")
    .eq("booking_reference", reference)
    .maybeSingle();

  if (recordError) {
    return jsonNoStore({ error: "On-demand booking could not be loaded." }, { status: 503 });
  }

  if (!record) {
    return jsonNoStore({ error: "On-demand booking reference was not found." }, { status: 404 });
  }

  if (safeText(record.instructor_id, "", 120) !== user.id) {
    return jsonNoStore({ error: "This on-demand request is not currently assigned to your instructor account." }, { status: 403 });
  }

  const status = String(record.status ?? "");
  const learnerId = safeText(record.learner_id, "", 120);
  const instructorName = safeText(record.instructor_name, user.email ?? "LDA instructor", 120);

  const routeWindowActive = isLessonRouteAccessActive({
    status,
    startsAt: record.starts_at,
    endsAt: record.ends_at,
    createdAt: record.created_at,
    updatedAt: record.updated_at
  });

  if (!routeWindowActive && ["accept", "en_route"].includes(action)) {
    return jsonNoStore({ error: lessonRouteExpiredResponseMessage() }, { status: 410 });
  }

  if (action === "accept") {
    if (status !== "pending_assignment") {
      return jsonNoStore({ error: "This on-demand request is no longer waiting for acceptance." }, { status: 409 });
    }

    const requirementSections = await getInstructorVerificationRequirements(supabase);
    const requiredDocumentTypes = flattenInstructorVerificationRequirements(requirementSections)
      .filter((document) => document.requirement === "required")
      .map((document) => document.type);
    const documentsByInstructor = await readInstructorFutureComplianceDocuments(supabase, [user.id]);
    const futureCompliance = getInstructorFutureComplianceStatus(
      documentsByInstructor.get(user.id) ?? [],
      requiredDocumentTypes,
      new Date()
    );

    if (!futureCompliance.ok) {
      return jsonNoStore(
        { error: "Your compliance evidence needs LDA review before you can accept new learner-facing bookings." },
        { status: 409 }
      );
    }

    await markOfferStatus(supabase, reference, user.id, "accepted");

    const { data: acceptedRecord, error } = await supabase
      .from("lesson_booking_records")
      .update({
        status: "accepted",
        lesson_summary: preserveSmartMatchLessonNote(
          `On-demand LDA lesson accepted by ${instructorName}. Your instructor is preparing to travel to your pickup point.`,
          record.lesson_summary
        )
      })
      .eq("booking_reference", reference)
      .eq("instructor_id", user.id)
      .eq("status", "pending_assignment")
      .select("*")
      .maybeSingle();

    if (error || !acceptedRecord) {
      return jsonNoStore({ error: error?.message ?? "This on-demand request could not be accepted." }, { status: 409 });
    }

    if (uuidPattern.test(learnerId)) {
      await insertNotification(supabase, {
        user_id: learnerId,
        booking_id: null,
        title: "Instructor found",
        body: `${instructorName} accepted your on-demand lesson. Reference: ${reference}.`,
        notification_type: "instant_booking_accepted"
      });
    }

    const learnerEmail = safeEmail(acceptedRecord.learner_email);
    if (learnerEmail) {
      await sendInstantBookingConfirmationEmail({
        reference,
        learnerEmail,
        learnerName: safeText(acceptedRecord.learner_name, "Learner", 120),
        instructorName,
        lessonSummary: safeText(
          acceptedRecord.lesson_summary,
          `On-demand LDA lesson accepted by ${instructorName}. Your instructor is preparing to travel to your pickup point.`,
          180
        ),
        trackingUrl: `${getAppOrigin(request)}/lesson-now/confirmed?reference=${encodeURIComponent(reference)}`,
        idempotencyKey: `instant-accepted-${reference}`
      });
    }

    return jsonNoStore({ ok: true, status: "accepted", message: "On-demand lesson accepted. You can now go en route when ready." });
  }

  if (action === "decline") {
    if (status !== "pending_assignment") {
      return jsonNoStore({ error: "This on-demand request is no longer waiting for your response." }, { status: 409 });
    }

    await markOfferStatus(supabase, reference, user.id, "declined");

    const { data: waitingRecord } = await supabase
      .from("lesson_booking_records")
      .update({
        instructor_id: null,
        instructor_name: "Waiting for instructor",
        instructor_email: null,
        car: null,
        status: "waiting_for_instructor",
        lesson_summary: preserveSmartMatchLessonNote(
          "Instant on-demand LDA lesson. LDA is matching the next suitable instructor with availability.",
          record.lesson_summary
        )
      })
      .eq("booking_reference", reference)
      .eq("instructor_id", user.id)
      .eq("status", "pending_assignment")
      .select("*")
      .maybeSingle();

    const nextAssignment = await offerOrAcceptNextInstructor(supabase, waitingRecord ?? record, request);

    return jsonNoStore({
      ok: true,
      status: nextAssignment.status,
      message: nextAssignment.instructorName
        ? `On-demand request declined. LDA has passed it to ${nextAssignment.instructorName}.`
        : nextAssignment.status === "expired"
          ? "On-demand request declined. The route window has expired, so LDA will not pass this pickup to another instructor."
        : "On-demand request declined. LDA is looking for the next suitable instructor."
    });
  }

  if (action === "en_route") {
    if (!["accepted", "upcoming"].includes(status)) {
      return jsonNoStore({ error: "Accept this on-demand lesson before marking yourself en route." }, { status: 409 });
    }

    const { error } = await supabase
      .from("lesson_booking_records")
      .update({
        status: "instructor_en_route",
        lesson_summary: preserveSmartMatchLessonNote(
          `On-demand LDA lesson accepted by ${instructorName}. Your instructor is on the way to your pickup point.`,
          record.lesson_summary
        )
      })
      .eq("booking_reference", reference)
      .eq("instructor_id", user.id)
      .in("status", ["accepted", "upcoming"]);

    if (error) {
      return jsonNoStore({ error: error.message }, { status: 409 });
    }

    if (uuidPattern.test(learnerId)) {
      await insertNotification(supabase, {
        user_id: learnerId,
        booking_id: null,
        title: "Instructor on the way",
        body: `${instructorName} is heading to your pickup point for your on-demand lesson. Reference: ${reference}.`,
        notification_type: "driver_en_route"
      });
    }

    const learnerEmail = safeEmail(record.learner_email);
    if (learnerEmail) {
      await sendInstructorEnRouteEmail({
        learnerEmail,
        instructorName,
        bookingReference: reference,
        lessonSummary: safeText(record.lesson_summary, "On-demand LDA lesson", 180),
        trackingUrl: `${getAppOrigin(request)}/lesson-now/confirmed?reference=${encodeURIComponent(reference)}`
      });
    }

    return jsonNoStore({ ok: true, status: "instructor_en_route", message: "Learner has been notified that you are en route." });
  }

  return jsonNoStore({ error: "Unsupported instructor response." }, { status: 400 });
}
