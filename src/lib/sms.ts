type SmsInput = {
  to?: string | null;
  body: string;
};

function normalizePhone(value?: string | null) {
  const phone = String(value ?? "").trim().replace(/\s+/g, "");
  if (phone.startsWith("07") && phone.length === 11) {
    return `+44${phone.slice(1)}`;
  }
  return phone;
}

export function canSendSms() {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_MESSAGING_SERVICE_SID);
}

export async function sendSms(input: SmsInput) {
  const to = normalizePhone(input.to);

  if (!to || !to.startsWith("+") || !canSendSms()) {
    return { skipped: true };
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  const params = new URLSearchParams({
    To: to,
    MessagingServiceSid: messagingServiceSid || "",
    Body: input.body
  });

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params
  });

  if (!response.ok) {
    throw new Error(`SMS failed with status ${response.status}`);
  }

  return response.json();
}
