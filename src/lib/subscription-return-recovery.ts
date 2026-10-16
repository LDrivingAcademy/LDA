import type { InstructorPackageId } from "@/lib/instructor-packages";
import type { LearnerPackageId } from "@/lib/learner-packages";
import { getStripePriceId } from "@/lib/stripe-env";
import { createClient } from "@/lib/supabase/server";
import { syncSubscriptionTarget, type SubscriptionSyncTarget } from "@/lib/subscription-profile-sync";

type SupabaseServerClient = NonNullable<Awaited<ReturnType<typeof createClient>>>;

type StripeListResponse<T> = {
  data?: T[];
  error?: {
    message?: string;
  };
};

type StripeCustomer = {
  id?: string;
};

type StripeSubscription = {
  id?: string;
  customer?: string | { id?: string } | null;
  status?: string | null;
  current_period_end?: number | null;
  created?: number | null;
  metadata?: Record<string, string | undefined> | null;
  items?: {
    data?: Array<{
      price?: {
        id?: string | null;
      } | null;
    }>;
  };
};

export type SubscriptionRecoveryResult = {
  target: SubscriptionSyncTarget;
  customerId?: string | null;
  subscriptionId?: string | null;
  status?: string | null;
  periodEnd?: string | null;
};

const activeSubscriptionStatuses = new Set(["active", "trialing", "past_due"]);

function toTimestamp(value?: number | null) {
  return value ? new Date(value * 1000).toISOString() : null;
}

function isActiveSubscription(status?: string | null) {
  return activeSubscriptionStatuses.has(status ?? "active");
}

function getCustomerId(customer?: string | { id?: string } | null) {
  return typeof customer === "string" ? customer : customer?.id ?? null;
}

function getTargetFromMetadata(metadata?: Record<string, string | undefined> | null): SubscriptionSyncTarget | null {
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

function getTargetFromPrice(priceId?: string | null): SubscriptionSyncTarget | null {
  if (!priceId) return null;

  const mappings: Array<{ envName: string; role: SubscriptionSyncTarget["role"]; packageId: string }> = [
    { envName: "STRIPE_INSTRUCTOR_PLUS_MONTHLY_PRICE_ID", role: "instructor", packageId: "instructor-plus" },
    { envName: "STRIPE_INSTRUCTOR_PLUS_YEARLY_PRICE_ID", role: "instructor", packageId: "instructor-plus" },
    { envName: "STRIPE_INSTRUCTOR_PRO_MONTHLY_PRICE_ID", role: "instructor", packageId: "instructor-pro" },
    { envName: "STRIPE_INSTRUCTOR_PRO_YEARLY_PRICE_ID", role: "instructor", packageId: "instructor-pro" },
    { envName: "STRIPE_LEARNER_PLUS_MONTHLY_PRICE_ID", role: "learner", packageId: "learner-plus" },
    { envName: "STRIPE_LEARNER_PLUS_YEARLY_PRICE_ID", role: "learner", packageId: "learner-plus" },
    { envName: "STRIPE_LEARNER_PRO_MONTHLY_PRICE_ID", role: "learner", packageId: "learner-pro" },
    { envName: "STRIPE_LEARNER_PRO_YEARLY_PRICE_ID", role: "learner", packageId: "learner-pro" }
  ];

  for (const mapping of mappings) {
    if (getStripePriceId(mapping.envName)?.value === priceId) {
      return mapping.role === "instructor"
        ? { role: "instructor", packageId: mapping.packageId as InstructorPackageId }
        : { role: "learner", packageId: mapping.packageId as LearnerPackageId };
    }
  }

  return null;
}

function getSubscriptionTarget(subscription: StripeSubscription) {
  return getTargetFromMetadata(subscription.metadata) ?? getTargetFromPrice(subscription.items?.data?.[0]?.price?.id);
}

async function stripeGet<T>(secretKey: string, path: string, params: Record<string, string>) {
  const url = new URL(`https://api.stripe.com/v1/${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.append(key, value));

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${secretKey}`
    }
  });
  const data = (await response.json()) as T & { error?: { message?: string } };

  if (!response.ok) {
    throw new Error(data.error?.message ?? "Stripe subscription recovery failed.");
  }

  return data;
}

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

export async function recoverLatestStripeSubscriptionForSignedInAccount({
  supabase,
  userId,
  email,
  role,
  secretKey
}: {
  supabase: SupabaseServerClient;
  userId: string;
  email?: string | null;
  role: "instructor" | "learner";
  secretKey?: string;
}) {
  if (!email || !secretKey) {
    return null;
  }

  const escapedEmail = email.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const customers = await stripeGet<StripeListResponse<StripeCustomer>>(secretKey, "customers/search", {
    query: `email:'${escapedEmail}'`,
    limit: "5"
  });
  const subscriptions: StripeSubscription[] = [];

  for (const customer of customers.data ?? []) {
    if (!customer.id) continue;

    const result = await stripeGet<StripeListResponse<StripeSubscription>>(secretKey, "subscriptions", {
      customer: customer.id,
      status: "all",
      limit: "10",
      "expand[]": "data.items.data.price"
    });
    subscriptions.push(...(result.data ?? []));
  }

  subscriptions.sort((left, right) => (right.created ?? 0) - (left.created ?? 0));

  for (const subscription of subscriptions) {
    const target = getSubscriptionTarget(subscription);
    const metadataUserId = subscription.metadata?.lda_user_id;

    if (!target || target.role !== role || !isActiveSubscription(subscription.status)) continue;
    if (metadataUserId && metadataUserId !== userId) continue;

    const customerId = getCustomerId(subscription.customer);
    const periodEnd = toTimestamp(subscription.current_period_end);

    try {
      try {
        await syncSubscriptionTarget({
          target,
          userId,
          customerId,
          subscriptionId: subscription.id,
          status: subscription.status,
          periodEnd
        });
      } catch (adminSyncError) {
        console.error("Stripe dashboard recovery admin sync failed; trying signed-in profile sync", adminSyncError);
        await syncSubscriptionWithUserClient({
          supabase,
          target,
          userId,
          customerId,
          subscriptionId: subscription.id,
          status: subscription.status,
          periodEnd
        });
      }
    } catch (syncError) {
      console.error("Stripe dashboard recovery profile sync failed; using verified subscription session", syncError);
    }

    return {
      target,
      customerId,
      subscriptionId: subscription.id,
      status: subscription.status,
      periodEnd
    };
  }

  return null;
}
