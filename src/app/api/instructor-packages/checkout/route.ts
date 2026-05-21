import { isRateLimited, jsonNoStore, rateLimitResponse } from "@/lib/security";
import {
  getInstructorPackage,
  getInstructorPackagePriceEnv,
  type BillingInterval,
  type InstructorPackageId,
} from "@/lib/instructor-packages";

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

function normaliseAppUrl(request: Request) {
  const configuredUrl = process.env.APP_WEBSITE_URL?.trim();
  const forwardedHost = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  const candidates = [
    configuredUrl,
    configuredUrl && !configuredUrl.startsWith("http") ? `https://${configuredUrl}` : undefined,
    forwardedHost ? `${forwardedProto}://${forwardedHost}` : undefined,
    "https://ldrivingacademy.co.uk",
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;

    try {
      return new URL(candidate).origin;
    } catch {
      // Keep trying the remaining fallbacks.
    }
  }

  return "https://ldrivingacademy.co.uk";
}

export async function POST(request: Request) {
  if (isRateLimited(request, "instructor-package-checkout", 12)) {
    return rateLimitResponse();
  }

  let payload: InstructorPackageCheckoutRequest = {};

  try {
    payload = (await request.json()) as InstructorPackageCheckoutRequest;
  } catch {
    return jsonNoStore({ error: "Invalid checkout request." }, { status: 400 });
  }

  const packageId = payload.packageId ?? "instructor-plus";
  const billingInterval = payload.billingInterval ?? "monthly";
  const instructorPackage = getInstructorPackage(packageId);

  if (!instructorPackage) {
    return jsonNoStore({ error: "Instructor package not found." }, { status: 404 });
  }

  const appUrl = normaliseAppUrl(request);

  if (instructorPackage.id === "instructor") {
    return jsonNoStore({ checkoutUrl: `${appUrl}/instructor-dashboard?plan=instructor` });
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const priceEnvName = getInstructorPackagePriceEnv(instructorPackage.id, billingInterval);
  const priceId = priceEnvName ? process.env[priceEnvName] : undefined;

  if (!stripeSecretKey || !priceId) {
    return jsonNoStore(
      {
        error: priceEnvName
          ? `Add ${priceEnvName} and STRIPE_SECRET_KEY in Vercel to enable this instructor subscription.`
          : "Instructor package checkout is not configured yet.",
      },
      { status: 500 },
    );
  }

  const body = new URLSearchParams({
    mode: "subscription",
    success_url: `${appUrl}/instructor-plus/${instructorPackage.slug}?checkout=success&billing=${billingInterval}`,
    cancel_url: `${appUrl}/instructor-plus/${instructorPackage.slug}?checkout=cancelled&billing=${billingInterval}`,
    "line_items[0][quantity]": "1",
    "line_items[0][price]": priceId,
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
        Authorization: `Bearer ${stripeSecretKey}`,
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
