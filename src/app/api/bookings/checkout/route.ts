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
import { getStripeEnvValue, getStripeSecretKey } from "@/lib/stripe-env";
import { createClient } from "@/lib/supabase/server";

type CheckoutRequest = {
  bookingId?: string;
  instructorId?: string;
  instructorName?: string;
  lessonSummary?: string;
  amountPence?: number;
  learnerAvailabilityPaused?: boolean;
  learnerAvailabilityPauseReason?: string;
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

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function POST(request: Request) {
  if (isRateLimited(request, "booking-checkout", 20)) {
    return rateLimitResponse();
  }

  const body = await readJsonBody<CheckoutRequest>(request);
  if (!body) {
    return jsonNoStore({ error: "Invalid checkout request." }, { status: 400 });
  }

  const stripeSecret = getStripeSecretKey();
  const appUrl = getAppOrigin(request);
  const currency = safeCurrency(getStripeEnvValue("STRIPE_DEFAULT_CURRENCY").value, "gbp");
  const amountPence = safeAmountPence(body.amountPence, 4200, 1000, 30000);
  const instructorName = safeText(body.instructorName, "your driving instructor", 80);
  const instructorId = safeText(body.instructorId, "", 80);
  const bookingId = safeText(body.bookingId, "demo-booking", 80);
  const paymentPreference = normalisePaymentPreference(body.paymentPreference);
  const learnerEmail = safeEmail(body.learnerEmail);
  const commissionPercent = Math.min(Math.max(Number(process.env.LDA_PLATFORM_COMMISSION_PERCENT ?? 10), 0), 30);
  const applicationFeeAmount = Math.round(amountPence * (commissionPercent / 100));

  if (body.learnerAvailabilityPaused) {
    return jsonNoStore(
      {
        error:
          safeText(body.learnerAvailabilityPauseReason, "", 180) ||
          "This instructor is temporarily unavailable while LDA reviews compliance evidence."
      },
      { status: 409 }
    );
  }

  if (instructorId && isUuid(instructorId)) {
    const supabase = await createClient();
    if (supabase) {
      const { data: instructorProfile } = await supabase
        .from("instructor_profiles")
        .select("verification_status,compliance_status,learner_availability_paused,learner_availability_pause_reason")
        .eq("user_id", instructorId)
        .maybeSingle();

      if (
        !instructorProfile ||
        instructorProfile.verification_status !== "approved" ||
        instructorProfile.compliance_status !== "clear" ||
        instructorProfile.learner_availability_paused
      ) {
        return jsonNoStore(
          {
            error:
              safeText(instructorProfile?.learner_availability_pause_reason, "", 180) ||
              "This instructor is temporarily unavailable while LDA reviews compliance evidence."
          },
          { status: 409 }
        );
      }
    }
  }

  if (!stripeSecret.value) {
    return jsonNoStore({
      mode: "demo",
      message: `Stripe is not configured yet. Add ${stripeSecret.envName} to create ${stripeSecret.modeLabel} Checkout sessions.`,
      checkoutUrl: `${appUrl}/learner-dashboard?demoCheckout=1&booking=${encodeURIComponent(bookingId)}`
    });
  }

  const params = new URLSearchParams({
    mode: "payment",
    success_url: `${appUrl}/learner-dashboard?payment=success&booking=${encodeURIComponent(bookingId)}`,
    cancel_url: `${appUrl}/learner-dashboard?payment=cancelled&booking=${encodeURIComponent(bookingId)}`,
    "metadata[booking_id]": bookingId,
    "metadata[instructor_id]": instructorId,
    "metadata[lda_protected_booking]": "true",
    "metadata[platform_policy_version]": "anti_circumvention_launch",
    "metadata[payment_preference]": paymentPreference,
    "payment_intent_data[metadata][booking_id]": bookingId,
    "payment_intent_data[metadata][instructor_id]": instructorId,
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
    checkoutUrl: session.url,
    checkoutSessionId: session.id
  });
}
