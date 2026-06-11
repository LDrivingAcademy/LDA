import {
  isRateLimited,
  jsonNoStore,
  rateLimitResponse,
  getAppOrigin,
  readJsonBody,
  safeAmountPence,
  safeCurrency,
  safeEmail,
  safeText
} from "@/lib/security";
import { applyStripeCheckoutPaymentMethods } from "@/lib/stripe-checkout";
import { getStripeEnvValue, getStripeSecretKey } from "@/lib/stripe-env";

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

export async function POST(request: Request) {
  if (isRateLimited(request, "instant-checkout", 15)) {
    return rateLimitResponse();
  }

  const body = await readJsonBody<InstantCheckoutRequest>(request);
  if (!body) {
    return jsonNoStore({ error: "Invalid checkout request." }, { status: 400 });
  }

  const learnerEmail = safeEmail(body.learnerEmail);
  const provisionalLicenceNumber = safeText(body.provisionalLicenceNumber, "", 32).replace(/\s/g, "");

  if (!required(body.fullName) || !learnerEmail || provisionalLicenceNumber.length < 10) {
    return jsonNoStore({ error: "Name, valid email, and provisional licence number are required." }, { status: 400 });
  }

  const stripeSecret = getStripeSecretKey();
  const appUrl = getAppOrigin(request);
  const currency = safeCurrency(getStripeEnvValue("STRIPE_DEFAULT_CURRENCY").value, "gbp");
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

  if (!stripeSecret.value) {
    return jsonNoStore({
      mode: "demo",
      reference,
      message: `Stripe is not configured yet. Add ${stripeSecret.envName} for ${stripeSecret.modeLabel} payment collection.`,
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

  applyStripeCheckoutPaymentMethods(params);

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeSecret.value}`,
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
