import { NextResponse } from "next/server";
import { sendBookingConfirmationEmails } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";

type ConfirmRequest = {
  bookingId: string;
  learnerId?: string;
  instructorId?: string;
  learnerEmail?: string;
  instructorEmail?: string;
  instructorName: string;
  lessonSummary: string;
};

export async function POST(request: Request) {
  const input = (await request.json()) as ConfirmRequest;
  const manageUrl = `${process.env.APP_WEBSITE_URL ?? "https://ldrivingacademy.co.uk"}/dashboard`;

  await sendBookingConfirmationEmails({
    learnerEmail: input.learnerEmail,
    instructorEmail: input.instructorEmail,
    instructorName: input.instructorName,
    lessonSummary: input.lessonSummary,
    manageUrl
  });

  const supabase = createAdminClient();

  if (supabase && input.instructorId) {
    await supabase.from("notifications").insert({
      user_id: input.instructorId,
      booking_id: input.bookingId,
      title: "New paid LDA booking",
      body: input.lessonSummary,
      notification_type: "booking_paid"
    });
  }

  return NextResponse.json({
    ok: true,
    message: "Learner email, instructor email, and instructor notification flow completed or queued."
  });
}
