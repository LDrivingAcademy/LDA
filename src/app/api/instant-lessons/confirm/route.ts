import { sendInstantBookingConfirmationEmail } from "@/lib/email";
import { isRateLimited, jsonNoStore, rateLimitResponse, safeEmail, safeText } from "@/lib/security";
import { sendSms } from "@/lib/sms";

type InstantConfirmRequest = {
  reference?: string;
  learnerEmail?: string;
  learnerPhone?: string;
  learnerName?: string;
  instructorName?: string;
  lessonSummary?: string;
};

export async function POST(request: Request) {
  if (isRateLimited(request, "instant-confirm", 20)) {
    return rateLimitResponse();
  }

  const input = (await request.json()) as InstantConfirmRequest;
  const reference = safeText(input.reference, "", 80);
  const learnerEmail = safeEmail(input.learnerEmail);

  if (!reference || !learnerEmail) {
    return jsonNoStore({ error: "Reference and learner email are required." }, { status: 400 });
  }

  await sendInstantBookingConfirmationEmail({
    reference,
    learnerEmail,
    learnerName: safeText(input.learnerName, "Learner", 120),
    instructorName: safeText(input.instructorName, "your LDA instructor", 120),
    lessonSummary: safeText(input.lessonSummary, "Instant LDA lesson", 180)
  });

  await sendSms({
    to: input.learnerPhone,
    body: `LDA instant lesson confirmed. Reference: ${reference}. Thank you for booking ${safeText(input.instructorName, "your LDA instructor", 120)}.`
  });

  return jsonNoStore({
    ok: true,
    message: "Instant booking confirmation email and text confirmation sent or skipped when provider keys are not configured."
  });
}
