import { redirect } from "next/navigation";
import { isDirectorAdminEmail } from "@/lib/admin-access";

type SupabaseRoleClient = {
  from: (table: string) => any;
};

export type MarketplaceRole = "learner" | "instructor";

type AccountRoleRow = {
  role?: string | null;
};

type ProfileEmailRow = {
  email?: string | null;
};

export type MarketplaceRoleState = {
  isAdmin: boolean;
  isSupport: boolean;
  isLearner: boolean;
  isInstructor: boolean;
  isApprovedInstructor: boolean;
  verificationStatus: string | null;
  effectiveRole: MarketplaceRole | "admin" | "support" | null;
};

export async function getMarketplaceRoleState(client: SupabaseRoleClient, userId: string): Promise<MarketplaceRoleState> {
  const [{ data: roles }, { data: instructorProfile }, { data: profile }] = await Promise.all([
    client.from("account_roles").select("role").eq("user_id", userId),
    client.from("instructor_profiles").select("verification_status").eq("user_id", userId).maybeSingle(),
    client.from("profiles").select("email").eq("id", userId).maybeSingle()
  ]);
  const roleNames = ((roles ?? []) as AccountRoleRow[]).map((accountRole) => String(accountRole.role));
  const profileEmail = (profile as ProfileEmailRow | null)?.email ?? null;
  const isAdmin = roleNames.includes("admin") && isDirectorAdminEmail(profileEmail);
  const isSupport = roleNames.includes("support");
  const isInstructor = roleNames.includes("instructor");
  const isLearner = roleNames.includes("learner");
  const verificationStatus = instructorProfile?.verification_status ? String(instructorProfile.verification_status) : null;
  const isApprovedInstructor = isAdmin || (isInstructor && verificationStatus === "approved");
  const effectiveRole = isAdmin ? "admin" : isSupport ? "support" : isInstructor ? "instructor" : isLearner ? "learner" : null;

  return {
    isAdmin,
    isSupport,
    isLearner,
    isInstructor,
    isApprovedInstructor,
    verificationStatus,
    effectiveRole
  };
}

export function canUseMarketplaceRole(state: MarketplaceRoleState, expectedRole: MarketplaceRole) {
  if (state.isAdmin) {
    return true;
  }

  if (expectedRole === "learner") {
    return state.effectiveRole === "learner";
  }

  return state.effectiveRole === "instructor" && state.isApprovedInstructor;
}

export async function redirectIfWrongMarketplaceRole(
  client: SupabaseRoleClient,
  userId: string,
  expectedRole: MarketplaceRole
) {
  const roleState = await getMarketplaceRoleState(client, userId);

  if (canUseMarketplaceRole(roleState, expectedRole)) {
    return;
  }

  if (roleState.effectiveRole === "instructor") {
    redirect(roleState.isApprovedInstructor ? "/instructor-dashboard" : "/instructor-verification?from=dashboard");
  }

  if (roleState.effectiveRole === "support") {
    redirect("/technical-support");
  }

  redirect("/learner-dashboard");
}
