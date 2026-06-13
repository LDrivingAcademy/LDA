import { NextResponse } from "next/server";
import type { InstructorPackageId } from "@/lib/instructor-packages";
import type { LearnerPackageId } from "@/lib/learner-packages";
import { getStripeSecretKey } from "@/lib/stripe-env";
import { createAdminClient } from "@/lib/supabase/admin";
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

function getTarget(session: StripeCheckoutSession) {
  const role = session.metadata?.lda_account_role;
  const instructorPackageId = session.metadata?.lda_instructor_package_id;
  const learnerPackageId = session.metadata?.lda_package_id;

  if (role === "instructor" && (instructorPackageId === "instructor-plus" || instructorPackageId === "instructor-pro")) {
    return { role, packageId: instructorPackageId as InstructorPackageId };
  }

  if (role === "learner" && (learnerPackageId === "learner-plus" || learnerPackageId === "learner-pro")) {
    return { role, packageId: learnerPackageId as LearnerPackageId };
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

    const admin = createAdminClient();

    if (!admin) {
      return NextResponse.redirect(getDashboardUrl(request, target.role, "pending"));
    }

    const subscriptionId = getSubscriptionId(session.subscription);
    const subscriptionStatus = getSubscriptionStatus(session.subscription);
    const periodEnd = getSubscriptionPeriodEnd(session.subscription);
    const now = new Date().toISOString();

    if (target.role === "instructor") {
      const { error } = await admin
        .from("instructor_profiles")
        .upsert(
          {
            user_id: user.id,
            instructor_package: target.packageId,
            instructor_subscription_status: subscriptionStatus,
            instructor_package_started_at: now,
            instructor_package_expires_at: periodEnd,
            instructor_package_source: "stripe",
            stripe_customer_id: session.customer ?? null,
            stripe_subscription_id: subscriptionId,
            updated_at: now
          },
          { onConflict: "user_id" }
        );

      if (error) {
        throw error;
      }
    } else {
      const { error } = await admin
        .from("learner_profiles")
        .upsert(
          {
            user_id: user.id,
            learner_package: target.packageId,
            learner_subscription_status: subscriptionStatus,
            learner_package_started_at: now,
            learner_package_expires_at: periodEnd,
            learner_plus_active: true,
            learner_plus_started_at: now,
            learner_plus_expires_at: periodEnd,
            learner_plus_source: "stripe",
            stripe_customer_id: session.customer ?? null,
            stripe_subscription_id: subscriptionId,
            updated_at: now
          },
          { onConflict: "user_id" }
        );

      if (error) {
        throw error;
      }
    }

    return NextResponse.redirect(getDashboardUrl(request, target.role));
  } catch (error) {
    console.error("Stripe checkout completion sync failed", error);
    return NextResponse.redirect(getDashboardUrl(request, fallbackRole, "pending"));
  }
}
