"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

type ScheduledLessonDatePlannerProps = {
  initialDate?: string | null;
  from?: string;
  courseId?: string | null;
  courseTitle?: string | null;
};

function addDaysIso(days: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function parseIsoDay(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;

  const date = new Date(year, month - 1, day);
  date.setHours(12, 0, 0, 0);
  return date;
}

function isoFromDate(value: Date) {
  const copy = new Date(value);
  copy.setHours(12, 0, 0, 0);
  return copy.toISOString().slice(0, 10);
}

function addMonths(value: Date, months: number) {
  const date = new Date(value);
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  date.setHours(12, 0, 0, 0);
  return date;
}

function formatMonth(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric"
  }).format(value);
}

function formatDate(value: string) {
  const date = parseIsoDay(value);
  if (!date) return value;

  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(date);
}

function getMonthCells(monthDate: Date) {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  first.setHours(12, 0, 0, 0);
  const firstWeekday = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - firstWeekday);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    date.setHours(12, 0, 0, 0);

    return {
      day: date.getDate(),
      iso: isoFromDate(date),
      inMonth: date.getMonth() === monthDate.getMonth()
    };
  });
}

function normaliseInitialDate(value: string | null | undefined, minDate: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return minDate;
  return value >= minDate ? value : minDate;
}

export function ScheduledLessonDatePlanner({ initialDate, from = "learner-dashboard", courseId, courseTitle }: ScheduledLessonDatePlannerProps) {
  const minDate = useMemo(() => addDaysIso(2), []);
  const currentDayIso = useMemo(() => addDaysIso(0), []);
  const [selectedDate, setSelectedDate] = useState(() => normaliseInitialDate(initialDate, minDate));
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const date = parseIsoDay(normaliseInitialDate(initialDate, minDate)) ?? new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });
  const cells = useMemo(() => getMonthCells(visibleMonth), [visibleMonth]);
  const selectedLabel = formatDate(selectedDate);
  const findInstructorHref = `/scheduled-lessons?from=${encodeURIComponent(from)}&date=${encodeURIComponent(selectedDate)}${courseId ? `&course=${encodeURIComponent(courseId)}` : ""}#scheduled-lessons-booking`;

  return (
    <section id="scheduled-lessons-calendar" className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
      <div className="rounded border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-black uppercase text-brand">
              <CalendarDays size={18} /> Scheduled lesson calendar
            </div>
            <h2 className="mt-2 text-3xl font-black tracking-normal">Pick the day you want to schedule.</h2>
            <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-zinc-600">
              Choose a future date first. Once you press Find instructor, LDA opens the search filters with that date selected so you can compare matching instructors.
              {courseTitle ? ` Your selected package is ${courseTitle}.` : ""}
            </p>
          </div>
          <div className="rounded border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-black text-zinc-800">
            Selected: {selectedLabel}
          </div>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_320px]">
          <section className="rounded border border-zinc-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 p-4">
              <div>
                <h3 className="text-xl font-black">{formatMonth(visibleMonth)}</h3>
                <p className="mt-1 text-sm font-bold text-zinc-500">Tap a date to choose your scheduled lesson day.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setVisibleMonth((current) => addMonths(current, -1))}
                  className="grid h-9 w-9 place-items-center rounded border border-zinc-300 hover:ring-2 hover:ring-brand"
                  aria-label="Previous month"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => setVisibleMonth((current) => addMonths(current, 1))}
                  className="grid h-9 w-9 place-items-center rounded border border-zinc-300 hover:ring-2 hover:ring-brand"
                  aria-label="Next month"
                >
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
                  {cells.map((cell) => {
                    const disabled = cell.iso < minDate;
                    const active = cell.iso === selectedDate;
                    const isToday = cell.iso === currentDayIso;

                    return (
                      <button
                        key={cell.iso}
                        type="button"
                        disabled={disabled}
                        onClick={() => setSelectedDate(cell.iso)}
                        aria-pressed={active}
                        className={`min-h-20 border-b border-r border-zinc-200 p-2 text-left transition sm:min-h-24 ${
                          isToday
                            ? "bg-sky-50 ring-2 ring-inset ring-sky-500 hover:bg-sky-50"
                            : active
                              ? "bg-red-50 ring-2 ring-inset ring-brand"
                              : cell.inMonth
                                ? "bg-white hover:bg-zinc-50"
                                : "bg-zinc-50 text-zinc-400"
                        } ${disabled ? "cursor-not-allowed text-zinc-300" : "text-zinc-900"}`}
                      >
                        <div className={`text-sm font-black ${isToday ? "text-sky-800" : ""}`}>{cell.day}</div>
                        <div className="mt-2 grid gap-1 text-[11px] font-black leading-4">
                          {active ? (
                            <span className="inline-flex items-center gap-1.5 text-brand">
                              <span className="h-2 w-2 rounded-full bg-brand" />
                              Selected
                            </span>
                          ) : null}
                          {cell.iso === minDate ? (
                            <span className={active ? "text-brand" : "text-zinc-500"}>First available</span>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          <aside className="rounded border border-red-200 bg-red-50 p-5">
            <div className="text-sm font-black uppercase text-brand">Advance scheduling terms</div>
            <h3 className="mt-2 text-2xl font-black">{courseTitle ?? "Scheduled lesson"}</h3>
            <p className="mt-3 text-sm font-semibold leading-6 text-red-950">
              Scheduled bookings reserve instructor diary time in advance. The booking flow will mark this as a scheduled lesson and add it to the learner calendar after checkout.
              {courseTitle ? " LDA will prioritise instructors who can cover the full package plan." : ""}
            </p>
            <Link href={findInstructorHref} className="lda-pill mt-5 w-full justify-center">
              Find instructor
            </Link>
          </aside>
        </div>
      </div>
    </section>
  );
}
