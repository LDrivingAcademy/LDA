import { LearnerPageHeader } from "@/components/learner-page-header";
import { NotificationHubPanel } from "@/components/notification-hub-panel";

export default function NotificationHubPage() {
  return (
    <main className="min-h-screen bg-white text-black">
      <LearnerPageHeader
        eyebrow="Notification hub"
        title="Choose the LDA alerts you want."
        body="Control booking, cancellation, instructor arrival, after-lesson, and promotional notifications from one focused page."
      />
      <NotificationHubPanel />
    </main>
  );
}
