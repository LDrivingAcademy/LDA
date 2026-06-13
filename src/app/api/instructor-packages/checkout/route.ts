import { getAppOrigin, isRateLimited, jsonNoStore, rateLimitResponse, readJsonBody } from "@/lib/security";
import {
  getInstructorPackage,
  getInstructorPackagePriceEnv,
  type BillingInterval,
  type InstructorPackageId,
} from "@/lib/instructor-packages";
import { getStripePriceId, getStripeSecretKey } from "@/lib/stripe-env";
import { cancelStripeSubscription, updateStripeSubscriptionPrice } from "@/lib/stripe-subscription-updates";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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
  const supabase = await createClient();

  if (!supabase) {
    return jsonNoStore({ error: "Sign in before changing your instructor package." }, { status: 401 });
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonNoStore({ error: "Sign in before changing your instructor package." }, { status: 401 });
  }

  const [{ data: roles }, { data: profile }, { data: instructorProfile }] = await Promise.all([
    supabase.from("account_roles").select("role").eq("user_id", user.id),
    supabase.from("profiles").select("email").eq("id", user.id).maybeSingle(),
    supabase.from("instructor_profiles").select("stripe_customer_id,stripe_subscription_id").eq("user_id", user.id).maybeSingle()
  ]);
  const isInstructor = roles?.some((role) => role.role === "instructor") ?? false;

  if (!isInstructor) {
    return jsonNoStore({ error: "Use an instructor account before changing instructor packages." }, { status: 403 });
  }

  if (instructorPackage.id === "instructor" && !instructorProfile?.stripe_subscription_id) {
    return jsonNoStore({ checkoutUrl: `${appUrl}/instructor-dashboard?plan=instructor` });
  }

  const stripeSecret = getStripeSecretKey();
  const priceEnvName = getInstructorPackagePriceEnv(instructorPackage.id, billingInterval);
  const stripePrice = getStripePriceId(priceEnvName);

  if (instructorPackage.id === "instructor" && instructorProfile?.stripe_subscription_id) {
    if (!stripeSecret.value) {
      return jsonNoStore({ error: "Instructor package cancellation is being connected. Please contact LDA support." }, { status: 500 });
    }

    try {
      const subscription = await cancelStripeSubscription(stripeSecret.value, instructorProfile.stripe_subscription_id);
      const admin = createAdminClient();

      if (admin) {
        const { error } = await admin
          .from("instructor_profiles")
          .update({
            instructor_package: "instructor",
            instructor_subscription_status: subscription.status,
            instructor_package_source: "stripe",
            instructor_package_expires_at: subscription.currentPeriodEnd,
            stripe_subscription_id: null,
            updated_at: new Date().toISOString()
          })
          .eq("user_id", user.id);

        if (error) {
          throw error;
        }
      }

      return jsonNoStore({ checkoutUrl: `${appUrl}/instructor-dashboard?plan=instructor` });
    } catch (error) {
      console.error("Instructor subscription cancellation failed", error);
      return jsonNoStore(
        { error: error instanceof Error ? error.message : "Instructor subscription could not be cancelled." },
        { status: 500 }
      );
    }
  }

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

  if (stripePrice.value.startsWith("prod_")) {
    console.error(
      `Instructor package checkout has a Stripe Product ID in ${stripePrice.envName}. Add the matching price_ ID instead.`,
    );
    return jsonNoStore(
      {
        error: "This package is linked to a Stripe Product ID. Add the matching Stripe Price ID in Vercel, then redeploy.",
      },
      { status: 400 },
    );
  }

  const successUrl = `${appUrl}/instructor-plus/${instructorPackage.slug}?checkout=success&billing=${billingInterval}`;
  const cancelUrl = `${appUrl}/instructor-plus/${instructorPackage.slug}?checkout=cancelled&billing=${billingInterval}`;

  if (instructorProfile?.stripe_subscription_id) {
    try {
      const subscription = await updateStripeSubscriptionPrice({
        secretKey: stripeSecret.value,
        subscriptionId: instructorProfile.stripe_subscription_id,
        priceId: stripePrice.value,
        metadata: {
          lda_user_id: user.id,
          lda_account_role: "instructor",
          lda_instructor_package_id: instructorPackage.id,
          lda_billing_interval: billingInterval
        }
      });
      const admin = createAdminClient();

      if (admin) {
        const { error } = await admin
          .from("instructor_profiles")
          .update({
            instructor_package: instructorPackage.id,
            instructor_subscription_status: subscription.status,
            instructor_package_source: "stripe",
            instructor_package_expires_at: subscription.currentPeriodEnd,
            stripe_subscription_id: subscription.id,
            updated_at: new Date().toISOString()
          })
          .eq("user_id", user.id);

        if (error) {
          throw error;
        }
      }

      return jsonNoStore({ checkoutUrl: successUrl });
    } catch (error) {
      console.error("Instructor subscription package change failed", error);
      return jsonNoStore(
        { error: error instanceof Error ? error.message : "Instructor subscription could not be updated." },
        { status: 500 }
      );
    }
  }

  const body = new URLSearchParams({
    mode: "subscription",
    success_url: successUrl,
    cancel_url: cancelUrl,
    "line_items[0][quantity]": "1",
    "line_items[0][price]": stripePrice.value,
    client_reference_id: user.id,
    ...(instructorProfile?.stripe_customer_id ? { customer: instructorProfile.stripe_customer_id } : {}),
    ...(!instructorProfile?.stripe_customer_id && (profile?.email || user.email) ? { customer_email: profile?.email ?? user.email ?? "" } : {}),
    "metadata[lda_user_id]": user.id,
    "metadata[lda_account_role]": "instructor",
    "metadata[lda_instructor_package_id]": instructorPackage.id,
    "metadata[lda_billing_interval]": billingInterval,
    "subscription_data[metadata][lda_user_id]": user.id,
    "subscription_data[metadata][lda_account_role]": "instructor",
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
