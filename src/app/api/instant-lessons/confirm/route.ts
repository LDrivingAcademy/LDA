import { NextResponse } from "next/server";
import { sendInstantBookingConfirmationEmail } from "@/lib/email";
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
  const input = (await request.json()) as InstantConfirmRequest;

  if (!input.reference || !input.learnerEmail) {
    return NextResponse.json({ error: "Reference and learner email are required." }, { status: 400 });
  }

  await sendInstantBookingConfirmationEmail({
    reference: input.reference,
    learnerEmail: input.learnerEmail,
    learnerName: input.learnerName ?? "Learner",
    instructorName: input.instructorName ?? "your LDA instructor",
    lessonSummary: input.lessonSummary ?? "Instant LDA lesson"
  });

  await sendSms({
    to: input.learnerPhone,
    body: `LDA instant lesson confirmed. Reference: ${input.reference}. Thank you for booking ${input.instructorName ?? "your LDA instructor"}.`
  });

  return NextResponse.json({
    ok: true,
    message: "Instant booking confirmation email and text confirmation sent or skipped when provider keys are not configured."
  });
}
