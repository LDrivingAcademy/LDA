import { sendProgressFeedbackEmail } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isRateLimited, jsonNoStore, rateLimitResponse, readJsonBody, safeEmail, safeText } from "@/lib/security";

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

  const input = await readJsonBody<ProgressFeedbackRequest>(request);
  if (!input) {
    return jsonNoStore({ error: "Invalid progress feedback request." }, { status: 400 });
  }

  const supabase = await createClient();
  const admin = createAdminClient();

  if (!supabase || !admin) {
    return jsonNoStore({ error: "Progress records are not configured." }, { status: 503 });
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonNoStore({ error: "Sign in as an instructor before sending progress." }, { status: 401 });
  }

  const [{ data: roles }, { data: instructorProfile }] = await Promise.all([
    supabase.from("account_roles").select("role").eq("user_id", user.id),
    supabase.from("profiles").select("full_name,email").eq("id", user.id).maybeSingle()
  ]);
  const isInstructor = roles?.some((accountRole) => accountRole.role === "instructor") ?? false;

  if (!isInstructor) {
    return jsonNoStore({ error: "Only instructors can edit and send learner progress records." }, { status: 403 });
  }

  const learnerName = safeText(input.learnerName, "", 120);
  const submittedLearnerEmail = safeEmail(input.learnerEmail);
  const instructorName = safeText(instructorProfile?.full_name || user.email || "LDA instructor", "LDA instructor", 120);

  if (!hasText(learnerName) || !submittedLearnerEmail || !hasText(instructorName)) {
    return jsonNoStore({ error: "Learner name, learner email, and instructor name are required." }, { status: 400 });
  }

  const { data: learners, error: learnerError } = await admin
    .from("profiles")
    .select("id,full_name,email,account_roles!inner(role)")
    .ilike("full_name", learnerName)
    .eq("email", submittedLearnerEmail)
    .eq("account_roles.role", "learner")
    .limit(1);

  if (learnerError) {
    return jsonNoStore({ error: learnerError.message }, { status: 500 });
  }

  const learner = learners?.[0];

  if (!learner?.id || !learner.email) {
    return jsonNoStore({ error: "Learner email does not match a learner account." }, { status: 400 });
  }

  const payload = {
    learnerName,
    learnerEmail: learner.email,
    instructorName,
    lessonReference: safeText(input.lessonReference, "", 80),
    completedSkills: (input.completedSkills ?? []).slice(0, 40).map((skill) => safeText(skill, "", 80)),
    instructorNotes: safeText(input.instructorNotes, "No notes added.", 4000),
    nextLessonFocus: safeText(input.nextLessonFocus, "No next-lesson focus added.", 1000),
    recommendedVideos: safeText(input.recommendedVideos, "", 1000)
  };

  try {
    const { error: recordError } = await admin.from("lesson_progress_records").insert({
      instructor_id: user.id,
      learner_id: learner.id,
      learner_name: learner.full_name || learnerName,
      learner_email: learner.email,
      instructor_name: instructorName,
      lesson_reference: payload.lessonReference,
      completed_skills: payload.completedSkills,
      instructor_notes: payload.instructorNotes,
      next_lesson_focus: payload.nextLessonFocus,
      recommended_videos: payload.recommendedVideos
    });

    if (recordError) {
      return jsonNoStore({ error: recordError.message }, { status: 500 });
    }

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
