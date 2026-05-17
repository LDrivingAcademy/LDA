import { sendBookingConfirmationEmails } from "@/lib/email";
import { isRateLimited, jsonNoStore, rateLimitResponse, safeEmail, safeText } from "@/lib/security";
import { sendSms } from "@/lib/sms";
import { createAdminClient } from "@/lib/supabase/admin";

type ConfirmRequest = {
  bookingId: string;
  learnerId?: string;
  instructorId?: string;
  learnerEmail?: string;
  learnerPhone?: string;
  instructorEmail?: string;
  instructorName: string;
  lessonSummary: string;
};

export async function POST(request: Request) {
  if (isRateLimited(request, "booking-confirm", 20)) {
    return rateLimitResponse();
  }

  const input = (await request.json()) as ConfirmRequest;
  const bookingId = safeText(input.bookingId, "", 80);
  const instructorName = safeText(input.instructorName, "", 120);
  const lessonSummary = safeText(input.lessonSummary, "", 180);
  if (!bookingId || !instructorName || !lessonSummary) {
    return jsonNoStore({ error: "Booking reference, instructor name, and lesson summary are required." }, { status: 400 });
  }

  const manageUrl = `${process.env.APP_WEBSITE_URL ?? "https://ldrivingacademy.co.uk"}/dashboard`;

  await sendBookingConfirmationEmails({
    bookingReference: bookingId,
    learnerEmail: safeEmail(input.learnerEmail),
    instructorEmail: safeEmail(input.instructorEmail),
    instructorName,
    lessonSummary,
    manageUrl
  });

  await sendSms({
    to: input.learnerPhone,
    body: `LDA booking confirmed. Reference: ${bookingId}. Thank you for booking ${instructorName}. Only share this reference with your instructor when they arrive.`
  });

  const supabase = createAdminClient();

  if (supabase && input.instructorId) {
    await supabase.from("notifications").insert({
      user_id: input.instructorId,
      booking_id: bookingId,
      title: "New paid LDA booking",
      body: lessonSummary,
      notification_type: "booking_paid"
    });
  }

  return jsonNoStore({
    ok: true,
    message: "Learner email, text confirmation, instructor email, and instructor notification flow completed or queued."
  });
}
