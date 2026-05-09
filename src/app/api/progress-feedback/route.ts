import { NextResponse } from "next/server";
import { sendProgressFeedbackEmail } from "@/lib/email";

type ProgressFeedbackRequest = {
  learnerName?: string;
  learnerEmail?: string;
  instructorName?: string;
  lessonReference?: string;
  completedSkills?: string[];
  instructorNotes?: string;
  nextLessonFocus?: string;
  recommendedVideos?: string;
};

function hasText(value?: string) {
  return typeof value === "string" && value.trim().length > 0;
}

export async function POST(request: Request) {
  const input = (await request.json()) as ProgressFeedbackRequest;

  if (!hasText(input.learnerName) || !hasText(input.learnerEmail) || !hasText(input.instructorName)) {
    return NextResponse.json({ error: "Learner name, learner email, and instructor name are required." }, { status: 400 });
  }

  const payload = {
    learnerName: input.learnerName!,
    learnerEmail: input.learnerEmail!,
    instructorName: input.instructorName!,
    lessonReference: input.lessonReference,
    completedSkills: input.completedSkills ?? [],
    instructorNotes: input.instructorNotes ?? "No notes added.",
    nextLessonFocus: input.nextLessonFocus ?? "No next-lesson focus added.",
    recommendedVideos: input.recommendedVideos ?? ""
  };

  try {
    await sendProgressFeedbackEmail(payload);
    return NextResponse.json({
      mode: process.env.RESEND_API_KEY ? "live" : "demo",
      message: process.env.RESEND_API_KEY
        ? "Progress feedback email sent."
        : "Progress feedback saved in demo mode. Add RESEND_API_KEY to send real emails."
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Feedback email failed." }, { status: 500 });
  }
}
