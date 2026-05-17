import { sendBookingCancellationEmails } from "@/lib/email";
import { isRateLimited, jsonNoStore, rateLimitResponse, safeEmail, safeText } from "@/lib/security";
import { sendSms } from "@/lib/sms";
import { createAdminClient } from "@/lib/supabase/admin";

type CancelBookingRequest = {
  bookingId: string;
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
  reason?: string;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getRefundSummary(startsAt: string) {
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

export async function POST(request: Request) {
  if (isRateLimited(request, "booking-cancel", 12)) {
    return rateLimitResponse();
  }

  const input = (await request.json()) as CancelBookingRequest;
  const bookingId = safeText(input.bookingId, "", 80);
  if (!bookingId || !safeText(input.instructorName, "", 120) || !safeText(input.lessonSummary, "", 180)) {
    return jsonNoStore({ error: "Booking reference, instructor name, and lesson summary are required." }, { status: 400 });
  }

  const policyUrl = `${process.env.APP_WEBSITE_URL ?? "https://ldrivingacademy.co.uk"}/cancellation-policy`;
  const refundSummary = getRefundSummary(input.startsAt);
  const learnerSms = `LDA lesson cancelled. Ref: ${bookingId}. ${refundSummary} Policy: ${policyUrl}`;
  const instructorSms = `LDA lesson cancelled by learner. Ref: ${bookingId}. ${safeText(input.lessonSummary, "", 180)}`;

  await sendBookingCancellationEmails({
    bookingReference: bookingId,
    learnerEmail: safeEmail(input.learnerEmail),
    instructorEmail: safeEmail(input.instructorEmail),
    learnerName: safeText(input.learnerName, "", 120),
    instructorName: safeText(input.instructorName, "", 120),
    lessonSummary: safeText(input.lessonSummary, "", 180),
    refundSummary,
    policyUrl
  });

  await Promise.all([
    sendSms({ to: input.learnerPhone, body: learnerSms }),
    sendSms({ to: input.instructorPhone, body: instructorSms })
  ]);

  const supabase = createAdminClient();

  if (supabase && uuidPattern.test(bookingId)) {
    await supabase
      .from("bookings")
      .update({
        status: "cancelled",
        cancellation_reason: safeText(input.reason, "Learner cancelled from account centre", 300)
      })
      .eq("id", bookingId);

    const notifications: {
      user_id: string;
      booking_id: string;
      title: string;
      body: string;
      notification_type: string;
    }[] = [];

    if (input.learnerId) {
      notifications.push({
        user_id: input.learnerId,
        booking_id: bookingId,
        title: "Lesson cancelled",
        body: refundSummary,
        notification_type: "booking_cancelled"
      });
    }

    if (input.instructorId) {
      notifications.push({
        user_id: input.instructorId,
        booking_id: bookingId,
        title: "Learner cancelled lesson",
        body: safeText(input.lessonSummary, "", 180),
        notification_type: "booking_cancelled"
      });
    }

    if (notifications.length) {
      await supabase.from("notifications").insert(notifications);
    }
  }

  return jsonNoStore({
    ok: true,
    refundSummary,
    message: "Cancellation confirmed. Learner and instructor notifications have been queued where contact details are available."
  });
}
