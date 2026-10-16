type SmsInput = {
  to?: string | null;
  body: string;
  required?: boolean;
};

const DEFAULT_LDA_SMS_FROM_PHONE = "07300470106";

export function normalizeSmsPhone(value?: string | null) {
  const phone = String(value ?? "").trim().replace(/[\s()-]/g, "");
  if (phone.startsWith("07") && phone.length === 11) {
    return `+44${phone.slice(1)}`;
  }
  if (phone.startsWith("447") && phone.length === 12) {
    return `+${phone}`;
  }
  return phone;
}

export function canSendSms() {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && (process.env.TWILIO_MESSAGING_SERVICE_SID || process.env.TWILIO_FROM_PHONE || DEFAULT_LDA_SMS_FROM_PHONE));
}

export async function sendSms(input: SmsInput) {
  const to = normalizeSmsPhone(input.to);

  if (!to) {
    if (input.required) {
      throw new Error("SMS destination phone number is required.");
    }
    return { skipped: true, reason: "no_phone" };
  }

  if (!to.startsWith("+")) {
    if (input.required) {
      throw new Error("Enter a valid mobile number with country code, or a UK mobile number starting 07.");
    }
    return { skipped: true, reason: "invalid_phone" };
  }

  if (!canSendSms()) {
    if (input.required) {
      throw new Error("SMS provider is not configured. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_PHONE.");
    }
    return { skipped: true, reason: "provider_not_configured" };
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  const fromPhone = normalizeSmsPhone(process.env.TWILIO_FROM_PHONE ?? process.env.SMS_FROM_PHONE ?? DEFAULT_LDA_SMS_FROM_PHONE);
  const params = new URLSearchParams({
    To: to,
    Body: input.body
  });

  if (messagingServiceSid) {
    params.set("MessagingServiceSid", messagingServiceSid);
  } else if (fromPhone?.startsWith("+")) {
    params.set("From", fromPhone);
  } else {
    throw new Error("SMS sender is not configured. Set TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_PHONE to a valid sender number.");
  }

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`SMS failed with status ${response.status}${details ? `: ${details.slice(0, 240)}` : ""}`);
  }

  return response.json();
}
