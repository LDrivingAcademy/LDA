import { getAppOrigin, isRateLimited, jsonNoStore, rateLimitResponse, readJsonBody } from "@/lib/security";
import {
  getInstructorPackage,
  getInstructorPackagePriceEnv,
  type BillingInterval,
  type InstructorPackageId,
} from "@/lib/instructor-packages";
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
import { syncInstructorPackage } from "@/lib/subscription-profile-sync";
import { syncInstructorPackageWithUserClient } from "@/lib/subscription-profile-user-sync";
import { recoverLatestStripeSubscriptionForSignedInAccount } from "@/lib/subscription-return-recovery";
import { normaliseSubscriptionReturnPath } from "@/lib/subscription-tier-entitlements";
import { createClient } from "@/lib/supabase/server";
import { canUseMarketplaceRole, getMarketplaceRoleState } from "@/lib/account-route-guard";
import { cookies } from "next/headers";

type InstructorPackageCheckoutRequest = {
  packageId?: InstructorPackageId;
  billingInterval?: BillingInterval;
  featureKey?: string;
  returnPath?: string;
};

function formatMonthlyPrice(pence: number) {
  return pence > 0 ? `\u00a3${(pence / 100).toFixed(2)} per month` : "Free";
}

type StripeCheckoutResponse = {
  url?: string;
  error?: {
    message?: string;
  };
};

function instructorRedirectResponse({
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
  packageId: InstructorPackageId;
  status?: string | null;
  periodEnd?: string | null;
}) {
  const response = jsonNoStore({ checkoutUrl });
  const maxAge = getSubscriptionSessionMaxAge(periodEnd);
  const token = createSubscriptionSessionToken(
    {
      userId,
      role: "instructor",
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
  if (isRateLimited(request, "instructor-package-checkout", 12)) {
    return rateLimitResponse();
  }

  const payload = await readJsonBody<InstructorPackageCheckoutRequest>(request);
  if (!payload) {
    return jsonNoStore({ error: "Invalid checkout request." }, { status: 400 });
  }

  const packageId = payload.packageId ?? "instructor-plus";
  const billingInterval: BillingInterval = "monthly";
  const instructorPackage = getInstructorPackage(packageId);

  if (!instructorPackage) {
    return jsonNoStore({ error: "Instructor package not found." }, { status: 404 });
  }

  const appUrl = getAppOrigin(request);
  const safeReturnPath = normaliseSubscriptionReturnPath(
    payload.returnPath,
    `/instructor-dashboard?subscription=updated&plan=${instructorPackage.id}`
  );
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

  const [{ data: profile }, { data: instructorProfile }, roleState] = await Promise.all([
    supabase.from("profiles").select("email").eq("id", user.id).maybeSingle(),
    supabase.from("instructor_profiles").select("instructor_package,stripe_customer_id,stripe_subscription_id,verification_status,instructor_subscription_status").eq("user_id", user.id).maybeSingle(),
    getMarketplaceRoleState(supabase, user.id)
  ]);
  const isAdmin = roleState.isAdmin;
  const subscriptionSession = readSubscriptionSessionToken(
    (await cookies()).get(subscriptionSessionCookieName)?.value,
    user.id,
    "instructor"
  );
  const sessionPaidPackage =
    subscriptionSession?.packageId === "instructor-plus" || subscriptionSession?.packageId === "instructor-pro";
  let savedStripeCustomerId = instructorProfile?.stripe_customer_id ?? subscriptionSession?.customerId ?? null;
  let savedStripeSubscriptionId =
    instructorProfile?.stripe_subscription_id ?? (sessionPaidPackage ? subscriptionSession?.subscriptionId : null) ?? null;
  let currentPackage =
    getInstructorPackage(
      instructorProfile?.instructor_package ?? (sessionPaidPackage ? subscriptionSession?.packageId : null) ?? "instructor",
    ) ?? getInstructorPackage("instructor")!;

  if (isAdmin) {
    return jsonNoStore({ checkoutUrl: `${appUrl}/admin` });
  }

  if (!canUseMarketplaceRole(roleState, "instructor")) {
    return jsonNoStore(
      { error: "Instructor packages unlock once LDA approves your instructor application." },
      { status: 403 }
    );
  }

  const stripeSecret = getStripeSecretKey();

  if (instructorPackage.id === "instructor" && !savedStripeSubscriptionId && currentPackage.id !== "instructor" && stripeSecret.value) {
    try {
      const recovered = await recoverLatestStripeSubscriptionForSignedInAccount({
        supabase,
        userId: user.id,
        email: profile?.email ?? user.email,
        role: "instructor",
        secretKey: stripeSecret.value
      });

      if (recovered) {
        savedStripeCustomerId = recovered.customerId ?? savedStripeCustomerId;
        savedStripeSubscriptionId = recovered.subscriptionId ?? savedStripeSubscriptionId;
        currentPackage = getInstructorPackage(recovered.target.packageId) ?? currentPackage;
      }
    } catch (error) {
      console.error("Instructor subscription cancellation recovery failed; falling back to local package correction", error);
    }
  }

  if (instructorPackage.id === "instructor" && !savedStripeSubscriptionId) {
    if (currentPackage.id !== "instructor") {
      try {
        try {
          await syncInstructorPackage({
            userId: user.id,
            customerId: savedStripeCustomerId,
            subscriptionId: null,
            packageId: "instructor",
            status: "canceled",
            periodEnd: null
          });
        } catch (adminSyncError) {
          console.error("Instructor free-tier correction admin sync failed; trying signed-in profile sync", adminSyncError);
          await syncInstructorPackageWithUserClient({
            supabase,
            userId: user.id,
            customerId: savedStripeCustomerId,
            subscriptionId: null,
            packageId: "instructor",
            status: "canceled",
            periodEnd: null
          });
        }
      } catch (syncError) {
        console.error("Instructor free-tier correction profile sync failed", syncError);
      }

      try {
        const cancellationEmail = profile?.email ?? user.email;
        if (cancellationEmail) {
          await sendSubscriptionCancellationEmail({
            to: cancellationEmail,
            role: "instructor",
            previousPackageName: currentPackage.name,
            freePackageName: "Instructor",
            dashboardUrl: `${appUrl}/instructor-dashboard?subscription=updated&plan=instructor`,
            idempotencyKey: `subscription-cancellation-instructor-${user.id}-${currentPackage.id}-no-subscription`
          });
        }
      } catch (emailError) {
        console.error("Instructor subscription cancellation email failed", emailError);
      }
    }

    return jsonNoStore({ checkoutUrl: `${appUrl}/instructor-dashboard?subscription=updated&plan=instructor` });
  }

  const priceEnvName = getInstructorPackagePriceEnv(instructorPackage.id, billingInterval);
  const stripePrice = getStripePriceId(priceEnvName);

  if (instructorPackage.id === "instructor" && savedStripeSubscriptionId) {
    if (!stripeSecret.value) {
      return jsonNoStore({ error: "Instructor package cancellation is being connected. Please contact LDA support." }, { status: 500 });
    }

    try {
      const subscription = await cancelStripeSubscription(stripeSecret.value, savedStripeSubscriptionId);
      try {
        try {
          await syncInstructorPackage({
            userId: user.id,
            customerId: savedStripeCustomerId,
            subscriptionId: subscription.id,
            packageId: "instructor",
            status: subscription.status,
            periodEnd: subscription.currentPeriodEnd
          });
        } catch (adminSyncError) {
          console.error("Instructor cancellation admin sync failed; trying signed-in profile sync", adminSyncError);
          await syncInstructorPackageWithUserClient({
            supabase,
            userId: user.id,
            customerId: savedStripeCustomerId,
            subscriptionId: subscription.id,
            packageId: "instructor",
            status: subscription.status,
            periodEnd: subscription.currentPeriodEnd
          });
        }
      } catch (syncError) {
        console.error("Instructor cancellation profile sync failed; using verified subscription session", syncError);
      }

      try {
        const cancellationEmail = profile?.email ?? user.email;
        if (cancellationEmail) {
          const emailResult = await sendSubscriptionCancellationEmail({
            to: cancellationEmail,
            role: "instructor",
            previousPackageName: currentPackage.name,
            freePackageName: "Instructor",
            dashboardUrl: `${appUrl}/instructor-dashboard?subscription=updated&plan=instructor`,
            idempotencyKey: `subscription-cancellation-${subscription.id}-${currentPackage.id}-to-instructor`
          });
          console.info("Instructor subscription cancellation email sent", {
            to: cancellationEmail,
            fromPackage: currentPackage.id,
            result: emailResult
          });
        }
      } catch (emailError) {
        console.error("Instructor subscription cancellation email failed", emailError);
      }

      return instructorRedirectResponse({
        checkoutUrl: `${appUrl}/instructor-dashboard?subscription=updated&plan=instructor`,
        userId: user.id,
        customerId: savedStripeCustomerId,
        subscriptionId: subscription.id,
        packageId: "instructor",
        status: subscription.status,
        periodEnd: subscription.currentPeriodEnd
      });
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
        error: "This package is being connected to checkout. Please try again shortly or contact LDA support.",
      },
      { status: 400 },
    );
  }

  const priceValidationError = await validateStripePriceMatchesExpected({
    expectedPence: instructorPackage.monthlyPricePence,
    packageName: instructorPackage.name,
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
        role: "instructor",
        secretKey: stripeSecret.value
      });

      if (recovered) {
        savedStripeCustomerId = recovered.customerId ?? savedStripeCustomerId;
        savedStripeSubscriptionId = recovered.subscriptionId ?? savedStripeSubscriptionId;
        currentPackage = getInstructorPackage(recovered.target.packageId) ?? currentPackage;
      }
    } catch (error) {
      console.error("Instructor subscription checkout recovery failed; continuing to checkout", error);
    }
  }

  const dashboardUrl = `${appUrl}${safeReturnPath}`;
  const successUrl = `${appUrl}/api/subscriptions/complete?session_id={CHECKOUT_SESSION_ID}&role=instructor&return_path=${encodeURIComponent(safeReturnPath)}`;
  const cancelUrl = `${appUrl}/instructor-plus/${instructorPackage.slug}?checkout=cancelled&billing=${billingInterval}`;

  if (savedStripeSubscriptionId) {
    try {
      const subscription = await updateStripeSubscriptionPrice({
        secretKey: stripeSecret.value,
        subscriptionId: savedStripeSubscriptionId,
        priceId: stripePrice.value,
        metadata: {
          lda_user_id: user.id,
          lda_account_role: "instructor",
          lda_instructor_package_id: instructorPackage.id,
          lda_billing_interval: billingInterval,
          lda_feature_key: payload.featureKey ?? "",
          lda_return_path: safeReturnPath
        },
        prorationBehavior: instructorPackage.rank > currentPackage.rank ? "always_invoice" : "none"
      });
      try {
        try {
          await syncInstructorPackage({
            userId: user.id,
            customerId: savedStripeCustomerId,
            subscriptionId: subscription.id,
            packageId: instructorPackage.id,
            status: subscription.status,
            periodEnd: subscription.currentPeriodEnd
          });
        } catch (adminSyncError) {
          console.error("Instructor subscription package admin sync failed; trying signed-in profile sync", adminSyncError);
          await syncInstructorPackageWithUserClient({
            supabase,
            userId: user.id,
            customerId: savedStripeCustomerId,
            subscriptionId: subscription.id,
            packageId: instructorPackage.id,
            status: subscription.status,
            periodEnd: subscription.currentPeriodEnd
          });
        }
      } catch (syncError) {
        console.error("Instructor subscription package profile sync failed; using verified subscription session", syncError);
      }

      try {
        const confirmationEmail = profile?.email ?? user.email;
        if (confirmationEmail) {
          const changeType =
            instructorPackage.rank > currentPackage.rank
              ? "upgrade"
              : instructorPackage.rank < currentPackage.rank
                ? "downgrade"
                : "change";
          const emailResult = await sendSubscriptionConfirmationEmail({
            to: confirmationEmail,
            role: "instructor",
            packageName: instructorPackage.name,
            previousPackageName: currentPackage.name,
            changeType,
            billingLabel: "monthly subscription",
            priceLabel: formatMonthlyPrice(instructorPackage.monthlyPricePence),
            dashboardUrl,
            packageSummary: instructorPackage.summary,
            featuresUrl: `${appUrl}/instructor-plus/${instructorPackage.slug}`,
            idempotencyKey: `subscription-confirmation-${subscription.id}-${currentPackage.id}-to-${instructorPackage.id}-${Date.now()}`
          });
          console.info("Instructor subscription confirmation email sent", {
            to: confirmationEmail,
            fromPackage: currentPackage.id,
            toPackage: instructorPackage.id,
            result: emailResult
          });
        }
      } catch (emailError) {
        console.error("Instructor subscription confirmation email failed", emailError);
      }

      return instructorRedirectResponse({
        checkoutUrl: dashboardUrl,
        userId: user.id,
        customerId: savedStripeCustomerId,
        subscriptionId: subscription.id,
        packageId: instructorPackage.id,
        status: subscription.status,
        periodEnd: subscription.currentPeriodEnd
      });
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
    ...(savedStripeCustomerId ? { customer: savedStripeCustomerId } : {}),
    ...(!savedStripeCustomerId && (profile?.email || user.email) ? { customer_email: profile?.email ?? user.email ?? "" } : {}),
    "metadata[lda_user_id]": user.id,
    "metadata[lda_account_role]": "instructor",
    "metadata[lda_instructor_package_id]": instructorPackage.id,
    "metadata[lda_billing_interval]": billingInterval,
    "metadata[lda_feature_key]": payload.featureKey ?? "",
    "metadata[lda_return_path]": safeReturnPath,
    "subscription_data[metadata][lda_user_id]": user.id,
    "subscription_data[metadata][lda_account_role]": "instructor",
    "subscription_data[metadata][lda_instructor_package_id]": instructorPackage.id,
    "subscription_data[metadata][lda_billing_interval]": billingInterval,
    "subscription_data[metadata][lda_feature_key]": payload.featureKey ?? "",
    "subscription_data[metadata][lda_return_path]": safeReturnPath,
    allow_promotion_codes: "true",
  });
  applyStripeCheckoutPaymentMethods(body);

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
