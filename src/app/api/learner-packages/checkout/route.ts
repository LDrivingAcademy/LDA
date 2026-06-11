import { getAppOrigin, isRateLimited, jsonNoStore, rateLimitResponse, readJsonBody } from "@/lib/security";
import {
  type BillingInterval,
  type LearnerPackageId,
  getLearnerPackage,
  getPackagePriceEnv
} from "@/lib/learner-packages";
import { getStripePriceId, getStripeSecretKey } from "@/lib/stripe-env";

type LearnerPackageCheckoutRequest = {
  packageId?: LearnerPackageId;
  billingInterval?: BillingInterval;
};

export async function POST(request: Request) {
  if (isRateLimited(request, "learner-package-checkout", 15)) {
    return rateLimitResponse();
  }

  const body = await readJsonBody<LearnerPackageCheckoutRequest>(request);
  if (!body) {
    return jsonNoStore({ error: "Invalid checkout request." }, { status: 400 });
  }

  const packageId = body.packageId ?? "learner-plus";
  const billingInterval = body.billingInterval === "yearly" ? "yearly" : "monthly";
  const learnerPackage = getLearnerPackage(packageId);
  const appUrl = getAppOrigin(request);

  if (!learnerPackage) {
    return jsonNoStore({ error: "LDA learner package was not found." }, { status: 404 });
  }

  if (learnerPackage.id === "learner") {
    return jsonNoStore({
      checkoutUrl: `${appUrl}/learner-dashboard?plan=learner`
    });
  }

  const stripeSecret = getStripeSecretKey();
  const priceEnvName = getPackagePriceEnv(learnerPackage.id, billingInterval);
  const stripePrice = getStripePriceId(priceEnvName);

  if (!stripeSecret.value) {
    console.error(`Learner package checkout is missing ${stripeSecret.envName} in ${stripeSecret.modeLabel} Stripe mode.`);
    return jsonNoStore(
      { error: "Subscription checkout is being connected. Please try again shortly or contact LDA support." },
      { status: 400 }
    );
  }

  if (!stripePrice?.value) {
    console.error(`Learner package checkout is missing Stripe Price ID: ${stripePrice?.envName ?? "unknown price env"} in ${stripeSecret.modeLabel} Stripe mode.`);
    return jsonNoStore(
      { error: "This learner package is being connected to checkout. Please try again shortly or contact LDA support." },
      { status: 400 }
    );
  }

  const successUrl = `${appUrl}/learner-plus/${learnerPackage.slug}?checkout=success&billing=${billingInterval}`;
  const cancelUrl = `${appUrl}/learner-plus/${learnerPackage.slug}?checkout=cancelled&billing=${billingInterval}`;
  const params = new URLSearchParams({
    mode: "subscription",
    success_url: successUrl,
    cancel_url: cancelUrl,
    "line_items[0][quantity]": "1",
    "line_items[0][price]": stripePrice.value,
    "metadata[lda_package_id]": learnerPackage.id,
    "metadata[lda_billing_interval]": billingInterval,
    "subscription_data[metadata][lda_package_id]": learnerPackage.id,
    "subscription_data[metadata][lda_billing_interval]": billingInterval
  });

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
    return jsonNoStore({ error: session.error?.message ?? "Stripe subscription checkout failed" }, { status: 400 });
  }

  return jsonNoStore({
    checkoutUrl: session.url,
    checkoutSessionId: session.id
  });
}
