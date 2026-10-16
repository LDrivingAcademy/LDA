type BookingEmailInput = {
  bookingReference: string;
  learnerEmail?: string;
  instructorEmail?: string;
  instructorName: string;
  lessonSummary: string;
  manageUrl: string;
};

type BookingCancellationEmailInput = {
  bookingReference: string;
  learnerEmail?: string;
  instructorEmail?: string;
  learnerName?: string;
  instructorName: string;
  lessonSummary: string;
  refundSummary: string;
  policyUrl: string;
  cancelledBy?: "learner" | "instructor";
};

type InstructorEnRouteEmailInput = {
  learnerEmail: string;
  instructorName: string;
  bookingReference: string;
  lessonSummary: string;
  trackingUrl: string;
};

type InstantBookingEmailInput = {
  reference: string;
  learnerEmail: string;
  learnerName: string;
  instructorName: string;
  lessonSummary: string;
  trackingUrl: string;
  idempotencyKey?: string;
};

type SupportEscalationInput = {
  role: "guest" | "learner" | "instructor" | "admin" | "support";
  name?: string;
  email?: string;
  bookingReference?: string;
  subject: string;
  message: string;
  assistantSummary?: string;
  urgent?: boolean;
};

type SupportTicketConfirmationInput = {
  to: string;
  reference: string;
  categoryLabel: string;
  priority: "standard" | "urgent" | "critical";
  idempotencyKey?: string;
};

type SupportTicketResolvedInput = {
  to: string;
  reference: string;
  categoryLabel: string;
  idempotencyKey?: string;
};

type OffPlatformReportEmailInput = {
  id: string;
  reference: string;
  learnerName: string;
  learnerEmail: string;
  instructorName: string;
  incidentDate: string;
  additionalDates?: string;
  details: string;
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

type InstructorVerificationSubmittedEmailInput = {
  to: string;
  fullName?: string;
  statusUrl: string;
};

type InstructorDocumentReviewEmailInput = {
  to: string;
  fullName?: string;
  documentLabel: string;
  statusUrl: string;
  reason?: string;
};

type PasswordResetEmailInput = {
  to: string;
  role: "learner" | "instructor" | "admin";
  confirmUrl: string;
};

type EmailContent = {
  subject: string;
  html: string;
  text: string;
};

type ProductFeedbackEmailInput = {
  issue: string;
  summary: string;
  pageUrl?: string;
};

type SubscriptionConfirmationEmailInput = {
  to: string;
  packageName: string;
  previousPackageName?: string;
  role: "learner" | "instructor";
  changeType?: "activation" | "upgrade" | "downgrade" | "change";
  billingLabel?: string;
  priceLabel?: string;
  dashboardUrl?: string;
  packageSummary?: string;
  featuresUrl?: string;
  idempotencyKey?: string;
};

type SubscriptionCancellationEmailInput = {
  to: string;
  role: "learner" | "instructor";
  previousPackageName?: string;
  freePackageName: string;
  dashboardUrl?: string;
  idempotencyKey?: string;
};

type SiteHealthAlertEmailInput = {
  to: string;
  status: "degraded" | "fail";
  target: string;
  checkedAt: string;
  successRate: number;
  threshold: number;
  total: number;
  ok: number;
  failed: number;
  slow: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
  failures: Array<{ name: string; status: number; durationMs: number; attempts: number; message: string }>;
  slowChecks: Array<{ name: string; status: number; durationMs: number; attempts: number; message: string }>;
  reason?: string;
  idempotencyKey?: string;
};

type AdminNoticeEmailInput = {
  to: string;
  subject: string;
  title: string;
  body: string;
  idempotencyKey?: string;
};

type PrivilegedLoginPriorityAlertEmailInput = {
  to?: string;
  role: "admin" | "support";
  attemptedIdentifier: string;
  ipAddress?: string | null;
  deviceSummary: string;
  route: string;
  failuresInWindow: number;
  windowMinutes: number;
  lockoutMinutes: number;
  occurredAt: string;
  idempotencyKey?: string;
};

type InstructorComplianceReminderEmailInput = {
  to: string;
  fullName?: string;
  documents: Array<{ label: string; expiryLabel: string; status: "expiring" | "expired" }>;
  dashboardUrl: string;
  idempotencyKey?: string;
};

type AccountDeletionScheduledEmailInput = {
  to: string;
  fullName?: string;
  recoveryUrl: string;
  expiresAt: string;
};

type AccountDeletionRecoveredEmailInput = {
  to: string;
  fullName?: string;
  signInUrl?: string;
  idempotencyKey?: string;
};

type EmailSendOptions = {
  idempotencyKey?: string;
};

export type BrandedEmailInput = {
  subject: string;
  title?: string;
  preheader?: string;
  eyebrow?: string;
  intro?: string;
  bodyHtml?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  secondaryCtaLabel?: string;
  secondaryCtaUrl?: string;
  footerNote?: string;
  tone?: "standard" | "success" | "warning" | "admin";
  showEyebrow?: boolean;
  showTitle?: boolean;
};

const LDA_EMAIL_SHELL_MARKER = 'data-lda-email-shell="true"';
const LDA_EMAIL_LOGO_URL = "https://ldrivingacademy.co.uk/lda-email-logo-v1.jpg?v=lda-20261010-sized";

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
    .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_match, url, label) => {
      const plainLabel = String(label).replace(/<[^>]+>/g, "").trim();
      return `${plainLabel} (${url})`;
    })
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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function emailParagraphs(value?: string) {
  if (!value?.trim()) {
    return "";
  }

  return value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map(
      (paragraph) =>
        `<p style="margin:0 0 18px;color:#252525;font-size:16px;line-height:1.65;">${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`,
    )
    .join("");
}

function renderEmailButton(label: string, url: string, variant: "primary" | "secondary") {
  const background = variant === "primary" ? "#ed1b24" : "#111111";
  return `
    <a href="${escapeHtml(url)}" style="display:inline-block;margin:4px 8px 4px 0;padding:14px 22px;border-radius:999px;background:${background};color:#ffffff;font-size:14px;font-weight:800;line-height:1;text-decoration:none;">
      ${escapeHtml(label)}
    </a>
  `;
}

export function renderLdaEmail(input: BrandedEmailInput) {
  const title = escapeHtml(input.title || input.subject);
  const preheader = escapeHtml(input.preheader || input.intro || input.subject);
  const eyebrow = escapeHtml(input.eyebrow || "L Driving Academy");
  const showEyebrow = input.showEyebrow !== false;
  const showTitle = input.showTitle !== false;
  const accent = input.tone === "warning" ? "#a16207" : input.tone === "success" ? "#047857" : "#ed1b24";
  const body = [emailParagraphs(input.intro), input.bodyHtml ?? ""].filter(Boolean).join("");
  const primaryButton = input.ctaLabel && input.ctaUrl ? renderEmailButton(input.ctaLabel, input.ctaUrl, "primary") : "";
  const secondaryButton =
    input.secondaryCtaLabel && input.secondaryCtaUrl
      ? renderEmailButton(input.secondaryCtaLabel, input.secondaryCtaUrl, "secondary")
      : "";
  const buttons = primaryButton || secondaryButton ? `<div style="margin:26px 0 8px;">${primaryButton}${secondaryButton}</div>` : "";
  const footerNote = escapeHtml(
    input.footerNote ||
      "This is a service message from L Driving Academy. If you need help, reply to this email and the L Driving Academy team will review it.",
  );

  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${title}</title>
        <style type="text/css">
          @media only screen and (max-width: 480px) {
            .lda-email-card {
              width: 100% !important;
              max-width: 100% !important;
            }

            .lda-email-outer {
              padding: 16px 8px !important;
            }

            .lda-email-header {
              padding: 16px 18px !important;
            }

            .lda-email-logo {
              width: 88px !important;
              height: auto !important;
            }

            .lda-email-body {
              padding: 26px 20px 22px !important;
            }

            .lda-email-footer {
              padding: 18px 20px !important;
            }
          }
        </style>
      </head>
      <body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111111;">
        <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${preheader}</span>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" ${LDA_EMAIL_SHELL_MARKER} style="width:100%;table-layout:fixed;background:#f3f4f6;margin:0;">
          <tr>
            <td align="center" class="lda-email-outer" style="padding:32px 16px;">
              <table role="presentation" width="640" cellspacing="0" cellpadding="0" class="lda-email-card" style="width:100%;max-width:640px;table-layout:fixed;background:#ffffff;border:1px solid #e5e7eb;border-radius:18px;overflow:hidden;">
                <tr>
                  <td class="lda-email-header" style="background:#050505;padding:20px 26px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td align="left">
                          <img
                            src="${LDA_EMAIL_LOGO_URL}"
                            width="112"
                            height="49"
                            alt="L Driving Academy"
                            class="lda-email-logo"
                            style="display:block;width:19%;min-width:88px;max-width:112px;height:auto;border:0;outline:none;text-decoration:none;"
                          />
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td class="lda-email-body" style="padding:34px 30px 28px;overflow-wrap:anywhere;">
                    ${showEyebrow ? `<div style="display:inline-block;margin:0 0 18px;padding:8px 12px;border-radius:999px;border:1px solid ${accent};color:${accent};font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:0.06em;">${eyebrow}</div>` : ""}
                    ${showTitle ? `<h1 style="margin:0 0 24px;color:#111111;font-size:32px;line-height:1.12;font-weight:900;letter-spacing:-0.4px;">${title}</h1>` : ""}
                    ${body}
                    ${buttons}
                    <div style="margin:30px 0 0;padding-top:22px;border-top:1px solid #e5e7eb;">
                      <p style="margin:0 0 4px;color:#252525;font-size:16px;line-height:1.6;">Kind regards,</p>
                      <p style="margin:0;color:#111111;font-size:16px;line-height:1.6;font-weight:900;">L Driving Academy team</p>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td class="lda-email-footer" style="background:#f9fafb;padding:20px 30px;border-top:1px solid #e5e7eb;">
                    <p style="margin:0;color:#6b7280;font-size:12px;line-height:1.55;">${footerNote}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

function normaliseEmailHtml(subject: string, html: string) {
  if (html.includes(LDA_EMAIL_SHELL_MARKER)) {
    return html;
  }

  const headingMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const title = headingMatch ? htmlToText(headingMatch[1]) : subject;
  const bodyHtml = (headingMatch ? html.replace(headingMatch[0], "") : html).replace(
    /<p[^>]*>\s*(?:hello|hi|dear)(?:\s+[^<,]+)?[,!]?\s*<\/p>/gi,
    "",
  );

  return renderLdaEmail({
    subject,
    title,
    bodyHtml,
  });
}

async function sendResendEmail(
  to: string,
  subject: string,
  html: string,
  _text?: string,
  options: EmailSendOptions = {},
) {
  const apiKey = process.env.RESEND_API_KEY;
  const replyTo = process.env.RESEND_REPLY_TO_EMAIL ?? process.env.APP_SUPPORT_EMAIL ?? "info@ldrivingacademy.co.uk";
  const finalHtml = normaliseEmailHtml(subject, html);
  const finalText = htmlToText(finalHtml);

  if (!apiKey) {
    return { skipped: true };
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json"
  };

  if (options.idempotencyKey) {
    headers["Idempotency-Key"] = options.idempotencyKey;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers,
    body: JSON.stringify({
      from: getSenderAddress(),
      to,
      subject,
      html: finalHtml,
      text: finalText,
      reply_to: replyTo
    })
  });

  if (!response.ok) {
    throw new Error(`Resend email failed with status ${response.status}`);
  }

  return response.json();
}

export async function sendLdaBrandedEmail(input: BrandedEmailInput & { to: string; idempotencyKey?: string }) {
  const html = renderLdaEmail(input);
  return sendResendEmail(input.to, input.subject, html, undefined, {
    idempotencyKey: input.idempotencyKey
  });
}

export async function sendBookingConfirmationEmails(input: BookingEmailInput) {
  const bookingReference = escapeHtml(input.bookingReference);
  const lessonSummary = escapeHtml(input.lessonSummary);
  const learnerSubject = `LDA booking confirmed ${input.bookingReference}`;
  const learnerHtml = renderLdaEmail({
    subject: learnerSubject,
    title: "Your LDA lesson is confirmed",
    eyebrow: "Booking confirmed",
    intro: `Thank you for booking ${input.instructorName}. Your lesson is now confirmed.`,
    bodyHtml: `
      <p style="margin:0 0 18px;color:#252525;font-size:16px;line-height:1.65;">${lessonSummary}</p>
      <div style="margin:24px 0;padding:18px;background:#fafafa;border:1px solid #eeeeee;border-radius:8px;">
        <div style="font-size:12px;font-weight:700;text-transform:uppercase;color:#52525b;">Your booking reference</div>
        <div style="font-size:28px;font-weight:900;letter-spacing:1px;word-break:break-word;">${bookingReference}</div>
      </div>
      <p style="margin:0;color:#252525;font-size:16px;line-height:1.65;">Only share this reference with your driving instructor when they arrive. Your dashboard contains lesson management, cancellation information, and live tracking.</p>
    `,
    ctaLabel: "Open booking",
    ctaUrl: input.manageUrl,
    tone: "success"
  });
  const instructorSubject = "New paid LDA lesson booking";
  const instructorHtml = renderLdaEmail({
    subject: instructorSubject,
    title: "A learner has booked a paid lesson",
    eyebrow: "New booking",
    bodyHtml: `
      <p style="margin:0 0 18px;color:#252525;font-size:16px;line-height:1.65;">${lessonSummary}</p>
      <div style="margin:24px 0;padding:18px;background:#fafafa;border:1px solid #eeeeee;border-radius:8px;">
        <div style="font-size:12px;font-weight:700;text-transform:uppercase;color:#52525b;">Booking reference</div>
        <div style="font-size:24px;font-weight:900;letter-spacing:1px;word-break:break-word;">${bookingReference}</div>
      </div>
      <p style="margin:0;color:#252525;font-size:16px;line-height:1.65;">Open your dashboard to prepare for the lesson and start en route tracking near the pickup time.</p>
    `,
    ctaLabel: "Open instructor dashboard",
    ctaUrl: input.manageUrl
  });

  const tasks = [];

  if (input.learnerEmail) {
    tasks.push(sendResendEmail(input.learnerEmail, learnerSubject, learnerHtml));
  }

  if (input.instructorEmail) {
    tasks.push(sendResendEmail(input.instructorEmail, instructorSubject, instructorHtml));
  }

  return Promise.all(tasks);
}

export async function sendBookingCancellationEmails(input: BookingCancellationEmailInput) {
  const bookingReference = escapeHtml(input.bookingReference);
  const instructorName = escapeHtml(input.instructorName);
  const lessonSummary = escapeHtml(input.lessonSummary);
  const refundSummary = escapeHtml(input.refundSummary);
  const cancelledBy = input.cancelledBy ?? "learner";
  const learnerIntro =
    cancelledBy === "instructor"
      ? `Your instructor, <strong>${instructorName}</strong>, has cancelled this lesson.`
      : `You have cancelled your lesson with <strong>${instructorName}</strong>.`;
  const instructorIntro =
    cancelledBy === "instructor"
      ? "You have cancelled this LDA lesson."
      : "The learner has cancelled a lesson with you.";
  const learnerSubject = `LDA lesson cancelled ${input.bookingReference}`;
  const learnerHtml = renderLdaEmail({
    subject: learnerSubject,
    title: "Your LDA lesson has been cancelled",
    eyebrow: "Booking update",
    bodyHtml: `
      <p style="margin:0 0 18px;color:#252525;font-size:16px;line-height:1.65;">${learnerIntro}</p>
      <p style="margin:0 0 18px;color:#252525;font-size:16px;line-height:1.65;">${lessonSummary}</p>
      <div style="margin:24px 0;padding:18px;background:#fafafa;border:1px solid #eeeeee;border-radius:8px;">
        <div style="font-size:12px;font-weight:700;text-transform:uppercase;color:#52525b;">Booking reference</div>
        <div style="font-size:28px;font-weight:900;letter-spacing:1px;word-break:break-word;">${bookingReference}</div>
        <p style="margin:12px 0 0;color:#52525b;font-size:14px;line-height:22px;"><strong>Refund status:</strong> ${refundSummary}</p>
      </div>
      <p style="margin:0;color:#252525;font-size:16px;line-height:1.65;">Cancellation and refund decisions follow the LDA cancellation policy.</p>
    `,
    ctaLabel: "Read cancellation policy",
    ctaUrl: input.policyUrl,
    tone: "warning"
  });
  const instructorSubject = `LDA lesson cancelled ${input.bookingReference}`;
  const instructorHtml = renderLdaEmail({
    subject: instructorSubject,
    title: "An LDA lesson has been cancelled",
    eyebrow: "Booking update",
    bodyHtml: `
      <p style="margin:0 0 18px;color:#252525;font-size:16px;line-height:1.65;">${instructorIntro}</p>
      <p style="margin:0 0 18px;color:#252525;font-size:16px;line-height:1.65;">${lessonSummary}</p>
      <div style="margin:24px 0;padding:18px;background:#fafafa;border:1px solid #eeeeee;border-radius:8px;">
        <p style="margin:0;color:#111111;font-size:14px;line-height:22px;"><strong>Booking reference:</strong> ${bookingReference}</p>
        <p style="margin:8px 0 0;color:#52525b;font-size:14px;line-height:22px;"><strong>Refund status:</strong> ${refundSummary}</p>
      </div>
      <p style="margin:0;color:#252525;font-size:16px;line-height:1.65;">Check your instructor dashboard for the updated diary and booking status.</p>
    `,
    tone: "warning"
  });

  const tasks = [];

  if (input.learnerEmail) {
    tasks.push(sendResendEmail(input.learnerEmail, learnerSubject, learnerHtml));
  }

  if (input.instructorEmail) {
    tasks.push(sendResendEmail(input.instructorEmail, instructorSubject, instructorHtml));
  }

  return Promise.all(tasks);
}

export async function sendInstructorEnRouteEmail(input: InstructorEnRouteEmailInput) {
  const bookingReference = escapeHtml(input.bookingReference);
  const lessonSummary = escapeHtml(input.lessonSummary);
  const html = renderLdaEmail({
    subject: "Your LDA instructor is on the way",
    title: "Your instructor is on the way",
    eyebrow: "Live lesson update",
    intro: `${input.instructorName} is travelling to the pickup point for your LDA lesson.`,
    bodyHtml: `
      <div style="margin:24px 0;padding:18px;background:#fafafa;border:1px solid #eeeeee;border-radius:8px;">
        <p style="margin:0;color:#111111;font-size:14px;line-height:22px;"><strong>Lesson:</strong> ${lessonSummary}</p>
        <p style="margin:8px 0 0;color:#52525b;font-size:14px;line-height:22px;"><strong>Reference:</strong> ${bookingReference}</p>
      </div>
      <p style="margin:0;color:#252525;font-size:16px;line-height:1.65;">Please be ready at your pickup point and keep your phone nearby for lesson updates.</p>
    `,
    ctaLabel: "Open live tracking",
    ctaUrl: input.trackingUrl
  });

  return sendResendEmail(input.learnerEmail, "Your LDA instructor is on the way", html);
}

export async function sendInstantBookingConfirmationEmail(input: InstantBookingEmailInput) {
  const instructorStatus = escapeHtml(input.instructorName);
  const lessonSummary = escapeHtml(input.lessonSummary);
  const reference = escapeHtml(input.reference);
  const subject = "your LDA on-demand lesson has been confirmed";
  const html = renderLdaEmail({
    subject,
    title: "Your on-demand lesson is confirmed",
    preheader: `Your LDA on-demand lesson has been confirmed. Reference ${input.reference}.`,
    eyebrow: "Booking confirmed",
    intro: "Your on-demand lesson has been confirmed. Keep this reference for support, refunds, or payment queries.",
    bodyHtml: `
      <div style="margin:24px 0;padding:20px;background:#fafafa;border:1px solid #eeeeee;border-radius:8px;">
        <div style="color:#71717a;font-size:12px;line-height:18px;font-weight:900;text-transform:uppercase;">Booking reference</div>
        <div style="margin-top:8px;color:#111111;font-size:30px;line-height:38px;font-weight:900;letter-spacing:1px;word-break:break-word;">${reference}</div>
        <p style="margin:14px 0 0;color:#52525b;font-size:14px;line-height:22px;">${lessonSummary}</p>
      </div>
      <p style="margin:0 0 14px;color:#252525;font-size:16px;line-height:1.65;"><strong>Instructor:</strong> ${instructorStatus}</p>
      <p style="margin:0;color:#252525;font-size:16px;line-height:1.65;">Open live tracking to view the pickup map and current lesson status. You do not need to give this reference to your instructor unless LDA support asks for it.</p>
    `,
    ctaLabel: "Track my instructor",
    ctaUrl: input.trackingUrl,
    footerNote:
      "This email was sent because an on-demand LDA lesson was booked using this email address. Reply with your booking reference if you need support.",
    tone: "success"
  });

  return sendResendEmail(
    input.learnerEmail,
    subject,
    html,
    undefined,
    {
      idempotencyKey: input.idempotencyKey
    }
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

  const html = renderLdaEmail({
    subject: `${priority} LDA support: ${input.subject}`,
    title: "LDA support escalation",
    eyebrow: `${priority} priority`,
    bodyHtml: `
      <div style="margin:0 0 20px;padding:18px;background:#fafafa;border:1px solid #eeeeee;border-radius:8px;">
        <p style="margin:0;color:#111111;font-size:14px;line-height:22px;"><strong>Role:</strong> ${role}</p>
        <p style="margin:6px 0 0;color:#52525b;font-size:14px;line-height:22px;"><strong>Name:</strong> ${name}</p>
        <p style="margin:6px 0 0;color:#52525b;font-size:14px;line-height:22px;"><strong>Email:</strong> ${email}</p>
        <p style="margin:6px 0 0;color:#52525b;font-size:14px;line-height:22px;"><strong>Booking reference:</strong> ${bookingReference}</p>
      </div>
      <h2 style="margin:0 0 8px;color:#111111;font-size:19px;line-height:26px;">Issue</h2>
      <p style="margin:0 0 20px;color:#252525;font-size:16px;line-height:1.65;">${message}</p>
      <h2 style="margin:0 0 8px;color:#111111;font-size:19px;line-height:26px;">Assistant summary</h2>
      <p style="margin:0;color:#252525;font-size:16px;line-height:1.65;">${assistantSummary}</p>
    `,
    footerNote: "This support escalation was generated from an LDA account or support workflow.",
    tone: input.urgent ? "warning" : "admin"
  });

  return sendResendEmail(supportEmail, `${priority} LDA support: ${subject}`, html);
}

export async function sendSupportTicketConfirmationEmail(input: SupportTicketConfirmationInput) {
  const reference = escapeHtml(input.reference);
  const categoryLabel = escapeHtml(input.categoryLabel);
  const priorityLabel = input.priority === "standard" ? "Standard" : input.priority === "urgent" ? "Urgent" : "Critical";

  return sendLdaBrandedEmail({
    to: input.to,
    idempotencyKey: input.idempotencyKey,
    subject: `${input.reference}: LDA support ticket received`,
    title: "Your support ticket has been received",
    eyebrow: "Support ticket",
    intro: "L Driving Academy has received your support request and saved the guidance and relevant account or booking context supplied with it.",
    bodyHtml: `
      <div style="margin:24px 0;padding:18px;background:#fafafa;border:1px solid #eeeeee;border-radius:8px;">
        <div style="font-size:12px;font-weight:700;text-transform:uppercase;color:#52525b;">Ticket reference</div>
        <div style="margin-top:4px;font-size:28px;font-weight:900;word-break:break-word;">${reference}</div>
        <p style="margin:12px 0 0;color:#52525b;font-size:14px;line-height:22px;"><strong>Category:</strong> ${categoryLabel}</p>
        <p style="margin:4px 0 0;color:#52525b;font-size:14px;line-height:22px;"><strong>Priority:</strong> ${priorityLabel}</p>
      </div>
      <p style="margin:0 0 18px;color:#252525;font-size:16px;line-height:1.65;">The support team will review the case and send updates by email. Keep this reference available if you reply about the same issue.</p>
      <p style="margin:0;color:#252525;font-size:16px;line-height:1.65;">LDA does not currently offer public phone or callback support.</p>
    `,
    footerNote: "This is a service message confirming an L Driving Academy support request.",
    tone: input.priority === "standard" ? "admin" : "warning"
  });
}

export async function sendSupportTicketResolvedEmail(input: SupportTicketResolvedInput) {
  const reference = escapeHtml(input.reference);
  const categoryLabel = escapeHtml(input.categoryLabel);

  return sendLdaBrandedEmail({
    to: input.to,
    idempotencyKey: input.idempotencyKey,
    subject: `${input.reference}: LDA support ticket actioned`,
    title: "Your support ticket has been actioned",
    eyebrow: "Support update",
    intro: "Thank you for contacting L Driving Academy. Your support ticket has now been reviewed and actioned by the LDA support team.",
    bodyHtml: `
      <div style="margin:24px 0;padding:18px;background:#fafafa;border:1px solid #eeeeee;border-radius:8px;">
        <div style="font-size:12px;font-weight:700;text-transform:uppercase;color:#52525b;">Ticket reference</div>
        <div style="margin-top:4px;font-size:28px;font-weight:900;word-break:break-word;">${reference}</div>
        <p style="margin:12px 0 0;color:#52525b;font-size:14px;line-height:22px;"><strong>Category:</strong> ${categoryLabel}</p>
      </div>
      <p style="margin:0 0 18px;color:#252525;font-size:16px;line-height:1.65;">The issue has been marked as completed by LDA technical support or admin. If you still notice the same problem, reply with your ticket reference so the team can reopen or review it.</p>
      <p style="margin:0;color:#252525;font-size:16px;line-height:1.65;">Thank you for helping us keep L Driving Academy running smoothly.</p>
    `,
    footerNote: "This is a service message confirming an L Driving Academy support ticket update.",
    tone: "admin"
  });
}

export async function sendOffPlatformReportEmail(input: OffPlatformReportEmailInput) {
  const supportEmail = process.env.LDA_OFF_PLATFORM_REPORT_EMAIL ?? "info@ldrivingacademy.com";
  const adminUrl = `${process.env.APP_WEBSITE_URL ?? "https://ldrivingacademy.co.uk"}/admin/support-escalations`;

  return sendLdaBrandedEmail({
    to: supportEmail,
    idempotencyKey: `off-platform-report-${input.id}`,
    subject: `${input.reference}: off-platform request investigation`,
    title: "Off-platform request reported",
    eyebrow: "Investigation required",
    intro: "A learner has reported an instructor request to arrange a payment, booking, or communication outside LDA.",
    bodyHtml: `
      <div style="margin:0 0 20px;padding:18px;background:#fafafa;border:1px solid #eeeeee;border-radius:8px;">
        <p style="margin:0;color:#111111;font-size:14px;line-height:22px;"><strong>Reference:</strong> ${escapeHtml(input.reference)}</p>
        <p style="margin:6px 0 0;color:#52525b;font-size:14px;line-height:22px;"><strong>Learner:</strong> ${escapeHtml(input.learnerName)}</p>
        <p style="margin:6px 0 0;color:#52525b;font-size:14px;line-height:22px;"><strong>Learner email:</strong> ${escapeHtml(input.learnerEmail)}</p>
        <p style="margin:6px 0 0;color:#52525b;font-size:14px;line-height:22px;"><strong>Instructor:</strong> ${escapeHtml(input.instructorName)}</p>
        <p style="margin:6px 0 0;color:#52525b;font-size:14px;line-height:22px;"><strong>Date:</strong> ${escapeHtml(input.incidentDate)}</p>
        ${input.additionalDates ? `<p style="margin:6px 0 0;color:#52525b;font-size:14px;line-height:22px;"><strong>Other dates:</strong> ${escapeHtml(input.additionalDates)}</p>` : ""}
      </div>
      <h2 style="margin:0 0 8px;color:#111111;font-size:19px;line-height:26px;">Learner report</h2>
      <p style="margin:0;color:#252525;font-size:16px;line-height:1.65;">${escapeHtml(input.details).replace(/\n/g, "<br />")}</p>
    `,
    ctaLabel: "Open admin investigation",
    ctaUrl: adminUrl,
    footerNote: "This report was saved in the LDA support system before this notification was sent.",
    tone: "warning"
  });
}

export async function sendProgressFeedbackEmail(input: ProgressFeedbackEmailInput) {
  const instructorName = escapeHtml(input.instructorName);
  const progressUrl = `${process.env.APP_WEBSITE_URL ?? "https://ldrivingacademy.co.uk"}/progress-tracker`;

  const html = renderLdaEmail({
    subject: "Your LDA progress tracker has been updated",
    title: "Your progress tracker has been updated",
    eyebrow: "Progress update",
    bodyHtml: `
      <p style="margin:0 0 18px;color:#252525;font-size:16px;line-height:1.65;">${instructorName} has updated your LDA progress tracker.</p>
      <p style="margin:0;color:#252525;font-size:16px;line-height:1.65;">Sign in to view the latest progress notes, completed topics, next lesson focus, and recommended resources. For privacy, the details are not included in this email.</p>
    `,
    ctaLabel: "View progress tracker",
    ctaUrl: progressUrl,
    footerNote: "Lesson progress details are only available after signing in to your LDA learner account."
  });

  return sendResendEmail(input.learnerEmail, "Your LDA progress tracker has been updated", html);
}

export async function sendAuthMagicLinkEmail(input: AuthMagicLinkEmailInput) {
  const roleLabel = input.role === "instructor" ? "instructor" : "learner";
  const html = renderLdaEmail({
    subject: "Your L Driving Academy login link",
    title: "Confirm your email",
    eyebrow: "Secure account access",
    intro: `Use the secure button below to confirm your email and continue your ${roleLabel} account setup with L Driving Academy.`,
    bodyHtml:
      '<p style="margin:0;color:#252525;font-size:16px;line-height:1.65;">If you did not request this email, no action is required.</p>',
    ctaLabel: "Continue to LDA",
    ctaUrl: input.confirmUrl,
    footerNote: "This secure confirmation link was requested for an L Driving Academy account.",
    tone: "warning"
  });

  return sendResendEmail(input.to, "Your L Driving Academy login link", html);
}

export async function sendInstructorVerificationSubmittedEmail(input: InstructorVerificationSubmittedEmailInput) {
  const subject = "Your LDA instructor application is under review";
  const html = renderLdaEmail({
    subject,
    title: "Your instructor application is under review",
    eyebrow: "Application received",
    intro: "Your application to become an LDA instructor has been received and your ADI documents are now under review.",
    bodyHtml:
      '<p style="margin:0 0 18px;color:#252525;font-size:16px;line-height:1.65;">You can check your application status at any time. Instructor calendar, availability, bookings, finance, and learner-facing visibility remain locked until LDA approves the account.</p><p style="margin:0;color:#252525;font-size:16px;line-height:1.65;">LDA will email you again when the review is complete.</p>',
    ctaLabel: "Check application status",
    ctaUrl: input.statusUrl
  });

  return sendResendEmail(input.to, subject, html, undefined, {
    idempotencyKey: `instructor-verification-submitted:${input.to}`
  });
}

export async function sendInstructorDocumentUploadedEmail(input: InstructorDocumentReviewEmailInput) {
  const documentLabel = escapeHtml(input.documentLabel);
  const subject = `Your ${input.documentLabel} is under review`;
  const html = renderLdaEmail({
    subject,
    title: "Your document is under review",
    eyebrow: "Document received",
    bodyHtml: `<p style="margin:0 0 18px;color:#252525;font-size:16px;line-height:1.65;">Thank you for uploading your <strong>${documentLabel}</strong>. It is now under review by LDA.</p><p style="margin:0;color:#252525;font-size:16px;line-height:1.65;">You can check your instructor verification status at any time.</p>`,
    ctaLabel: "Check status",
    ctaUrl: input.statusUrl
  });

  return sendResendEmail(input.to, subject, html);
}

export async function sendInstructorDocumentApprovedEmail(input: InstructorDocumentReviewEmailInput) {
  const documentLabel = escapeHtml(input.documentLabel);
  const subject = `Your ${input.documentLabel} has been approved`;
  const html = renderLdaEmail({
    subject,
    title: "Your document has been approved",
    eyebrow: "Document approved",
    bodyHtml: `<p style="margin:0 0 18px;color:#252525;font-size:16px;line-height:1.65;">Thank you. Your <strong>${documentLabel}</strong> has been approved by LDA.</p><p style="margin:0;color:#252525;font-size:16px;line-height:1.65;">You can check your instructor verification status at any time.</p>`,
    ctaLabel: "Check status",
    ctaUrl: input.statusUrl,
    tone: "success"
  });

  return sendResendEmail(input.to, subject, html);
}

export async function sendInstructorDocumentRejectedEmail(input: InstructorDocumentReviewEmailInput) {
  const documentLabel = escapeHtml(input.documentLabel);
  const reason = input.reason?.trim()
    ? input.reason.trim()
    : "LDA could not approve this document from the evidence provided. Please upload a clear, current replacement document that matches your instructor profile.";
  const safeReason = escapeHtml(reason);
  const subject = `Your ${input.documentLabel} needs another upload`;
  const html = renderLdaEmail({
    subject,
    title: "Your document needs another upload",
    eyebrow: "Action required",
    bodyHtml: `
      <p style="margin:0 0 18px;color:#252525;font-size:16px;line-height:1.65;">LDA could not approve your <strong>${documentLabel}</strong>.</p>
      <div style="margin:24px 0;padding:18px;background:#fafafa;border:1px solid #eeeeee;border-radius:8px;">
        <div style="font-size:12px;font-weight:700;text-transform:uppercase;color:#52525b;">Reason</div>
        <p style="margin:8px 0 0;color:#252525;font-size:15px;line-height:24px;">${safeReason}</p>
      </div>
      <p style="margin:0;color:#252525;font-size:16px;line-height:1.65;">Upload a clear, current replacement from your instructor verification page.</p>
    `,
    ctaLabel: "Upload replacement",
    ctaUrl: input.statusUrl,
    tone: "warning"
  });

  return sendResendEmail(input.to, subject, html);
}

export function buildPasswordResetEmail(input: PasswordResetEmailInput): EmailContent {
  const roleLabel = input.role === "admin" ? "admin" : input.role === "instructor" ? "instructor" : "learner";
  const subject = "Reset your L Driving Academy password";
  const html = renderLdaEmail({
    subject,
    title: "Reset your password",
    preheader: "Use your secure link to reset your L Driving Academy password.",
    eyebrow: "Secure account access",
    intro: `A password reset was requested for your L Driving Academy ${roleLabel} account. Use the secure button below to choose a new password.`,
    bodyHtml: `
      <div style="margin:24px 0;padding:18px 20px;background:#fafafa;border:1px solid #eeeeee;border-radius:8px;">
        <div style="color:#71717a;font-size:12px;line-height:18px;font-weight:800;text-transform:uppercase;">Security note</div>
        <p style="margin:8px 0 0;color:#111111;font-size:16px;line-height:24px;font-weight:800;">Only continue if you requested this change.</p>
        <p style="margin:8px 0 0;color:#52525b;font-size:14px;line-height:22px;">If this was not you, no action is needed. Your password will stay the same and this reset link can be ignored.</p>
      </div>
      <p style="margin:0;color:#252525;font-size:16px;line-height:1.65;">The secure link can be opened on your phone, laptop, or tablet.</p>
    `,
    ctaLabel: "Reset password",
    ctaUrl: input.confirmUrl,
    footerNote:
      "This email was sent because a password reset was requested for an L Driving Academy account. Reply to this email if you need support.",
    tone: "warning"
  });

  return { subject, html, text: htmlToText(html) };
}

export async function sendPasswordResetEmail(input: PasswordResetEmailInput) {
  const email = buildPasswordResetEmail(input);
  return sendResendEmail(input.to, email.subject, email.html, email.text);
}

export async function sendProductFeedbackEmail(input: ProductFeedbackEmailInput) {
  const supportEmail = process.env.LDA_FEEDBACK_EMAIL ?? process.env.APP_SUPPORT_EMAIL ?? "info@ldrivingacademy.co.uk";
  const issue = escapeHtml(input.issue);
  const summary = escapeHtml(input.summary);
  const pageUrl = escapeHtml(input.pageUrl || "Not provided");
  const appUrl = process.env.APP_WEBSITE_URL ?? "https://ldrivingacademy.co.uk";

  const html = renderLdaEmail({
    subject: `LDA feedback: ${input.issue}`,
    title: "New LDA feedback",
    eyebrow: "Technical support",
    bodyHtml: `
      <div style="margin:0 0 20px;padding:18px;background:#fafafa;border:1px solid #eeeeee;border-radius:8px;">
        <p style="margin:0;color:#111111;font-size:14px;line-height:22px;"><strong>Issue:</strong> ${issue}</p>
        <p style="margin:8px 0 0;color:#52525b;font-size:14px;line-height:22px;"><strong>Summary:</strong> ${summary}</p>
        <p style="margin:8px 0 0;color:#52525b;font-size:14px;line-height:22px;"><strong>Page:</strong> ${pageUrl}</p>
      </div>
      <p style="margin:0;color:#252525;font-size:16px;line-height:1.65;">The complete feedback is stored privately. Open the support queue to review the concise version alongside other submissions.</p>
    `,
    ctaLabel: "Open technical support feedback",
    ctaUrl: `${appUrl}/technical-support/feedback`,
    tone: "admin"
  });

  return sendResendEmail(supportEmail, `LDA feedback: ${input.issue}`, html);
}

export async function sendSubscriptionConfirmationEmail(input: SubscriptionConfirmationEmailInput) {
  const packageName = escapeHtml(input.packageName);
  const previousPackageName = input.previousPackageName ? escapeHtml(input.previousPackageName) : null;
  const roleLabel = input.role === "instructor" ? "instructor" : "learner";
  const billingLabel = escapeHtml(input.billingLabel ?? "monthly subscription");
  const priceLabel = input.priceLabel ? escapeHtml(input.priceLabel) : null;
  const changeType = input.changeType ?? (previousPackageName ? "change" : "activation");
  const packageSummary = escapeHtml(
    input.packageSummary ??
      "Your account has been updated and your new subscription benefits are now available.",
  );
  const dashboardUrl =
    input.dashboardUrl ??
    `${process.env.APP_WEBSITE_URL ?? "https://ldrivingacademy.co.uk"}/${roleLabel}-dashboard`;
  const featuresUrl = escapeHtml(input.featuresUrl ?? dashboardUrl);
  const priceCopy = priceLabel ? ` Your monthly Stripe subscription is now <strong>${priceLabel}</strong>.` : "";
  const transitionCopy =
    changeType === "upgrade" && previousPackageName
      ? `You have upgraded from <strong>${previousPackageName}</strong> to <strong>${packageName}</strong>.${priceCopy}`
      : changeType === "downgrade" && previousPackageName
        ? `Your subscription has changed from <strong>${previousPackageName}</strong> to <strong>${packageName}</strong>.${priceCopy} Your account now uses the benefits included with this tier.`
        : previousPackageName
          ? `Your subscription has changed from <strong>${previousPackageName}</strong> to <strong>${packageName}</strong>.${priceCopy}`
          : `Your <strong>${packageName}</strong> subscription is now active.${priceCopy}`;
  const headerLabel =
    changeType === "upgrade"
      ? "Upgrade confirmed"
      : changeType === "downgrade"
        ? "Subscription changed"
        : "Subscription confirmed";
  const headline =
    changeType === "upgrade"
      ? `Welcome to ${packageName}`
      : changeType === "downgrade"
        ? `You're now on ${packageName}`
        : `${packageName} is active`;
  const subject =
    changeType === "upgrade"
      ? `Your ${packageName} upgrade is confirmed`
      : changeType === "downgrade"
        ? `Your LDA subscription has changed to ${packageName}`
        : `Your ${packageName} subscription is confirmed`;
  const html = renderLdaEmail({
    subject,
    title: headline,
    preheader: `Your LDA subscription has changed to ${input.packageName}.`,
    eyebrow: headerLabel,
    bodyHtml: `
      <p style="margin:0 0 18px;color:#252525;font-size:16px;line-height:1.65;">${transitionCopy}</p>
      <div style="margin:24px 0;padding:18px 20px;background:#fafafa;border:1px solid #eeeeee;border-radius:8px;">
        <div style="color:#71717a;font-size:12px;line-height:18px;font-weight:800;text-transform:uppercase;">Subscription summary</div>
        <p style="margin:8px 0 0;color:#111111;font-size:16px;line-height:24px;font-weight:800;">${packageSummary}</p>
        <p style="margin:8px 0 0;color:#52525b;font-size:14px;line-height:22px;">Your ${billingLabel} is active${priceLabel ? ` at ${priceLabel}` : ""}, and your ${roleLabel} permissions now match ${packageName}.</p>
      </div>
      <p style="margin:0;color:#252525;font-size:16px;line-height:1.65;">Review the subscription from your dashboard or <a href="${featuresUrl}" style="color:#ed1b24;font-weight:800;text-decoration:none;">view the package details</a>.</p>
    `,
    ctaLabel: "Open your dashboard",
    ctaUrl: dashboardUrl,
    footerNote:
      "This confirmation was sent because your L Driving Academy subscription was updated successfully. Reply to this email if you need support.",
    tone: "success"
  });

  return sendResendEmail(input.to, subject, html, htmlToText(html), {
    idempotencyKey: input.idempotencyKey
  });
}

export async function sendSubscriptionCancellationEmail(input: SubscriptionCancellationEmailInput) {
  const roleLabel = input.role === "instructor" ? "instructor" : "learner";
  const freePackageName = escapeHtml(input.freePackageName);
  const previousPackageName = input.previousPackageName ? escapeHtml(input.previousPackageName) : null;
  const dashboardUrl =
    input.dashboardUrl ??
    `${process.env.APP_WEBSITE_URL ?? "https://ldrivingacademy.co.uk"}/${roleLabel}-dashboard`;
  const transitionCopy = previousPackageName
    ? `Your subscription has been cancelled and your account has moved from <strong>${previousPackageName}</strong> back to <strong>${freePackageName}</strong>.`
    : `Your subscription has been cancelled and your account is now back on <strong>${freePackageName}</strong>.`;
  const subject = "Your LDA subscription has been cancelled";
  const html = renderLdaEmail({
    subject,
    title: "Your subscription has been cancelled",
    preheader: `Your LDA subscription has been cancelled and your account is back on ${input.freePackageName}.`,
    eyebrow: "Account updated",
    bodyHtml: `
      <p style="margin:0 0 18px;color:#252525;font-size:16px;line-height:1.65;">${transitionCopy}</p>
      <div style="margin:24px 0;padding:18px 20px;background:#fafafa;border:1px solid #eeeeee;border-radius:8px;">
        <div style="color:#71717a;font-size:12px;line-height:18px;font-weight:800;text-transform:uppercase;">Current package</div>
        <p style="margin:8px 0 0;color:#111111;font-size:16px;line-height:24px;font-weight:800;">${freePackageName}</p>
        <p style="margin:8px 0 0;color:#52525b;font-size:14px;line-height:22px;">Your monthly Stripe subscription has been cancelled and your ${roleLabel} permissions have been updated.</p>
      </div>
      <p style="margin:0;color:#252525;font-size:16px;line-height:1.65;">You can choose a subscription again from your dashboard whenever you are ready.</p>
    `,
    ctaLabel: "Open your dashboard",
    ctaUrl: dashboardUrl,
    footerNote:
      "This confirmation was sent because your L Driving Academy subscription was cancelled successfully. Reply to this email if you need support.",
    tone: "warning"
  });

  return sendResendEmail(input.to, subject, html, htmlToText(html), {
    idempotencyKey: input.idempotencyKey
  });
}

export async function sendSiteHealthAlertEmail(input: SiteHealthAlertEmailInput) {
  const statusLabel = input.status === "fail" ? "Site health failure" : "Site health warning";
  const subject = `LDA alert: ${statusLabel} (${input.successRate.toFixed(2)}%)`;
  const target = escapeHtml(input.target);
  const checkedAt = escapeHtml(input.checkedAt);
  const reason = escapeHtml(input.reason ?? "The monitor crossed the configured email concern line.");
  const incidentCards = [...input.failures, ...input.slowChecks]
    .slice(0, 10)
    .map((item) => {
      const type = input.failures.includes(item) ? "Failure" : "Slow";
      return `
        <div style="margin:0 0 10px;padding:14px;background:#fafafa;border:1px solid #eeeeee;border-radius:8px;">
          <div style="color:#111111;font-size:13px;font-weight:900;">${escapeHtml(type)}: ${escapeHtml(item.name)}</div>
          <div style="margin-top:5px;color:#52525b;font-size:13px;line-height:20px;">Status ${item.status || "timeout"} | ${item.durationMs}ms | ${escapeHtml(item.message)}</div>
        </div>
      `;
    })
    .join("");

  const html = renderLdaEmail({
    subject,
    title: "LDA site health dropped below target",
    preheader: `${statusLabel}: ${input.successRate.toFixed(2)}% of checks passed.`,
    eyebrow: statusLabel,
    bodyHtml: `
      <p style="margin:0 0 12px;color:#252525;font-size:16px;line-height:1.65;">The production monitor checked ${target} at ${checkedAt}. The current success rate is <strong>${input.successRate.toFixed(3)}%</strong> against a <strong>${input.threshold.toFixed(3)}%</strong> healthy baseline.</p>
      <p style="margin:0 0 20px;color:#111111;font-size:15px;line-height:24px;font-weight:800;">Alert reason: ${reason}</p>
      <div style="margin:0 0 20px;padding:18px 20px;background:#fafafa;border:1px solid #eeeeee;border-radius:8px;">
        <div style="color:#71717a;font-size:12px;line-height:18px;font-weight:900;text-transform:uppercase;">Summary</div>
        <p style="margin:8px 0 0;color:#111111;font-size:15px;line-height:23px;font-weight:800;">${input.ok}/${input.total} checks passed. ${input.failed} failed. ${input.slow} were slow.</p>
        <p style="margin:8px 0 0;color:#52525b;font-size:14px;line-height:22px;">Latency: p50 ${input.p50Ms}ms, p95 ${input.p95Ms}ms, p99 ${input.p99Ms}ms, max ${input.maxMs}ms.</p>
      </div>
      ${incidentCards || `<p style="margin:0 0 18px;color:#52525b;font-size:14px;line-height:22px;">No individual failures were recorded, but the success target was not met.</p>`}
      <p style="margin:18px 0 0;color:#52525b;font-size:14px;line-height:22px;">Review the technical support dashboard, deployment logs, recent traffic, and function latency before making changes.</p>
    `,
    footerNote:
      "This operational alert was generated automatically by the LDA production site-health monitor.",
    tone: "warning"
  });

  return sendResendEmail(input.to, subject, html, htmlToText(html), {
    idempotencyKey: input.idempotencyKey
  });
}

export async function sendAdminNoticeEmail(input: AdminNoticeEmailInput) {
  const title = escapeHtml(input.title);
  const bodyParagraphs = escapeHtml(input.body)
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\n/g, "<br />"))
    .filter(Boolean);
  const html = renderLdaEmail({
    subject: input.subject,
    title,
    preheader: input.body,
    eyebrow: "Account notice",
    bodyHtml: `
      ${bodyParagraphs.map((paragraph) => `<p style="margin:0 0 18px;font-size:16px;line-height:26px;color:#27272a;">${paragraph}</p>`).join("")}
      <div style="margin-top:10px;padding:18px;background:#fafafa;border-left:4px solid #ed1b24;">
        <p style="margin:0;font-size:15px;line-height:24px;color:#3f3f46;">If you believe this notice was sent in error, reply to this email and the L Driving Academy team will review your account.</p>
      </div>
    `,
    tone: "admin"
  });

  return sendResendEmail(input.to, input.subject, html, undefined, {
    idempotencyKey: input.idempotencyKey
  });
}

export async function sendPrivilegedLoginPriorityAlertEmail(input: PrivilegedLoginPriorityAlertEmailInput) {
  const to =
    input.to ||
    process.env.LDA_SECURITY_ALERT_EMAIL ||
    process.env.LDA_ADMIN_EMAIL ||
    process.env.APP_SUPPORT_EMAIL ||
    "info@ldrivingacademy.co.uk";
  const roleLabel = input.role === "admin" ? "admin" : "technical support";
  const subject = `Priority security alert: repeated ${roleLabel} sign-in failures`;
  const attemptedIdentifier = escapeHtml(input.attemptedIdentifier || "not provided");
  const ipAddress = escapeHtml(input.ipAddress || "unknown");
  const deviceSummary = escapeHtml(input.deviceSummary || "Unknown device");
  const route = escapeHtml(input.route || "privileged sign-in");
  const occurredAt = escapeHtml(input.occurredAt);

  const html = renderLdaEmail({
    subject,
    title: "Repeated privileged sign-in failures detected",
    preheader: "LDA detected repeated failed attempts against a privileged account.",
    eyebrow: "Priority security alert",
    bodyHtml: `
      <p style="margin:0 0 18px;color:#252525;font-size:16px;line-height:1.65;">There may be an attempted privileged-account login attack or account compromise risk.</p>
      <div style="margin:0 0 20px;padding:18px 20px;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;">
        <div style="color:#7c2d12;font-size:12px;line-height:18px;font-weight:900;text-transform:uppercase;">Attempt summary</div>
        <p style="margin:8px 0 0;color:#111111;font-size:15px;line-height:23px;"><strong>Account area:</strong> ${escapeHtml(roleLabel)}</p>
        <p style="margin:8px 0 0;color:#111111;font-size:15px;line-height:23px;"><strong>Attempted identifier:</strong> ${attemptedIdentifier}</p>
        <p style="margin:8px 0 0;color:#111111;font-size:15px;line-height:23px;"><strong>IP address:</strong> ${ipAddress}</p>
        <p style="margin:8px 0 0;color:#111111;font-size:15px;line-height:23px;"><strong>Device:</strong> ${deviceSummary}</p>
        <p style="margin:8px 0 0;color:#111111;font-size:15px;line-height:23px;"><strong>Route:</strong> ${route}</p>
        <p style="margin:8px 0 0;color:#111111;font-size:15px;line-height:23px;"><strong>Failures:</strong> ${input.failuresInWindow} within ${input.windowMinutes} minutes</p>
        <p style="margin:8px 0 0;color:#111111;font-size:15px;line-height:23px;"><strong>Detected at:</strong> ${occurredAt}</p>
      </div>
      <p style="margin:0;color:#252525;font-size:16px;line-height:1.65;">LDA has temporarily slowed or locked further privileged sign-in attempts for this identifier. Review recent privileged access audit logs before taking action.</p>
    `,
    footerNote:
      "This security alert never includes attempted passwords. Do not ask anyone to share a password or authenticator code.",
    tone: "warning"
  });

  return sendResendEmail(to, subject, html, htmlToText(html), {
    idempotencyKey: input.idempotencyKey
  });
}

export async function sendInstructorComplianceReminderEmail(input: InstructorComplianceReminderEmailInput) {
  const hasExpired = input.documents.some((document) => document.status === "expired");
  const subject = hasExpired ? "LDA instructor compliance action required" : "LDA instructor document renewal reminder";
  const title = hasExpired ? "Compliance evidence needs attention" : "Document renewal reminder";
  const rows = input.documents
    .slice(0, 8)
    .map((document) => {
      const label = escapeHtml(document.label);
      const expiryLabel = escapeHtml(document.expiryLabel);
      const status = document.status === "expired" ? "Expired" : "Renewal due";
      return `
        <div style="margin:0 0 10px;padding:14px;background:#fafafa;border:1px solid #eeeeee;border-radius:8px;">
          <div style="color:#111111;font-size:14px;font-weight:900;">${label}</div>
          <div style="margin-top:4px;color:#52525b;font-size:13px;line-height:20px;">${status}: ${expiryLabel}</div>
        </div>
      `;
    })
    .join("");
  const intro = hasExpired
    ? "One or more instructor compliance documents has expired. Learner-facing bookings and Smart Match visibility may be paused until LDA receives and approves renewal evidence."
    : "One or more instructor compliance documents is due for renewal soon. Upload renewal evidence before the expiry date so learner-facing availability can stay open.";

  const html = renderLdaEmail({
    subject,
    title,
    eyebrow: "Instructor compliance",
    intro,
    bodyHtml: `
      ${rows}
      <p style="margin:14px 0 0;color:#252525;font-size:16px;line-height:1.65;">Open your instructor verification page to upload renewal evidence. LDA will review the replacement while your current approved version stays active until the renewal is approved.</p>
    `,
    ctaLabel: "Upload renewal evidence",
    ctaUrl: input.dashboardUrl,
    tone: hasExpired ? "warning" : "standard",
    footerNote:
      "This service message was sent because your LDA instructor compliance records need renewal or review."
  });

  return sendResendEmail(input.to, subject, html, undefined, {
    idempotencyKey: input.idempotencyKey
  });
}

export async function sendAccountDeletionScheduledEmail(input: AccountDeletionScheduledEmailInput) {
  const expiresAt = escapeHtml(
    new Intl.DateTimeFormat("en-GB", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: "Europe/London"
    }).format(new Date(input.expiresAt))
  );
  const subject = "We’re sorry to see you go";
  const html = renderLdaEmail({
    subject,
    title: "We’re sorry to see you go",
    eyebrow: "Account deletion scheduled",
    intro: "Thank you for using L Driving Academy. We’re sorry to see you go.",
    bodyHtml: `
      <p style="margin:0 0 18px;color:#252525;font-size:16px;line-height:1.65;">Your L Driving Academy account has been deactivated and scheduled for permanent deletion.</p>
      <div style="margin:24px 0;padding:18px;background:#fafafa;border:1px solid #eeeeee;border-radius:8px;">
        <div style="font-size:12px;font-weight:700;text-transform:uppercase;color:#52525b;">You have 30 days to restart your account</div>
        <p style="margin:8px 0 0;color:#111111;font-size:16px;line-height:24px;font-weight:800;">${expiresAt}</p>
      </div>
      <p style="margin:0 0 18px;color:#252525;font-size:16px;line-height:1.65;">If you want to restart your account, press the button below before the deadline. Your account will be reactivated so you can pick up from where you left off.</p>
      <p style="margin:0 0 18px;color:#252525;font-size:16px;line-height:1.65;">Any paid LDA subscription connected to this account is cancelled when account deletion is requested so future renewals do not continue after the account has been deactivated.</p>
      <p style="margin:0 0 18px;color:#252525;font-size:16px;line-height:1.65;">After 30 days, LDA will permanently delete or anonymise removable personal data while retaining only records required for legal, payment, dispute, tax, regulatory, or fraud-prevention reasons.</p>
      <p style="margin:0;color:#252525;font-size:16px;line-height:1.65;">If you did not request this, restart the account and contact LDA support immediately.</p>
    `,
    ctaLabel: "Restart Account",
    ctaUrl: input.recoveryUrl,
    tone: "warning",
    footerNote: "This email was sent because account deletion was requested for an L Driving Academy account."
  });

  return sendResendEmail(input.to, subject, html);
}

export async function sendAccountDeletionRecoveredEmail(input: AccountDeletionRecoveredEmailInput) {
  const subject = "Welcome back to LDA";
  const html = renderLdaEmail({
    subject,
    title: "Welcome back",
    eyebrow: "Account restarted",
    intro: "Welcome back. We’re glad to have you back with L Driving Academy.",
    bodyHtml: `
      <p style="margin:0 0 18px;color:#252525;font-size:16px;line-height:1.65;">Your L Driving Academy account has been restarted.</p>
      <p style="margin:0 0 18px;color:#252525;font-size:16px;line-height:1.65;">You can now pick up from where you left off. If anything has changed, please review your account details after signing in.</p>
      <p style="margin:0 0 18px;color:#252525;font-size:16px;line-height:1.65;">If a paid subscription was cancelled when account deletion was requested, billing will not restart automatically. You can choose a paid package again from your dashboard.</p>
      <p style="margin:0;color:#252525;font-size:16px;line-height:1.65;">Thank you for coming back to L Driving Academy.</p>
    `,
    ctaLabel: input.signInUrl ? "Sign in to LDA" : undefined,
    ctaUrl: input.signInUrl,
    tone: "success",
    footerNote: "This confirmation was sent because your L Driving Academy account was restarted."
  });

  return sendResendEmail(input.to, subject, html, undefined, {
    idempotencyKey: input.idempotencyKey
  });
}
