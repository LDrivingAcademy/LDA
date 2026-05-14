import { LearnerPageHeader } from "@/components/learner-page-header";
import { RateInstructorPanel } from "@/components/rate-instructor-panel";

export default function RateInstructorPage() {
  return (
    <main className="min-h-screen bg-white text-black">
      <LearnerPageHeader
        eyebrow="Rate your instructor"
        title="Review an instructor after a completed lesson."
        body="Give one to five stars and add a written review where useful. LDA only collects reviews about instructors, not learners."
      />
      <RateInstructorPanel />
    </main>
  );
}
