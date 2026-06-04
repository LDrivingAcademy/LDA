"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  PauseCircle,
  PlusCircle,
  ShieldCheck,
  UserRound
} from "lucide-react";

type LessonStatus = "booked" | "pending" | "free" | "blocked";

type InstructorSlot = {
  id: string;
  date: string;
  start: string;
  end: string;
  status: LessonStatus;
  learner?: string;
  pickup?: string;
  reference?: string;
  note?: string;
};

type InstructorCalendarWorkspaceProps = {
  instructorName: string;
  instructorEmail?: string | null;
};

const initialSlots: InstructorSlot[] = [
  {
    id: "slot-1",
    date: "2026-06-08",
    start: "09:00",
    end: "10:30",
    status: "booked",
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
    status: "booked",
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
    status: "booked",
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
  booked: { label: "Booked", className: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  pending: { label: "Being booked", className: "border-amber-200 bg-amber-50 text-amber-800" },
  free: { label: "Free", className: "border-sky-200 bg-sky-50 text-sky-800" },
  blocked: { label: "Unavailable", className: "border-zinc-200 bg-zinc-100 text-zinc-700" }
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
    { booked: 0, pending: 0, free: 0, blocked: 0 } satisfies Record<LessonStatus, number>
  );
}

export function InstructorCalendarWorkspace({ instructorName, instructorEmail }: InstructorCalendarWorkspaceProps) {
  const [displayMonth, setDisplayMonth] = useState(() => new Date(2026, 5, 1));
  const [selectedDate, setSelectedDate] = useState("2026-06-08");
  const [slots, setSlots] = useState<InstructorSlot[]>(initialSlots);
  const monthCells = useMemo(() => getMonthCells(displayMonth), [displayMonth]);
  const visibleMonthPrefix = `${displayMonth.getFullYear()}-${String(displayMonth.getMonth() + 1).padStart(2, "0")}`;
  const monthSlots = slots.filter((slot) => slot.date.startsWith(visibleMonthPrefix));
  const monthCounts = statusCounts(monthSlots);
  const selectedSlots = slots.filter((slot) => slot.date === selectedDate).sort((a, b) => a.start.localeCompare(b.start));
  const totalLessonHours = monthSlots
    .filter((slot) => slot.status === "booked")
    .reduce((hours, slot) => {
      const [startHour, startMinute] = slot.start.split(":").map(Number);
      const [endHour, endMinute] = slot.end.split(":").map(Number);
      return hours + (endHour * 60 + endMinute - startHour * 60 - startMinute) / 60;
    }, 0);

  function updateSlotStatus(slotId: string, status: LessonStatus) {
    setSlots((current) => current.map((slot) => (slot.id === slotId ? { ...slot, status } : slot)));
  }

  function addFreeSlot() {
    const nextId = `slot-${Date.now()}`;
    const existing = slots.filter((slot) => slot.date === selectedDate);
    const start = existing.length > 0 ? "17:30" : "09:00";
    const end = existing.length > 0 ? "19:00" : "10:30";

    setSlots((current) => [
      ...current,
      {
        id: nextId,
        date: selectedDate,
        start,
        end,
        status: "free",
        note: "New availability slot"
      }
    ]);
  }

  return (
    <main className="min-h-screen bg-white text-black">
      <section className="border-b border-zinc-200 bg-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-red-500/60 bg-red-500/15 px-4 py-2 text-sm font-black text-red-100">
            <CalendarDays size={17} /> Instructor bookings and calendar
          </div>
          <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_340px] lg:items-end">
            <div>
              <h1 className="max-w-4xl text-5xl font-black tracking-normal sm:text-6xl">Plan your LDA work around your own time.</h1>
              <p className="mt-4 max-w-3xl text-lg font-semibold leading-8 text-zinc-300">
                View booked lessons, open availability, checkout holds, and unavailable time before accepting more learner demand.
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

      <section className="mx-auto grid max-w-7xl gap-5 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_380px] lg:px-8">
        <div className="grid gap-5">
          <div className="grid gap-3 md:grid-cols-4">
            <Metric icon={CheckCircle2} label="Booked" value={String(monthCounts.booked)} tone="emerald" />
            <Metric icon={Clock3} label="Being booked" value={String(monthCounts.pending)} tone="amber" />
            <Metric icon={PlusCircle} label="Free slots" value={String(monthCounts.free)} tone="sky" />
            <Metric icon={PauseCircle} label="Lesson hours" value={totalLessonHours.toFixed(1)} tone="zinc" />
          </div>

          <section className="rounded border border-zinc-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 p-4">
              <div>
                <h2 className="text-2xl font-black">{monthLabel(displayMonth)}</h2>
                <p className="mt-1 text-sm font-bold text-zinc-500">Tap a day to inspect bookings and edit availability.</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setDisplayMonth((current) => addMonths(current, -1))} className="grid h-10 w-10 place-items-center rounded border border-zinc-300 hover:ring-2 hover:ring-brand" aria-label="Previous month">
                  <ChevronLeft size={18} />
                </button>
                <button type="button" onClick={() => setDisplayMonth((current) => addMonths(current, 1))} className="grid h-10 w-10 place-items-center rounded border border-zinc-300 hover:ring-2 hover:ring-brand" aria-label="Next month">
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50 text-center text-xs font-black uppercase text-zinc-500">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                <div key={day} className="px-2 py-3">{day}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {monthCells.map((cell) => {
                const daySlots = slots.filter((slot) => slot.date === cell.iso);
                const counts = statusCounts(daySlots);
                const isSelected = cell.iso === selectedDate;

                return (
                  <button
                    key={cell.iso}
                    type="button"
                    disabled={!cell.day}
                    onClick={() => cell.day && setSelectedDate(cell.iso)}
                    className={`min-h-28 border-b border-r border-zinc-200 p-2 text-left transition ${isSelected ? "bg-red-50 ring-2 ring-inset ring-brand" : cell.day ? "bg-white hover:bg-zinc-50" : "bg-zinc-50"}`}
                  >
                    {cell.day ? (
                      <>
                        <div className="text-sm font-black">{cell.day}</div>
                        <div className="mt-3 grid gap-1">
                          {counts.booked ? <StatusDot label={`${counts.booked} booked`} className="bg-emerald-500" /> : null}
                          {counts.pending ? <StatusDot label={`${counts.pending} holding`} className="bg-amber-500" /> : null}
                          {counts.free ? <StatusDot label={`${counts.free} free`} className="bg-sky-500" /> : null}
                          {counts.blocked ? <StatusDot label={`${counts.blocked} off`} className="bg-zinc-500" /> : null}
                        </div>
                      </>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="grid content-start gap-5">
          <section className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-black uppercase text-brand">Day planner</div>
            <h2 className="mt-2 text-2xl font-black">{new Intl.DateTimeFormat("en-GB", { dateStyle: "full" }).format(new Date(`${selectedDate}T12:00:00`))}</h2>
            <button type="button" onClick={addFreeSlot} className="lda-pill lda-pill-sm mt-4">
              <PlusCircle size={17} /> Add free slot
            </button>
            <div className="mt-5 grid gap-3">
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
                      <select value={slot.status} onChange={(event) => updateSlotStatus(slot.id, event.target.value as LessonStatus)} className="rounded border border-zinc-300 bg-white px-2 py-2 text-sm font-bold">
                        <option value="free">Free</option>
                        <option value="pending">Being booked</option>
                        <option value="booked">Booked</option>
                        <option value="blocked">Unavailable</option>
                      </select>
                    </div>
                    {slot.learner ? (
                      <div className="mt-4 grid gap-2 text-sm font-bold text-zinc-700">
                        <div className="flex items-center gap-2"><UserRound size={16} className="text-brand" /> {slot.learner}</div>
                        {slot.pickup ? <div className="flex items-center gap-2"><MapPin size={16} className="text-brand" /> {slot.pickup}</div> : null}
                        {slot.reference ? <div className="font-mono text-xs text-zinc-500">{slot.reference}</div> : null}
                      </div>
                    ) : null}
                    {slot.note ? <p className="mt-3 text-sm font-semibold leading-6 text-zinc-600">{slot.note}</p> : null}
                  </article>
                ))
              ) : (
                <div className="rounded border border-zinc-200 bg-zinc-50 p-4 text-sm font-bold leading-6 text-zinc-600">
                  No slots are set for this day yet. Add a free slot or leave the day empty.
                </div>
              )}
            </div>
          </section>

          <section className="rounded border border-zinc-200 bg-zinc-950 p-5 text-white shadow-sm">
            <ShieldCheck className="text-brand" />
            <h2 className="mt-3 text-2xl font-black">Flexible working controls</h2>
            <div className="mt-4 grid gap-3 text-sm font-bold leading-6 text-zinc-300">
              <p>Free slots can be made visible to learners.</p>
              <p>Being booked means a learner has started checkout and the slot should not be double-booked.</p>
              <p>Unavailable keeps personal time, school runs, breaks, and admin time out of learner search.</p>
            </div>
          </section>
        </aside>
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
    <article className="rounded border border-zinc-200 bg-white p-4 shadow-sm">
      <div className={`grid h-11 w-11 place-items-center rounded ${toneClass}`}>
        <Icon size={22} />
      </div>
      <div className="mt-4 text-3xl font-black">{value}</div>
      <div className="mt-1 text-sm font-black uppercase text-zinc-500">{label}</div>
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
