import type { InstructorPackageId } from "@/lib/instructor-packages";
import type { LearnerPackageId } from "@/lib/learner-packages";
import { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = NonNullable<Awaited<ReturnType<typeof createClient>>>;

const activeSubscriptionStatuses = new Set(["active", "trialing", "past_due"]);

function isActiveSubscription(status?: string | null) {
  return activeSubscriptionStatuses.has(status ?? "active");
}

export async function syncInstructorPackageWithUserClient({
  supabase,
  userId,
  customerId,
  subscriptionId,
  packageId,
  status,
  periodEnd
}: {
  supabase: SupabaseServerClient;
  userId: string;
  customerId?: string | null;
  subscriptionId?: string | null;
  packageId: InstructorPackageId;
  status?: string | null;
  periodEnd?: string | null;
}) {
  const isActive = isActiveSubscription(status);
  const nextPackage = isActive ? packageId : "instructor";
  const now = new Date().toISOString();
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

  const { data, error } = await supabase.from("instructor_profiles").update(values).eq("user_id", userId).select("user_id").maybeSingle();
  if (error) throw error;
  if (data) return;

  const { error: insertError } = await supabase.from("instructor_profiles").insert({ user_id: userId, verification_status: "draft", ...values });
  if (insertError) throw insertError;
}

export async function syncLearnerPackageWithUserClient({
  supabase,
  userId,
  customerId,
  subscriptionId,
  packageId,
  status,
  periodEnd
}: {
  supabase: SupabaseServerClient;
  userId: string;
  customerId?: string | null;
  subscriptionId?: string | null;
  packageId: LearnerPackageId;
  status?: string | null;
  periodEnd?: string | null;
}) {
  const isActive = isActiveSubscription(status);
  const nextPackage = isActive ? packageId : "learner";
  const now = new Date().toISOString();
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

  const { data, error } = await supabase.from("learner_profiles").update(values).eq("user_id", userId).select("user_id").maybeSingle();
  if (error) throw error;
  if (data) return;

  const { error: insertError } = await supabase.from("learner_profiles").insert({ user_id: userId, ...values });
  if (insertError) throw insertError;
}
