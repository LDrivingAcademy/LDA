import { LearnerPageHeader } from "@/components/learner-page-header";
import { RateInstructorPanel } from "@/components/rate-instructor-panel";
import { getPageBackLink, type PageSourceSearchParams } from "@/lib/page-back-link";

type RateInstructorPageProps = {
  searchParams?: PageSourceSearchParams;
};

export default async function RateInstructorPage({ searchParams }: RateInstructorPageProps) {
  const { backHref, backLabel } = await getPageBackLink(searchParams);

  return (
    <main className="min-h-screen bg-white text-black">
      <LearnerPageHeader
        eyebrow="Rate your instructor"
        title="Review an instructor after a completed lesson."
        body="Give one to five stars and add a written review where useful. LDA only collects reviews about instructors, not learners."
        backHref={backHref}
        backLabel={backLabel}
      />
      <RateInstructorPanel />
    </main>
  );
}
