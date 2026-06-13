import { getAppOrigin, isRateLimited, jsonNoStore, rateLimitResponse, readJsonBody } from "@/lib/security";
import {
  type BillingInterval,
  type LearnerPackageId,
  getLearnerPackage,
  getPackagePriceEnv
} from "@/lib/learner-packages";
import { getStripePriceId, getStripeSecretKey } from "@/lib/stripe-env";
import { cancelStripeSubscription, updateStripeSubscriptionPrice } from "@/lib/stripe-subscription-updates";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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

  const supabase = await createClient();

  if (!supabase) {
    return jsonNoStore({ error: "Sign in before changing your learner package." }, { status: 401 });
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonNoStore({ error: "Sign in before changing your learner package." }, { status: 401 });
  }

  const [{ data: roles }, { data: profile }, { data: learnerProfile }] = await Promise.all([
    supabase.from("account_roles").select("role").eq("user_id", user.id),
    supabase.from("profiles").select("email").eq("id", user.id).maybeSingle(),
    supabase.from("learner_profiles").select("stripe_customer_id,stripe_subscription_id").eq("user_id", user.id).maybeSingle()
  ]);
  const isLearner = roles?.some((role) => role.role === "learner") ?? false;

  if (!isLearner) {
    return jsonNoStore({ error: "Use a learner account before changing learner packages." }, { status: 403 });
  }

  if (!learnerPackage) {
    return jsonNoStore({ error: "LDA learner package was not found." }, { status: 404 });
  }

  if (learnerPackage.id === "learner" && !learnerProfile?.stripe_subscription_id) {
    return jsonNoStore({
      checkoutUrl: `${appUrl}/learner-dashboard?plan=learner`
    });
  }

  const stripeSecret = getStripeSecretKey();
  const priceEnvName = getPackagePriceEnv(learnerPackage.id, billingInterval);
  const stripePrice = getStripePriceId(priceEnvName);

  if (learnerPackage.id === "learner" && learnerProfile?.stripe_subscription_id) {
    if (!stripeSecret.value) {
      return jsonNoStore({ error: "Learner package cancellation is being connected. Please contact LDA support." }, { status: 500 });
    }

    try {
      const subscription = await cancelStripeSubscription(stripeSecret.value, learnerProfile.stripe_subscription_id);
      const admin = createAdminClient();

      if (admin) {
        const now = new Date().toISOString();
        const { error } = await admin
          .from("learner_profiles")
          .update({
            learner_package: "learner",
            learner_subscription_status: subscription.status,
            learner_package_expires_at: subscription.currentPeriodEnd,
            learner_plus_active: false,
            learner_plus_expires_at: subscription.currentPeriodEnd,
            learner_plus_source: "stripe",
            stripe_subscription_id: null,
            updated_at: now
          })
          .eq("user_id", user.id);

        if (error) {
          throw error;
        }
      }

      return jsonNoStore({ checkoutUrl: `${appUrl}/learner-dashboard?plan=learner` });
    } catch (error) {
      console.error("Learner subscription cancellation failed", error);
      return jsonNoStore(
        { error: error instanceof Error ? error.message : "Learner subscription could not be cancelled." },
        { status: 500 }
      );
    }
  }

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

  if (stripePrice.value.startsWith("prod_")) {
    console.error(`Learner package checkout has a Stripe Product ID in ${stripePrice.envName}. Add the matching price_ ID instead.`);
    return jsonNoStore(
      { error: "This learner package is linked to a Stripe Product ID. Add the matching Stripe Price ID in Vercel, then redeploy." },
      { status: 400 }
    );
  }

  const successUrl = `${appUrl}/learner-plus/${learnerPackage.slug}?checkout=success&billing=${billingInterval}`;
  const cancelUrl = `${appUrl}/learner-plus/${learnerPackage.slug}?checkout=cancelled&billing=${billingInterval}`;

  if (learnerProfile?.stripe_subscription_id) {
    try {
      const subscription = await updateStripeSubscriptionPrice({
        secretKey: stripeSecret.value,
        subscriptionId: learnerProfile.stripe_subscription_id,
        priceId: stripePrice.value,
        metadata: {
          lda_user_id: user.id,
          lda_account_role: "learner",
          lda_package_id: learnerPackage.id,
          lda_billing_interval: billingInterval
        }
      });
      const admin = createAdminClient();

      if (admin) {
        const now = new Date().toISOString();
        const { error } = await admin
          .from("learner_profiles")
          .update({
            learner_package: learnerPackage.id,
            learner_subscription_status: subscription.status,
            learner_package_started_at: now,
            learner_package_expires_at: subscription.currentPeriodEnd,
            learner_plus_active: learnerPackage.id !== "learner",
            learner_plus_started_at: now,
            learner_plus_expires_at: subscription.currentPeriodEnd,
            learner_plus_source: "stripe",
            stripe_subscription_id: subscription.id,
            updated_at: now
          })
          .eq("user_id", user.id);

        if (error) {
          throw error;
        }
      }

      return jsonNoStore({ checkoutUrl: successUrl });
    } catch (error) {
      console.error("Learner subscription package change failed", error);
      return jsonNoStore(
        { error: error instanceof Error ? error.message : "Learner subscription could not be updated." },
        { status: 500 }
      );
    }
  }

  const params = new URLSearchParams({
    mode: "subscription",
    success_url: successUrl,
    cancel_url: cancelUrl,
    "line_items[0][quantity]": "1",
    "line_items[0][price]": stripePrice.value,
    client_reference_id: user.id,
    ...(learnerProfile?.stripe_customer_id ? { customer: learnerProfile.stripe_customer_id } : {}),
    ...(!learnerProfile?.stripe_customer_id && (profile?.email || user.email) ? { customer_email: profile?.email ?? user.email ?? "" } : {}),
    "metadata[lda_user_id]": user.id,
    "metadata[lda_account_role]": "learner",
    "metadata[lda_package_id]": learnerPackage.id,
    "metadata[lda_billing_interval]": billingInterval,
    "subscription_data[metadata][lda_user_id]": user.id,
    "subscription_data[metadata][lda_account_role]": "learner",
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
