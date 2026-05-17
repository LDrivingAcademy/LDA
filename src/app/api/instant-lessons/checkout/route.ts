import {
  isRateLimited,
  jsonNoStore,
  rateLimitResponse,
  safeAmountPence,
  safeCurrency,
  safeEmail,
  safeText
} from "@/lib/security";

type InstantCheckoutRequest = {
  fullName?: string;
  learnerEmail?: string;
  learnerPhone?: string;
  provisionalLicenceNumber?: string;
  instructorName?: string;
  instructorEmail?: string;
  lessonSummary?: string;
  amountPence?: number;
  paymentPreference?: string;
};

function createReference() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const random = crypto.randomUUID().slice(0, 8).toUpperCase();
  return `LDA-${date}-${random}`;
}

function required(value?: string) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalisePaymentPreference(value?: string) {
  return String(value ?? "card")
    .trim()
    .toLowerCase()
    .replaceAll(" ", "_");
}

function normaliseAppUrl(request: Request) {
  const configuredUrl = process.env.APP_WEBSITE_URL?.trim();
  const forwardedHost = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  const candidates = [
    configuredUrl,
    configuredUrl && !configuredUrl.startsWith("http") ? `https://${configuredUrl}` : undefined,
    forwardedHost ? `${forwardedProto}://${forwardedHost}` : undefined,
    "https://ldrivingacademy.co.uk"
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;

    try {
      const url = new URL(candidate);
      return url.origin;
    } catch {
      // Try the next candidate. A malformed APP_WEBSITE_URL should not block checkout.
    }
  }

  return "https://ldrivingacademy.co.uk";
}

export async function POST(request: Request) {
  if (isRateLimited(request, "instant-checkout", 15)) {
    return rateLimitResponse();
  }

  const body = (await request.json()) as InstantCheckoutRequest;
  const learnerEmail = safeEmail(body.learnerEmail);
  const provisionalLicenceNumber = safeText(body.provisionalLicenceNumber, "", 32).replace(/\s/g, "");

  if (!required(body.fullName) || !learnerEmail || provisionalLicenceNumber.length < 10) {
    return jsonNoStore({ error: "Name, valid email, and provisional licence number are required." }, { status: 400 });
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const appUrl = normaliseAppUrl(request);
  const currency = safeCurrency(process.env.STRIPE_DEFAULT_CURRENCY, "gbp");
  const amountPence = safeAmountPence(body.amountPence, 6500, 2500, 50000);
  const instructorName = safeText(body.instructorName, "your LDA instructor", 80);
  const lessonSummary = safeText(body.lessonSummary, `Instant LDA lesson with ${instructorName}`, 180);
  const paymentPreference = normalisePaymentPreference(body.paymentPreference);
  const reference = createReference();
  const successParams = new URLSearchParams({
    reference,
    email: learnerEmail,
    phone: safeText(body.learnerPhone, "", 30),
    name: safeText(body.fullName, "", 100),
    instructor: instructorName,
    summary: lessonSummary
  });
  const successUrl = `${appUrl}/lesson-now/confirmed?${successParams.toString()}`;
  const cancelUrl = `${appUrl}/lesson-now?payment=cancelled`;

  if (!stripeSecretKey) {
    return jsonNoStore({
      mode: "demo",
      reference,
      message: "Stripe is not configured yet. Add STRIPE_SECRET_KEY for live payment collection.",
      checkoutUrl: successUrl
    });
  }

  const params = new URLSearchParams({
    mode: "payment",
    success_url: successUrl,
    cancel_url: cancelUrl,
    "metadata[booking_reference]": reference,
    "metadata[learner_email]": learnerEmail,
    "metadata[learner_phone]": safeText(body.learnerPhone, "", 30),
    "metadata[instructor_name]": instructorName,
    "metadata[payment_preference]": paymentPreference,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": currency,
    "line_items[0][price_data][unit_amount]": String(amountPence),
    "line_items[0][price_data][product_data][name]": `Instant LDA driving lesson with ${instructorName}`,
    "line_items[0][price_data][product_data][description]": lessonSummary,
    "customer_email": learnerEmail
  });

  if (paymentPreference === "paypal" || process.env.STRIPE_ENABLE_PAYPAL === "true") {
    params.set("payment_method_types[0]", "card");
    params.set("payment_method_types[1]", "paypal");
  } else if (paymentPreference) {
    params.set("payment_method_types[0]", "card");
  }

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params
  });
  const session = await response.json();

  if (!response.ok) {
    return jsonNoStore({ error: session.error?.message ?? "Stripe checkout failed" }, { status: 400 });
  }

  return jsonNoStore({
    reference,
    checkoutUrl: session.url,
    checkoutSessionId: session.id
  });
}
