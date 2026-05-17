import { isRateLimited, jsonNoStore, rateLimitResponse } from "@/lib/security";
import {
  type BillingInterval,
  type LearnerPackageId,
  getLearnerPackage,
  getPackagePriceEnv
} from "@/lib/learner-packages";

type LearnerPackageCheckoutRequest = {
  packageId?: LearnerPackageId;
  billingInterval?: BillingInterval;
};

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
      // Try the next candidate. A malformed APP_WEBSITE_URL should not block subscription checkout.
    }
  }

  return "https://ldrivingacademy.co.uk";
}

export async function POST(request: Request) {
  if (isRateLimited(request, "learner-package-checkout", 15)) {
    return rateLimitResponse();
  }

  const body = (await request.json()) as LearnerPackageCheckoutRequest;
  const packageId = body.packageId ?? "learner-plus";
  const billingInterval = body.billingInterval ?? "monthly";
  const learnerPackage = getLearnerPackage(packageId);
  const appUrl = normaliseAppUrl(request);

  if (!learnerPackage) {
    return jsonNoStore({ error: "LDA learner package was not found." }, { status: 404 });
  }

  if (learnerPackage.id === "learner") {
    return jsonNoStore({
      checkoutUrl: `${appUrl}/learner-dashboard?plan=learner`
    });
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const priceEnvName = getPackagePriceEnv(learnerPackage.id, billingInterval);
  const priceId = priceEnvName ? process.env[priceEnvName] : undefined;

  if (!stripeSecretKey) {
    return jsonNoStore(
      { error: "Stripe subscriptions are not configured yet. Add STRIPE_SECRET_KEY in Vercel." },
      { status: 400 }
    );
  }

  if (!priceEnvName || !priceId) {
    return jsonNoStore(
      { error: `Add ${priceEnvName ?? "the Stripe Price ID"} in Vercel to enable this subscription.` },
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
    "line_items[0][price]": priceId,
    "metadata[lda_package_id]": learnerPackage.id,
    "metadata[lda_billing_interval]": billingInterval,
    "subscription_data[metadata][lda_package_id]": learnerPackage.id,
    "subscription_data[metadata][lda_billing_interval]": billingInterval
  });

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
    return jsonNoStore({ error: session.error?.message ?? "Stripe subscription checkout failed" }, { status: 400 });
  }

  return jsonNoStore({
    checkoutUrl: session.url,
    checkoutSessionId: session.id
  });
}
