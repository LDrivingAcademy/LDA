"use client";

import { useEffect, useState } from "react";
import { readStoredJsonOrNull } from "@/lib/browser-storage";

const preferenceList = [
  ["lessonUpdates", "Lesson confirmations and changes"],
  ["driverEnRoute", "Instructor en route alerts"],
  ["driverArrived", "Instructor has arrived"],
  ["cancellationUpdates", "Cancellation and refund updates"],
  ["afterLessonRevision", "After lesson revision notes"],
  ["offers", "Deals, free trials, and learner offers"]
] as const;

type NotificationPrefs = Record<(typeof preferenceList)[number][0], boolean>;

type AccountNotification = {
  id: string;
  notification_type: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

const defaultPrefs: NotificationPrefs = {
  lessonUpdates: true,
  driverEnRoute: true,
  driverArrived: true,
  cancellationUpdates: true,
  afterLessonRevision: true,
  offers: false
};

export function NotificationHubPanel({
  initialNotifications = [],
  loadError = null
}: {
  initialNotifications?: AccountNotification[];
  loadError?: string | null;
}) {
  const [prefs, setPrefs] = useState(defaultPrefs);

  useEffect(() => {
    const stored = readStoredJsonOrNull<Partial<NotificationPrefs>>("lda-notification-preferences");
    if (stored) {
      setPrefs({ ...defaultPrefs, ...stored });
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("lda-notification-preferences", JSON.stringify(prefs));
  }, [prefs]);

  return (
    <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 rounded border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-black">Your account notifications</h2>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-zinc-600">
          Booking confirmations, instructor alerts, calendar updates, and account security messages appear here.
        </p>
        {loadError ? (
          <div className="mt-5 rounded border border-red-200 bg-red-50 p-4 text-sm font-black text-red-700">{loadError}</div>
        ) : null}
        <div className="mt-6 space-y-3">
          {initialNotifications.length > 0 ? (
            initialNotifications.map((notification) => (
              <article key={notification.id} className="rounded border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-black text-zinc-950">{notification.title}</p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-zinc-700">{notification.body}</p>
                  </div>
                  <div className="text-right">
                    {!notification.read_at ? (
                      <span className="inline-flex rounded-full bg-red-600 px-3 py-1 text-xs font-black uppercase text-white">New</span>
                    ) : null}
                    <p className="mt-2 text-xs font-black uppercase text-zinc-500">
                      {new Date(notification.created_at).toLocaleString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </p>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded border border-zinc-200 bg-zinc-50 p-4 text-sm font-black text-zinc-700">
              No account notifications yet. Booking confirmations and instructor alerts will appear here.
            </div>
          )}
        </div>
      </div>
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
