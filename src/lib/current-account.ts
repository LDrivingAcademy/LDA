import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { type InstructorPackageId } from "@/lib/instructor-packages";
import { type LearnerPackageId } from "@/lib/learner-packages";
import { cookies } from "next/headers";
import { readSubscriptionSessionToken, subscriptionSessionCookieName } from "@/lib/subscription-session-cookie";
import { hasSupabaseAuthCookie } from "@/lib/supabase/auth-cookie";
import { isDirectorAdminEmail, isMarketplaceTestInstructorEmail } from "@/lib/admin-access";
import {
  getEntitledInstructorPackageId,
  getEntitledLearnerPackageId,
  hasActiveSubscriptionEntitlement,
  hasInactiveSubscriptionStatus,
  isPaidInstructorPackageId,
  isPaidLearnerPackageId
} from "@/lib/subscription-entitlements";
import { hasAcceptedCurrentTerms } from "@/lib/terms-version";

export type HeaderAccountSummary = {
  dashboardHref: string;
  email: string;
  homeSuggestionCards?: Array<{
    title: string;
    body: string;
    href: string;
    image: "car" | "calendar" | "match" | "instructor" | "tracking" | "support" | "social";
    cta: string;
    disabled?: boolean;
    note?: string;
  }>;
  marketingOptIn: boolean;
  name: string;
  privilegedMenuLinks?: Array<{ href: string; label: string }>;
  role: "instructor" | "learner" | "admin" | "support";
  subscriptionHref: string;
  subscriptionLabel: string;
  upgradeHref?: string;
  upgradeLabel?: string;
  needsTermsAcceptance?: boolean;
};

function getDisplayName(fullName: string | null | undefined, email: string | null | undefined) {
  const trimmedName = fullName?.trim();

  if (trimmedName) {
    return trimmedName;
  }

  return email?.split("@")[0] || "Account";
}

export async function getHeaderAccountSummary(): Promise<HeaderAccountSummary | null> {
  const cookieStore = await cookies();

  if (!hasSupabaseAuthCookie(cookieStore.getAll())) {
    return null;
  }

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
  const readClient = createAdminClient() ?? supabase;

  try {
    [{ data: profile }, { data: roles }, { data: learnerProfile }, { data: instructorProfile }] = await Promise.all([
      readClient.from("profiles").select("full_name,email,marketing_opt_in,terms_version_accepted").eq("id", user.id).maybeSingle(),
      readClient.from("account_roles").select("role").eq("user_id", user.id),
      readClient
        .from("learner_profiles")
        .select("learner_package,learner_subscription_status,learner_package_expires_at,learner_plus_active,learner_plus_expires_at")
        .eq("user_id", user.id)
        .maybeSingle(),
      readClient
        .from("instructor_profiles")
        .select("instructor_package,instructor_subscription_status,instructor_package_expires_at,verification_status")
        .eq("user_id", user.id)
        .maybeSingle()
    ]);
  } catch {
    return null;
  }

  const roleNames = roles?.map((role) => String(role.role)) ?? [];
  const isAdmin = roleNames.includes("admin") && isDirectorAdminEmail(user.email);
  const isInstructor = roleNames.includes("instructor");
  const isSupport = roleNames.includes("support");
  const needsTermsAcceptance = !isAdmin && !hasAcceptedCurrentTerms(profile);
  const accountEmail = profile?.email ?? user.email ?? "";

  if (isAdmin) {
    return {
      dashboardHref: "/admin",
      email: accountEmail,
      homeSuggestionCards: [
        {
          title: "Find instructors",
          body: "Preview the learner instructor-search experience from the protected admin preview controls.",
          href: "/dashboard?adminPreview=learner",
          image: "car",
          cta: "Preview learner"
        },
        {
          title: "Schedule lessons",
          body: "Preview learner scheduled lessons, future booking dates, pickup details, booking records, and dashboard scheduling controls.",
          href: "/planned-lessons?from=home",
          image: "calendar",
          cta: "Preview lessons"
        },
        {
          title: "Smart Match",
          body: "Run SmartMatch as an admin preview without changing account type.",
          href: "/smart-match?from=admin",
          image: "match",
          cta: "Open SmartMatch"
        },
        {
          title: "Become an instructor",
          body: "Preview instructor onboarding, verification, availability, finance, and learner route tools.",
          href: "/dashboard?adminPreview=instructor",
          image: "instructor",
          cta: "Preview instructor"
        },
        {
          title: "Live tracking",
          body: "Preview learner tracking or instructor pickup routing from the admin preview dashboard.",
          href: "/dashboard?adminPreview=instructor#instructor-live-tracking",
          image: "tracking",
          cta: "Preview tracking"
        },
        {
          title: "Subscribe & socials",
          body: "Open the public social and subscription page exactly as users see it.",
          href: "/social",
          image: "social",
          cta: "View social"
        }
      ],
      marketingOptIn: Boolean(profile?.marketing_opt_in),
      name: getDisplayName(profile?.full_name, profile?.email ?? user.email),
      privilegedMenuLinks: [
        { href: "/admin-preview", label: "Preview learner/instructor" },
        { href: "/admin", label: "Admin dashboard" },
        { href: "/owner-dashboard", label: "Owner analytics" },
        { href: "/admin#recent-activity", label: "Recent activity" },
        { href: "/instructor-verification?from=admin", label: "Instructor verification" },
        { href: "/booking-history?from=admin", label: "Bookings" },
        { href: "/instructor-finance?from=admin", label: "Finance" },
        { href: "/support/learner?from=admin", label: "Complaints and support" },
        { href: "/feedback?from=admin", label: "Feedback" },
        { href: "/admin-mfa?manage=1", label: "Authenticator MFA" }
      ],
      role: "admin",
      subscriptionHref: "/admin",
      subscriptionLabel: "Admin",
      needsTermsAcceptance: false
    };
  }

  if (isSupport) {
    return {
      dashboardHref: "/technical-support",
      email: accountEmail,
      homeSuggestionCards: [
        {
          title: "Support queue",
          body: "Open the Technical Operations Centre queue for authenticated support work.",
          href: "/technical-support/feedback",
          image: "support",
          cta: "Open queue"
        },
        {
          title: "Site health",
          body: "Review live operational health checks from the support control centre.",
          href: "/technical-support/health",
          image: "tracking",
          cta: "View health"
        },
        {
          title: "Incidents",
          body: "Open the support incident log for technical triage and escalation updates.",
          href: "/technical-support/incidents",
          image: "calendar",
          cta: "Open incidents"
        }
      ],
      marketingOptIn: Boolean(profile?.marketing_opt_in),
      name: getDisplayName(profile?.full_name, profile?.email ?? user.email),
      privilegedMenuLinks: [{ href: "/technical-support", label: "Technical Operations Centre" }],
      role: "support",
      subscriptionHref: "/technical-support",
      subscriptionLabel: "Technical support",
      needsTermsAcceptance: false
    };
  }

  const subscriptionSession = readSubscriptionSessionToken(
    cookieStore.get(subscriptionSessionCookieName)?.value,
    user.id,
    isInstructor ? "instructor" : "learner"
  );
  const hasLearnerPlus =
    !isInstructor &&
    !hasInactiveSubscriptionStatus(learnerProfile?.learner_subscription_status) &&
    Boolean(learnerProfile?.learner_plus_active) &&
    hasActiveSubscriptionEntitlement({
      packageId: "learner-plus",
      status: learnerProfile?.learner_subscription_status,
      expiresAt: learnerProfile?.learner_plus_expires_at
    });
  const learnerSubscriptionIsInactive = hasInactiveSubscriptionStatus(learnerProfile?.learner_subscription_status);
  const instructorSubscriptionIsInactive = hasInactiveSubscriptionStatus(instructorProfile?.instructor_subscription_status);
  const learnerSessionPackage =
    !learnerSubscriptionIsInactive && isPaidLearnerPackageId(subscriptionSession?.packageId)
      ? subscriptionSession.packageId
      : null;
  const instructorSessionPackage =
    !instructorSubscriptionIsInactive && isPaidInstructorPackageId(subscriptionSession?.packageId)
      ? subscriptionSession.packageId
      : null;
  const learnerProfilePackage = getEntitledLearnerPackageId({
    packageId: learnerProfile?.learner_package,
    status: learnerProfile?.learner_subscription_status,
    expiresAt: learnerProfile?.learner_package_expires_at
  });
  const instructorProfilePackage = getEntitledInstructorPackageId({
    packageId: instructorProfile?.instructor_package,
    status: instructorProfile?.instructor_subscription_status,
    expiresAt: instructorProfile?.instructor_package_expires_at
  });
  const learnerProfilePaidPackage = isPaidLearnerPackageId(learnerProfilePackage) ? learnerProfilePackage : null;
  const instructorProfilePaidPackage = isPaidInstructorPackageId(instructorProfilePackage) ? instructorProfilePackage : null;
  const learnerPackageId = (learnerProfilePaidPackage || (hasLearnerPlus ? "learner-plus" : null) || learnerSessionPackage || "learner") as LearnerPackageId;
  const learnerPackageLabel =
    learnerPackageId === "learner-pro"
      ? "Learner Pro"
      : learnerPackageId === "learner-plus" || hasLearnerPlus
        ? "Learner Plus"
        : "Learner";
  const instructorPackageId = (instructorProfilePaidPackage || instructorSessionPackage || "instructor") as InstructorPackageId;
  const instructorIsApproved = instructorProfile?.verification_status === "approved" || (isInstructor && isMarketplaceTestInstructorEmail(accountEmail));
  const instructorPackageLabel =
    !instructorIsApproved
      ? "In progress"
      : instructorPackageId === "instructor-plus"
      ? "Instructor Plus"
      : instructorPackageId === "instructor-pro"
        ? "Instructor Pro"
        : "Instructor";
  const instructorUpgrade =
    !instructorIsApproved
      ? {}
      : instructorPackageId === "instructor"
      ? { upgradeLabel: "Upgrade to Plus", upgradeHref: "/instructor-plus" }
      : instructorPackageId === "instructor-plus"
        ? { upgradeLabel: "Upgrade to Pro", upgradeHref: "/instructor-plus" }
        : {};

  return {
    dashboardHref: isInstructor ? "/instructor-dashboard" : "/learner-dashboard",
    email: accountEmail,
    marketingOptIn: Boolean(profile?.marketing_opt_in),
    name: getDisplayName(profile?.full_name, profile?.email ?? user.email),
    role: isInstructor ? "instructor" : "learner",
    subscriptionHref: isInstructor ? (instructorIsApproved ? "/instructor-plus" : "/instructor-verification?from=dashboard") : "/learner-plus",
    subscriptionLabel: isInstructor ? instructorPackageLabel : learnerPackageLabel,
    needsTermsAcceptance,
    ...(isInstructor ? instructorUpgrade : learnerPackageId !== "learner" || hasLearnerPlus ? {} : { upgradeLabel: "Upgrade to Plus", upgradeHref: "/learner-plus" })
  };
}
