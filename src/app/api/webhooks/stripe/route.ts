import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { getStripeEnvValue, getStripePriceId } from "@/lib/stripe-env";
import { createAdminClient } from "@/lib/supabase/admin";
import type { InstructorPackageId } from "@/lib/instructor-packages";
import type { LearnerPackageId } from "@/lib/learner-packages";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type StripeEvent = {
  id: string;
  type: string;
  data: {
    object: StripeCheckoutSession | StripeSubscription;
  };
};

type StripeCheckoutSession = {
  id: string;
  object: "checkout.session";
  client_reference_id?: string | null;
  customer?: string | null;
  subscription?: string | null;
  metadata?: Record<string, string | undefined> | null;
};

type StripeSubscription = {
  id: string;
  object: "subscription";
  customer?: string | null;
  status?: string | null;
  current_period_end?: number | null;
  metadata?: Record<string, string | undefined> | null;
  items?: {
    data?: Array<{
      price?: {
        id?: string | null;
      } | null;
    }>;
  };
};

type SubscriptionSyncTarget =
  | {
      role: "instructor";
      packageId: InstructorPackageId;
    }
  | {
      role: "learner";
      packageId: LearnerPackageId;
    };

const activeSubscriptionStatuses = new Set(["active", "trialing", "past_due"]);

function parseStripeSignature(header: string | null) {
  if (!header) {
    return null;
  }

  const parts = header.split(",").map((part) => part.trim());
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2);
  const signatures = parts.filter((part) => part.startsWith("v1=")).map((part) => part.slice(3));

  return timestamp && signatures.length ? { timestamp, signatures } : null;
}

function secureCompare(left: string, right: string) {
  if (!/^[a-f0-9]+$/i.test(left) || !/^[a-f0-9]+$/i.test(right)) {
    return false;
  }

  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function verifyStripeWebhook(payload: string, signatureHeader: string | null, secret: string) {
  const parsedSignature = parseStripeSignature(signatureHeader);

  if (!parsedSignature) {
    return false;
  }

  const timestampSeconds = Number(parsedSignature.timestamp);
  const ageSeconds = Math.abs(Date.now() / 1000 - timestampSeconds);

  if (!Number.isFinite(timestampSeconds) || ageSeconds > 300) {
    return false;
  }

  const expected = createHmac("sha256", secret).update(`${parsedSignature.timestamp}.${payload}`).digest("hex");
  return parsedSignature.signatures.some((signature) => secureCompare(signature, expected));
}

function toTimestamp(value?: number | null) {
  return value ? new Date(value * 1000).toISOString() : null;
}

function getPricePackage(priceId?: string | null): SubscriptionSyncTarget | null {
  if (!priceId) {
    return null;
  }

  const priceMappings: Array<{ envName: string; role: SubscriptionSyncTarget["role"]; packageId: string }> = [
    { envName: "STRIPE_INSTRUCTOR_PLUS_MONTHLY_PRICE_ID", role: "instructor", packageId: "instructor-plus" },
    { envName: "STRIPE_INSTRUCTOR_PLUS_YEARLY_PRICE_ID", role: "instructor", packageId: "instructor-plus" },
    { envName: "STRIPE_INSTRUCTOR_PRO_MONTHLY_PRICE_ID", role: "instructor", packageId: "instructor-pro" },
    { envName: "STRIPE_INSTRUCTOR_PRO_YEARLY_PRICE_ID", role: "instructor", packageId: "instructor-pro" },
    { envName: "STRIPE_LEARNER_PLUS_MONTHLY_PRICE_ID", role: "learner", packageId: "learner-plus" },
    { envName: "STRIPE_LEARNER_PLUS_YEARLY_PRICE_ID", role: "learner", packageId: "learner-plus" },
    { envName: "STRIPE_LEARNER_PRO_MONTHLY_PRICE_ID", role: "learner", packageId: "learner-pro" },
    { envName: "STRIPE_LEARNER_PRO_YEARLY_PRICE_ID", role: "learner", packageId: "learner-pro" }
  ];

  for (const mapping of priceMappings) {
    if (getStripePriceId(mapping.envName)?.value === priceId) {
      return mapping.role === "instructor"
        ? { role: "instructor", packageId: mapping.packageId as InstructorPackageId }
        : { role: "learner", packageId: mapping.packageId as LearnerPackageId };
    }
  }

  return null;
}

function getSessionTarget(session: StripeCheckoutSession): SubscriptionSyncTarget | null {
  const role = session.metadata?.lda_account_role;
  const instructorPackageId = session.metadata?.lda_instructor_package_id;
  const learnerPackageId = session.metadata?.lda_package_id;

  if (role === "instructor" && (instructorPackageId === "instructor-plus" || instructorPackageId === "instructor-pro")) {
    return { role, packageId: instructorPackageId };
  }

  if (role === "learner" && (learnerPackageId === "learner-plus" || learnerPackageId === "learner-pro")) {
    return { role, packageId: learnerPackageId };
  }

  return null;
}

function getSubscriptionTarget(subscription: StripeSubscription): SubscriptionSyncTarget | null {
  const role = subscription.metadata?.lda_account_role;
  const instructorPackageId = subscription.metadata?.lda_instructor_package_id;
  const learnerPackageId = subscription.metadata?.lda_package_id;

  if (role === "instructor" && (instructorPackageId === "instructor-plus" || instructorPackageId === "instructor-pro")) {
    return { role, packageId: instructorPackageId };
  }

  if (role === "learner" && (learnerPackageId === "learner-plus" || learnerPackageId === "learner-pro")) {
    return { role, packageId: learnerPackageId };
  }

  return getPricePackage(subscription.items?.data?.[0]?.price?.id);
}

async function syncInstructorPackage({
  userId,
  customerId,
  subscriptionId,
  packageId,
  status,
  periodEnd
}: {
  userId?: string | null;
  customerId?: string | null;
  subscriptionId?: string | null;
  packageId: InstructorPackageId;
  status?: string | null;
  periodEnd?: string | null;
}) {
  const supabase = createAdminClient();
  const isActive = activeSubscriptionStatuses.has(status ?? "active");
  const nextPackage = isActive ? packageId : "instructor";

  if (!supabase) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }

  const values = {
    instructor_package: nextPackage,
    instructor_subscription_status: status ?? "active",
    instructor_package_started_at: isActive ? new Date().toISOString() : null,
    instructor_package_expires_at: isActive ? periodEnd ?? null : null,
    instructor_package_source: "stripe",
    stripe_customer_id: customerId ?? null,
    stripe_subscription_id: isActive ? subscriptionId ?? null : null,
    updated_at: new Date().toISOString()
  };

  if (userId) {
    const { error } = await supabase.from("instructor_profiles").upsert({ user_id: userId, ...values }, { onConflict: "user_id" });
    if (error) throw error;
    return;
  }

  let query = supabase.from("instructor_profiles").update(values);

  if (subscriptionId) {
    query = query.eq("stripe_subscription_id", subscriptionId);
  } else if (customerId) {
    query = query.eq("stripe_customer_id", customerId);
  } else {
    throw new Error("Stripe instructor subscription event had no LDA user, customer, or subscription id.");
  }

  const { error } = await query;
  if (error) throw error;
}

async function syncLearnerPackage({
  userId,
  customerId,
  subscriptionId,
  packageId,
  status,
  periodEnd
}: {
  userId?: string | null;
  customerId?: string | null;
  subscriptionId?: string | null;
  packageId: LearnerPackageId;
  status?: string | null;
  periodEnd?: string | null;
}) {
  const supabase = createAdminClient();
  const isActive = activeSubscriptionStatuses.has(status ?? "active");
  const nextPackage = isActive ? packageId : "learner";

  if (!supabase) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }

  const values = {
    learner_package: nextPackage,
    learner_subscription_status: status ?? "active",
    learner_package_started_at: isActive ? new Date().toISOString() : null,
    learner_package_expires_at: isActive ? periodEnd ?? null : null,
    learner_plus_active: isActive && nextPackage !== "learner",
    learner_plus_started_at: isActive && nextPackage !== "learner" ? new Date().toISOString() : null,
    learner_plus_expires_at: isActive && nextPackage !== "learner" ? periodEnd ?? null : null,
    learner_plus_source: "stripe",
    stripe_customer_id: customerId ?? null,
    stripe_subscription_id: isActive ? subscriptionId ?? null : null,
    updated_at: new Date().toISOString()
  };

  if (userId) {
    const { error } = await supabase.from("learner_profiles").upsert({ user_id: userId, ...values }, { onConflict: "user_id" });
    if (error) throw error;
    return;
  }

  let query = supabase.from("learner_profiles").update(values);

  if (subscriptionId) {
    query = query.eq("stripe_subscription_id", subscriptionId);
  } else if (customerId) {
    query = query.eq("stripe_customer_id", customerId);
  } else {
    throw new Error("Stripe learner subscription event had no LDA user, customer, or subscription id.");
  }

  const { error } = await query;
  if (error) throw error;
}

async function syncTarget({
  target,
  userId,
  customerId,
  subscriptionId,
  status,
  periodEnd
}: {
  target: SubscriptionSyncTarget;
  userId?: string | null;
  customerId?: string | null;
  subscriptionId?: string | null;
  status?: string | null;
  periodEnd?: string | null;
}) {
  if (target.role === "instructor") {
    await syncInstructorPackage({ userId, customerId, subscriptionId, packageId: target.packageId, status, periodEnd });
    return;
  }

  await syncLearnerPackage({ userId, customerId, subscriptionId, packageId: target.packageId, status, periodEnd });
}

export async function POST(request: Request) {
  const webhookSecret = getStripeEnvValue("STRIPE_WEBHOOK_SECRET");
  const payload = await request.text();

  if (!webhookSecret.value) {
    return NextResponse.json({ error: `Add ${webhookSecret.envName} in Vercel to enable Stripe webhooks.` }, { status: 500 });
  }

  if (!verifyStripeWebhook(payload, request.headers.get("stripe-signature"), webhookSecret.value)) {
    return NextResponse.json({ error: "Invalid Stripe webhook signature." }, { status: 400 });
  }

  const event = JSON.parse(payload) as StripeEvent;

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as StripeCheckoutSession;
      const target = getSessionTarget(session);

      if (target) {
        await syncTarget({
          target,
          userId: session.metadata?.lda_user_id ?? session.client_reference_id,
          customerId: session.customer,
          subscriptionId: session.subscription,
          status: "active"
        });
      }
    }

    if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as StripeSubscription;
      const target = getSubscriptionTarget(subscription);

      if (target) {
        await syncTarget({
          target,
          userId: subscription.metadata?.lda_user_id,
          customerId: subscription.customer,
          subscriptionId: subscription.id,
          status: event.type === "customer.subscription.deleted" ? "canceled" : subscription.status ?? "active",
          periodEnd: toTimestamp(subscription.current_period_end)
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe subscription sync failed", error);
    return NextResponse.json({ error: "Stripe subscription sync failed." }, { status: 500 });
  }
}
