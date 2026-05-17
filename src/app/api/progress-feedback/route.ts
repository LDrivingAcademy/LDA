import { sendProgressFeedbackEmail } from "@/lib/email";
import { isRateLimited, jsonNoStore, rateLimitResponse, safeEmail, safeText } from "@/lib/security";

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
  if (isRateLimited(request, "progress-feedback", 20)) {
    return rateLimitResponse();
  }

  const input = (await request.json()) as ProgressFeedbackRequest;
  const learnerName = safeText(input.learnerName, "", 120);
  const learnerEmail = safeEmail(input.learnerEmail);
  const instructorName = safeText(input.instructorName, "", 120);

  if (!hasText(learnerName) || !learnerEmail || !hasText(instructorName)) {
    return jsonNoStore({ error: "Learner name, learner email, and instructor name are required." }, { status: 400 });
  }

  const payload = {
    learnerName,
    learnerEmail,
    instructorName,
    lessonReference: safeText(input.lessonReference, "", 80),
    completedSkills: (input.completedSkills ?? []).slice(0, 40).map((skill) => safeText(skill, "", 80)),
    instructorNotes: safeText(input.instructorNotes, "No notes added.", 4000),
    nextLessonFocus: safeText(input.nextLessonFocus, "No next-lesson focus added.", 1000),
    recommendedVideos: safeText(input.recommendedVideos, "", 1000)
  };

  try {
    await sendProgressFeedbackEmail(payload);
    return jsonNoStore({
      mode: process.env.RESEND_API_KEY ? "live" : "demo",
      message: process.env.RESEND_API_KEY
        ? "Progress feedback email sent."
        : "Progress feedback saved in demo mode. Add RESEND_API_KEY to send real emails."
    });
  } catch (error) {
    return jsonNoStore({ error: error instanceof Error ? error.message : "Feedback email failed." }, { status: 500 });
  }
}
