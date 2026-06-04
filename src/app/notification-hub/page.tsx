import { LearnerPageHeader } from "@/components/learner-page-header";
import { NotificationHubPanel } from "@/components/notification-hub-panel";
import { getPageBackLink, type PageSourceSearchParams } from "@/lib/page-back-link";

type NotificationHubPageProps = {
  searchParams?: PageSourceSearchParams;
};

export default async function NotificationHubPage({ searchParams }: NotificationHubPageProps) {
  const { backHref, backLabel } = await getPageBackLink(searchParams);

  return (
    <main className="min-h-screen bg-white text-black">
      <LearnerPageHeader
        eyebrow="Notification hub"
        title="Choose the LDA alerts you want."
        body="Control booking, cancellation, instructor arrival, after-lesson, and promotional notifications from one focused page."
        backHref={backHref}
        backLabel={backLabel}
      />
      <NotificationHubPanel />
    </main>
  );
}
