import { NextResponse } from "next/server";
import type { InstructorPackageId } from "@/lib/instructor-packages";
import type { LearnerPackageId } from "@/lib/learner-packages";
import { getStripeSecretKey } from "@/lib/stripe-env";
import {
  createSubscriptionSessionToken,
  getSubscriptionSessionMaxAge,
  subscriptionSessionCookieName
} from "@/lib/subscription-session-cookie";
import { syncSubscriptionTarget, type SubscriptionSyncTarget } from "@/lib/subscription-profile-sync";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type StripeCheckoutSession = {
  id?: string;
  client_reference_id?: string | null;
  customer?: string | null;
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

function redirectWithSubscriptionSession({
  request,
  target,
  userId,
  customerId,
  subscriptionId,
  status,
  periodEnd
}: {
  request: Request;
  target: SubscriptionSyncTarget;
  userId: string;
  customerId?: string | null;
  subscriptionId?: string | null;
  status?: string | null;
  periodEnd?: string | null;
}) {
  const maxAge = getSubscriptionSessionMaxAge(periodEnd);
  const response = NextResponse.redirect(getUpdatedDashboardUrl(request, target.role, target.packageId));
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

    if (!target) {
      return NextResponse.redirect(getPendingDashboardUrl(request, fallbackRole, "missing-package-metadata"));
    }

    if (!sessionUserId || sessionUserId !== user.id) {
      return NextResponse.redirect(getPendingDashboardUrl(request, fallbackRole, "account-mismatch"));
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

    return redirectWithSubscriptionSession({
      request,
      target,
      userId: user.id,
      customerId: session.customer,
      subscriptionId,
      status: subscriptionStatus,
      periodEnd
    });
  } catch (error) {
    console.error("Stripe checkout completion sync failed", error);
    return NextResponse.redirect(getPendingDashboardUrl(request, fallbackRole, "sync-failed"));
  }
}
