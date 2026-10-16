import { NextResponse } from "next/server";
import { sendSubscriptionConfirmationEmail } from "@/lib/email";
import { getInstructorPackage, type InstructorPackageId } from "@/lib/instructor-packages";
import { getLearnerPackage, type LearnerPackageId } from "@/lib/learner-packages";
import { canUseMarketplaceRole, getMarketplaceRoleState } from "@/lib/account-route-guard";
import { getStripeSecretKey } from "@/lib/stripe-env";
import {
  createSubscriptionSessionToken,
  getSubscriptionSessionMaxAge,
  subscriptionSessionCookieName
} from "@/lib/subscription-session-cookie";
import { syncSubscriptionTarget, type SubscriptionSyncTarget } from "@/lib/subscription-profile-sync";
import { normaliseSubscriptionReturnPath } from "@/lib/subscription-tier-entitlements";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type StripeCheckoutSession = {
  id?: string;
  client_reference_id?: string | null;
  customer_email?: string | null;
  customer?: string | null;
  customer_details?: {
    email?: string | null;
  } | null;
  subscription?: string | StripeSubscription | null;
  metadata?: Record<string, string | undefined> | null;
  error?: {
    message?: string;
  };
};

type StripeSubscription = {
  id?: string;
  status?: string | null;
  current_period_end?: number | null;
  metadata?: Record<string, string | undefined> | null;
};

type StripeCustomer = {
  email?: string | null;
  deleted?: boolean;
  error?: {
    message?: string;
  };
};

function getDashboardUrl(request: Request, role: string, state = "updated") {
  const url = new URL(role === "learner" ? "/learner-dashboard" : "/instructor-dashboard", request.url);
  url.searchParams.set("subscription", state);
  return url;
}

function getPendingDashboardUrl(request: Request, role: string, reason: string) {
  const url = getDashboardUrl(request, role, "pending");
  url.searchParams.set("reason", reason);
  return url;
}

function getUpdatedDashboardUrl(request: Request, role: string, packageId: string) {
  const url = getDashboardUrl(request, role);
  url.searchParams.set("plan", packageId);
  return url;
}

function getSubscriptionReturnUrl(request: Request, target: SubscriptionSyncTarget, returnPath?: string | null) {
  const fallbackPath = getUpdatedDashboardUrl(request, target.role, target.packageId).pathname + getUpdatedDashboardUrl(request, target.role, target.packageId).search;
  const url = new URL(normaliseSubscriptionReturnPath(returnPath, fallbackPath), request.url);
  url.searchParams.set("subscription", "updated");
  url.searchParams.set("plan", target.packageId);
  return url;
}

function redirectWithSubscriptionSession({
  request,
  target,
  userId,
  customerId,
  subscriptionId,
  status,
  periodEnd,
  returnPath
}: {
  request: Request;
  target: SubscriptionSyncTarget;
  userId: string;
  customerId?: string | null;
  subscriptionId?: string | null;
  status?: string | null;
  periodEnd?: string | null;
  returnPath?: string | null;
}) {
  const maxAge = getSubscriptionSessionMaxAge(periodEnd);
  const response = NextResponse.redirect(getSubscriptionReturnUrl(request, target, returnPath));
  const token = createSubscriptionSessionToken(
    {
      userId,
      role: target.role,
      packageId: target.packageId,
      customerId,
      subscriptionId,
      status,
      periodEnd
    },
    maxAge
  );

  if (token) {
    const isSecureRequest = new URL(request.url).protocol === "https:";
    response.cookies.set(subscriptionSessionCookieName, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: isSecureRequest,
      maxAge,
      path: "/"
    });
  }

  return response;
}

function toTimestamp(value?: number | null) {
  return value ? new Date(value * 1000).toISOString() : null;
}

function formatMonthlyPrice(pence: number) {
  return pence > 0 ? `\u00a3${(pence / 100).toFixed(2)} per month` : "Free";
}

function getSubscriptionId(subscription?: string | StripeSubscription | null) {
  return typeof subscription === "string" ? subscription : subscription?.id ?? null;
}

function getSubscriptionStatus(subscription?: string | StripeSubscription | null) {
  return typeof subscription === "string" ? "active" : subscription?.status ?? "active";
}

function getSubscriptionPeriodEnd(subscription?: string | StripeSubscription | null) {
  return typeof subscription === "string" ? null : toTimestamp(subscription?.current_period_end);
}

function isActiveSubscription(status?: string | null) {
  return new Set(["active", "trialing", "past_due"]).has(status ?? "active");
}

function getMetadataTarget(metadata?: Record<string, string | undefined> | null): SubscriptionSyncTarget | null {
  const role = metadata?.lda_account_role;
  const instructorPackageId = metadata?.lda_instructor_package_id;
  const learnerPackageId = metadata?.lda_package_id;

  if (role === "instructor" && (instructorPackageId === "instructor-plus" || instructorPackageId === "instructor-pro")) {
    return { role: "instructor", packageId: instructorPackageId as InstructorPackageId };
  }

  if (role === "learner" && (learnerPackageId === "learner-plus" || learnerPackageId === "learner-pro")) {
    return { role: "learner", packageId: learnerPackageId as LearnerPackageId };
  }

  return null;
}

function getTarget(session: StripeCheckoutSession): SubscriptionSyncTarget | null {
  const subscription = typeof session.subscription === "string" ? null : session.subscription;
  return getMetadataTarget(session.metadata) ?? getMetadataTarget(subscription?.metadata);
}

function getSessionUserId(session: StripeCheckoutSession) {
  const subscription = typeof session.subscription === "string" ? null : session.subscription;
  return session.metadata?.lda_user_id ?? subscription?.metadata?.lda_user_id ?? session.client_reference_id ?? null;
}

function getCheckoutReturnPath(session: StripeCheckoutSession, requestReturnPath?: string | null) {
  const subscription = typeof session.subscription === "string" ? null : session.subscription;
  return session.metadata?.lda_return_path ?? subscription?.metadata?.lda_return_path ?? requestReturnPath ?? null;
}

async function getStripeCheckoutSession(sessionId: string, secretKey: string) {
  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=subscription`, {
    headers: {
      Authorization: `Bearer ${secretKey}`
    }
  });
  const session = (await response.json()) as StripeCheckoutSession;

  if (!response.ok) {
    throw new Error(session.error?.message ?? "Stripe checkout session could not be confirmed.");
  }

  return session;
}

async function getStripeCustomerEmail(customerId: string | null | undefined, secretKey: string) {
  if (!customerId) {
    return null;
  }

  const response = await fetch(`https://api.stripe.com/v1/customers/${encodeURIComponent(customerId)}`, {
    headers: {
      Authorization: `Bearer ${secretKey}`
    }
  });
  const customer = (await response.json()) as StripeCustomer;

  if (!response.ok || customer.deleted) {
    console.error("Stripe customer email lookup failed during checkout completion", customer.error?.message ?? "Customer was not available.");
    return null;
  }

  return customer.email ?? null;
}

function getTargetPackage(target: SubscriptionSyncTarget) {
  return target.role === "instructor"
    ? getInstructorPackage(target.packageId)
    : getLearnerPackage(target.packageId);
}

function getPackageFeaturesUrl(request: Request, target: SubscriptionSyncTarget) {
  const url = new URL(
    target.role === "instructor" ? `/instructor-plus/${target.packageId}` : `/learner-plus/${target.packageId}`,
    request.url,
  );
  return url.toString();
}

async function sendCheckoutCompletionEmail({
  request,
  session,
  target,
  secretKey,
  subscriptionId,
  fallbackEmail
}: {
  request: Request;
  session: StripeCheckoutSession;
  target: SubscriptionSyncTarget;
  secretKey: string;
  subscriptionId?: string | null;
  fallbackEmail?: string | null;
}) {
  const targetPackage = getTargetPackage(target);
  const email =
    session.customer_details?.email ??
    session.customer_email ??
    (await getStripeCustomerEmail(session.customer, secretKey)) ??
    fallbackEmail;

  if (!targetPackage || !email) {
    console.error(`Subscription confirmation email skipped for ${target.packageId}: missing ${!targetPackage ? "package" : "email"}.`);
    return;
  }

  try {
    await sendSubscriptionConfirmationEmail({
      to: email,
      role: target.role,
      packageName: targetPackage.name,
      changeType: "activation",
      billingLabel: "monthly subscription",
      priceLabel: formatMonthlyPrice(targetPackage.monthlyPricePence),
      dashboardUrl: getUpdatedDashboardUrl(request, target.role, target.packageId).toString(),
      packageSummary: targetPackage.summary,
      featuresUrl: getPackageFeaturesUrl(request, target),
      idempotencyKey: `subscription-confirmation-${subscriptionId ?? session.id ?? target.packageId}`
    });
  } catch (emailError) {
    console.error("Checkout completion subscription confirmation email failed", emailError);
  }
}

type SupabaseServerClient = NonNullable<Awaited<ReturnType<typeof createClient>>>;

async function syncSubscriptionWithUserClient({
  supabase,
  target,
  userId,
  customerId,
  subscriptionId,
  status,
  periodEnd
}: {
  supabase: SupabaseServerClient;
  target: SubscriptionSyncTarget;
  userId: string;
  customerId?: string | null;
  subscriptionId?: string | null;
  status?: string | null;
  periodEnd?: string | null;
}) {
  const now = new Date().toISOString();
  const isActive = isActiveSubscription(status);

  if (target.role === "instructor") {
    const values = {
      instructor_package: isActive ? target.packageId : "instructor",
      instructor_subscription_status: status ?? "active",
      instructor_package_started_at: isActive ? now : null,
      instructor_package_expires_at: isActive ? periodEnd ?? null : null,
      instructor_package_source: "stripe",
      stripe_customer_id: customerId ?? null,
      stripe_subscription_id: isActive ? subscriptionId ?? null : null,
      updated_at: now
    };
    const { data, error } = await supabase.from("instructor_profiles").update(values).eq("user_id", userId).select("user_id").maybeSingle();

    if (error) throw error;
    if (data) return;

    const { error: insertError } = await supabase.from("instructor_profiles").insert({ user_id: userId, verification_status: "draft", ...values });
    if (insertError) throw insertError;
    return;
  }

  const values = {
    learner_package: isActive ? target.packageId : "learner",
    learner_subscription_status: status ?? "active",
    learner_package_started_at: isActive ? now : null,
    learner_package_expires_at: isActive ? periodEnd ?? null : null,
    learner_plus_active: isActive && target.packageId !== "learner",
    learner_plus_started_at: isActive && target.packageId !== "learner" ? now : null,
    learner_plus_expires_at: isActive && target.packageId !== "learner" ? periodEnd ?? null : null,
    learner_plus_source: "stripe",
    stripe_customer_id: customerId ?? null,
    stripe_subscription_id: isActive ? subscriptionId ?? null : null,
    updated_at: now
  };
  const { data, error } = await supabase.from("learner_profiles").update(values).eq("user_id", userId).select("user_id").maybeSingle();

  if (error) throw error;
  if (data) return;

  const { error: insertError } = await supabase.from("learner_profiles").insert({ user_id: userId, ...values });
  if (insertError) throw insertError;
}

async function syncVerifiedSubscription({
  supabase,
  target,
  userId,
  customerId,
  subscriptionId,
  status,
  periodEnd
}: {
  supabase: SupabaseServerClient;
  target: SubscriptionSyncTarget;
  userId: string;
  customerId?: string | null;
  subscriptionId?: string | null;
  status?: string | null;
  periodEnd?: string | null;
}) {
  try {
    await syncSubscriptionTarget({
      target,
      userId,
      customerId,
      subscriptionId,
      status,
      periodEnd
    });
  } catch (adminSyncError) {
    console.error("Stripe checkout admin profile sync failed; trying signed-in profile sync", adminSyncError);
    await syncSubscriptionWithUserClient({
      supabase,
      target,
      userId,
      customerId,
      subscriptionId,
      status,
      periodEnd
    });
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id") ?? "";
  const fallbackRole = url.searchParams.get("role") ?? "instructor";
  const requestReturnPath = url.searchParams.get("return_path");
  const stripeSecret = getStripeSecretKey();
  const supabase = await createClient();

  if (!sessionId || !stripeSecret.value || !supabase) {
    return NextResponse.redirect(getPendingDashboardUrl(request, fallbackRole, !sessionId ? "missing-session" : !stripeSecret.value ? "missing-stripe-secret" : "missing-supabase"));
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("role", fallbackRole === "learner" ? "learner" : "instructor");
    return NextResponse.redirect(loginUrl);
  }

  try {
    const session = await getStripeCheckoutSession(sessionId, stripeSecret.value);
    const target = getTarget(session);
    const sessionUserId = getSessionUserId(session);
    const returnPath = getCheckoutReturnPath(session, requestReturnPath);

    if (!target) {
      return NextResponse.redirect(getPendingDashboardUrl(request, fallbackRole, "missing-package-metadata"));
    }

    if (!sessionUserId || sessionUserId !== user.id) {
      return NextResponse.redirect(getPendingDashboardUrl(request, fallbackRole, "account-mismatch"));
    }

    const roleState = await getMarketplaceRoleState(supabase, user.id);
    if (!canUseMarketplaceRole(roleState, target.role)) {
      return NextResponse.redirect(getPendingDashboardUrl(request, roleState.effectiveRole === "learner" ? "learner" : "instructor", "wrong-account-type"));
    }

    const subscriptionId = getSubscriptionId(session.subscription);
    const subscriptionStatus = getSubscriptionStatus(session.subscription);
    const periodEnd = getSubscriptionPeriodEnd(session.subscription);

    if (!isActiveSubscription(subscriptionStatus)) {
      return NextResponse.redirect(getPendingDashboardUrl(request, fallbackRole, "subscription-not-active"));
    }

    try {
      await syncVerifiedSubscription({
        supabase,
        target,
        userId: user.id,
        customerId: session.customer,
        subscriptionId,
        status: subscriptionStatus,
        periodEnd
      });
    } catch (syncError) {
      console.error("Stripe checkout completion profile sync failed; using verified subscription session", syncError);
    }

    await sendCheckoutCompletionEmail({
      request,
      session,
      target,
      secretKey: stripeSecret.value,
      subscriptionId,
      fallbackEmail: user.email
    });

    return redirectWithSubscriptionSession({
      request,
      target,
      userId: user.id,
      customerId: session.customer,
      subscriptionId,
      status: subscriptionStatus,
      periodEnd,
      returnPath
    });
  } catch (error) {
    console.error("Stripe checkout completion sync failed", error);
    return NextResponse.redirect(getPendingDashboardUrl(request, fallbackRole, "sync-failed"));
  }
}
