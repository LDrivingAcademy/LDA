"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronDown, MailCheck, X } from "lucide-react";
import { readStoredJsonOrNull } from "@/lib/browser-storage";
import { applyCancelledBookingStatus, rememberCancelledBooking, subscribeToCancelledBookings } from "@/lib/cancelled-booking-sync";
import { PlatformProtectionPanel } from "@/components/platform-protection-panel";

export type BookingRecord = {
  id: string;
  instructorName: string;
  instructorId?: string;
  lessonSummary: string;
  date: string;
  time: string;
  bookingWindow?: "same_day_or_next_day" | "advance_scheduled";
  startsAt?: string;
  endsAt?: string;
  pickup: string;
  pricePence: number;
  car: string;
  status: "pending" | "upcoming" | "completed" | "cancelled";
  rating?: number;
  review?: string;
  refundSummary?: string;
};

const retiredDemoBookingReferences = new Set(["LDA-AME-UPCOMING", "LDA-MAR-COMPLETE"]);

function formatPounds(pricePence: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pricePence / 100);
}

function formatStatus(status: BookingRecord["status"]) {
  if (status === "upcoming") return "Upcoming";
  if (status === "completed") return "Completed";
  if (status === "cancelled") return "Cancelled";
  return "Pending";
}

function isRetiredDemoBooking(record: BookingRecord) {
  return retiredDemoBookingReferences.has(record.id.toUpperCase());
}

function formatLessonTitle(booking: BookingRecord) {
  return `${booking.date} at ${booking.time}`;
}

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function isPastBookingDay(booking: BookingRecord) {
  if (!booking.date || booking.date === "Not recorded") {
    const startDate = parseBookingDateTime(booking);
    return startDate ? startDate.toISOString().slice(0, 10) < todayIso() : false;
  }

  return booking.date < todayIso();
}

function getDefaultOpenBookingId(bookings: BookingRecord[], initialOpenBookingId?: string | null, initialCancelBookingId?: string | null) {
  if (initialOpenBookingId && bookings.some((booking) => booking.id === initialOpenBookingId)) {
    return initialOpenBookingId;
  }

  if (initialCancelBookingId && bookings.some((booking) => booking.id === initialCancelBookingId)) {
    return initialCancelBookingId;
  }

  return bookings.find((booking) => !isPastBookingDay(booking))?.id ?? null;
}

function findBookingById(bookings: BookingRecord[], bookingId?: string | null) {
  return bookingId ? bookings.find((booking) => booking.id === bookingId) ?? null : null;
}

function isAdvanceScheduledBooking(booking: BookingRecord) {
  return booking.bookingWindow === "advance_scheduled" || booking.lessonSummary.toLowerCase().includes("advance scheduled");
}

function parseBookingDateTime(booking: BookingRecord) {
  const startFromIso = booking.startsAt ? new Date(booking.startsAt) : null;
  if (startFromIso && !Number.isNaN(startFromIso.getTime())) {
    return startFromIso;
  }

  if (!booking.date || !booking.time || booking.date === "Not recorded" || booking.time === "Not recorded") {
    return null;
  }

  const startFromDisplay = new Date(`${booking.date}T${booking.time}:00`);
  return Number.isNaN(startFromDisplay.getTime()) ? null : startFromDisplay;
}

function normaliseBookingTimelineStatus(booking: BookingRecord): BookingRecord {
  if (booking.status === "cancelled") {
    return booking;
  }

  const now = Date.now();
  const endDate = booking.endsAt ? new Date(booking.endsAt) : null;
  const validEndTime = endDate && !Number.isNaN(endDate.getTime()) ? endDate.getTime() : null;
  const startDate = parseBookingDateTime(booking);
  const validStartTime = startDate ? startDate.getTime() : null;
  const hasPassed = validEndTime !== null ? validEndTime < now : validStartTime !== null && validStartTime < now;

  if (!hasPassed || booking.status === "completed") {
    return booking;
  }

  return { ...booking, status: "completed" };
}

function applyFinalCancelledStatuses(bookings: BookingRecord[]) {
  return applyCancelledBookingStatus(bookings).map(normaliseBookingTimelineStatus);
}

export function BookingHistoryPanel({
  fromDashboard = false,
  initialBookings = [],
  initialOpenBookingId,
  initialCancelBookingId
}: {
  fromDashboard?: boolean;
  initialBookings?: BookingRecord[];
  initialOpenBookingId?: string | null;
  initialCancelBookingId?: string | null;
}) {
  const defaultOpenBookingId = getDefaultOpenBookingId(initialBookings, initialOpenBookingId, initialCancelBookingId);
  const [bookings, setBookings] = useState<BookingRecord[]>(initialBookings);
  const [openBookingId, setOpenBookingId] = useState<string | null>(defaultOpenBookingId);
  const [pendingCancelBooking, setPendingCancelBooking] = useState<BookingRecord | null>(() => findBookingById(initialBookings, initialCancelBookingId));
  const [isCancellingBooking, setIsCancellingBooking] = useState(false);
  const [cancelStatus, setCancelStatus] = useState<string | null>(null);
  const [cancelConfirmation, setCancelConfirmation] = useState<{
    reference: string;
    instructorName: string;
    lesson: string;
    refundSummary: string;
  } | null>(null);

  useEffect(() => {
    const stored = readStoredJsonOrNull<BookingRecord[]>("lda-learner-bookings");
    const storedBookings = Array.isArray(stored) ? applyFinalCancelledStatuses(stored.filter((record) => !isRetiredDemoBooking(record))) : [];
    const mergedBookings = applyFinalCancelledStatuses(initialBookings);

    for (const storedBooking of storedBookings) {
      if (!mergedBookings.some((booking) => booking.id === storedBooking.id)) {
        mergedBookings.push(storedBooking);
      }
    }

    const syncedBookings = applyFinalCancelledStatuses(mergedBookings);
    setBookings(syncedBookings);
    setOpenBookingId((current) => current ?? getDefaultOpenBookingId(mergedBookings, initialOpenBookingId, initialCancelBookingId));
    setPendingCancelBooking((current) => current ?? findBookingById(mergedBookings, initialCancelBookingId));

    if (stored && storedBookings.length !== stored.length) {
      localStorage.setItem("lda-learner-bookings", JSON.stringify(storedBookings));
    }
  }, [initialBookings, initialOpenBookingId, initialCancelBookingId]);

  useEffect(() => {
    const localBookings = applyFinalCancelledStatuses(bookings.filter((booking) => !isRetiredDemoBooking(booking)));
    localStorage.setItem("lda-learner-bookings", JSON.stringify(localBookings));
  }, [bookings]);

  useEffect(() => {
    return subscribeToCancelledBookings(() => {
      setBookings((current) => applyFinalCancelledStatuses(current));
      setPendingCancelBooking((current) => (current ? applyFinalCancelledStatuses([current])[0] ?? current : current));
    });
  }, []);

  async function cancelBooking(booking: BookingRecord) {
    setIsCancellingBooking(true);
    setCancelStatus("Cancelling lesson and notifying both sides...");

    try {
      const response = await fetch("/api/bookings/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: booking.id,
          cancellationActor: "learner",
          instructorName: booking.instructorName,
          lessonSummary: `${booking.date} at ${booking.time} from ${booking.pickup}`,
          startsAt: booking.startsAt ?? `${booking.date}T${booking.time}:00+01:00`,
          bookingWindow: booking.bookingWindow,
          reason: "Learner cancelled from booking history"
        })
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result?.error || result?.message || "Cancellation could not be completed.");
      }

      const refundSummary = result.refundSummary || "Refund eligibility will be reviewed against the cancellation policy.";
      rememberCancelledBooking(booking.id, refundSummary);
      setBookings((current) =>
        applyFinalCancelledStatuses(
          current.map((item) =>
            item.id === booking.id
              ? {
                  ...item,
                  status: "cancelled",
                  refundSummary
                }
              : item
          )
        )
      );
      setOpenBookingId(booking.id);
      setPendingCancelBooking(null);
      setCancelStatus("Lesson cancelled. Learner and instructor notifications have been queued where contact details are available.");
      setCancelConfirmation({
        reference: booking.id,
        instructorName: booking.instructorName,
        lesson: `${booking.date} at ${booking.time}`,
        refundSummary
      });
    } catch (error) {
      setCancelStatus(error instanceof Error ? error.message : "Cancellation could not be completed.");
    } finally {
      setIsCancellingBooking(false);
    }
  }

  return (
    <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {pendingCancelBooking ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 px-4 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-lesson-confirm-title"
            className="relative w-full max-w-lg rounded border border-zinc-200 bg-white p-6 text-black shadow-2xl"
          >
            <button
              type="button"
              onClick={() => {
                setPendingCancelBooking(null);
                setCancelStatus(null);
              }}
              aria-label="Keep lesson and close"
              className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full border border-zinc-200 text-zinc-700 hover:bg-zinc-100"
            >
              <X size={20} />
            </button>
            <div className="inline-flex items-center gap-2 rounded bg-red-50 px-3 py-2 text-sm font-black uppercase text-red-800">
              <AlertTriangle size={17} /> Confirm cancellation
            </div>
            <h2 id="cancel-lesson-confirm-title" className="mt-4 pr-12 text-3xl font-black tracking-normal">
              Are you sure you want to cancel this lesson?
            </h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-zinc-700">
              This will cancel your lesson with <span className="font-black text-black">{pendingCancelBooking.instructorName}</span> on{" "}
              <span className="font-black text-black">{pendingCancelBooking.date} at {pendingCancelBooking.time}</span>.
            </p>
            <p className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm font-bold leading-6 text-red-950">
              LDA will apply the cancellation policy and send the cancellation update where contact details are available.
            </p>
            {cancelStatus ? <p className="mt-4 rounded border border-zinc-200 bg-zinc-50 p-3 text-sm font-black text-zinc-800">{cancelStatus}</p> : null}
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => cancelBooking(pendingCancelBooking)}
                disabled={isCancellingBooking}
                className="lda-pill lda-pill-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                Yes, cancel lesson
              </button>
              <button
                type="button"
                onClick={() => {
                  setPendingCancelBooking(null);
                  setCancelStatus(null);
                }}
                disabled={isCancellingBooking}
                className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-black hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                No, keep lesson
              </button>
            </div>
          </section>
        </div>
      ) : null}
      {cancelConfirmation ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 px-4 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="lesson-cancelled-title"
            className="relative w-full max-w-lg rounded border border-zinc-200 bg-white p-6 text-black shadow-2xl"
          >
            <button
              type="button"
              onClick={() => setCancelConfirmation(null)}
              aria-label="Close cancellation confirmation"
              className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full border border-zinc-200 text-zinc-700 hover:bg-zinc-100"
            >
              <X size={20} />
            </button>
            <div className="inline-flex items-center gap-2 rounded bg-red-50 px-3 py-2 text-sm font-black uppercase text-red-800">
              <MailCheck size={17} /> Lesson cancelled
            </div>
            <h2 id="lesson-cancelled-title" className="mt-4 pr-12 text-3xl font-black tracking-normal">
              Your LDA lesson has been cancelled.
            </h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-zinc-700">
              LDA is sending cancellation emails to you and the instructor, adding notification hub updates, marking the lesson cancelled on both calendars, and reopening the instructor slot.
            </p>
            <div className="mt-5 grid gap-2 rounded border border-zinc-200 bg-zinc-50 p-4 text-sm font-bold leading-6 text-zinc-700">
              <div>
                <span className="text-zinc-500">Instructor:</span> <span className="text-black">{cancelConfirmation.instructorName}</span>
              </div>
              <div>
                <span className="text-zinc-500">Lesson:</span> <span className="text-black">{cancelConfirmation.lesson}</span>
              </div>
              <div>
                <span className="text-zinc-500">Reference:</span> <span className="font-mono text-black">{cancelConfirmation.reference}</span>
              </div>
            </div>
            <p className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm font-black leading-6 text-red-900">
              {cancelConfirmation.refundSummary}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/learner-calendar?from=booking-history" className="lda-pill lda-pill-sm">
                Open calendar
              </Link>
              <button
                type="button"
                onClick={() => setCancelConfirmation(null)}
                className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-black hover:ring-2 hover:ring-brand"
              >
                Back to history
              </button>
            </div>
          </section>
        </div>
      ) : null}
      <div className="grid gap-4">
        {bookings.length === 0 ? (
          <article className="rounded border border-zinc-200 bg-white p-6 text-center shadow-sm">
            <div className="mx-auto max-w-md">
              <div className="text-sm font-black uppercase text-brand">No history</div>
              <h2 className="mt-3 text-3xl font-black tracking-normal text-black">No lessons booked yet.</h2>
              <p className="mt-3 text-sm font-semibold leading-6 text-zinc-600">
                Once you book or complete an LDA lesson, it will appear here one by one with the lesson date, instructor, and what was covered.
              </p>
              <Link href="/learner-dashboard" className="lda-pill lda-pill-sm mt-5">
                Book a lesson
              </Link>
            </div>
          </article>
        ) : null}
        {bookings.map((booking) => {
          const isOpen = openBookingId === booking.id;
          const isAdvanceScheduled = isAdvanceScheduledBooking(booking);
          const canCancel = (booking.status === "upcoming" || booking.status === "pending") && !isAdvanceScheduled;
          const isProtectedScheduled = (booking.status === "upcoming" || booking.status === "pending") && isAdvanceScheduled;
          const isPastDay = isPastBookingDay(booking);

          return (
            <article key={booking.id} className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setOpenBookingId((current) => (current === booking.id ? null : booking.id))}
                  aria-expanded={isOpen}
                  className="inline-flex min-w-0 items-center gap-2 text-left text-xl font-black text-black hover:text-brand"
                >
                  <ChevronDown size={20} className={`shrink-0 transition ${isOpen ? "rotate-180" : ""}`} />
                  <span className="underline decoration-red-500 decoration-2 underline-offset-4">{formatLessonTitle(booking)}</span>
                </button>
                <div className="flex flex-wrap items-center gap-2">
                  {canCancel && !isPastDay ? (
                    <button
                      type="button"
                      onClick={() => {
                        setOpenBookingId(booking.id);
                        setPendingCancelBooking(booking);
                        setCancelStatus(null);
                      }}
                      className="rounded-full bg-brand px-4 py-2 text-xs font-black uppercase text-white shadow-sm shadow-red-900/20 hover:ring-2 hover:ring-brand/40"
                    >
                      Cancel lesson
                    </button>
                  ) : null}
                  <span className={booking.status === "cancelled" ? "rounded-full bg-red-100 px-3 py-1 text-xs font-black uppercase text-red-700" : booking.status === "completed" ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-black uppercase text-emerald-700" : "rounded-full bg-zinc-100 px-3 py-1 text-xs font-black uppercase text-zinc-700"}>
                    {formatStatus(booking.status)}
                  </span>
                </div>
              </div>
              <p className="mt-2 text-sm font-bold text-zinc-600">
                Instructor: {booking.instructorName}. {booking.review ? `Covered: ${booking.review}` : booking.lessonSummary}
              </p>
              {isOpen ? (
                <div className="mt-5 grid gap-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <Detail label="Lesson" value={formatLessonTitle(booking)} />
                    <Detail label="Instructor" value={booking.instructorName} />
                    <Detail label="What you covered" value={booking.review || "No lesson notes have been added yet."} />
                    <Detail label="Pickup" value={booking.pickup} />
                    <Detail label="Car" value={booking.car} />
                    <Detail label="Price" value={formatPounds(booking.pricePence)} />
                    <Detail label="Status" value={formatStatus(booking.status)} />
                    <Detail label="Reference" value={booking.id} />
                  </div>
                  <PlatformProtectionPanel audience="learner" compact />
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
                  {isProtectedScheduled ? (
                    <div className="rounded border border-emerald-200 bg-emerald-50 p-4">
                      <h3 className="font-black text-emerald-950">Scheduled lesson protected</h3>
                      <p className="mt-2 text-sm font-semibold leading-6 text-emerald-950">
                        This scheduled lesson reserves instructor diary time in advance, so learner self-service cancellation is not available from booking history.
                      </p>
                      <Link href="/cancellation-policy" className="mt-2 inline-flex text-sm font-black text-brand underline underline-offset-4">
                        Read cancellation policy
                      </Link>
                    </div>
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
                      <button
                        type="button"
                        onClick={() => {
                          setPendingCancelBooking(booking);
                          setCancelStatus(null);
                        }}
                        className="lda-pill lda-pill-sm mt-4"
                      >
                        Cancel lesson
                      </button>
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
