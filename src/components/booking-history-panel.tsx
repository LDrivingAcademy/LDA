"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { readStoredJsonOrNull } from "@/lib/browser-storage";

type BookingRecord = {
  id: string;
  instructorName: string;
  instructorId?: string;
  lessonSummary: string;
  date: string;
  time: string;
  pickup: string;
  pricePence: number;
  car: string;
  status: "pending" | "upcoming" | "completed" | "cancelled";
  rating?: number;
  review?: string;
  refundSummary?: string;
};

const fallbackBookings: BookingRecord[] = [
  {
    id: "LDA-AME-UPCOMING",
    instructorName: "Amelia Khan",
    instructorId: "amelia-khan",
    lessonSummary: "2026-05-16 at 10:00 from EN5 5XY. Toyota Yaris Hybrid, automatic.",
    date: "2026-05-16",
    time: "10:00",
    pickup: "EN5 5XY",
    pricePence: 4200,
    car: "Toyota Yaris Hybrid",
    status: "upcoming"
  },
  {
    id: "LDA-MAR-COMPLETE",
    instructorName: "Marcus Reed",
    instructorId: "marcus-reed",
    lessonSummary: "2026-05-08 at 15:00 from EN5 5XY. Ford Fiesta, manual.",
    date: "2026-05-08",
    time: "15:00",
    pickup: "EN5 5XY",
    pricePence: 3900,
    car: "Ford Fiesta",
    status: "completed",
    rating: 5,
    review: "Covered clutch control, observations, left turns, and independent driving."
  }
];

function formatPounds(pricePence: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pricePence / 100);
}

function formatStatus(status: BookingRecord["status"]) {
  if (status === "upcoming") return "Upcoming";
  if (status === "completed") return "Completed";
  if (status === "cancelled") return "Cancelled";
  return "Pending";
}

export function BookingHistoryPanel({ fromDashboard = false }: { fromDashboard?: boolean }) {
  const [bookings, setBookings] = useState<BookingRecord[]>(fallbackBookings);
  const [openBookingId, setOpenBookingId] = useState<string | null>(fallbackBookings[1]?.id ?? null);
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null);
  const [cancelStatus, setCancelStatus] = useState<string | null>(null);

  useEffect(() => {
    const stored = readStoredJsonOrNull<BookingRecord[]>("lda-learner-bookings");
    if (Array.isArray(stored)) {
      setBookings(stored);
    } else {
      localStorage.setItem("lda-learner-bookings", JSON.stringify(fallbackBookings));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("lda-learner-bookings", JSON.stringify(bookings));
  }, [bookings]);

  async function cancelBooking(booking: BookingRecord) {
    setCancelStatus("Cancelling lesson and notifying both sides...");

    try {
      const response = await fetch("/api/bookings/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: booking.id,
          instructorName: booking.instructorName,
          lessonSummary: `${booking.date} at ${booking.time} from ${booking.pickup}`,
          startsAt: `${booking.date}T${booking.time}:00+01:00`,
          reason: "Learner cancelled from booking history"
        })
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result?.message || "Cancellation could not be completed.");
      }

      setBookings((current) =>
        current.map((item) =>
          item.id === booking.id
            ? {
                ...item,
                status: "cancelled",
                refundSummary: result.refundSummary || "Refund eligibility will be reviewed against the cancellation policy."
              }
            : item
        )
      );
      setOpenBookingId(booking.id);
      setPendingCancelId(null);
      setCancelStatus("Lesson cancelled. Learner and instructor notifications have been queued where contact details are available.");
    } catch (error) {
      setCancelStatus(error instanceof Error ? error.message : "Cancellation could not be completed.");
    }
  }

  return (
    <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid gap-4">
        {bookings.map((booking) => {
          const isOpen = openBookingId === booking.id;
          const canCancel = booking.status === "upcoming" || booking.status === "pending";

          return (
            <article key={booking.id} className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setOpenBookingId((current) => (current === booking.id ? null : booking.id))}
                  className="text-left text-xl font-black text-black underline decoration-red-500 decoration-2 underline-offset-4 hover:text-brand"
                >
                  {booking.instructorName}
                </button>
                <span className={booking.status === "cancelled" ? "rounded-full bg-red-100 px-3 py-1 text-xs font-black uppercase text-red-700" : booking.status === "completed" ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-black uppercase text-emerald-700" : "rounded-full bg-zinc-100 px-3 py-1 text-xs font-black uppercase text-zinc-700"}>
                  {formatStatus(booking.status)}
                </span>
              </div>
              <p className="mt-2 text-sm font-bold text-zinc-600">{booking.lessonSummary}</p>

              {isOpen ? (
                <div className="mt-5 grid gap-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <Detail label="Reference" value={booking.id} />
                    <Detail label="Date and time" value={`${booking.date} at ${booking.time}`} />
                    <Detail label="Pickup" value={booking.pickup} />
                    <Detail label="Car" value={booking.car} />
                    <Detail label="Price" value={formatPounds(booking.pricePence)} />
                    <Detail label="Status" value={formatStatus(booking.status)} />
                  </div>
                  {booking.status === "completed" ? (
                    <div className="rounded border border-zinc-200 bg-zinc-50 p-4">
                      <h3 className="font-black">Completed lesson details</h3>
                      <p className="mt-2 text-sm font-semibold leading-6 text-zinc-700">{booking.review || "No revision notes have been added yet."}</p>
                      <Link href={fromDashboard ? "/after-lesson-revision?from=dashboard" : "/after-lesson-revision"} className="lda-pill lda-pill-sm mt-4">
                        Open after lesson revision
                      </Link>
                    </div>
                  ) : null}
                  {booking.refundSummary ? (
                    <p className="rounded border border-red-200 bg-red-50 p-3 text-sm font-black leading-6 text-red-900">{booking.refundSummary}</p>
                  ) : null}
                  {canCancel ? (
                    <div className="rounded border border-red-200 bg-red-50 p-4">
                      <h3 className="font-black text-red-950">Cancel upcoming lesson</h3>
                      <p className="mt-2 text-sm font-semibold leading-6 text-red-950">
                        Refunds depend on notice, instructor travel, and whether the instructor can reasonably replace the slot.
                      </p>
                      <Link href="/cancellation-policy" className="mt-2 inline-flex text-sm font-black text-brand underline underline-offset-4">
                        Read cancellation policy
                      </Link>
                      {pendingCancelId === booking.id ? (
                        <div className="mt-4 rounded bg-white p-4">
                          <p className="font-black">Are you sure you want to cancel this lesson?</p>
                          <p className="mt-2 text-sm font-semibold leading-6 text-zinc-600">
                            If you confirm, LDA will notify your instructor and send cancellation confirmation by email and text where contact details are available.
                          </p>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <button type="button" onClick={() => cancelBooking(booking)} className="lda-pill lda-pill-sm">
                              Yes, cancel lesson
                            </button>
                            <button type="button" onClick={() => setPendingCancelId(null)} className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-black hover:ring-2 hover:ring-brand">
                              Keep lesson
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button type="button" onClick={() => setPendingCancelId(booking.id)} className="lda-pill lda-pill-sm mt-4">
                          Cancel lesson
                        </button>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
      {cancelStatus ? <p className="mt-5 rounded border border-zinc-200 bg-zinc-50 p-4 text-sm font-black text-zinc-800">{cancelStatus}</p> : null}
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-zinc-200 bg-zinc-50 p-3">
      <div className="text-xs font-black uppercase text-zinc-500">{label}</div>
      <div className="mt-1 font-black text-zinc-950">{value}</div>
    </div>
  );
}
