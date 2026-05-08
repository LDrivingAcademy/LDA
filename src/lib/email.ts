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

async function sendResendEmail(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL ?? "info@ldrivingacademy.co.uk";

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
      from,
      to,
      subject,
      html
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
