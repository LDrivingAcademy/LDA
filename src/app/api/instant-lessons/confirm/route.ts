import { NextResponse } from "next/server";
import { sendInstantBookingConfirmationEmail } from "@/lib/email";

type InstantConfirmRequest = {
  reference?: string;
  learnerEmail?: string;
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

  return NextResponse.json({
    ok: true,
    message: "Instant booking confirmation email sent or skipped in demo mode."
  });
}
