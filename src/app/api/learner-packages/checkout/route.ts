import { getAppOrigin, isRateLimited, jsonNoStore, rateLimitResponse, readJsonBody } from "@/lib/security";
import {
  type BillingInterval,
  type LearnerPackageId,
  getLearnerPackage,
  getPackagePriceEnv
} from "@/lib/learner-packages";
import { sendSubscriptionCancellationEmail, sendSubscriptionConfirmationEmail } from "@/lib/email";
import { getStripePriceId, getStripeSecretKey } from "@/lib/stripe-env";
import { applyStripeCheckoutPaymentMethods } from "@/lib/stripe-checkout";
import { validateStripePriceMatchesExpected } from "@/lib/stripe-price-display";
import { cancelStripeSubscription, updateStripeSubscriptionPrice } from "@/lib/stripe-subscription-updates";
import {
  createSubscriptionSessionToken,
  getSubscriptionSessionMaxAge,
  readSubscriptionSessionToken,
  subscriptionSessionCookieName
} from "@/lib/subscription-session-cookie";
import { syncLearnerPackage } from "@/lib/subscription-profile-sync";
import { syncLearnerPackageWithUserClient } from "@/lib/subscription-profile-user-sync";
import { recoverLatestStripeSubscriptionForSignedInAccount } from "@/lib/subscription-return-recovery";
import { normaliseSubscriptionReturnPath } from "@/lib/subscription-tier-entitlements";
import { createClient } from "@/lib/supabase/server";
import { canUseMarketplaceRole, getMarketplaceRoleState } from "@/lib/account-route-guard";
import { cookies } from "next/headers";

type LearnerPackageCheckoutRequest = {
  packageId?: LearnerPackageId;
  billingInterval?: BillingInterval;
  featureKey?: string;
  returnPath?: string;
};

function formatMonthlyPrice(pence: number) {
  return pence > 0 ? `\u00a3${(pence / 100).toFixed(2)} per month` : "Free";
}

function learnerRedirectResponse({
  checkoutUrl,
  userId,
  customerId,
  subscriptionId,
  packageId,
  status,
  periodEnd
}: {
  checkoutUrl: string;
  userId: string;
  customerId?: string | null;
  subscriptionId?: string | null;
  packageId: LearnerPackageId;
  status?: string | null;
  periodEnd?: string | null;
}) {
  const response = jsonNoStore({ checkoutUrl });
  const maxAge = getSubscriptionSessionMaxAge(periodEnd);
  const token = createSubscriptionSessionToken(
    {
      userId,
      role: "learner",
      packageId,
      customerId,
      subscriptionId,
      status,
      periodEnd
    },
    maxAge
  );

  if (token) {
    response.cookies.set(subscriptionSessionCookieName, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: checkoutUrl.startsWith("https://"),
      maxAge,
      path: "/"
    });
  }

  return response;
}

export async function POST(request: Request) {
  if (isRateLimited(request, "learner-package-checkout", 15)) {
    return rateLimitResponse();
  }

  const body = await readJsonBody<LearnerPackageCheckoutRequest>(request);
  if (!body) {
    return jsonNoStore({ error: "Invalid checkout request." }, { status: 400 });
  }

  const packageId = body.packageId ?? "learner-plus";
  const billingInterval: BillingInterval = "monthly";
  const learnerPackage = getLearnerPackage(packageId);
  const appUrl = getAppOrigin(request);
  const safeReturnPath = normaliseSubscriptionReturnPath(
    body.returnPath,
    `/learner-dashboard?subscription=updated&plan=${learnerPackage?.id ?? "learner-plus"}`
  );

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

  const [{ data: profile }, { data: learnerProfile }] = await Promise.all([
    supabase.from("profiles").select("email").eq("id", user.id).maybeSingle(),
    supabase.from("learner_profiles").select("learner_package,stripe_customer_id,stripe_subscription_id").eq("user_id", user.id).maybeSingle()
  ]);
  const roleState = await getMarketplaceRoleState(supabase, user.id);
  const isAdmin = roleState.isAdmin;
  const subscriptionSession = readSubscriptionSessionToken(
    (await cookies()).get(subscriptionSessionCookieName)?.value,
    user.id,
    "learner"
  );
  const sessionPaidPackage = subscriptionSession?.packageId === "learner-plus" || subscriptionSession?.packageId === "learner-pro";
  let savedStripeCustomerId = learnerProfile?.stripe_customer_id ?? subscriptionSession?.customerId ?? null;
  let savedStripeSubscriptionId =
    learnerProfile?.stripe_subscription_id ?? (sessionPaidPackage ? subscriptionSession?.subscriptionId : null) ?? null;
  let currentPackage =
    getLearnerPackage(learnerProfile?.learner_package ?? (sessionPaidPackage ? subscriptionSession?.packageId : null) ?? "learner") ??
    getLearnerPackage("learner")!;

  if (isAdmin) {
    return jsonNoStore({ checkoutUrl: `${appUrl}/admin` });
  }

  if (!canUseMarketplaceRole(roleState, "learner")) {
    return jsonNoStore({ error: "Use a learner account before changing learner packages." }, { status: 403 });
  }

  if (!learnerPackage) {
    return jsonNoStore({ error: "LDA learner package was not found." }, { status: 404 });
  }

  const stripeSecret = getStripeSecretKey();

  if (learnerPackage.id === "learner" && !savedStripeSubscriptionId && currentPackage.id !== "learner" && stripeSecret.value) {
    try {
      const recovered = await recoverLatestStripeSubscriptionForSignedInAccount({
        supabase,
        userId: user.id,
        email: profile?.email ?? user.email,
        role: "learner",
        secretKey: stripeSecret.value
      });

      if (recovered) {
        savedStripeCustomerId = recovered.customerId ?? savedStripeCustomerId;
        savedStripeSubscriptionId = recovered.subscriptionId ?? savedStripeSubscriptionId;
        currentPackage = getLearnerPackage(recovered.target.packageId) ?? currentPackage;
      }
    } catch (error) {
      console.error("Learner subscription cancellation recovery failed; falling back to local package correction", error);
    }
  }

  if (learnerPackage.id === "learner" && !savedStripeSubscriptionId) {
    if (currentPackage.id !== "learner") {
      try {
        try {
          await syncLearnerPackage({
            userId: user.id,
            customerId: savedStripeCustomerId,
            subscriptionId: null,
            packageId: "learner",
            status: "canceled",
            periodEnd: null
          });
        } catch (adminSyncError) {
          console.error("Learner free-tier correction admin sync failed; trying signed-in profile sync", adminSyncError);
          await syncLearnerPackageWithUserClient({
            supabase,
            userId: user.id,
            customerId: savedStripeCustomerId,
            subscriptionId: null,
            packageId: "learner",
            status: "canceled",
            periodEnd: null
          });
        }
      } catch (syncError) {
        console.error("Learner free-tier correction profile sync failed", syncError);
      }

      try {
        const cancellationEmail = profile?.email ?? user.email;
        if (cancellationEmail) {
          await sendSubscriptionCancellationEmail({
            to: cancellationEmail,
            role: "learner",
            previousPackageName: currentPackage.name,
            freePackageName: "Learner",
            dashboardUrl: `${appUrl}/learner-dashboard?subscription=updated&plan=learner`,
            idempotencyKey: `subscription-cancellation-learner-${user.id}-${currentPackage.id}-no-subscription`
          });
        }
      } catch (emailError) {
        console.error("Learner subscription cancellation email failed", emailError);
      }
    }

    return jsonNoStore({
      checkoutUrl: `${appUrl}/learner-dashboard?subscription=updated&plan=learner`
    });
  }

  const priceEnvName = getPackagePriceEnv(learnerPackage.id, billingInterval);
  const stripePrice = getStripePriceId(priceEnvName);

  if (learnerPackage.id === "learner" && savedStripeSubscriptionId) {
    if (!stripeSecret.value) {
      return jsonNoStore({ error: "Learner package cancellation is being connected. Please contact LDA support." }, { status: 500 });
    }

    try {
      const subscription = await cancelStripeSubscription(stripeSecret.value, savedStripeSubscriptionId);
      try {
        try {
          await syncLearnerPackage({
            userId: user.id,
            customerId: savedStripeCustomerId,
            subscriptionId: subscription.id,
            packageId: "learner",
            status: subscription.status,
            periodEnd: subscription.currentPeriodEnd
          });
        } catch (adminSyncError) {
          console.error("Learner cancellation admin sync failed; trying signed-in profile sync", adminSyncError);
          await syncLearnerPackageWithUserClient({
            supabase,
            userId: user.id,
            customerId: savedStripeCustomerId,
            subscriptionId: subscription.id,
            packageId: "learner",
            status: subscription.status,
            periodEnd: subscription.currentPeriodEnd
          });
        }
      } catch (syncError) {
        console.error("Learner cancellation profile sync failed; using verified subscription session", syncError);
      }

      try {
        const cancellationEmail = profile?.email ?? user.email;
        if (cancellationEmail) {
          const emailResult = await sendSubscriptionCancellationEmail({
            to: cancellationEmail,
            role: "learner",
            previousPackageName: currentPackage.name,
            freePackageName: "Learner",
            dashboardUrl: `${appUrl}/learner-dashboard?subscription=updated&plan=learner`,
            idempotencyKey: `subscription-cancellation-${subscription.id}-${currentPackage.id}-to-learner`
          });
          console.info("Learner subscription cancellation email sent", {
            to: cancellationEmail,
            fromPackage: currentPackage.id,
            result: emailResult
          });
        }
      } catch (emailError) {
        console.error("Learner subscription cancellation email failed", emailError);
      }

      return learnerRedirectResponse({
        checkoutUrl: `${appUrl}/learner-dashboard?subscription=updated&plan=learner`,
        userId: user.id,
        customerId: savedStripeCustomerId,
        subscriptionId: subscription.id,
        packageId: "learner",
        status: subscription.status,
        periodEnd: subscription.currentPeriodEnd
      });
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
      { error: "This learner package is being connected to checkout. Please try again shortly or contact LDA support." },
      { status: 400 }
    );
  }

  const priceValidationError = await validateStripePriceMatchesExpected({
    expectedPence: learnerPackage.monthlyPricePence,
    packageName: learnerPackage.name,
    priceEnvName: stripePrice.envName,
    priceId: stripePrice.value,
    secretKey: stripeSecret.value,
  });

  if (priceValidationError) {
    console.error(priceValidationError);
    return jsonNoStore({ error: priceValidationError }, { status: 400 });
  }

  if (!savedStripeSubscriptionId) {
    try {
      const recovered = await recoverLatestStripeSubscriptionForSignedInAccount({
        supabase,
        userId: user.id,
        email: profile?.email ?? user.email,
        role: "learner",
        secretKey: stripeSecret.value
      });

      if (recovered) {
        savedStripeCustomerId = recovered.customerId ?? savedStripeCustomerId;
        savedStripeSubscriptionId = recovered.subscriptionId ?? savedStripeSubscriptionId;
        currentPackage = getLearnerPackage(recovered.target.packageId) ?? currentPackage;
      }
    } catch (error) {
      console.error("Learner subscription checkout recovery failed; continuing to checkout", error);
    }
  }

  const dashboardUrl = `${appUrl}${safeReturnPath}`;
  const successUrl = `${appUrl}/api/subscriptions/complete?session_id={CHECKOUT_SESSION_ID}&role=learner&return_path=${encodeURIComponent(safeReturnPath)}`;
  const cancelUrl = `${appUrl}/learner-plus/${learnerPackage.slug}?checkout=cancelled&billing=${billingInterval}`;

  if (savedStripeSubscriptionId) {
    try {
      const subscription = await updateStripeSubscriptionPrice({
        secretKey: stripeSecret.value,
        subscriptionId: savedStripeSubscriptionId,
        priceId: stripePrice.value,
        metadata: {
          lda_user_id: user.id,
          lda_account_role: "learner",
          lda_package_id: learnerPackage.id,
          lda_billing_interval: billingInterval,
          lda_feature_key: body.featureKey ?? "",
          lda_return_path: safeReturnPath
        },
        prorationBehavior: learnerPackage.rank > currentPackage.rank ? "always_invoice" : "none"
      });
      try {
        try {
          await syncLearnerPackage({
            userId: user.id,
            customerId: savedStripeCustomerId,
            subscriptionId: subscription.id,
            packageId: learnerPackage.id,
            status: subscription.status,
            periodEnd: subscription.currentPeriodEnd
          });
        } catch (adminSyncError) {
          console.error("Learner subscription package admin sync failed; trying signed-in profile sync", adminSyncError);
          await syncLearnerPackageWithUserClient({
            supabase,
            userId: user.id,
            customerId: savedStripeCustomerId,
            subscriptionId: subscription.id,
            packageId: learnerPackage.id,
            status: subscription.status,
            periodEnd: subscription.currentPeriodEnd
          });
        }
      } catch (syncError) {
        console.error("Learner subscription package profile sync failed; using verified subscription session", syncError);
      }

      try {
        const confirmationEmail = profile?.email ?? user.email;
        if (confirmationEmail) {
          const changeType =
            learnerPackage.rank > currentPackage.rank
              ? "upgrade"
              : learnerPackage.rank < currentPackage.rank
                ? "downgrade"
                : "change";
          const emailResult = await sendSubscriptionConfirmationEmail({
            to: confirmationEmail,
            role: "learner",
            packageName: learnerPackage.name,
            previousPackageName: currentPackage.name,
            changeType,
            billingLabel: "monthly subscription",
            priceLabel: formatMonthlyPrice(learnerPackage.monthlyPricePence),
            dashboardUrl,
            packageSummary: learnerPackage.summary,
            featuresUrl: `${appUrl}/learner-plus/${learnerPackage.slug}`,
            idempotencyKey: `subscription-confirmation-${subscription.id}-${currentPackage.id}-to-${learnerPackage.id}-${Date.now()}`
          });
          console.info("Learner subscription confirmation email sent", {
            to: confirmationEmail,
            fromPackage: currentPackage.id,
            toPackage: learnerPackage.id,
            result: emailResult
          });
        }
      } catch (emailError) {
        console.error("Learner subscription confirmation email failed", emailError);
      }

      return learnerRedirectResponse({
        checkoutUrl: dashboardUrl,
        userId: user.id,
        customerId: savedStripeCustomerId,
        subscriptionId: subscription.id,
        packageId: learnerPackage.id,
        status: subscription.status,
        periodEnd: subscription.currentPeriodEnd
      });
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
    ...(savedStripeCustomerId ? { customer: savedStripeCustomerId } : {}),
    ...(!savedStripeCustomerId && (profile?.email || user.email) ? { customer_email: profile?.email ?? user.email ?? "" } : {}),
    "metadata[lda_user_id]": user.id,
    "metadata[lda_account_role]": "learner",
    "metadata[lda_package_id]": learnerPackage.id,
    "metadata[lda_billing_interval]": billingInterval,
    "metadata[lda_feature_key]": body.featureKey ?? "",
    "metadata[lda_return_path]": safeReturnPath,
    "subscription_data[metadata][lda_user_id]": user.id,
    "subscription_data[metadata][lda_account_role]": "learner",
    "subscription_data[metadata][lda_package_id]": learnerPackage.id,
    "subscription_data[metadata][lda_billing_interval]": billingInterval,
    "subscription_data[metadata][lda_feature_key]": body.featureKey ?? "",
    "subscription_data[metadata][lda_return_path]": safeReturnPath,
    allow_promotion_codes: "true"
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
    return jsonNoStore({ error: session.error?.message ?? "Stripe subscription checkout failed" }, { status: 400 });
  }

  return jsonNoStore({
    checkoutUrl: session.url,
    checkoutSessionId: session.id
  });
}
