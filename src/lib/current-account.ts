import { createClient } from "@/lib/supabase/server";
import { type InstructorPackageId } from "@/lib/instructor-packages";
import { type LearnerPackageId } from "@/lib/learner-packages";
import { cookies } from "next/headers";
import { readSubscriptionSessionToken, subscriptionSessionCookieName } from "@/lib/subscription-session-cookie";

export type HeaderAccountSummary = {
  dashboardHref: string;
  name: string;
  role: "instructor" | "learner";
  subscriptionHref: string;
  subscriptionLabel: string;
  upgradeHref?: string;
  upgradeLabel?: string;
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
  let instructorProfile = null;

  try {
    [{ data: profile }, { data: roles }, { data: learnerProfile }, { data: instructorProfile }] = await Promise.all([
      supabase.from("profiles").select("full_name,email").eq("id", user.id).maybeSingle(),
      supabase.from("account_roles").select("role").eq("user_id", user.id),
      supabase
        .from("learner_profiles")
        .select("learner_package,learner_plus_active,learner_plus_expires_at")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("instructor_profiles")
        .select("instructor_package")
        .eq("user_id", user.id)
        .maybeSingle()
    ]);
  } catch {
    return null;
  }

  const roleNames = roles?.map((role) => String(role.role)) ?? [];
  const isInstructor = roleNames.includes("instructor");
  const subscriptionSession = readSubscriptionSessionToken(
    (await cookies()).get(subscriptionSessionCookieName)?.value,
    user.id,
    isInstructor ? "instructor" : "learner"
  );
  const hasLearnerPlus =
    !isInstructor &&
    Boolean(learnerProfile?.learner_plus_active) &&
    (!learnerProfile?.learner_plus_expires_at || new Date(learnerProfile.learner_plus_expires_at).getTime() > Date.now());
  const learnerSessionPackage =
    subscriptionSession?.packageId === "learner-plus" || subscriptionSession?.packageId === "learner-pro"
      ? subscriptionSession.packageId
      : null;
  const instructorSessionPackage =
    subscriptionSession?.packageId === "instructor-plus" || subscriptionSession?.packageId === "instructor-pro"
      ? subscriptionSession.packageId
      : null;
  const learnerPackageId = (learnerSessionPackage || learnerProfile?.learner_package || (hasLearnerPlus ? "learner-plus" : "learner")) as LearnerPackageId;
  const learnerPackageLabel =
    learnerPackageId === "learner-pro"
      ? "Learner Pro"
      : learnerPackageId === "learner-plus" || hasLearnerPlus
        ? "Learner Plus"
        : "Learner";
  const instructorPackageId = (instructorSessionPackage || instructorProfile?.instructor_package || "instructor") as InstructorPackageId;
  const instructorPackageLabel =
    instructorPackageId === "instructor-plus"
      ? "Instructor Plus"
      : instructorPackageId === "instructor-pro"
        ? "Instructor Pro"
        : "Instructor";
  const instructorUpgrade =
    instructorPackageId === "instructor"
      ? { upgradeLabel: "Upgrade to Plus", upgradeHref: "/instructor-plus" }
      : instructorPackageId === "instructor-plus"
        ? { upgradeLabel: "Upgrade to Pro", upgradeHref: "/instructor-plus" }
        : {};

  return {
    dashboardHref: isInstructor ? "/instructor-dashboard" : "/learner-dashboard",
    name: getDisplayName(profile?.full_name, profile?.email ?? user.email),
    role: isInstructor ? "instructor" : "learner",
    subscriptionHref: isInstructor ? "/instructor-dashboard" : "/learner-plus",
    subscriptionLabel: isInstructor ? instructorPackageLabel : learnerPackageLabel,
    ...(isInstructor ? instructorUpgrade : learnerPackageId !== "learner" || hasLearnerPlus ? {} : { upgradeLabel: "Upgrade to Plus", upgradeHref: "/learner-plus" })
  };
}
