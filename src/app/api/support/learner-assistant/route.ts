import { NextResponse } from "next/server";
import { sendSupportEscalationEmail } from "@/lib/email";

type LearnerAssistantRequest = {
  name?: string;
  email?: string;
  bookingReference?: string;
  message?: string;
  urgency?: "standard" | "urgent";
};

const urgentPattern = /\b(urgent|emergency|today|now|payment failed|paid twice|refund|cancel|cancelled|no show|not arrived|late|unsafe|accident|stranded)\b/i;

function isMeaningful(value?: string) {
  return typeof value === "string" && value.trim().length > 2;
}

function extractOutputText(payload: unknown) {
  if (
    payload &&
    typeof payload === "object" &&
    "output_text" in payload &&
    typeof payload.output_text === "string"
  ) {
    return payload.output_text;
  }

  return "";
}

function demoAnswer(message: string, urgent: boolean) {
  if (urgent) {
    return "This looks time-sensitive. I have prepared this as an urgent LDA support issue. Include your booking reference, lesson time, instructor name, and the best phone/email contact. If you are currently unsafe or in immediate danger, contact the emergency services first.";
  }

  if (/book|booking|lesson/i.test(message)) {
    return "For booking help, check your learner dashboard for upcoming, completed, cancelled, and rescheduled lessons. If a booking is missing, send the booking reference, payment email, instructor name, and lesson date so support can match the record.";
  }

  if (/pay|payment|stripe|card|refund/i.test(message)) {
    return "For payment questions, LDA support needs the payment email, booking reference, amount paid, and what happened at checkout. Stripe handles card details securely, so do not send full card numbers.";
  }

  return "I can help with learner bookings, managing lessons, payment confirmation, cancellation rules, pickup postcode issues, and support escalation. Tell me what you are trying to do and include any booking reference if you have one.";
}

export async function POST(request: Request) {
  const input = (await request.json()) as LearnerAssistantRequest;

  if (!isMeaningful(input.message)) {
    return NextResponse.json({ error: "Enter a support question first." }, { status: 400 });
  }

  const message = input.message!.trim();
  const urgent = input.urgency === "urgent" || urgentPattern.test(message);
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_SUPPORT_MODEL || "gpt-5.2";
  let answer = "";
  let mode: "demo" | "live" = "demo";

  if (apiKey) {
    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          instructions:
            "You are LDA learner support for a UK learner-driver marketplace. Be concise, practical, and safety-aware. Help learners book lessons, manage bookings, understand cancellations, payment confirmations, pickup postcode issues, and live tracking. Do not give legal advice. If the issue is urgent, tell the learner support will be notified and ask for booking reference/contact details.",
          input: [
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: `Learner name: ${input.name || "Not provided"}\nLearner email: ${input.email || "Not provided"}\nBooking reference: ${input.bookingReference || "Not provided"}\nUrgent: ${urgent ? "yes" : "no"}\nQuestion: ${message}`
                }
              ]
            }
          ]
        })
      });

      if (response.ok) {
        answer = extractOutputText(await response.json());
        mode = "live";
      }
    } catch {
      answer = "";
    }
  }

  if (!answer) {
    answer = demoAnswer(message, urgent);
  }

  let escalation: "skipped" | "sent-or-queued" = "skipped";
  if (urgent) {
    try {
      await sendSupportEscalationEmail({
        role: "learner",
        name: input.name,
        email: input.email,
        bookingReference: input.bookingReference,
        subject: "Learner support escalation",
        message,
        assistantSummary: answer,
        urgent
      });
    } catch {
      // Do not block the learner from seeing guidance if the email provider is temporarily unavailable.
    }
    escalation = "sent-or-queued";
  }

  return NextResponse.json({
    answer,
    urgent,
    escalation,
    mode
  });
}
