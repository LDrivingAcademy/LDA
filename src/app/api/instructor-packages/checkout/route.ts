import { getAppOrigin, isRateLimited, jsonNoStore, rateLimitResponse, readJsonBody } from "@/lib/security";
import {
  getInstructorPackage,
  getInstructorPackagePriceEnv,
  type BillingInterval,
  type InstructorPackageId,
} from "@/lib/instructor-packages";
import { getStripePriceId, getStripeSecretKey } from "@/lib/stripe-env";

type InstructorPackageCheckoutRequest = {
  packageId?: InstructorPackageId;
  billingInterval?: BillingInterval;
};

type StripeCheckoutResponse = {
  url?: string;
  error?: {
    message?: string;
  };
};

export async function POST(request: Request) {
  if (isRateLimited(request, "instructor-package-checkout", 12)) {
    return rateLimitResponse();
  }

  const payload = await readJsonBody<InstructorPackageCheckoutRequest>(request);
  if (!payload) {
    return jsonNoStore({ error: "Invalid checkout request." }, { status: 400 });
  }

  const packageId = payload.packageId ?? "instructor-plus";
  const billingInterval = payload.billingInterval === "yearly" ? "yearly" : "monthly";
  const instructorPackage = getInstructorPackage(packageId);

  if (!instructorPackage) {
    return jsonNoStore({ error: "Instructor package not found." }, { status: 404 });
  }

  const appUrl = getAppOrigin(request);

  if (instructorPackage.id === "instructor") {
    return jsonNoStore({ checkoutUrl: `${appUrl}/instructor-dashboard?plan=instructor` });
  }

  const stripeSecret = getStripeSecretKey();
  const priceEnvName = getInstructorPackagePriceEnv(instructorPackage.id, billingInterval);
  const stripePrice = getStripePriceId(priceEnvName);

  if (!stripeSecret.value || !stripePrice?.value) {
    console.error(
      `Instructor package checkout missing ${!stripeSecret.value ? stripeSecret.envName : stripePrice?.envName ?? "Stripe Price ID"} in ${stripeSecret.modeLabel} Stripe mode.`,
    );
    return jsonNoStore(
      {
        error: "Instructor package checkout is being connected. Please try again shortly or contact LDA support.",
      },
      { status: 500 },
    );
  }

  const body = new URLSearchParams({
    mode: "subscription",
    success_url: `${appUrl}/instructor-plus/${instructorPackage.slug}?checkout=success&billing=${billingInterval}`,
    cancel_url: `${appUrl}/instructor-plus/${instructorPackage.slug}?checkout=cancelled&billing=${billingInterval}`,
    "line_items[0][quantity]": "1",
    "line_items[0][price]": stripePrice.value,
    "metadata[lda_instructor_package_id]": instructorPackage.id,
    "metadata[lda_billing_interval]": billingInterval,
    "subscription_data[metadata][lda_instructor_package_id]": instructorPackage.id,
    "subscription_data[metadata][lda_billing_interval]": billingInterval,
    allow_promotion_codes: "true",
  });

  try {
    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecret.value}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    const data = (await response.json()) as StripeCheckoutResponse;

    if (!response.ok) {
      return jsonNoStore(
        { error: data.error?.message ?? "Instructor package checkout could not open." },
        { status: response.status },
      );
    }

    if (!data.url) {
      return jsonNoStore({ error: "Stripe did not return a checkout URL." }, { status: 500 });
    }

    return jsonNoStore({ checkoutUrl: data.url });
  } catch (error) {
    console.error("Instructor package checkout failed", error);
    return jsonNoStore({ error: "Instructor package checkout could not open." }, { status: 500 });
  }
}
