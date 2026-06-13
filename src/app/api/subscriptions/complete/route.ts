import { NextResponse } from "next/server";
import type { InstructorPackageId } from "@/lib/instructor-packages";
import type { LearnerPackageId } from "@/lib/learner-packages";
import { getStripeSecretKey } from "@/lib/stripe-env";
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

function getUpdatedDashboardUrl(request: Request, role: string, packageId: string) {
  const url = getDashboardUrl(request, role);
  url.searchParams.set("plan", packageId);
  return url;
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

function getTarget(session: StripeCheckoutSession): SubscriptionSyncTarget | null {
  const role = session.metadata?.lda_account_role;
  const instructorPackageId = session.metadata?.lda_instructor_package_id;
  const learnerPackageId = session.metadata?.lda_package_id;

  if (role === "instructor" && (instructorPackageId === "instructor-plus" || instructorPackageId === "instructor-pro")) {
    return { role: "instructor", packageId: instructorPackageId as InstructorPackageId };
  }

  if (role === "learner" && (learnerPackageId === "learner-plus" || learnerPackageId === "learner-pro")) {
    return { role: "learner", packageId: learnerPackageId as LearnerPackageId };
  }

  return null;
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

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id") ?? "";
  const fallbackRole = url.searchParams.get("role") ?? "instructor";
  const stripeSecret = getStripeSecretKey();
  const supabase = await createClient();

  if (!sessionId || !stripeSecret.value || !supabase) {
    return NextResponse.redirect(getDashboardUrl(request, fallbackRole, "pending"));
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
    const sessionUserId = session.metadata?.lda_user_id ?? session.client_reference_id;

    if (!target || sessionUserId !== user.id) {
      return NextResponse.redirect(getDashboardUrl(request, fallbackRole, "pending"));
    }

    const subscriptionId = getSubscriptionId(session.subscription);
    const subscriptionStatus = getSubscriptionStatus(session.subscription);
    const periodEnd = getSubscriptionPeriodEnd(session.subscription);

    await syncSubscriptionTarget({
      target,
      userId: user.id,
      customerId: session.customer,
      subscriptionId,
      status: subscriptionStatus,
      periodEnd
    });

    return NextResponse.redirect(getUpdatedDashboardUrl(request, target.role, target.packageId));
  } catch (error) {
    console.error("Stripe checkout completion sync failed", error);
    return NextResponse.redirect(getDashboardUrl(request, fallbackRole, "pending"));
  }
}
