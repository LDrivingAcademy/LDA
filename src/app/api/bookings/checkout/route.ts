import {
  isRateLimited,
  jsonNoStore,
  rateLimitResponse,
  getAppOrigin,
  readJsonBody,
  safeAmountPence,
  safeCurrency,
  safeEmail,
  safeStripeConnectedAccountId,
  safeText
} from "@/lib/security";
import { applyStripeCheckoutPaymentMethods } from "@/lib/stripe-checkout";

type CheckoutRequest = {
  bookingId?: string;
  instructorName?: string;
  lessonSummary?: string;
  amountPence?: number;
  stripeConnectedAccountId?: string;
  paymentPreference?: string;
  learnerEmail?: string | null;
};

function normalisePaymentPreference(value?: string) {
  return String(value ?? "card")
    .trim()
    .toLowerCase()
    .replaceAll(" ", "_");
}

export async function POST(request: Request) {
  if (isRateLimited(request, "booking-checkout", 20)) {
    return rateLimitResponse();
  }

  const body = await readJsonBody<CheckoutRequest>(request);
  if (!body) {
    return jsonNoStore({ error: "Invalid checkout request." }, { status: 400 });
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const appUrl = getAppOrigin(request);
  const currency = safeCurrency(process.env.STRIPE_DEFAULT_CURRENCY, "gbp");
  const amountPence = safeAmountPence(body.amountPence, 4200, 1000, 30000);
  const instructorName = safeText(body.instructorName, "your driving instructor", 80);
  const bookingId = safeText(body.bookingId, "demo-booking", 80);
  const paymentPreference = normalisePaymentPreference(body.paymentPreference);
  const learnerEmail = safeEmail(body.learnerEmail);
  const commissionPercent = Math.min(Math.max(Number(process.env.LDA_PLATFORM_COMMISSION_PERCENT ?? 10), 0), 30);
  const applicationFeeAmount = Math.round(amountPence * (commissionPercent / 100));

  if (!stripeSecretKey) {
    return jsonNoStore({
      mode: "demo",
      message: "Stripe is not configured yet. Add STRIPE_SECRET_KEY to create live Checkout sessions.",
      checkoutUrl: `${appUrl}/learner-dashboard?demoCheckout=1&booking=${encodeURIComponent(bookingId)}`
    });
  }

  const params = new URLSearchParams({
    mode: "payment",
    success_url: `${appUrl}/learner-dashboard?payment=success&booking=${encodeURIComponent(bookingId)}`,
    cancel_url: `${appUrl}/learner-dashboard?payment=cancelled&booking=${encodeURIComponent(bookingId)}`,
    "metadata[booking_id]": bookingId,
    "metadata[lda_protected_booking]": "true",
    "metadata[platform_policy_version]": "anti_circumvention_launch",
    "metadata[payment_preference]": paymentPreference,
    "payment_intent_data[metadata][booking_id]": bookingId,
    "payment_intent_data[metadata][lda_protected_booking]": "true",
    "payment_intent_data[metadata][platform_policy_version]": "anti_circumvention_launch",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": currency,
    "line_items[0][price_data][unit_amount]": String(amountPence),
    "line_items[0][price_data][product_data][name]": `LDA driving lesson with ${instructorName}`
  });

  if (learnerEmail) {
    params.set("customer_email", learnerEmail);
  }

  applyStripeCheckoutPaymentMethods(params);

  const connectedAccountId = safeStripeConnectedAccountId(body.stripeConnectedAccountId);
  if (connectedAccountId) {
    params.set("payment_intent_data[transfer_data][destination]", connectedAccountId);
    params.set("payment_intent_data[application_fee_amount]", String(applicationFeeAmount));
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
    checkoutUrl: session.url,
    checkoutSessionId: session.id
  });
}
