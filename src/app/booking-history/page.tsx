import { BookingHistoryPanel } from "@/components/booking-history-panel";
import { LearnerPageHeader } from "@/components/learner-page-header";

export default function BookingHistoryPage() {
  return (
    <main className="min-h-screen bg-white text-black">
      <LearnerPageHeader
        eyebrow="Booking history"
        title="View every LDA lesson in one place."
        body="Open completed lessons for details, review upcoming lessons, and cancel bookings with clear confirmation and cancellation-policy guidance."
      />
      <BookingHistoryPanel />
    </main>
  );
}
