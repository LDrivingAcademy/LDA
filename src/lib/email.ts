type BookingEmailInput = {
  learnerEmail?: string;
  instructorEmail?: string;
  instructorName: string;
  lessonSummary: string;
  manageUrl: string;
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
