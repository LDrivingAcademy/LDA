import { createClient } from "@/lib/supabase/server";
import type { InstructorPackageId } from "@/lib/instructor-packages";
import type { LearnerPackageId } from "@/lib/learner-packages";
import { cookies } from "next/headers";
import { readSubscriptionSessionToken, subscriptionSessionCookieName } from "@/lib/subscription-session-cookie";
import { isDirectorAdminEmail } from "@/lib/admin-access";
import { getEntitledInstructorPackageId, getEntitledLearnerPackageId, hasInactiveSubscriptionStatus, isPaidInstructorPackageId, isPaidLearnerPackageId } from "@/lib/subscription-entitlements";
import { hasSupabaseAuthCookie } from "@/lib/supabase/auth-cookie";

export async function getSignedInInstructorPackageId(): Promise<InstructorPackageId> {
  const cookieStore = await cookies();

  if (!hasSupabaseAuthCookie(cookieStore.getAll())) {
    return "instructor";
  }

  const supabase = await createClient();

  if (!supabase) {
    return "instructor";
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return "instructor";
  }

  const { data } = await supabase
    .from("instructor_profiles")
    .select("instructor_package,instructor_subscription_status,instructor_package_expires_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const packageId = getEntitledInstructorPackageId({
    packageId: data?.instructor_package,
    status: data?.instructor_subscription_status,
    expiresAt: data?.instructor_package_expires_at
  });
  const subscriptionIsInactive = hasInactiveSubscriptionStatus(data?.instructor_subscription_status);

  if (isPaidInstructorPackageId(packageId)) {
    return packageId;
  }

  if (subscriptionIsInactive) {
    return "instructor";
  }

  const subscriptionSession = readSubscriptionSessionToken(
    cookieStore.get(subscriptionSessionCookieName)?.value,
    user.id,
    "instructor"
  );

  return isPaidInstructorPackageId(subscriptionSession?.packageId)
    ? subscriptionSession.packageId
    : "instructor";
}

export async function getSignedInInstructorPackageAccess(): Promise<{
  packageId: InstructorPackageId;
  verificationStatus: string | null;
  isApproved: boolean;
  isApplicationInProgress: boolean;
}> {
  const cookieStore = await cookies();

  if (!hasSupabaseAuthCookie(cookieStore.getAll())) {
    return {
      packageId: "instructor",
      verificationStatus: null,
      isApproved: false,
      isApplicationInProgress: false
    };
  }

  const supabase = await createClient();

  if (!supabase) {
    return {
      packageId: "instructor",
      verificationStatus: null,
      isApproved: false,
      isApplicationInProgress: false
    };
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      packageId: "instructor",
      verificationStatus: null,
      isApproved: false,
      isApplicationInProgress: false
    };
  }

  const { data } = await supabase
    .from("instructor_profiles")
    .select("instructor_package,instructor_subscription_status,instructor_package_expires_at,verification_status")
    .eq("user_id", user.id)
    .maybeSingle();

  const packageId = getEntitledInstructorPackageId({
    packageId: data?.instructor_package,
    status: data?.instructor_subscription_status,
    expiresAt: data?.instructor_package_expires_at
  });
  const verificationStatus = String(data?.verification_status ?? "").trim().toLowerCase();
  const isApproved = verificationStatus === "approved";

  return {
    packageId: packageId ?? "instructor",
    verificationStatus: data?.verification_status ?? null,
    isApproved,
    isApplicationInProgress: Boolean(data) && !isApproved
  };
}

export async function isSignedInAdmin() {
  const cookieStore = await cookies();

  if (!hasSupabaseAuthCookie(cookieStore.getAll())) {
    return false;
  }

  const supabase = await createClient();

  if (!supabase) {
    return false;
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return false;
  }

  if (!isDirectorAdminEmail(user.email)) {
    return false;
  }

  const { data } = await supabase
    .from("account_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();

  return Boolean(data);
}

export async function getSignedInLearnerPackageId(): Promise<LearnerPackageId> {
  const cookieStore = await cookies();

  if (!hasSupabaseAuthCookie(cookieStore.getAll())) {
    return "learner";
  }

  const supabase = await createClient();

  if (!supabase) {
    return "learner";
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return "learner";
  }

  const { data } = await supabase
    .from("learner_profiles")
    .select("learner_package,learner_subscription_status,learner_package_expires_at,learner_plus_active,learner_plus_expires_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const packageId = getEntitledLearnerPackageId({
    packageId: data?.learner_package,
    status: data?.learner_subscription_status,
    expiresAt: data?.learner_package_expires_at
  });
  const subscriptionIsInactive = hasInactiveSubscriptionStatus(data?.learner_subscription_status);
  const hasLegacyLearnerPlus =
    !subscriptionIsInactive &&
    Boolean(data?.learner_plus_active) &&
    (!data?.learner_plus_expires_at || new Date(data.learner_plus_expires_at).getTime() > Date.now());

  if (isPaidLearnerPackageId(packageId)) {
    return packageId;
  }

  if (subscriptionIsInactive) {
    return "learner";
  }

  if (hasLegacyLearnerPlus) {
    return "learner-plus";
  }

  const subscriptionSession = readSubscriptionSessionToken(
    cookieStore.get(subscriptionSessionCookieName)?.value,
    user.id,
    "learner"
  );

  return isPaidLearnerPackageId(subscriptionSession?.packageId)
    ? subscriptionSession.packageId
    : "learner";
}
