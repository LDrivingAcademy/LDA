import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isRateLimited, jsonNoStore, rateLimitResponse, safeEmail, safeText } from "@/lib/security";

type ProgressFeedbackRequest = {
  learnerName?: string;
  learnerEmail?: string;
  instructorName?: string;
  lessonReference?: string;
  completedSkills?: string[];
  totalChecklistSkills?: number;
  testReadySignedOff?: boolean;
  instructorNotes?: string;
  nextLessonFocus?: string;
  recommendedVideos?: string;
};

function hasText(value?: string) {
  return typeof value === "string" && value.trim().length > 0;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    return { skipped: true };
  }

  const fromAddress = process.env.RESEND_FROM_EMAIL ?? "info@ldrivingacademy.co.uk";
  const from = fromAddress.includes("<") && fromAddress.includes(">") ? fromAddress : `L Driving Academy <${fromAddress}>`;
  const replyTo = process.env.RESEND_REPLY_TO_EMAIL ?? process.env.APP_SUPPORT_EMAIL ?? "info@ldrivingacademy.co.uk";
  const progressUrl = `${process.env.APP_WEBSITE_URL ?? "https://ldrivingacademy.co.uk"}/progress-tracker`;
  const learnerName = escapeHtml(input.learnerName);
  const instructorName = escapeHtml(input.instructorName);
  const escapedUrl = escapeHtml(progressUrl);
  const html = `
    <div style="font-family: Arial, sans-serif; color: #111; line-height: 1.6;">
      <h1>Your LDA progress tracker has been updated</h1>
      <p>Hello ${learnerName},</p>
      <p>${instructorName} has updated your LDA progress tracker.</p>
      <p>Sign in to your learner dashboard to view the latest progress notes, completed topics, next lesson focus, and recommended resources.</p>
      <p style="margin: 28px 0;">
        <a href="${escapedUrl}" style="display:inline-block;background:#ed1b24;color:#fff;text-decoration:none;font-weight:800;padding:14px 22px;border-radius:999px;">
          View progress tracker
        </a>
      </p>
      <p>For privacy, this email does not include your lesson progress details.</p>
    </div>
  `;
  const text = [
    `Hello ${input.learnerName},`,
    "",
    `${input.instructorName} has updated your LDA progress tracker.`,
    "Sign in to your learner dashboard to view the latest progress notes, completed topics, next lesson focus, and recommended resources.",
    "",
    progressUrl,
    "",
    "For privacy, this email does not include your lesson progress details."
  ].join("\n");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: input.learnerEmail,
      subject: "Your LDA progress tracker has been updated",
      html,
      text,
      reply_to: replyTo
    })
  });

  if (!response.ok) {
    throw new Error(`Progress notification email failed with status ${response.status}`);
  }

  return response.json();
}

async function sendTestReadyNotification(input: {
  learnerEmail: string;
  learnerName: string;
  instructorName: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    return { skipped: true };
  }

  const fromAddress = process.env.RESEND_FROM_EMAIL ?? "info@ldrivingacademy.co.uk";
  const from = fromAddress.includes("<") && fromAddress.includes(">") ? fromAddress : `L Driving Academy <${fromAddress}>`;
  const replyTo = process.env.RESEND_REPLY_TO_EMAIL ?? process.env.APP_SUPPORT_EMAIL ?? "info@ldrivingacademy.co.uk";
  const progressUrl = `${process.env.APP_WEBSITE_URL ?? "https://ldrivingacademy.co.uk"}/progress-tracker`;
  const bookingUrl = "https://www.gov.uk/book-driving-test";
  const learnerName = escapeHtml(input.learnerName);
  const instructorName = escapeHtml(input.instructorName);
  const escapedProgressUrl = escapeHtml(progressUrl);
  const escapedBookingUrl = escapeHtml(bookingUrl);
  const html = `
    <div style="font-family: Arial, sans-serif; color: #111; line-height: 1.6;">
      <h1>Your instructor has marked you test-ready</h1>
      <p>Hello ${learnerName},</p>
      <p>${instructorName} has signed off your LDA progress checklist and marked you as ready to start your practical test booking journey.</p>
      <p>Sign in to LDA to review your completed progress record, then use the official GOV.UK service to book your driving test yourself.</p>
      <p style="margin: 28px 0;">
        <a href="${escapedProgressUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;font-weight:800;padding:14px 22px;border-radius:999px;margin-right:8px;">
          View LDA progress
        </a>
        <a href="${escapedBookingUrl}" style="display:inline-block;background:#ed1b24;color:#fff;text-decoration:none;font-weight:800;padding:14px 22px;border-radius:999px;">
          Book on GOV.UK
        </a>
      </p>
      <p>For safety and compliance, LDA and your instructor do not book the test for you. GOV.UK says learner drivers must book, change, swap, or cancel their own car driving test.</p>
    </div>
  `;
  const text = [
    `Hello ${input.learnerName},`,
    "",
    `${input.instructorName} has signed off your LDA progress checklist and marked you as ready to start your practical test booking journey.`,
    "Sign in to LDA to review your completed progress record, then use the official GOV.UK service to book your driving test yourself.",
    "",
    `LDA progress: ${progressUrl}`,
    `Official GOV.UK booking: ${bookingUrl}`,
    "",
    "For safety and compliance, LDA and your instructor do not book the test for you. GOV.UK says learner drivers must book, change, swap, or cancel their own car driving test."
  ].join("\n");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: input.learnerEmail,
      subject: "Your instructor has marked you test-ready",
      html,
      text,
      reply_to: replyTo
    })
  });

  if (!response.ok) {
    throw new Error(`Test-ready email failed with status ${response.status}`);
  }

  return response.json();
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
    totalChecklistSkills: Math.max(0, Math.min(Number(input.totalChecklistSkills ?? 0), 40)),
    testReadySignedOff: Boolean(input.testReadySignedOff),
    instructorNotes: safeText(input.instructorNotes, "No notes added.", 4000),
    nextLessonFocus: safeText(input.nextLessonFocus, "No next-lesson focus added.", 1000),
    recommendedVideos: safeText(input.recommendedVideos, "", 1000)
  };
  const hasInstructorSignedEverySkill =
    payload.testReadySignedOff &&
    payload.totalChecklistSkills > 0 &&
    payload.completedSkills.length === payload.totalChecklistSkills;

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
