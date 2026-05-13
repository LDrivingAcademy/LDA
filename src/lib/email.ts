type BookingEmailInput = {
  learnerEmail?: string;
  instructorEmail?: string;
  instructorName: string;
  lessonSummary: string;
  manageUrl: string;
};

type InstantBookingEmailInput = {
  reference: string;
  learnerEmail: string;
  learnerName: string;
  instructorName: string;
  lessonSummary: string;
};

type SupportEscalationInput = {
  role: "learner" | "instructor" | "admin";
  name?: string;
  email?: string;
  bookingReference?: string;
  subject: string;
  message: string;
  assistantSummary?: string;
  urgent?: boolean;
};

type ProgressFeedbackEmailInput = {
  learnerName: string;
  learnerEmail: string;
  instructorName: string;
  lessonReference?: string;
  completedSkills: string[];
  instructorNotes: string;
  nextLessonFocus: string;
  recommendedVideos: string;
};

type AuthMagicLinkEmailInput = {
  to: string;
  fullName?: string;
  role: "learner" | "instructor";
  confirmUrl: string;
};

export function canSendTransactionalEmail() {
  return Boolean(process.env.RESEND_API_KEY);
}

function getSenderAddress() {
  const from = process.env.RESEND_FROM_EMAIL ?? "info@ldrivingacademy.co.uk";
  if (from.includes("<") && from.includes(">")) {
    return from;
  }

  return `L Driving Academy <${from}>`;
}

function htmlToText(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<li>/gi, "- ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#039;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function sendResendEmail(to: string, subject: string, html: string, text = htmlToText(html)) {
  const apiKey = process.env.RESEND_API_KEY;
  const replyTo = process.env.RESEND_REPLY_TO_EMAIL ?? process.env.APP_SUPPORT_EMAIL ?? "info@ldrivingacademy.co.uk";

  if (!apiKey) {
    return { skipped: true };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: getSenderAddress(),
      to,
      subject,
      html,
      text,
      reply_to: replyTo
    })
  });

  if (!response.ok) {
    throw new Error(`Resend email failed with status ${response.status}`);
  }

  return response.json();
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function sendBookingConfirmationEmails(input: BookingEmailInput) {
  const learnerHtml = `
    <h1>Thank you for booking ${input.instructorName}</h1>
    <p>${input.lessonSummary}</p>
    <p>You can manage your lesson, cancellation policy, and live tracking from your LDA dashboard.</p>
    <p><a href="${input.manageUrl}">Open booking</a></p>
  `;
  const instructorHtml = `
    <h1>New paid LDA booking</h1>
    <p>${input.lessonSummary}</p>
    <p>The learner has booked you for this lesson. Please open your dashboard to accept, prepare, or start en route tracking near pickup time.</p>
    <p><a href="${input.manageUrl}">Open instructor dashboard</a></p>
  `;

  const tasks = [];

  if (input.learnerEmail) {
    tasks.push(sendResendEmail(input.learnerEmail, `Thank you for booking ${input.instructorName}`, learnerHtml));
  }

  if (input.instructorEmail) {
    tasks.push(sendResendEmail(input.instructorEmail, "New paid LDA lesson booking", instructorHtml));
  }

  return Promise.all(tasks);
}

export async function sendInstantBookingConfirmationEmail(input: InstantBookingEmailInput) {
  const learnerName = escapeHtml(input.learnerName);
  const instructorName = escapeHtml(input.instructorName);
  const lessonSummary = escapeHtml(input.lessonSummary);
  const reference = escapeHtml(input.reference);
  const html = `
    <div style="font-family: Arial, sans-serif; color: #111; line-height: 1.6;">
      <h1>Thank you for booking with L Driving Academy</h1>
      <p>Hello ${learnerName},</p>
      <p>Your instant driving lesson booking has been received for <strong>${instructorName}</strong>.</p>
      <p>${lessonSummary}</p>
      <div style="margin: 24px 0; padding: 18px; background: #f4f4f5; border-radius: 8px;">
        <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #52525b;">Your confirmation number</div>
        <div style="font-size: 28px; font-weight: 900; letter-spacing: 1px;">${reference}</div>
      </div>
      <p>Please keep this confirmation number ready so your instructor can confirm the booking belongs to you.</p>
      <p>Thank you for choosing L Driving Academy.</p>
    </div>
  `;

  return sendResendEmail(
    input.learnerEmail,
    `L Driving Academy booking confirmation ${input.reference}`,
    html
  );
}

export async function sendSupportEscalationEmail(input: SupportEscalationInput) {
  const supportEmail = process.env.LDA_SUPPORT_ESCALATION_EMAIL ?? process.env.APP_SUPPORT_EMAIL ?? "info@ldrivingacademy.co.uk";
  const role = escapeHtml(input.role);
  const name = escapeHtml(input.name || "Not provided");
  const email = escapeHtml(input.email || "Not provided");
  const bookingReference = escapeHtml(input.bookingReference || "Not provided");
  const subject = escapeHtml(input.subject);
  const message = escapeHtml(input.message);
  const assistantSummary = escapeHtml(input.assistantSummary || "No assistant summary available.");
  const priority = input.urgent ? "Urgent" : "Standard";

  const html = `
    <div style="font-family: Arial, sans-serif; color: #111; line-height: 1.6;">
      <h1>LDA support escalation</h1>
      <p><strong>Priority:</strong> ${priority}</p>
      <p><strong>Role:</strong> ${role}</p>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Booking reference:</strong> ${bookingReference}</p>
      <h2>Issue</h2>
      <p>${message}</p>
      <h2>Assistant summary</h2>
      <p>${assistantSummary}</p>
    </div>
  `;

  return sendResendEmail(supportEmail, `${priority} LDA support: ${subject}`, html);
}

export async function sendProgressFeedbackEmail(input: ProgressFeedbackEmailInput) {
  const learnerName = escapeHtml(input.learnerName);
  const instructorName = escapeHtml(input.instructorName);
  const lessonReference = escapeHtml(input.lessonReference || "Not provided");
  const instructorNotes = escapeHtml(input.instructorNotes);
  const nextLessonFocus = escapeHtml(input.nextLessonFocus);
  const recommendedVideos = escapeHtml(input.recommendedVideos || "No videos added.");
  const completedSkills = input.completedSkills.length
    ? input.completedSkills.map((skill) => `<li>${escapeHtml(skill)}</li>`).join("")
    : "<li>No skills marked complete yet.</li>";

  const html = `
    <div style="font-family: Arial, sans-serif; color: #111; line-height: 1.6;">
      <h1>Your LDA lesson progress update</h1>
      <p>Hello ${learnerName},</p>
      <p>${instructorName} has sent feedback after your lesson.</p>
      <p><strong>Lesson reference:</strong> ${lessonReference}</p>
      <h2>Completed skills</h2>
      <ul>${completedSkills}</ul>
      <h2>Instructor notes</h2>
      <p>${instructorNotes}</p>
      <h2>Before your next lesson</h2>
      <p>${nextLessonFocus}</p>
      <h2>Recommended videos or links</h2>
      <p>${recommendedVideos.replace(/\n/g, "<br />")}</p>
      <p>Keeping this progress record helps avoid repeating covered topics and keeps the next lesson focused.</p>
    </div>
  `;

  return sendResendEmail(input.learnerEmail, `LDA lesson progress update from ${input.instructorName}`, html);
}

export async function sendAuthMagicLinkEmail(input: AuthMagicLinkEmailInput) {
  const name = escapeHtml(input.fullName || "there");
  const roleLabel = input.role === "instructor" ? "instructor" : "learner";
  const confirmUrl = escapeHtml(input.confirmUrl);
  const text = [
    `Hello ${input.fullName || "there"},`,
    "",
    `Use this secure link to confirm your email and continue your ${roleLabel} setup with L Driving Academy:`,
    input.confirmUrl,
    "",
    "You can open this link on your phone, laptop, or tablet. It does not need to be opened on the same device that requested it.",
    "",
    "If you did not request this email, you can ignore it."
  ].join("\n");
  const html = `
    <div style="font-family: Arial, sans-serif; color: #111; line-height: 1.6;">
      <h1>Your secure LDA login link</h1>
      <p>Hello ${name},</p>
      <p>Click the button below to confirm your email and continue your ${roleLabel} setup with L Driving Academy.</p>
      <p style="margin: 28px 0;">
        <a href="${confirmUrl}" style="display:inline-block;background:#ed1b24;color:#fff;text-decoration:none;font-weight:800;padding:14px 22px;border-radius:999px;">
          Continue to LDA
        </a>
      </p>
      <p>This link can be opened on your phone, laptop, or tablet. It does not need to be opened on the same device that requested it.</p>
      <p>If the button does not work, copy and paste this link into your browser:</p>
      <p><a href="${confirmUrl}">${confirmUrl}</a></p>
      <p>If you did not request this email, you can safely ignore it.</p>
    </div>
  `;

  return sendResendEmail(input.to, "Your L Driving Academy login link", html, text);
}
