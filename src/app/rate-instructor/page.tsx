import { AdminSessionAutoSignOut } from "@/components/admin-session-auto-sign-out";
import { LearnerPageHeader } from "@/components/learner-page-header";
import { RateInstructorPanel } from "@/components/rate-instructor-panel";
import { isSignedInAdmin } from "@/lib/account-package-state";
import { redirectIfWrongMarketplaceRole } from "@/lib/account-route-guard";
import { getPageBackLink, type PageSourceSearchParams } from "@/lib/page-back-link";
import { requireSignedInPage } from "@/lib/page-auth";

type RateInstructorPageProps = {
  searchParams?: PageSourceSearchParams;
};

export default async function RateInstructorPage({ searchParams }: RateInstructorPageProps) {
  const { backHref, backLabel, fromAdmin } = await getPageBackLink(searchParams, {
    allowAdminSource: await isSignedInAdmin()
  });
  const { supabase, user } = await requireSignedInPage("Sign in before rating an instructor.");
  await redirectIfWrongMarketplaceRole(supabase, user.id, "learner");

  return (
    <main className="min-h-screen bg-white text-black">
      {fromAdmin ? <AdminSessionAutoSignOut /> : null}
      <LearnerPageHeader
        eyebrow="Rate your instructor"
        title="Review an instructor after a completed lesson."
        body="Give one to five stars and add a written review where useful. LDA only collects reviews about instructors, not learners."
        backHref={backHref}
        backLabel={backLabel}
        brandHref={fromAdmin ? "/admin" : "/"}
        brandLabel={fromAdmin ? "LDA admin dashboard" : "L Driving Academy home"}
      />
      <RateInstructorPanel />
    </main>
  );
}
