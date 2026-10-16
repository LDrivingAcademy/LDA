import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isRateLimited, jsonNoStore, rateLimitResponse, safeEmail, safeText } from "@/lib/security";
import { canUseMarketplaceRole, getMarketplaceRoleState } from "@/lib/account-route-guard";
import { sendLdaBrandedEmail } from "@/lib/email";

type ProgressFeedbackRequest = {
  learnerName?: string;
  learnerEmail?: string;
  instructorName?: string;
  lessonReference?: string;
  completedSkills?: string[];
  requiredChecklistSkills?: string[];
  totalChecklistSkills?: number;
  testReadySignedOff?: boolean;
  instructorNotes?: string;
  nextLessonFocus?: string;
  recommendedVideos?: string;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function hasText(value?: string) {
  return typeof value === "string" && value.trim().length > 0;
}

function uniqueSkillList(skills: string[]) {
  const skillsByKey = new Map<string, string>();

  for (const skill of skills) {
    const cleaned = safeText(skill, "", 80);
    if (cleaned) {
      skillsByKey.set(cleaned.toLowerCase(), cleaned);
    }
  }

  return Array.from(skillsByKey.values());
}

function flattenCompletedSkills(records: { completed_skills: string[] | null }[] | null) {
  return uniqueSkillList((records ?? []).flatMap((record) => record.completed_skills ?? []));
}

async function markReferencedLessonCompleted(input: {
  admin: NonNullable<ReturnType<typeof createAdminClient>>;
  lessonReference: string;
  instructorId: string;
  learnerId: string;
}) {
  const lessonReference = safeText(input.lessonReference, "", 80);

  if (!lessonReference) {
    return false;
  }

  const completedAt = new Date().toISOString();
  const [referenceUpdate, bookingUpdate] = await Promise.all([
    input.admin
      .from("lesson_booking_records")
      .update({ status: "completed", updated_at: completedAt })
      .eq("booking_reference", lessonReference)
      .eq("learner_id", input.learnerId)
      .eq("instructor_id", input.instructorId)
      .not("status", "ilike", "%cancel%"),
    uuidPattern.test(lessonReference)
      ? input.admin
          .from("bookings")
          .update({ status: "completed", updated_at: completedAt })
          .eq("id", lessonReference)
          .eq("learner_id", input.learnerId)
          .eq("instructor_id", input.instructorId)
          .not("status", "ilike", "%cancel%")
      : Promise.resolve({ error: null })
  ]);

  if (referenceUpdate.error) {
    throw new Error(referenceUpdate.error.message);
  }

  if (bookingUpdate.error) {
    throw new Error(bookingUpdate.error.message);
  }

  return true;
}

async function readProgressRequest(request: Request) {
  try {
    return (await request.json()) as ProgressFeedbackRequest;
  } catch {
    return null;
  }
}

async function sendProgressUpdatedNotification(input: {
  learnerEmail: string;
  learnerName: string;
  instructorName: string;
}) {
  const progressUrl = `${process.env.APP_WEBSITE_URL ?? "https://ldrivingacademy.co.uk"}/progress-tracker`;

  return sendLdaBrandedEmail({
    to: input.learnerEmail,
    subject: "Your LDA progress tracker has been updated",
    title: "Your LDA progress tracker has been updated",
    eyebrow: "Progress update",
    intro: `${input.instructorName} has updated your LDA progress tracker.`,
    bodyHtml: `
      <p style="margin:0 0 18px;color:#252525;font-size:16px;line-height:1.65;">Sign in to your learner dashboard to view the latest progress notes, completed topics, next lesson focus, and recommended resources.</p>
      <p style="margin:0 0 18px;color:#252525;font-size:16px;line-height:1.65;">For privacy, this email does not include your lesson progress details.</p>
    `,
    ctaLabel: "View progress tracker",
    ctaUrl: progressUrl,
    footerNote: "For privacy, lesson progress details are only available after signing in to your LDA account."
  });
}

async function sendTestReadyNotification(input: {
  learnerEmail: string;
  learnerName: string;
  instructorName: string;
}) {
  const progressUrl = `${process.env.APP_WEBSITE_URL ?? "https://ldrivingacademy.co.uk"}/progress-tracker`;
  const bookingUrl = "https://www.gov.uk/book-driving-test";

  return sendLdaBrandedEmail({
    to: input.learnerEmail,
    subject: "Your instructor has marked you test-ready",
    title: "Your instructor has marked you test-ready",
    eyebrow: "Test readiness",
    intro: `${input.instructorName} has signed off your LDA progress checklist and marked you as ready to start your practical test booking journey.`,
    bodyHtml: `
      <p style="margin:0 0 18px;color:#252525;font-size:16px;line-height:1.65;">Sign in to LDA to review your completed progress record, then use the official GOV.UK service to book your driving test yourself.</p>
      <p style="margin:0 0 18px;color:#252525;font-size:16px;line-height:1.65;">For safety and compliance, LDA and your instructor do not book the test for you. GOV.UK says learner drivers must book, change, swap, or cancel their own car driving test.</p>
    `,
    ctaLabel: "View LDA progress",
    ctaUrl: progressUrl,
    secondaryCtaLabel: "Book on GOV.UK",
    secondaryCtaUrl: bookingUrl
  });
}

export async function POST(request: Request) {
  if (isRateLimited(request, "progress-feedback", 20)) {
    return rateLimitResponse();
  }

  const input = await readProgressRequest(request);
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

  const [{ data: instructorProfile }, roleState] = await Promise.all([
    supabase.from("profiles").select("full_name,email").eq("id", user.id).maybeSingle(),
    getMarketplaceRoleState(supabase, user.id)
  ]);

  if (!canUseMarketplaceRole(roleState, "instructor")) {
    return jsonNoStore({ error: "Instructor approval is required before sending learner progress records." }, { status: 403 });
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

  const { data: previousProgressRecords, error: previousProgressError } = await admin
    .from("lesson_progress_records")
    .select("completed_skills")
    .eq("learner_id", learner.id)
    .order("sent_at", { ascending: true });

  if (previousProgressError) {
    return jsonNoStore({ error: previousProgressError.message }, { status: 500 });
  }

  const previouslyCompletedSkills = flattenCompletedSkills(previousProgressRecords);
  const submittedCompletedSkills = uniqueSkillList(input.completedSkills ?? []);
  const requiredChecklistSkills = uniqueSkillList(input.requiredChecklistSkills ?? []);
  const mergedCompletedSkills = uniqueSkillList([...previouslyCompletedSkills, ...submittedCompletedSkills]).slice(0, 40);
  const submittedChecklistTotal = Math.max(0, Math.min(Number(input.totalChecklistSkills ?? 0), 40));

  const payload = {
    learnerName,
    learnerEmail: learner.email,
    instructorName,
    lessonReference: safeText(input.lessonReference, "", 80),
    completedSkills: mergedCompletedSkills,
    totalChecklistSkills: Math.max(submittedChecklistTotal, mergedCompletedSkills.length),
    testReadySignedOff: Boolean(input.testReadySignedOff),
    instructorNotes: safeText(input.instructorNotes, "No notes added.", 4000),
    nextLessonFocus: safeText(input.nextLessonFocus, "No next-lesson focus added.", 1000),
    recommendedVideos: safeText(input.recommendedVideos, "", 1000)
  };
  const completedSkillKeys = new Set(payload.completedSkills.map((skill) => skill.toLowerCase()));
  const hasCompletedRequiredSkills =
    requiredChecklistSkills.length > 0 &&
    requiredChecklistSkills.every((skill) => completedSkillKeys.has(skill.toLowerCase()));
  const hasInstructorSignedEverySkill =
    payload.testReadySignedOff &&
    (hasCompletedRequiredSkills ||
      (requiredChecklistSkills.length === 0 &&
        payload.totalChecklistSkills > 0 &&
        payload.completedSkills.length >= payload.totalChecklistSkills));

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

    const lessonStatusUpdated = await markReferencedLessonCompleted({
      admin,
      lessonReference: payload.lessonReference,
      instructorId: user.id,
      learnerId: learner.id
    });

    const { error: notificationError } = await admin.from("notifications").insert({
      user_id: learner.id,
      booking_id: uuidPattern.test(payload.lessonReference) ? payload.lessonReference : null,
      title: "After lesson review updated",
      body: `${payload.instructorName} has updated your after lesson review and progress tracker. Reference: ${payload.lessonReference || "manual progress record"}.`,
      notification_type: "after_lesson_review"
    });

    if (notificationError) {
      throw new Error(notificationError.message);
    }

    await sendProgressUpdatedNotification({
      learnerEmail: payload.learnerEmail,
      learnerName: payload.learnerName,
      instructorName: payload.instructorName
    });
    if (hasInstructorSignedEverySkill) {
      await sendTestReadyNotification({
        learnerEmail: payload.learnerEmail,
        learnerName: payload.learnerName,
        instructorName: payload.instructorName
      });
    }
    return jsonNoStore({
      lessonStatusUpdated,
      mode: process.env.RESEND_API_KEY ? "live" : "demo",
      message: process.env.RESEND_API_KEY
        ? hasInstructorSignedEverySkill
          ? "Progress saved. The learner has been notified that their instructor marked them test-ready and given the official GOV.UK booking link."
          : "Progress saved to the learner profile and the learner has been notified."
        : hasInstructorSignedEverySkill
          ? "Progress saved. Add RESEND_API_KEY to send the test-ready learner email."
          : "Progress saved to the learner profile. Add RESEND_API_KEY to send notification emails."
    });
  } catch (error) {
    return jsonNoStore({ error: error instanceof Error ? error.message : "Progress notification failed." }, { status: 500 });
  }
}
