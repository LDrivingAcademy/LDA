"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  History,
  MapPin,
  Route,
  TimerReset,
  UserRound,
  X,
  XCircle
} from "lucide-react";
import { readStoredJsonOrNull } from "@/lib/browser-storage";
import { applyCancelledBookingStatus, rememberCancelledBooking, subscribeToCancelledBookings } from "@/lib/cancelled-booking-sync";
import { getLessonLifecycleStatus, type LessonLifecycleStatus } from "@/lib/lesson-lifecycle";
import type { BookingRecord } from "@/components/booking-history-panel";

export type LearnerCalendarLesson = {
  id: string;
  date: string;
  start: string;
  end: string;
  status: LessonLifecycleStatus;
  instructorName: string;
  pickup: string;
  car: string;
  reference: string;
  summary: string;
};

type LearnerCalendarWorkspaceProps = {
  learnerName: string;
  learnerEmail?: string | null;
  initialLessons?: LearnerCalendarLesson[];
};

const statusStyles: Record<LearnerCalendarLesson["status"], { label: string; className: string; dotClassName: string }> = {
  scheduled: { label: "Scheduled", className: "border-emerald-200 bg-emerald-50 text-emerald-800", dotClassName: "bg-emerald-500" },
  pending: { label: "Pending", className: "border-amber-200 bg-amber-50 text-amber-800", dotClassName: "bg-amber-500" },
  completed: { label: "Completed", className: "border-sky-200 bg-sky-50 text-sky-800", dotClassName: "bg-sky-500" },
  cancelled: { label: "Cancelled", className: "border-red-200 bg-red-50 text-red-800", dotClassName: "bg-red-500" }
};

function isoDate(year: number, monthIndex: number, day: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(date);
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function parseIsoDay(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day || 1);
}

function todayIso() {
  const now = new Date();
  return isoDate(now.getFullYear(), now.getMonth(), now.getDate());
}

function tomorrowIso() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return isoDate(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
}

function getMonthCells(displayMonth: Date) {
  const year = displayMonth.getFullYear();
  const month = displayMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<{ iso: string; day: number | null }> = [];

  for (let index = 0; index < startOffset; index += 1) {
    cells.push({ iso: `blank-${index}`, day: null });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ iso: isoDate(year, month, day), day });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ iso: `blank-${cells.length}`, day: null });
  }

  return cells;
}

function statusCounts(lessons: LearnerCalendarLesson[]) {
  return lessons.reduce(
    (counts, lesson) => {
      counts[lesson.status] += 1;
      return counts;
    },
    { scheduled: 0, pending: 0, completed: 0, cancelled: 0 } satisfies Record<LearnerCalendarLesson["status"], number>
  );
}

function formatDisplayDay(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "full" }).format(parseIsoDay(value));
}

function formatNextLessonMetric(lesson: Pick<LearnerCalendarLesson, "date" | "start"> | undefined, currentDay: string) {
  if (!lesson) return "None";
  if (lesson.date === currentDay) return `Today ${lesson.start}`;
  if (lesson.date === tomorrowIso()) return `Tomorrow ${lesson.start}`;

  return `${new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(parseIsoDay(lesson.date))} ${lesson.start}`;
}

function normaliseStoredStatus(booking: BookingRecord): LearnerCalendarLesson["status"] {
  return getLessonLifecycleStatus({
    status: booking.status,
    startsAt: booking.startsAt ?? `${booking.date}T${booking.time}:00`,
    endsAt: booking.endsAt
  });
}

function storedBookingToLesson(booking: BookingRecord): LearnerCalendarLesson | null {
  const startsAt = booking.startsAt ? new Date(booking.startsAt) : null;
  const date = booking.date && booking.date !== "Not recorded" ? booking.date : startsAt && !Number.isNaN(startsAt.getTime()) ? isoDate(startsAt.getFullYear(), startsAt.getMonth(), startsAt.getDate()) : "";

  if (!date || date === "Not recorded") {
    return null;
  }

  return {
    id: booking.id,
    date,
    start: booking.time || "Time pending",
    end: booking.endsAt && !Number.isNaN(new Date(booking.endsAt).getTime()) ? new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(booking.endsAt)) : "Time pending",
    status: normaliseStoredStatus(booking),
    instructorName: booking.instructorName,
    pickup: booking.pickup,
    car: booking.car,
    reference: booking.id,
    summary: booking.lessonSummary
  };
}

function mergeLessons(initialLessons: LearnerCalendarLesson[]) {
  const merged = [...initialLessons];
  const stored = readStoredJsonOrNull<BookingRecord[]>("lda-learner-bookings");
  const storedLessons = Array.isArray(stored) ? stored.map(storedBookingToLesson).filter((lesson): lesson is LearnerCalendarLesson => Boolean(lesson)) : [];

  for (const lesson of storedLessons) {
    if (!merged.some((item) => item.id === lesson.id || item.reference === lesson.reference)) {
      merged.push(lesson);
    }
  }

  return applyCancelledBookingStatus(merged).sort((a, b) => `${a.date}T${a.start}`.localeCompare(`${b.date}T${b.start}`));
}

function findInitialDate() {
  return todayIso();
}

function getLessonStartsAt(lesson: LearnerCalendarLesson) {
  return /^\d{2}:\d{2}$/.test(lesson.start) ? `${lesson.date}T${lesson.start}:00` : undefined;
}

function getLessonEndsAt(lesson: LearnerCalendarLesson) {
  return /^\d{2}:\d{2}$/.test(lesson.end) ? `${lesson.date}T${lesson.end}:00` : undefined;
}

function getLessonStartTime(lesson: LearnerCalendarLesson) {
  const startsAt = getLessonStartsAt(lesson);
  const date = startsAt ? new Date(startsAt) : parseIsoDay(lesson.date);

  return Number.isNaN(date.getTime()) ? Number.POSITIVE_INFINITY : date.getTime();
}

function applyLiveLessonStatuses(lessons: LearnerCalendarLesson[], now: Date) {
  return applyCancelledBookingStatus(lessons)
    .map((lesson) => ({
      ...lesson,
      status: getLessonLifecycleStatus({
        status: lesson.status,
        startsAt: getLessonStartsAt(lesson),
        endsAt: getLessonEndsAt(lesson),
        now
      })
    }))
    .sort((a, b) => getLessonStartTime(a) - getLessonStartTime(b));
}

function getLessonBookingWindow(lesson: LearnerCalendarLesson) {
  return lesson.date > tomorrowIso() ? "advance_scheduled" : "same_day_or_next_day";
}

function getBookLessonHrefForDate(date: string) {
  if (date > tomorrowIso()) {
    return `/scheduled-lessons?from=learner-calendar&date=${encodeURIComponent(date)}#scheduled-lessons-booking`;
  }

  return `/learner-dashboard?section=driving-lessons&from=learner-calendar&date=${encodeURIComponent(date)}#driving-lessons-booking`;
}

function markStoredLessonCancelled(lesson: LearnerCalendarLesson, refundSummary?: string) {
  const stored = readStoredJsonOrNull<BookingRecord[]>("lda-learner-bookings");

  if (!Array.isArray(stored)) {
    return;
  }

  const updated = stored.map((booking) =>
    booking.id === lesson.id || booking.id === lesson.reference
      ? {
          ...booking,
          status: "cancelled" as const,
          refundSummary: refundSummary || booking.refundSummary
        }
      : booking
  );

  localStorage.setItem("lda-learner-bookings", JSON.stringify(updated));
}

function markLessonsCancelledFromRegistry(lessons: LearnerCalendarLesson[]) {
  return applyCancelledBookingStatus(lessons);
}

export function LearnerCalendarWorkspace({ learnerName, learnerEmail, initialLessons = [] }: LearnerCalendarWorkspaceProps) {
  const router = useRouter();
  const initialDate = useMemo(() => findInitialDate(), []);
  const [lessons, setLessons] = useState(initialLessons);
  const [liveNow, setLiveNow] = useState(() => new Date());
  const [pendingCancelLesson, setPendingCancelLesson] = useState<LearnerCalendarLesson | null>(null);
  const [isCancellingLesson, setIsCancellingLesson] = useState(false);
  const [cancelStatus, setCancelStatus] = useState<string | null>(null);
  const [cancelConfirmation, setCancelConfirmation] = useState<{
    reference: string;
    instructorName: string;
    lesson: string;
    refundSummary?: string;
  } | null>(null);
  const [displayMonth, setDisplayMonth] = useState(() => {
    const initial = parseIsoDay(initialDate);
    return new Date(initial.getFullYear(), initial.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const currentDayIso = todayIso();
  const calendarLessons = useMemo(() => applyLiveLessonStatuses(lessons, liveNow), [lessons, liveNow]);
  const monthCells = useMemo(() => getMonthCells(displayMonth), [displayMonth]);
  const liveCounts = statusCounts(calendarLessons);
  const selectedLessons = calendarLessons.filter((lesson) => lesson.date === selectedDate).sort((a, b) => a.start.localeCompare(b.start));
  const nextLesson = calendarLessons.find((lesson) => lesson.status === "scheduled" || lesson.status === "pending");
  const canBookSelectedDate = selectedDate >= currentDayIso;
  const selectedDateBookingHref = getBookLessonHrefForDate(selectedDate);

  useEffect(() => {
    const updateLiveClock = () => {
      if (!document.hidden) {
        setLiveNow(new Date());
      }
    };

    const intervalId = window.setInterval(updateLiveClock, 60000);
    document.addEventListener("visibilitychange", updateLiveClock);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", updateLiveClock);
    };
  }, []);

  useEffect(() => {
    const merged = mergeLessons(initialLessons);

    setLessons(merged);
  }, [initialLessons]);

  useEffect(() => {
    return subscribeToCancelledBookings(() => {
      setLessons((current) => markLessonsCancelledFromRegistry(current));
    });
  }, []);

  useEffect(() => {
    let lastRefreshAt = 0;
    const refreshCalendar = () => {
      const now = Date.now();
      if (now - lastRefreshAt < 5000) {
        return;
      }

      lastRefreshAt = now;
      router.refresh();
    };
    const refreshWhenVisible = () => {
      if (!document.hidden) {
        refreshCalendar();
      }
    };
    const intervalId = window.setInterval(refreshWhenVisible, 60000);

    window.addEventListener("focus", refreshCalendar);
    window.addEventListener("pageshow", refreshCalendar);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshCalendar);
      window.removeEventListener("pageshow", refreshCalendar);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [router]);

  async function cancelLesson(lesson: LearnerCalendarLesson) {
    setIsCancellingLesson(true);
    setCancelStatus("Cancelling lesson...");

    try {
      const response = await fetch("/api/bookings/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: lesson.reference,
          cancellationActor: "learner",
          instructorName: lesson.instructorName,
          lessonSummary: `${lesson.date} at ${lesson.start} from ${lesson.pickup}`,
          startsAt: getLessonStartsAt(lesson),
          bookingWindow: getLessonBookingWindow(lesson),
          reason: "Learner cancelled from learner calendar"
        })
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result?.error || result?.message || "Cancellation could not be completed.");
      }

      markStoredLessonCancelled(lesson, result.refundSummary);
      rememberCancelledBooking(lesson.reference, result.refundSummary);
      setLessons((current) =>
        markLessonsCancelledFromRegistry(
          current.map((item) =>
            item.id === lesson.id || item.reference === lesson.reference
              ? {
                  ...item,
                  status: "cancelled"
                }
              : item
          )
        )
      );
      setPendingCancelLesson(null);
      setCancelStatus("Lesson cancelled. Your calendar has been updated.");
      setCancelConfirmation({
        reference: lesson.reference,
        instructorName: lesson.instructorName,
        lesson: `${formatDisplayDay(lesson.date)} at ${lesson.start}`,
        refundSummary: result.refundSummary
      });
    } catch (error) {
      setCancelStatus(error instanceof Error ? error.message : "Cancellation could not be completed.");
    } finally {
      setIsCancellingLesson(false);
    }
  }

  return (
    <>
      {pendingCancelLesson ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 px-4 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="learner-calendar-cancel-title"
            className="relative w-full max-w-lg rounded border border-zinc-200 bg-white p-6 text-black shadow-2xl"
          >
            <button
              type="button"
              onClick={() => {
                setPendingCancelLesson(null);
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
            <h2 id="learner-calendar-cancel-title" className="mt-4 pr-12 text-3xl font-black tracking-normal">
              Are you sure you want to cancel this lesson?
            </h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-zinc-700">
              This will cancel your lesson with <span className="font-black text-black">{pendingCancelLesson.instructorName}</span> on{" "}
              <span className="font-black text-black">{formatDisplayDay(pendingCancelLesson.date)} at {pendingCancelLesson.start}</span>.
            </p>
            <p className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm font-bold leading-6 text-red-950">
              Your booking will be marked as cancelled and LDA will apply the cancellation policy.
            </p>
            {cancelStatus ? <p className="mt-4 rounded border border-zinc-200 bg-zinc-50 p-3 text-sm font-black text-zinc-800">{cancelStatus}</p> : null}
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => cancelLesson(pendingCancelLesson)}
                disabled={isCancellingLesson}
                className="lda-pill lda-pill-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                Yes, cancel lesson
              </button>
              <button
                type="button"
                onClick={() => {
                  setPendingCancelLesson(null);
                  setCancelStatus(null);
                }}
                disabled={isCancellingLesson}
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
            aria-labelledby="learner-calendar-cancelled-title"
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
              <CheckCircle2 size={17} /> Lesson cancelled
            </div>
            <h2 id="learner-calendar-cancelled-title" className="mt-4 pr-12 text-3xl font-black tracking-normal">
              Your LDA lesson has been cancelled.
            </h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-zinc-700">
              Your calendar has been updated and LDA is sending your cancellation confirmation by email.
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
            {cancelConfirmation.refundSummary ? (
              <p className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm font-black leading-6 text-red-900">
                {cancelConfirmation.refundSummary}
              </p>
            ) : null}
            <button type="button" onClick={() => setCancelConfirmation(null)} className="lda-pill lda-pill-sm mt-5">
              Back to calendar
            </button>
          </section>
        </div>
      ) : null}
      <section className="border-b border-zinc-200 bg-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-red-500/60 bg-red-500/15 px-4 py-2 text-sm font-black text-red-100">
            <CalendarDays size={17} /> Learner calendar
          </div>
          <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_340px] lg:items-end">
            <div>
              <h1 className="max-w-4xl text-5xl font-black tracking-normal sm:text-6xl">Your booked lessons, mapped by date.</h1>
              <p className="mt-4 max-w-3xl text-lg font-semibold leading-8 text-zinc-300">
                Review scheduled, pending, completed, and cancelled lessons in the same calendar.
              </p>
            </div>
            <aside className="rounded border border-zinc-800 bg-zinc-950 p-5">
              <div className="text-sm font-black uppercase text-zinc-500">Signed in learner</div>
              <div className="mt-2 text-2xl font-black">{learnerName}</div>
              {learnerEmail ? <div className="mt-1 text-sm font-bold text-zinc-400">{learnerEmail}</div> : null}
            </aside>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid content-start gap-5">
          <div className="grid items-start gap-3 sm:grid-cols-2 md:grid-cols-4">
            <Metric icon={CalendarDays} label="Scheduled" value={String(liveCounts.scheduled)} tone="emerald" />
            <Metric icon={Clock3} label="Pending" value={String(liveCounts.pending)} tone="amber" />
            <Metric icon={CheckCircle2} label="Completed" value={String(liveCounts.completed)} tone="sky" />
            <Metric icon={TimerReset} label="Next lesson" value={formatNextLessonMetric(nextLesson, currentDayIso)} tone="zinc" />
          </div>

          <section className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-black uppercase text-brand">Day planner</div>
            <h2 className="mt-2 text-2xl font-black">{formatDisplayDay(selectedDate)}</h2>
            <div className="mt-5 grid gap-3">
              {selectedLessons.length > 0 ? (
                selectedLessons.map((lesson) => {
                  const isAdvanceScheduled = getLessonBookingWindow(lesson) === "advance_scheduled";
                  const hasLessonActions = lesson.status === "scheduled" || lesson.status === "pending";
                  const canSelfCancel = hasLessonActions && !isAdvanceScheduled;

                  return (
                  <article key={lesson.id} className="rounded border border-zinc-200 bg-zinc-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-lg font-black">
                          {lesson.start} - {lesson.end}
                        </div>
                        <div className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase ${statusStyles[lesson.status].className}`}>
                          {statusStyles[lesson.status].label}
                        </div>
                      </div>
                      <div className="rounded border border-zinc-200 bg-white px-3 py-2 text-xs font-black uppercase text-zinc-500">
                        {lesson.reference}
                      </div>
                    </div>
                    <div className="mt-4 grid gap-2 text-sm font-bold text-zinc-700">
                      <div className="flex items-center gap-2">
                        <UserRound size={16} className="text-brand" /> {lesson.instructorName}
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin size={16} className="text-brand" /> {lesson.pickup}
                      </div>
                      <div className="flex items-center gap-2">
                        <Route size={16} className="text-brand" /> {lesson.car}
                      </div>
                    </div>
                    <p className="mt-3 text-sm font-semibold leading-6 text-zinc-600">{lesson.summary}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link href="/booking-history?from=learner-calendar" className="lda-pill lda-pill-sm">
                        <History size={16} /> History
                      </Link>
                      {hasLessonActions ? (
                        <>
                          {canSelfCancel ? (
                            <button
                              type="button"
                              onClick={() => {
                                setPendingCancelLesson(lesson);
                                setCancelStatus(null);
                              }}
                              className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-black text-red-800 hover:bg-red-100"
                            >
                              Cancel lesson
                            </button>
                          ) : (
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-800">
                              Scheduled lesson
                            </span>
                          )}
                          <Link href={`/tracking?booking=${encodeURIComponent(lesson.reference)}&from=learner-calendar`} className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-black hover:ring-2 hover:ring-brand">
                            Track lesson
                          </Link>
                        </>
                      ) : null}
                    </div>
                  </article>
                  );
                })
              ) : (
                <div className="rounded border border-zinc-200 bg-zinc-50 p-4 text-sm font-bold leading-6 text-zinc-600">
                  <p>No lessons are scheduled for this day.</p>
                  {canBookSelectedDate ? (
                    <Link href={selectedDateBookingHref} className="lda-pill lda-pill-sm mt-4">
                      Book lesson for this day
                    </Link>
                  ) : (
                    <p className="mt-3 text-xs font-black uppercase text-zinc-500">Choose today or a future date to book a new lesson.</p>
                  )}
                </div>
              )}
            </div>
          </section>

          <section className="rounded border border-zinc-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 p-4">
              <div>
                <h2 className="text-xl font-black">{monthLabel(displayMonth)}</h2>
                <p className="mt-1 text-sm font-bold text-zinc-500">Tap a date to update the day planner above.</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setDisplayMonth((current) => addMonths(current, -1))} className="grid h-9 w-9 place-items-center rounded border border-zinc-300 hover:ring-2 hover:ring-brand" aria-label="Previous month">
                  <ChevronLeft size={18} />
                </button>
                <button type="button" onClick={() => setDisplayMonth((current) => addMonths(current, 1))} className="grid h-9 w-9 place-items-center rounded border border-zinc-300 hover:ring-2 hover:ring-brand" aria-label="Next month">
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
            <div className="lda-mobile-scroll sm:m-0 sm:overflow-visible sm:p-0">
              <div>
                <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50 text-center text-xs font-black uppercase text-zinc-500">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                    <div key={day} className="px-2 py-2">
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {monthCells.map((cell) => {
                    const dayLessons = calendarLessons.filter((lesson) => lesson.date === cell.iso);
                    const counts = statusCounts(dayLessons);
                    const isSelected = cell.iso === selectedDate;
                    const isToday = cell.iso === currentDayIso;

                    return (
                      <button
                        key={cell.iso}
                        type="button"
                        disabled={!cell.day}
                        onClick={() => cell.day && setSelectedDate(cell.iso)}
                        className={`min-h-20 border-b border-r border-zinc-200 p-2 text-left transition sm:min-h-24 ${
                          isToday
                            ? "bg-sky-50 ring-2 ring-inset ring-sky-500 hover:bg-sky-50"
                            : isSelected
                              ? "bg-red-50 ring-2 ring-inset ring-brand"
                              : cell.day
                                ? "bg-white hover:bg-zinc-50"
                                : "bg-zinc-50"
                        }`}
                      >
                        {cell.day ? (
                          <>
                            <div className={`text-sm font-black ${isToday ? "text-sky-800" : ""}`}>{cell.day}</div>
                            <div className="mt-2 grid gap-0.5">
                              {counts.scheduled ? <StatusDot label={`${counts.scheduled} scheduled`} className={statusStyles.scheduled.dotClassName} /> : null}
                              {counts.pending ? <StatusDot label={`${counts.pending} pending`} className={statusStyles.pending.dotClassName} /> : null}
                              {counts.completed ? <StatusDot label={`${counts.completed} done`} className={statusStyles.completed.dotClassName} /> : null}
                              {counts.cancelled ? <StatusDot label={`${counts.cancelled} cancelled`} className={statusStyles.cancelled.dotClassName} /> : null}
                            </div>
                          </>
                        ) : null}
                      </button>
                    );
                  })}
                  </div>
                </div>
              </div>
            </section>

            {calendarLessons.length === 0 ? (
              <section className="rounded border border-zinc-200 bg-white p-5 text-center shadow-sm">
                <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-red-50 text-brand">
                  <XCircle size={20} />
                </div>
                <h2 className="mt-3 text-2xl font-black">No lessons in your calendar yet.</h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-zinc-600">
                  Once you book a lesson, it will appear here automatically as well as in booking history.
                </p>
                <Link href="/learner-dashboard?section=driving-lessons&from=dashboard#driving-lessons-booking" className="lda-pill lda-pill-sm mt-4">
                  Book a lesson
                </Link>
              </section>
            ) : null}
        </div>
      </section>
    </>
  );
}

function Metric({ icon: Icon, label, value, tone }: { icon: typeof CalendarDays; label: string; value: string; tone: "emerald" | "amber" | "sky" | "zinc" }) {
  const toneClass = {
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    sky: "bg-sky-50 text-sky-700",
    zinc: "bg-zinc-100 text-zinc-700"
  }[tone];

  return (
    <article className="flex aspect-square min-h-[112px] flex-col justify-between rounded border border-zinc-200 bg-white p-3 shadow-sm">
      <div className={`grid h-8 w-8 place-items-center rounded ${toneClass}`}>
        <Icon size={17} />
      </div>
      <div>
        <div className="text-2xl font-black">{value}</div>
        <div className="mt-1 text-xs font-black uppercase text-zinc-500">{label}</div>
      </div>
    </article>
  );
}

function StatusDot({ label, className }: { label: string; className: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] font-black leading-4 text-zinc-600">
      <span className={`h-2 w-2 rounded-full ${className}`} />
      {label}
    </div>
  );
}
