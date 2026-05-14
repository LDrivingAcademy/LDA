"use client";

import { useEffect, useState } from "react";

const preferenceList = [
  ["lessonUpdates", "Lesson confirmations and changes"],
  ["driverEnRoute", "Instructor en route alerts"],
  ["driverArrived", "Instructor has arrived"],
  ["cancellationUpdates", "Cancellation and refund updates"],
  ["afterLessonRevision", "After lesson revision notes"],
  ["offers", "Deals, free trials, and learner offers"]
] as const;

type NotificationPrefs = Record<(typeof preferenceList)[number][0], boolean>;

const defaultPrefs: NotificationPrefs = {
  lessonUpdates: true,
  driverEnRoute: true,
  driverArrived: true,
  cancellationUpdates: true,
  afterLessonRevision: true,
  offers: false
};

export function NotificationHubPanel() {
  const [prefs, setPrefs] = useState(defaultPrefs);

  useEffect(() => {
    const stored = localStorage.getItem("lda-notification-preferences");
    if (stored) {
      setPrefs({ ...defaultPrefs, ...JSON.parse(stored) });
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("lda-notification-preferences", JSON.stringify(prefs));
  }, [prefs]);

  return (
    <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-black">Choose your LDA notifications</h2>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-zinc-600">
          Control which service and learner updates LDA can send. Critical payment, safety, or legal messages may still be sent where required.
        </p>
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {preferenceList.map(([key, label]) => (
            <label key={key} className="flex items-center justify-between gap-4 rounded border border-zinc-200 bg-zinc-50 p-4 text-sm font-black text-zinc-800">
              <span>{label}</span>
              <input
                type="checkbox"
                checked={prefs[key]}
                onChange={(event) => setPrefs((current) => ({ ...current, [key]: event.target.checked }))}
                className="h-5 w-5 accent-red-600"
              />
            </label>
          ))}
        </div>
      </div>
    </section>
  );
}
