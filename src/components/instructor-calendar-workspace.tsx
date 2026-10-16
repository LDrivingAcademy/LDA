"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MessageSquareText,
  MapPin,
  PauseCircle,
  PlusCircle,
  Trash2,
  X,
  XCircle,
  UserRound
} from "lucide-react";
import { applyCancelledBookingStatus, rememberCancelledBooking, subscribeToCancelledBookings } from "@/lib/cancelled-booking-sync";
import { getLessonLifecycleStatus, type LessonLifecycleStatus } from "@/lib/lesson-lifecycle";
import type { LiveGpsPoint } from "@/lib/live-gps-utils";
import { requestFreshGpsPoint, subscribeLiveGps } from "@/lib/live-gps-watch-manager";
import { writeCachedLiveLocation } from "@/lib/live-location-client-cache";

export type LessonStatus = LessonLifecycleStatus | "free" | "blocked";

export type InstructorSlot = {
  id: string;
  date: string;
  start: string;
  end: string;
  status: LessonStatus;
  learner?: string;
  pickup?: string;
  reference?: string;
  note?: string;
  instructorArrivedAt?: string | null;
  instructorLateMinutes?: number;
  learnerTimeBankMinutesAwarded?: number;
  punctualityStatus?: string | null;
};

type InstructorCalendarWorkspaceProps = {
  instructorName: string;
  instructorEmail?: string | null;
  initialSlots?: InstructorSlot[];
  useDemoSlots?: boolean;
};

const CALENDAR_STORAGE_KEY = "lda:instructor-calendar-slots:v1";
const EMPTY_INITIAL_SLOTS: InstructorSlot[] = [];
const workLocationPingIntervalMs = 15000;

function applyFinalCancelledSlots(slots: InstructorSlot[]) {
  return applyCancelledBookingStatus(slots.map((slot) => ({ ...slot, reference: slot.reference || slot.id }))) as InstructorSlot[];
}

const demoInitialSlots: InstructorSlot[] = [
  {
    id: "slot-1",
    date: "2026-06-08",
    start: "09:00",
    end: "10:30",
    status: "completed",
    learner: "Mia Thompson",
    pickup: "EN5 5XY",
    reference: "LDA-MIA-0900",
    note: "Manual lesson, junction confidence"
  },
  {
    id: "slot-2",
    date: "2026-06-08",
    start: "11:00",
    end: "12:30",
    status: "free",
    note: "Available for Barnet or Finchley"
  },
  {
    id: "slot-3",
    date: "2026-06-09",
    start: "14:00",
    end: "15:30",
    status: "pending",
    learner: "Owen Patel",
    pickup: "N12 8QP",
    reference: "LDA-OWE-HOLD",
    note: "Learner checkout in progress"
  },
  {
    id: "slot-4",
    date: "2026-06-10",
    start: "16:00",
    end: "17:30",
    status: "completed",
    learner: "Aaliyah Grant",
    pickup: "NW7 2EU",
    reference: "LDA-AAL-1600",
    note: "Mock-test route planning"
  },
  {
    id: "slot-5",
    date: "2026-06-12",
    start: "08:00",
    end: "10:00",
    status: "blocked",
    note: "School run / unavailable"
  },
  {
    id: "slot-6",
    date: "2026-06-13",
    start: "10:00",
    end: "11:30",
    status: "free",
    note: "Open weekend slot"
  },
  {
    id: "slot-7",
    date: "2026-06-15",
    start: "13:00",
    end: "14:30",
    status: "completed",
    learner: "Noah Evans",
    pickup: "EN4 9AB",
    reference: "LDA-NOA-1300",
    note: "Roundabouts and independent driving"
  },
  {
    id: "slot-8",
    date: "2026-06-17",
    start: "18:00",
    end: "19:30",
    status: "pending",
    learner: "Grace Lee",
    pickup: "N20 0AA",
    reference: "LDA-GRA-HOLD",
    note: "Evening lesson request"
  }
];

const statusStyles: Record<LessonStatus, { label: string; className: string }> = {
  scheduled: { label: "Scheduled", className: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  pending: { label: "Pending", className: "border-amber-200 bg-amber-50 text-amber-800" },
  completed: { label: "Completed", className: "border-sky-200 bg-sky-50 text-sky-800" },
  free: { label: "Free", className: "border-sky-200 bg-sky-50 text-sky-800" },
  blocked: { label: "Unavailable", className: "border-zinc-200 bg-zinc-100 text-zinc-700" },
  cancelled: { label: "Cancelled", className: "border-red-200 bg-red-50 text-red-800" }
};

const instructorNotifications = [
  {
    title: "Learner enquiry",
    detail: "New learner request waiting for lesson-time confirmation.",
    meta: "Action needed today"
  },
  {
    title: "Lesson reminder",
    detail: "Confirmed pickup details should be checked before the next scheduled slot.",
    meta: "Booking workflow"
  },
  {
    title: "Test reminder",
    detail: "Review test-ready pupils before approving additional mock-test slots.",
    meta: "Readiness check"
  },
  {
    title: "LDA announcement",
    detail: "Keep availability current so SmartMatch does not offer stale lesson times.",
    meta: "Platform update"
  }
];

function isoDate(year: number, monthIndex: number, day: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(date);
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
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

function parseIsoDay(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day || 1);
}

function displayMonthForDate(value: string) {
  const date = parseIsoDay(value);
  return Number.isNaN(date.getTime()) ? new Date() : new Date(date.getFullYear(), date.getMonth(), 1);
}

function formatNextLessonMetric(slot: Pick<InstructorSlot, "date" | "start"> | undefined, currentDay: string) {
  if (!slot) return "None";
  if (slot.date === currentDay) return `Today ${slot.start}`;
  if (slot.date === tomorrowIso()) return `Tomorrow ${slot.start}`;

  return `${new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(parseIsoDay(slot.date))} ${slot.start}`;
}

function formatTimeForInput(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(value);
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

function statusCounts(slots: InstructorSlot[]) {
  return slots.reduce(
    (counts, slot) => {
      counts[slot.status] += 1;
      return counts;
    },
    { scheduled: 0, pending: 0, completed: 0, free: 0, blocked: 0, cancelled: 0 } satisfies Record<LessonStatus, number>
  );
}

function isBookingControlledStatus(status: LessonStatus) {
  return status === "scheduled" || status === "pending" || status === "completed" || status === "cancelled";
}

function getSlotStartsAt(slot: InstructorSlot) {
  return /^\d{2}:\d{2}$/.test(slot.start) ? `${slot.date}T${slot.start}:00` : undefined;
}

function getSlotEndsAt(slot: InstructorSlot) {
  return /^\d{2}:\d{2}$/.test(slot.end) ? `${slot.date}T${slot.end}:00` : undefined;
}

function getSlotStartTime(slot: InstructorSlot) {
  const startsAt = getSlotStartsAt(slot);
  const date = startsAt ? new Date(startsAt) : parseIsoDay(slot.date);

  return Number.isNaN(date.getTime()) ? Number.POSITIVE_INFINITY : date.getTime();
}

function applyLiveSlotStatuses(slots: InstructorSlot[], now: Date) {
  return applyFinalCancelledSlots(slots)
    .map((slot) =>
      isBookingControlledStatus(slot.status)
        ? {
            ...slot,
            status: getLessonLifecycleStatus({
              status: slot.status,
              startsAt: getSlotStartsAt(slot),
              endsAt: getSlotEndsAt(slot),
              now
            })
          }
        : slot
    )
    .sort((a, b) => getSlotStartTime(a) - getSlotStartTime(b));
}

function isLessonStatus(value: unknown): value is LessonStatus {
  return value === "scheduled" || value === "pending" || value === "completed" || value === "free" || value === "blocked" || value === "cancelled";
}

function isInstructorSlot(value: unknown): value is InstructorSlot {
  if (!value || typeof value !== "object") {
    return false;
  }

  const slot = value as Partial<InstructorSlot>;
  return (
    typeof slot.id === "string" &&
    typeof slot.date === "string" &&
    typeof slot.start === "string" &&
    typeof slot.end === "string" &&
    isLessonStatus(slot.status)
  );
}

function readStoredSlots() {
  try {
    const stored = window.localStorage.getItem(CALENDAR_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : null;
    return Array.isArray(parsed) && parsed.every(isInstructorSlot) ? parsed : null;
  } catch {
    return null;
  }
}

async function requestWorkLocation() {
  const point = await requestFreshGpsPoint({
    source: "working_day",
    enableHighAccuracy: true,
    maximumAge: 2500,
    timeout: 15000
  });
  if (!point) {
    throw new Error("This browser does not support live location. Use a browser with location access before starting work.");
  }

  return point;
}

async function shareWorkLocation(position: LiveGpsPoint, source: "working_day" | "start_work") {
  writeCachedLiveLocation("instructor-work", "working-day", position);

  const response = await fetch("/api/instructor-location/live", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      latitude: position.lat,
      longitude: position.lng,
      accuracy: position.accuracy,
      heading: position.heading,
      speed: position.speed,
      clientRecordedAt: position.recordedAt,
      source
    })
  });
  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result?.error || "LDA could not update your live work location.");
  }

  return result;
}

export function InstructorCalendarWorkspace({ instructorName, instructorEmail, initialSlots = EMPTY_INITIAL_SLOTS, useDemoSlots = false }: InstructorCalendarWorkspaceProps) {
  const router = useRouter();
  const workLocationUnsubscribeRef = useRef<(() => void) | null>(null);
  const lastWorkLocationPingAtRef = useRef(0);
  const [displayMonth, setDisplayMonth] = useState(() => displayMonthForDate(todayIso()));
  const [selectedDate, setSelectedDate] = useState(() => todayIso());
  const [slots, setSlots] = useState<InstructorSlot[]>(() => applyFinalCancelledSlots(initialSlots.length > 0 ? initialSlots : useDemoSlots ? demoInitialSlots : EMPTY_INITIAL_SLOTS));
  const [liveNow, setLiveNow] = useState(() => new Date());
  const [hasLoadedStoredSlots, setHasLoadedStoredSlots] = useState(false);
  const [removeMode, setRemoveMode] = useState(false);
  const [pendingCancelSlot, setPendingCancelSlot] = useState<InstructorSlot | null>(null);
  const [isCancellingSlot, setIsCancellingSlot] = useState(false);
  const [cancelStatus, setCancelStatus] = useState<string | null>(null);
  const [availabilityStatus, setAvailabilityStatus] = useState<string | null>(null);
  const [availabilityBusy, setAvailabilityBusy] = useState(false);
  const [newSlotStart, setNewSlotStart] = useState("09:00");
  const [newSlotEnd, setNewSlotEnd] = useState("10:30");
  const currentDayIso = todayIso();
  const calendarSlots = useMemo(() => applyLiveSlotStatuses(slots, liveNow), [liveNow, slots]);
  const monthCells = useMemo(() => getMonthCells(displayMonth), [displayMonth]);
  const liveCounts = statusCounts(calendarSlots);
  const selectedSlots = calendarSlots.filter((slot) => slot.date === selectedDate).sort((a, b) => a.start.localeCompare(b.start));
  const nextLesson = calendarSlots.find((slot) => slot.status === "scheduled" || slot.status === "pending");

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
      stopWorkLocationWatch();
    };
  }, []);

  function stopWorkLocationWatch() {
    workLocationUnsubscribeRef.current?.();
    workLocationUnsubscribeRef.current = null;
  }

  function startWorkLocationWatch() {
    if (workLocationUnsubscribeRef.current) {
      return;
    }

    workLocationUnsubscribeRef.current = subscribeLiveGps(
      {
        source: "working_day",
        enableHighAccuracy: true,
        maximumAge: 2500,
        timeout: 15000
      },
      {
        onPoint: (position) => {
          const now = Date.now();
          if (now - lastWorkLocationPingAtRef.current < workLocationPingIntervalMs) {
            return;
          }

          lastWorkLocationPingAtRef.current = now;
          shareWorkLocation(position, "working_day").catch((error) => {
            setAvailabilityStatus(error instanceof Error ? error.message : "LDA could not refresh your live work location.");
          });
        },
        onError: () => {
          setAvailabilityStatus("Location permission is required while you are working. Allow browser location access or end your working day.");
        }
      }
    );
  }

  useEffect(() => {
    if (initialSlots.length > 0) {
      setSlots(applyFinalCancelledSlots(initialSlots));
      setHasLoadedStoredSlots(true);
      return;
    }

    const storedSlots = useDemoSlots ? readStoredSlots() : null;
    if (storedSlots) {
      setSlots(applyFinalCancelledSlots(storedSlots));
    } else if (useDemoSlots) {
      setSlots(applyFinalCancelledSlots(demoInitialSlots));
    } else {
      setSlots(EMPTY_INITIAL_SLOTS);
    }
    setHasLoadedStoredSlots(true);
  }, [initialSlots]);

  useEffect(() => {
    return subscribeToCancelledBookings(() => {
      setSlots((current) => applyFinalCancelledSlots(current));
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

  useEffect(() => {
    if (!useDemoSlots || !hasLoadedStoredSlots || initialSlots.length > 0) {
      return;
    }

    window.localStorage.setItem(CALENDAR_STORAGE_KEY, JSON.stringify(slots));
  }, [hasLoadedStoredSlots, initialSlots.length, slots, useDemoSlots]);

  function updateInstructorAvailability(slotId: string, status: "free" | "blocked") {
    setSlots((current) => current.map((slot) => {
      if (slot.id !== slotId || (slot.status !== "free" && slot.status !== "blocked")) {
        return slot;
      }

      return {
        ...slot,
        status,
        note: status === "free" ? "Available for learner booking" : "Marked unavailable by instructor"
      };
    }));
  }

  async function saveAvailability(payload: Record<string, unknown>) {
    setAvailabilityBusy(true);
    setAvailabilityStatus("Saving availability...");

    try {
      const response = await fetch("/api/instructor-availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result?.error || result?.message || "Availability could not be saved.");
      }

      setAvailabilityStatus(result?.message || "Availability updated.");
      router.refresh();
      return result;
    } catch (error) {
      setAvailabilityStatus(error instanceof Error ? error.message : "Availability could not be saved.");
      return null;
    } finally {
      setAvailabilityBusy(false);
    }
  }

  function slotFromApi(slot: { id?: string; starts_at?: string; ends_at?: string } | null | undefined, note: string): InstructorSlot | null {
    if (!slot?.id || !slot.starts_at || !slot.ends_at) {
      return null;
    }

    const startsAt = new Date(slot.starts_at);
    const endsAt = new Date(slot.ends_at);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      return null;
    }

    return {
      id: slot.id,
      date: isoDate(startsAt.getFullYear(), startsAt.getMonth(), startsAt.getDate()),
      start: formatTimeForInput(startsAt),
      end: formatTimeForInput(endsAt),
      status: "free",
      note
    };
  }

  async function cancelLesson(slot: InstructorSlot) {
    setIsCancellingSlot(true);
    setCancelStatus("Cancelling lesson...");

    try {
      const response = await fetch("/api/bookings/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: slot.reference || slot.id,
          cancellationActor: "instructor",
          instructorName,
          lessonSummary: `${slot.date} at ${slot.start} from ${slot.pickup || "pickup not recorded"}`,
          startsAt: /^\d{2}:\d{2}$/.test(slot.start) ? `${slot.date}T${slot.start}:00+01:00` : new Date().toISOString(),
          reason: "Instructor cancelled from instructor calendar"
        })
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result?.error || result?.message || "Cancellation could not be completed.");
      }

      rememberCancelledBooking(slot.reference || slot.id, result.refundSummary);
      setSlots((current) =>
        applyFinalCancelledSlots(
          current.map((currentSlot) => {
            if (currentSlot.id !== slot.id || (currentSlot.status !== "scheduled" && currentSlot.status !== "pending")) {
              return currentSlot;
            }

            return {
              ...currentSlot,
              status: "cancelled",
              note: "Instructor cancellation confirmed. Learner email and notification hub updates have been queued."
            };
          })
        )
      );
      setPendingCancelSlot(null);
      setCancelStatus("Lesson cancelled. Learner and instructor notifications have been queued.");
    } catch (error) {
      setCancelStatus(error instanceof Error ? error.message : "Cancellation could not be completed.");
    } finally {
      setIsCancellingSlot(false);
    }
  }

  async function addFreeSlot() {
    const result = await saveAvailability({
      action: "add_slot",
      date: selectedDate,
      start: newSlotStart,
      end: newSlotEnd
    });
    const slot = slotFromApi(result?.slot, "Available for learner booking");

    if (slot) {
      setSlots((current) => applyFinalCancelledSlots([...current, slot]));
    }

    setRemoveMode(false);
  }

  async function startWorkingDay() {
    setAvailabilityStatus("Requesting live location before starting work...");
    let initialPosition: LiveGpsPoint;

    try {
      initialPosition = await requestWorkLocation();
    } catch {
      setAvailabilityStatus("Location permission is required while you are working. Allow location in your browser, then press Start work now again.");
      return;
    }

    const result = await saveAvailability({ action: "start_work" });
    const slot = slotFromApi(result?.slot, "Live working window");

    if (slot) {
      try {
        lastWorkLocationPingAtRef.current = Date.now();
        await shareWorkLocation(initialPosition, "start_work");
        startWorkLocationWatch();
      } catch (error) {
        setAvailabilityStatus(error instanceof Error ? error.message : "LDA could not update your live work location.");
      }

      setSelectedDate(slot.date);
      setDisplayMonth(displayMonthForDate(slot.date));
      setSlots((current) => applyFinalCancelledSlots([...current, slot]));
    }
  }

  async function endWorkingDay() {
    const result = await saveAvailability({ action: "end_work" });

    if (result) {
      stopWorkLocationWatch();
      const now = new Date();
      setSlots((current) =>
        current.filter((slot) => {
          if (slot.status !== "free") return true;
          const startsAt = getSlotStartsAt(slot) ? new Date(getSlotStartsAt(slot) as string) : null;
          const endsAt = getSlotEndsAt(slot) ? new Date(getSlotEndsAt(slot) as string) : null;
          return !(startsAt && endsAt && startsAt <= now && endsAt > now);
        })
      );
    }
  }

  async function removeAvailabilitySlot(slotId: string) {
    if (useDemoSlots || !/^[0-9a-f-]{36}$/i.test(slotId)) {
      setSlots((current) => current.filter((slot) => slot.id !== slotId || (slot.status !== "free" && slot.status !== "blocked")));
      return;
    }

    const result = await saveAvailability({ action: "remove_slot", slotId });
    if (result) {
      setSlots((current) => current.filter((slot) => slot.id !== slotId || (slot.status !== "free" && slot.status !== "blocked")));
    }
  }

  return (
    <main className="min-h-screen bg-white text-black">
      {pendingCancelSlot ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 px-4 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="instructor-calendar-cancel-title"
            className="relative w-full max-w-lg rounded border border-zinc-200 bg-white p-6 text-black shadow-2xl"
          >
            <button
              type="button"
              onClick={() => {
                setPendingCancelSlot(null);
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
            <h2 id="instructor-calendar-cancel-title" className="mt-4 pr-12 text-3xl font-black tracking-normal">
              Are you sure you want to cancel this lesson?
            </h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-zinc-700">
              This will cancel the lesson with <span className="font-black text-black">{pendingCancelSlot.learner || "this learner"}</span> on{" "}
              <span className="font-black text-black">{pendingCancelSlot.date} at {pendingCancelSlot.start}</span>.
            </p>
            <p className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm font-bold leading-6 text-red-950">
              LDA will treat this as an instructor cancellation and the booking status will move to cancelled.
            </p>
            {cancelStatus ? <p className="mt-4 rounded border border-zinc-200 bg-zinc-50 p-3 text-sm font-black text-zinc-800">{cancelStatus}</p> : null}
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => cancelLesson(pendingCancelSlot)}
                disabled={isCancellingSlot}
                className="lda-pill lda-pill-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                Yes, cancel lesson
              </button>
              <button
                type="button"
                onClick={() => {
                  setPendingCancelSlot(null);
                  setCancelStatus(null);
                }}
                disabled={isCancellingSlot}
                className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-black hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                No, keep lesson
              </button>
            </div>
          </section>
        </div>
      ) : null}
      <section className="border-b border-zinc-200 bg-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-red-500/60 bg-red-500/15 px-4 py-2 text-sm font-black text-red-100">
            <CalendarDays size={17} /> Instructor bookings and calendar
          </div>
          <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_340px] lg:items-end">
            <div>
              <h1 className="max-w-4xl text-5xl font-black tracking-normal sm:text-6xl">Manage bookings and availability.</h1>
              <p className="mt-4 max-w-3xl text-lg font-semibold leading-8 text-zinc-300">
                See scheduled, pending, completed, and cancelled lessons alongside free and unavailable diary time.
              </p>
            </div>
            <aside className="rounded border border-zinc-800 bg-zinc-950 p-5">
              <div className="text-sm font-black uppercase text-zinc-500">Signed in instructor</div>
              <div className="mt-2 text-2xl font-black">{instructorName}</div>
              {instructorEmail ? <div className="mt-1 text-sm font-bold text-zinc-400">{instructorEmail}</div> : null}
            </aside>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid content-start gap-5">
          <div className="grid items-start gap-3 sm:grid-cols-2 md:grid-cols-4">
            <Metric icon={CalendarDays} label="Scheduled" value={String(liveCounts.scheduled)} tone="emerald" />
            <Metric icon={Clock3} label="Pending" value={String(liveCounts.pending)} tone="amber" />
            <Metric icon={CheckCircle2} label="Completed" value={String(liveCounts.completed)} tone="sky" />
            <Metric icon={PauseCircle} label="Next lesson" value={formatNextLessonMetric(nextLesson, currentDayIso)} tone="zinc" />
          </div>
        </div>

        <aside className="grid content-start gap-5">
          <section className="rounded border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 text-xs font-black uppercase text-brand">
                  <Bell size={16} /> Messages & notifications
                </div>
                <h2 className="mt-2 text-xl font-black">Lesson-day alerts</h2>
                <p className="mt-1 text-xs font-bold leading-5 text-zinc-500">
                  Showing the latest alerts. Scroll for the rest.
                </p>
              </div>
              <Link href="/notification-hub?from=dashboard" className="rounded border border-zinc-300 px-3 py-2 text-xs font-black uppercase hover:ring-2 hover:ring-brand">
                Hub
              </Link>
            </div>
            <div className="mt-4 grid max-h-[178px] gap-2 overflow-y-auto pr-1">
              {instructorNotifications.map((notification) => (
                <article key={notification.title} className="rounded border border-zinc-200 bg-zinc-50 p-3">
                  <div className="flex items-start gap-3">
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded bg-red-50 text-brand">
                      <MessageSquareText size={16} />
                    </div>
                    <div>
                      <h3 className="text-sm font-black">{notification.title}</h3>
                      <p className="mt-1 text-xs font-semibold leading-5 text-zinc-600">{notification.detail}</p>
                      <div className="mt-1 text-[11px] font-black uppercase text-zinc-500">{notification.meta}</div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="flex min-h-0 flex-col rounded border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-black uppercase text-brand">Day planner</div>
            <h2 className="mt-2 text-2xl font-black">{new Intl.DateTimeFormat("en-GB", { dateStyle: "full" }).format(new Date(`${selectedDate}T12:00:00`))}</h2>
            <div className="mt-4 grid gap-3 rounded border border-zinc-200 bg-zinc-50 p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-black uppercase text-zinc-600">
                  Start time
                  <input
                    type="time"
                    value={newSlotStart}
                    onChange={(event) => setNewSlotStart(event.target.value)}
                    className="mt-1 w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-black text-black"
                  />
                </label>
                <label className="text-xs font-black uppercase text-zinc-600">
                  End time
                  <input
                    type="time"
                    value={newSlotEnd}
                    onChange={(event) => setNewSlotEnd(event.target.value)}
                    className="mt-1 w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-black text-black"
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
              <button type="button" onClick={addFreeSlot} disabled={availabilityBusy} className="lda-pill lda-pill-sm disabled:cursor-not-allowed disabled:opacity-60">
                <PlusCircle size={17} /> Add free slot
              </button>
              <button type="button" onClick={startWorkingDay} disabled={availabilityBusy} className="lda-pill lda-pill-sm disabled:cursor-not-allowed disabled:opacity-60">
                <CheckCircle2 size={17} /> Start work now
              </button>
              <button type="button" onClick={endWorkingDay} disabled={availabilityBusy} className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-black hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60">
                <PauseCircle size={17} /> End working day
              </button>
              <button type="button" onClick={() => setRemoveMode((current) => !current)} disabled={availabilityBusy} className={`lda-pill lda-pill-sm disabled:cursor-not-allowed disabled:opacity-60 ${removeMode ? "bg-black text-white" : ""}`}>
                <Trash2 size={17} /> Remove slot
              </button>
              </div>
            </div>
            {availabilityStatus ? (
              <p className="mt-3 rounded border border-zinc-200 bg-white p-3 text-xs font-black leading-5 text-zinc-700">
                {availabilityStatus}
              </p>
            ) : null}
            {removeMode ? (
              <p className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-xs font-black leading-5 text-red-800">
                Remove mode is on. Only free or unavailable slots can be removed; scheduled, pending, completed, and cancelled lessons stay system controlled.
              </p>
            ) : null}
            <div className="mt-5 grid min-h-0 gap-3 overflow-y-auto pr-1">
              {selectedSlots.length > 0 ? (
                selectedSlots.map((slot) => (
                  <article key={slot.id} className="rounded border border-zinc-200 bg-zinc-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-lg font-black">{slot.start} - {slot.end}</div>
                        <div className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase ${statusStyles[slot.status].className}`}>
                          {statusStyles[slot.status].label}
                        </div>
                      </div>
                      {slot.status === "free" || slot.status === "blocked" ? (
                        <select value={slot.status} onChange={(event) => updateInstructorAvailability(slot.id, event.target.value as "free" | "blocked")} className="rounded border border-zinc-300 bg-white px-2 py-2 text-sm font-bold">
                          <option value="free">Free</option>
                          <option value="blocked">Unavailable</option>
                        </select>
                      ) : (
                        <div className="rounded border border-zinc-200 bg-white px-3 py-2 text-xs font-black uppercase text-zinc-500">
                          System controlled
                        </div>
                      )}
                    </div>
                    {slot.learner ? (
                      <div className="mt-4 grid gap-2 text-sm font-bold text-zinc-700">
                        <div className="flex items-center gap-2"><UserRound size={16} className="text-brand" /> {slot.learner}</div>
                        {slot.pickup ? <div className="flex items-center gap-2"><MapPin size={16} className="text-brand" /> {slot.pickup}</div> : null}
                        {slot.reference ? <div className="font-mono text-xs text-zinc-500">{slot.reference}</div> : null}
                      </div>
                    ) : null}
                    {slot.note ? <p className="mt-3 text-sm font-semibold leading-6 text-zinc-600">{slot.note}</p> : null}
                    {removeMode && (slot.status === "free" || slot.status === "blocked") ? (
                      <button type="button" onClick={() => removeAvailabilitySlot(slot.id)} className="mt-4 inline-flex items-center gap-2 rounded border border-red-200 bg-white px-3 py-2 text-sm font-black text-red-700 hover:bg-red-50">
                        <Trash2 size={16} /> Remove this slot
                      </button>
                    ) : null}
                    {slot.status === "scheduled" || slot.status === "pending" ? (
                      <div className="mt-4 rounded border border-red-200 bg-white p-3">
                        <p className="text-xs font-bold leading-5 text-zinc-600">
                          Cancelling a confirmed lesson notifies the learner, may trigger a refund or cancellation fee review, and repeated short-notice cancellations may affect instructor account standing. Valid safety, vehicle, illness, or learner no-show reasons can be reviewed by LDA support.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setPendingCancelSlot(slot);
                            setCancelStatus(null);
                          }}
                          className="lda-pill lda-pill-sm mt-3"
                        >
                          <XCircle size={17} /> Cancel lesson
                        </button>
                      </div>
                    ) : null}
                  </article>
                ))
              ) : (
                <div className="rounded border border-zinc-200 bg-zinc-50 p-4 text-sm font-bold leading-6 text-zinc-600">
                  No slots are set for this day yet. Add a free slot or leave the day empty.
                </div>
              )}
            </div>
          </section>

        </aside>

        <section className="rounded border border-zinc-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 p-4">
            <div>
              <h2 className="text-xl font-black">{monthLabel(displayMonth)}</h2>
              <p className="mt-1 text-sm font-bold text-zinc-500">Tap a day to inspect bookings and edit availability.</p>
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
                  <div key={day} className="px-2 py-2">{day}</div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {monthCells.map((cell) => {
                  const daySlots = calendarSlots.filter((slot) => slot.date === cell.iso);
                  const counts = statusCounts(daySlots);
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
                            {counts.scheduled ? <StatusDot label={`${counts.scheduled} scheduled`} className="bg-emerald-500" /> : null}
                            {counts.pending ? <StatusDot label={`${counts.pending} pending`} className="bg-amber-500" /> : null}
                            {counts.completed ? <StatusDot label={`${counts.completed} done`} className="bg-sky-500" /> : null}
                            {counts.free ? <StatusDot label={`${counts.free} free`} className="bg-sky-500" /> : null}
                            {counts.blocked ? <StatusDot label={counts.blocked === 1 ? "day off" : `${counts.blocked} unavailable`} className="bg-zinc-500" /> : null}
                            {counts.cancelled ? <StatusDot label={`${counts.cancelled} cancelled`} className="bg-red-500" /> : null}
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
      </section>
    </main>
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
