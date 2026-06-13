import type { InstructorPackageId } from "@/lib/instructor-packages";
import type { LearnerPackageId } from "@/lib/learner-packages";
import { createAdminClient } from "@/lib/supabase/admin";

const activeSubscriptionStatuses = new Set(["active", "trialing", "past_due"]);

export type SubscriptionSyncTarget =
  | {
      role: "instructor";
      packageId: InstructorPackageId;
    }
  | {
      role: "learner";
      packageId: LearnerPackageId;
    };

function isActiveSubscription(status?: string | null) {
  return activeSubscriptionStatuses.has(status ?? "active");
}

export async function syncInstructorPackage({
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
  const isActive = isActiveSubscription(status);
  const nextPackage = isActive ? packageId : "instructor";
  const now = new Date().toISOString();

  if (!supabase) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }

  const values = {
    instructor_package: nextPackage,
    instructor_subscription_status: status ?? "active",
    instructor_package_started_at: isActive ? now : null,
    instructor_package_expires_at: isActive ? periodEnd ?? null : null,
    instructor_package_source: "stripe",
    stripe_customer_id: customerId ?? null,
    stripe_subscription_id: isActive ? subscriptionId ?? null : null,
    updated_at: now
  };

  if (userId) {
    const { data, error } = await supabase.from("instructor_profiles").update(values).eq("user_id", userId).select("user_id").maybeSingle();
    if (error) throw error;
    if (data) return;

    const { error: insertError } = await supabase.from("instructor_profiles").insert({ user_id: userId, ...values });
    if (insertError) throw insertError;
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

export async function syncLearnerPackage({
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
  const isActive = isActiveSubscription(status);
  const nextPackage = isActive ? packageId : "learner";
  const now = new Date().toISOString();

  if (!supabase) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }

  const values = {
    learner_package: nextPackage,
    learner_subscription_status: status ?? "active",
    learner_package_started_at: isActive ? now : null,
    learner_package_expires_at: isActive ? periodEnd ?? null : null,
    learner_plus_active: isActive && nextPackage !== "learner",
    learner_plus_started_at: isActive && nextPackage !== "learner" ? now : null,
    learner_plus_expires_at: isActive && nextPackage !== "learner" ? periodEnd ?? null : null,
    learner_plus_source: "stripe",
    stripe_customer_id: customerId ?? null,
    stripe_subscription_id: isActive ? subscriptionId ?? null : null,
    updated_at: now
  };

  if (userId) {
    const { data, error } = await supabase.from("learner_profiles").update(values).eq("user_id", userId).select("user_id").maybeSingle();
    if (error) throw error;
    if (data) return;

    const { error: insertError } = await supabase.from("learner_profiles").insert({ user_id: userId, ...values });
    if (insertError) throw insertError;
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

export async function syncSubscriptionTarget({
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
