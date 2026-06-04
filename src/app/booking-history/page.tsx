import { BookingHistoryPanel } from "@/components/booking-history-panel";
import { LearnerPageHeader } from "@/components/learner-page-header";
import { getPageBackLink, type PageSourceSearchParams } from "@/lib/page-back-link";

type BookingHistoryPageProps = {
  searchParams?: PageSourceSearchParams;
};

export default async function BookingHistoryPage({ searchParams }: BookingHistoryPageProps) {
  const { backHref, backLabel, fromDashboard } = await getPageBackLink(searchParams);

  return (
    <main className="min-h-screen bg-white text-black">
      <LearnerPageHeader
        eyebrow="Booking history"
        title="View every LDA lesson in one place."
        body="Open completed lessons for details, review upcoming lessons, and cancel bookings with clear confirmation and cancellation-policy guidance."
        backHref={backHref}
        backLabel={backLabel}
      />
      <BookingHistoryPanel fromDashboard={fromDashboard} />
    </main>
  );
}
