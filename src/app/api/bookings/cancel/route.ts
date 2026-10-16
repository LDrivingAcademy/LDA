import { sendBookingCancellationEmails } from "@/lib/email";
import { getAppOrigin, isRateLimited, jsonNoStore, rateLimitResponse, readJsonBody, safeEmail, safeText } from "@/lib/security";
import { sendSms } from "@/lib/sms";
import { isDirectorAdminEmail } from "@/lib/admin-access";
import { enforceLearnerCancellationPolicy } from "@/lib/learner-account-enforcement";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { canUseMarketplaceRole, getMarketplaceRoleState } from "@/lib/account-route-guard";

type CancelBookingRequest = {
  bookingId: string;
  cancellationActor?: "learner" | "instructor";
  learnerId?: string;
  instructorId?: string;
  learnerName?: string;
  learnerEmail?: string;
  learnerPhone?: string;
  instructorEmail?: string;
  instructorPhone?: string;
  instructorName: string;
  lessonSummary: string;
  startsAt: string;
  bookingWindow?: "same_day_or_next_day" | "advance_scheduled";
  reason?: string;
};

type LessonBookingRecord = {
  booking_reference: string;
  learner_id: string | null;
  learner_email: string | null;
  learner_phone: string | null;
  instructor_id: string | null;
  instructor_email: string | null;
  instructor_name: string | null;
  lesson_summary: string | null;
  starts_at: string | null;
  status: string | null;
  payment_status: string | null;
};

type ProfileContact = {
  full_name: string | null;
  email: string | null;
  phone: string | null;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const terminalBookingStatuses = new Set([
  "cancelled",
  "cancelled_by_learner",
  "cancelled_by_instructor",
  "completed",
  "refunded",
  "refund_requested",
  "disputed"
]);
const terminalPaymentStatuses = new Set(["refunded", "refund_pending", "refund_requested", "disputed"]);

function isTerminalBookingStatus(value?: string | null) {
  const status = String(value ?? "").trim().toLowerCase();
  return terminalBookingStatuses.has(status) || status.includes("cancel") || status.includes("refund");
}

function isTerminalPaymentStatus(value?: string | null) {
  const status = String(value ?? "").trim().toLowerCase();
  return terminalPaymentStatuses.has(status) || status.includes("refund");
}

function hasLessonStarted(startsAt?: string | null) {
  if (!startsAt) {
    return false;
  }

  const lessonStart = new Date(startsAt);
  return Number.isFinite(lessonStart.getTime()) && lessonStart.getTime() <= Date.now();
}

function getRefundSummary(startsAt: string, bookingWindow?: CancelBookingRequest["bookingWindow"]) {
  if (bookingWindow === "advance_scheduled") {
    return "This was an advance scheduled lesson, so automatic refund cancellation is not available. LDA support can review exceptional circumstances under the cancellation policy.";
  }

  const startsAtDate = new Date(startsAt);
  const hoursUntilLesson = (startsAtDate.getTime() - Date.now()) / (1000 * 60 * 60);

  if (Number.isNaN(hoursUntilLesson)) {
    return "Refund eligibility will be reviewed against the cancellation policy.";
  }

  if (hoursUntilLesson >= 24) {
    return "This cancellation is outside the 24-hour window, so a full refund can be requested subject to Stripe processing times.";
  }

  if (hoursUntilLesson >= 2) {
    return "This cancellation is inside the 24-hour window, so a partial or manual refund review may apply.";
  }

  return "This cancellation is very close to lesson time or instructor travel time, so the lesson may be non-refundable unless LDA support approves an exception.";
}

function isoDayOffset(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function isAdvanceScheduledCancellation(input: CancelBookingRequest, referenceRecord: LessonBookingRecord | null) {
  if (input.bookingWindow === "advance_scheduled") {
    return true;
  }

  const startsAt = referenceRecord?.starts_at || input.startsAt;
  const isoDay = typeof startsAt === "string" ? startsAt.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] : null;

  if (isoDay) {
    return isoDay > isoDayOffset(1);
  }

  const parsedStart = new Date(startsAt);
  if (Number.isNaN(parsedStart.getTime())) {
    return false;
  }

  const tomorrowEnd = new Date();
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
  tomorrowEnd.setHours(23, 59, 59, 999);
  return parsedStart.getTime() > tomorrowEnd.getTime();
}

function getRefundReviewPaymentStatus({
  actor,
  startsAt,
  bookingWindow,
  currentPaymentStatus
}: {
  actor: "learner" | "instructor";
  startsAt?: string | null;
  bookingWindow?: CancelBookingRequest["bookingWindow"];
  currentPaymentStatus?: string | null;
}) {
  const normalisedPaymentStatus = String(currentPaymentStatus ?? "").trim().toLowerCase();

  if (normalisedPaymentStatus !== "paid") {
    return currentPaymentStatus ?? "unpaid";
  }

  if (actor === "instructor") {
    return "refund_requested";
  }

  if (bookingWindow === "advance_scheduled") {
    return "paid";
  }

  const lessonStart = new Date(startsAt ?? "");
  if (Number.isNaN(lessonStart.getTime())) {
    return "paid";
  }

  const hoursUntilLesson = (lessonStart.getTime() - Date.now()) / (1000 * 60 * 60);
  return hoursUntilLesson >= 24 ? "refund_requested" : "paid";
}

export async function POST(request: Request) {
  if (isRateLimited(request, "booking-cancel", 12)) {
    return rateLimitResponse();
  }

  const input = await readJsonBody<CancelBookingRequest>(request);
  if (!input) {
    return jsonNoStore({ error: "Invalid booking cancellation request." }, { status: 400 });
  }

  const bookingId = safeText(input.bookingId, "", 80);
  if (!bookingId || !safeText(input.instructorName, "", 120) || !safeText(input.lessonSummary, "", 180)) {
    return jsonNoStore({ error: "Booking reference, instructor name, and lesson summary are required." }, { status: 400 });
  }
  const cancellationActor = input.cancellationActor === "instructor" ? "instructor" : "learner";

  const signedInSupabase = await createClient();
  if (!signedInSupabase) {
    return jsonNoStore({ error: "Authentication is not configured." }, { status: 503 });
  }

  const {
    data: { user }
  } = await signedInSupabase.auth.getUser();

  if (!user) {
    return jsonNoStore({ error: "Sign in before cancelling a booking." }, { status: 401 });
  }

  const [{ data: profile }, { data: roles }, { data: booking }, { data: referenceBooking }] = await Promise.all([
    signedInSupabase.from("profiles").select("full_name,email,phone").eq("id", user.id).maybeSingle(),
    signedInSupabase.from("account_roles").select("role").eq("user_id", user.id),
    uuidPattern.test(bookingId)
      ? signedInSupabase
          .from("bookings")
          .select("id,learner_id,instructor_id,status,payment_status")
          .eq("id", bookingId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    signedInSupabase
      .from("lesson_booking_records")
      .select("booking_reference,learner_id,learner_email,learner_phone,instructor_id,instructor_email,instructor_name,lesson_summary,starts_at,status,payment_status")
      .eq("booking_reference", bookingId)
      .maybeSingle()
  ]);
  const isAdmin = (roles?.some((accountRole) => accountRole.role === "admin") ?? false) && isDirectorAdminEmail(user.email);
  const referenceRecord = referenceBooking as LessonBookingRecord | null;
  const signedInProfile = profile as ProfileContact | null;
  const roleState = await getMarketplaceRoleState(signedInSupabase, user.id);

  if (!isAdmin && !canUseMarketplaceRole(roleState, cancellationActor)) {
    return jsonNoStore(
      {
        error:
          cancellationActor === "learner"
            ? "Use a learner account before cancelling a learner booking."
            : "Use an approved instructor account before cancelling an instructor booking."
      },
      { status: 403 }
    );
  }

  if (uuidPattern.test(bookingId) && !booking) {
    return jsonNoStore({ error: "Booking could not be found." }, { status: 404 });
  }

  if (booking && !isAdmin) {
    const ownsBooking =
      cancellationActor === "instructor"
        ? booking.instructor_id === user.id
        : booking.learner_id === user.id;

    if (!ownsBooking) {
      return jsonNoStore({ error: "You can only cancel bookings linked to your account." }, { status: 403 });
    }
  }

  if (referenceRecord && !isAdmin) {
    const ownsReference =
      cancellationActor === "instructor"
        ? referenceRecord.instructor_id === user.id
        : referenceRecord.learner_id === user.id;

    if (!ownsReference) {
      return jsonNoStore({ error: "You can only cancel bookings linked to your account." }, { status: 403 });
    }
  }

  if (
    !isAdmin &&
    (isTerminalBookingStatus(booking?.status) ||
      isTerminalBookingStatus(referenceRecord?.status) ||
      isTerminalPaymentStatus(booking?.payment_status) ||
      isTerminalPaymentStatus(referenceRecord?.payment_status))
  ) {
    return jsonNoStore(
      {
        error:
          "This lesson is already cancelled, completed, refunded, or under review. It cannot be cancelled again."
      },
      { status: 409 }
    );
  }

  const lessonStartsAtForGuard = referenceRecord?.starts_at || input.startsAt;
  if (!isAdmin && hasLessonStarted(lessonStartsAtForGuard)) {
    return jsonNoStore(
      {
        error:
          "This lesson has already started or passed, so self-service cancellation is no longer available. Contact LDA support if the lesson was not delivered correctly."
      },
      { status: 409 }
    );
  }

  if (cancellationActor === "learner" && !isAdmin && isAdvanceScheduledCancellation(input, referenceRecord)) {
    return jsonNoStore(
      {
        error: "Scheduled lessons reserve instructor diary time in advance, so learner self-service cancellation is not available. Contact LDA support if this needs review."
      },
      { status: 409 }
    );
  }

  const supabase = createAdminClient();
  const policyUrl = `${getAppOrigin(request)}/cancellation-policy`;
  const refundSummary = getRefundSummary(input.startsAt, input.bookingWindow);
  const nextReferencePaymentStatus = getRefundReviewPaymentStatus({
    actor: cancellationActor,
    startsAt: referenceRecord?.starts_at || input.startsAt,
    bookingWindow: input.bookingWindow,
    currentPaymentStatus: referenceRecord?.payment_status
  });
  const resolvedInstructorName = safeText(referenceRecord?.instructor_name || input.instructorName, "LDA instructor", 120);
  const resolvedLessonSummary = safeText(referenceRecord?.lesson_summary || input.lessonSummary, "", 180);
  const notificationInstructorId = safeText(booking?.instructor_id || referenceRecord?.instructor_id || input.instructorId, "", 80);
  const notificationLearnerId = safeText(booking?.learner_id || referenceRecord?.learner_id || input.learnerId, "", 80);
  const [learnerContactResult, instructorContactResult] = supabase
    ? await Promise.all([
        notificationLearnerId
          ? supabase.from("profiles").select("full_name,email,phone").eq("id", notificationLearnerId).maybeSingle()
          : Promise.resolve({ data: null }),
        notificationInstructorId
          ? supabase.from("profiles").select("full_name,email,phone").eq("id", notificationInstructorId).maybeSingle()
          : Promise.resolve({ data: null })
      ])
    : [{ data: null }, { data: null }];
  const learnerContact = learnerContactResult.data as ProfileContact | null;
  const instructorContact = instructorContactResult.data as ProfileContact | null;
  const learnerSms =
    cancellationActor === "instructor"
      ? `LDA lesson cancelled by instructor. Ref: ${bookingId}. Policy: ${policyUrl}`
      : `LDA lesson cancelled. Ref: ${bookingId}. ${refundSummary} Policy: ${policyUrl}`;
  const instructorSms =
    cancellationActor === "instructor"
      ? `You cancelled an LDA lesson. Ref: ${bookingId}. ${safeText(input.lessonSummary, "", 180)}`
      : `LDA lesson cancelled by learner. Ref: ${bookingId}. ${safeText(input.lessonSummary, "", 180)}`;
  const learnerEmail = safeEmail(
    cancellationActor === "learner"
      ? signedInProfile?.email || user.email || input.learnerEmail
      : referenceRecord?.learner_email || learnerContact?.email || input.learnerEmail
  );
  const learnerPhone = safeText(
    cancellationActor === "learner" ? signedInProfile?.phone || learnerContact?.phone || input.learnerPhone : referenceRecord?.learner_phone || learnerContact?.phone || input.learnerPhone,
    "",
    40
  );
  const resolvedInstructorEmail = safeEmail(
    cancellationActor === "instructor"
      ? signedInProfile?.email || user.email || input.instructorEmail
      : input.instructorEmail || referenceRecord?.instructor_email || instructorContact?.email
  );
  const lessonStartsAt = referenceRecord?.starts_at || input.startsAt;
  const learnerName = safeText(
    input.learnerName || learnerContact?.full_name || (cancellationActor === "learner" ? signedInProfile?.full_name : ""),
    "",
    120
  );

  await sendBookingCancellationEmails({
    bookingReference: bookingId,
    learnerEmail,
    instructorEmail: resolvedInstructorEmail,
    learnerName,
    instructorName: resolvedInstructorName,
    lessonSummary: resolvedLessonSummary,
    refundSummary,
    policyUrl,
    cancelledBy: cancellationActor
  });

  await Promise.all([
    sendSms({ to: learnerPhone, body: learnerSms }),
    notificationInstructorId ? sendSms({ to: safeText(cancellationActor === "instructor" ? signedInProfile?.phone || instructorContact?.phone || input.instructorPhone : instructorContact?.phone || input.instructorPhone, "", 40), body: instructorSms }) : Promise.resolve()
  ]);

  if (supabase) {
    const notificationRows: {
      user_id: string;
      booking_id: string | null;
      title: string;
      body: string;
      notification_type: string;
    }[] = [];
    const notificationBookingId = uuidPattern.test(bookingId) ? bookingId : null;

    if (notificationLearnerId) {
      notificationRows.push({
        user_id: notificationLearnerId,
        booking_id: notificationBookingId,
        title: cancellationActor === "instructor" ? "Instructor cancelled lesson" : "Lesson cancelled",
        body:
          cancellationActor === "instructor"
            ? `${resolvedInstructorName} cancelled your LDA lesson. Reference: ${bookingId}.`
            : `${refundSummary} Reference: ${bookingId}.`,
        notification_type: "booking_cancelled"
      });
    }

    if (notificationInstructorId) {
      notificationRows.push({
        user_id: notificationInstructorId,
        booking_id: notificationBookingId,
        title: cancellationActor === "instructor" ? "You cancelled a lesson" : "Learner cancelled lesson",
        body:
          cancellationActor === "instructor"
            ? `${resolvedLessonSummary || "You cancelled an LDA lesson."} Reference: ${bookingId}.`
            : `${resolvedLessonSummary || "A learner cancelled an LDA lesson."} Reference: ${bookingId}.`,
        notification_type: "booking_cancelled"
      });
    }

    if (notificationRows.length) {
      await supabase.from("notifications").insert(notificationRows);
    }
  }

  if (supabase && booking) {
    await supabase
      .from("bookings")
      .update({
        status: "cancelled",
        cancellation_reason: safeText(input.reason, `${cancellationActor} cancelled booking ${bookingId}`, 300)
      })
      .eq("id", bookingId);
  }

  if (supabase && referenceRecord) {
    await supabase
      .from("lesson_booking_records")
      .update({
        status: `cancelled_by_${cancellationActor}`,
        payment_status: nextReferencePaymentStatus
      })
      .eq("booking_reference", bookingId)
      .not("status", "in", "(cancelled,cancelled_by_learner,cancelled_by_instructor,completed,refunded,refund_requested,disputed)")
      .not("payment_status", "in", "(refunded,refund_pending,refund_requested,disputed)")
      .eq(cancellationActor === "instructor" ? "instructor_id" : "learner_id", cancellationActor === "instructor" ? referenceRecord.instructor_id : referenceRecord.learner_id);

    await supabase
      .from("lesson_booking_records")
      .update({
        cancellation_actor: cancellationActor,
        cancellation_reason: safeText(input.reason, `${cancellationActor} cancelled booking ${bookingId}`, 300),
        cancelled_by: user.id,
        cancelled_at: new Date().toISOString()
      })
      .eq("booking_reference", bookingId);
  }

  if (cancellationActor === "learner" && !isAdmin) {
    await enforceLearnerCancellationPolicy(notificationLearnerId || user.id, bookingId);
  }

  if (supabase && cancellationActor === "learner" && notificationInstructorId && lessonStartsAt) {
    const lessonStart = new Date(lessonStartsAt);

    if (!Number.isNaN(lessonStart.getTime())) {
      const slotWindowStart = new Date(lessonStart.getTime() - 60_000).toISOString();
      const slotWindowEnd = new Date(lessonStart.getTime() + 60_000).toISOString();

      await supabase
        .from("availability_slots")
        .update({ is_booked: false })
        .eq("instructor_id", notificationInstructorId)
        .gte("starts_at", slotWindowStart)
        .lt("starts_at", slotWindowEnd);
    }
  }

  return jsonNoStore({
    ok: true,
    refundSummary,
    message: "Cancellation confirmed. Learner and instructor notifications have been queued where contact details are available."
  });
}
