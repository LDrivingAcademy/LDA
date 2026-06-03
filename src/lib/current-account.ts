import { createClient } from "@/lib/supabase/server";

export type HeaderAccountSummary = {
  dashboardHref: string;
  name: string;
  subscriptionHref: string;
  subscriptionLabel: string;
};

function getDisplayName(fullName: string | null | undefined, email: string | null | undefined) {
  const trimmedName = fullName?.trim();

  if (trimmedName) {
    return trimmedName;
  }

  return email?.split("@")[0] || "Account";
}

export async function getHeaderAccountSummary(): Promise<HeaderAccountSummary | null> {
  const supabase = await createClient();

  if (!supabase) {
    return null;
  }

  let user = null;

  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    return null;
  }

  if (!user) {
    return null;
  }

  let profile = null;
  let roles = null;
  let learnerProfile = null;

  try {
    [{ data: profile }, { data: roles }, { data: learnerProfile }] = await Promise.all([
      supabase.from("profiles").select("full_name,email").eq("id", user.id).maybeSingle(),
      supabase.from("account_roles").select("role").eq("user_id", user.id),
      supabase
        .from("learner_profiles")
        .select("learner_plus_active,learner_plus_expires_at")
        .eq("user_id", user.id)
        .maybeSingle()
    ]);
  } catch {
    return null;
  }

  const roleNames = roles?.map((role) => String(role.role)) ?? [];
  const isInstructor = roleNames.includes("instructor");
  const hasLearnerPlus =
    !isInstructor &&
    Boolean(learnerProfile?.learner_plus_active) &&
    (!learnerProfile?.learner_plus_expires_at || new Date(learnerProfile.learner_plus_expires_at).getTime() > Date.now());

  return {
    dashboardHref: isInstructor ? "/instructor-dashboard" : "/learner-dashboard",
    name: getDisplayName(profile?.full_name, profile?.email ?? user.email),
    subscriptionHref: isInstructor ? "/instructor-dashboard" : "/learner-plus",
    subscriptionLabel: isInstructor ? "Instructor" : hasLearnerPlus ? "Learner Plus" : "Learner"
  };
}
