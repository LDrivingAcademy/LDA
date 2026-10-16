"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ClipboardCheck, X } from "lucide-react";

export type InstructorProgressReminderLesson = {
  bookingReference: string;
  learnerName: string;
  startsAt: string;
  endsAt: string;
};

const dismissedReminderPrefix = "lda-progress-reminder-dismissed:";

function formatLessonWindow(startsAt: string, endsAt: string) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "This lesson has finished.";
  }

  return `${start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} to ${end.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

export function InstructorLessonProgressReminder({ lesson }: { lesson: InstructorProgressReminderLesson | null }) {
  const [isVisible, setIsVisible] = useState(false);
  const storageKey = lesson ? `${dismissedReminderPrefix}${lesson.bookingReference}` : "";
  const progressHref = lesson ? `/progress-tracker?from=dashboard&booking=${encodeURIComponent(lesson.bookingReference)}` : "/progress-tracker?from=dashboard";
  const lessonWindow = useMemo(() => (lesson ? formatLessonWindow(lesson.startsAt, lesson.endsAt) : ""), [lesson]);

  useEffect(() => {
    if (!lesson) {
      setIsVisible(false);
      return;
    }

    const lessonEnd = new Date(lesson.endsAt).getTime();
    if (Number.isNaN(lessonEnd) || lessonEnd > Date.now()) {
      setIsVisible(false);
      return;
    }

    try {
      if (window.localStorage.getItem(storageKey)) {
        setIsVisible(false);
        return;
      }
    } catch {
      // Keep the reminder visible if localStorage is blocked.
    }

    setIsVisible(true);
  }, [lesson, storageKey]);

  if (!lesson || !isVisible) {
    return null;
  }

  function dismissReminder() {
    try {
      window.localStorage.setItem(storageKey, new Date().toISOString());
    } catch {
      // No-op: dismiss in memory if localStorage is blocked.
    }
    setIsVisible(false);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4 py-8">
      <section className="w-full max-w-lg rounded border border-zinc-200 bg-white p-6 text-black shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded bg-red-50 text-brand">
            <ClipboardCheck size={24} />
          </div>
          <button
            type="button"
            onClick={dismissReminder}
            className="grid h-10 w-10 shrink-0 place-items-center rounded border border-zinc-200 text-zinc-600 hover:bg-zinc-100"
            aria-label="Dismiss learner progress reminder"
          >
            <X size={18} />
          </button>
        </div>
        <div className="mt-5 text-sm font-black uppercase text-brand">Lesson finished</div>
        <h2 className="mt-2 text-3xl font-black tracking-normal">Fill in learner progress notes.</h2>
        <p className="mt-3 text-base font-semibold leading-7 text-zinc-700">
          {lesson.learnerName}'s lesson from {lessonWindow} has finished. Add progress notes now so the learner record stays up to date.
        </p>
        <div className="mt-4 rounded border border-zinc-200 bg-zinc-50 p-3 text-sm font-bold text-zinc-700">
          Lesson reference: <span className="font-black text-black">{lesson.bookingReference}</span>
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link href={progressHref} onClick={dismissReminder} className="lda-pill justify-center">
            Open progress notes
          </Link>
          <button type="button" onClick={dismissReminder} className="rounded-full border border-zinc-300 px-5 py-3 text-sm font-black text-zinc-700 hover:bg-zinc-100">
            Remind me later
          </button>
        </div>
      </section>
    </div>
  );
}
