"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, CircleAlert, LogIn, LogOut, MapPin } from "lucide-react";
import { useLiveGpsTracker } from "@/hooks/use-live-gps-tracker";
import type { LiveGpsPoint } from "@/lib/live-gps-utils";
import { publishInstructorWorkLocation, publishInstructorWorkStatus } from "@/lib/instructor-work-live-events";
import { clearCachedLiveLocation, writeCachedLiveLocation } from "@/lib/live-location-client-cache";

type InstructorStartWorkPanelProps = {
  initiallyLive: boolean;
};

const LOCATION_PREF_KEY = "lda-location-sharing-enabled";
const workLocationPingIntervalMs = 15000;

function idleLocationPreferenceIsOn() {
  try {
    return window.localStorage.getItem(LOCATION_PREF_KEY) !== "false";
  } catch {
    return true;
  }
}

async function shareWorkLocation(position: LiveGpsPoint, source: "working_day" | "log_on") {
  const response = await fetch("/api/instructor-location/live", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      latitude: position.lat,
      longitude: position.lng,
      accuracy: position.accuracy,
      heading: position.heading,
      speed: position.speed,
      source,
      clientRecordedAt: position.recordedAt
    })
  });
  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result?.error || "LDA could not update your live work location.");
  }

  return result;
}

function gpsStatusLabel(status: string) {
  switch (status) {
    case "active":
      return "sharing live";
    case "requesting":
      return "requesting permission";
    case "permission_denied":
      return "permission blocked";
    case "unavailable":
      return "unavailable";
    case "gps_lost":
      return "GPS signal lost";
    case "offline":
      return "offline, queued";
    case "stopped":
      return "stopped";
    default:
      return "ready";
  }
}

export function InstructorStartWorkPanel({ initiallyLive }: InstructorStartWorkPanelProps) {
  const [isLive, setIsLive] = useState(initiallyLive);
  const [busyAction, setBusyAction] = useState<"log_on" | "log_off" | null>(null);
  const [message, setMessage] = useState(
    initiallyLive
      ? "You are logged on. Live location is required while you are working."
      : "Press Log On when you are ready to start receiving work."
  );
  const {
    status: gpsStatus,
    error: gpsError,
    lastSentAt: gpsLastSentAt,
    requestCurrentPosition
  } = useLiveGpsTracker({
    enabled: isLive,
    source: "working_day",
    minIntervalMs: workLocationPingIntervalMs,
    minDistanceMeters: 25,
    maximumAgeMs: 0,
    onMeaningfulPoint: async (point) => {
      try {
        writeCachedLiveLocation("instructor-work", "working-day", point);
        await shareWorkLocation(point, "working_day");
        publishInstructorWorkLocation(point);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "LDA could not refresh your live work location.");
      }
    }
  });
  const gpsLastSentDisplay = gpsLastSentAt
    ? new Date(gpsLastSentAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : null;

  useEffect(() => {
    setIsLive(initiallyLive);
  }, [initiallyLive]);

  useEffect(() => {
    if (!initiallyLive) {
      return;
    }

    void requestCurrentPosition().then((point) => {
      if (!point) {
        setMessage("You are logged on, but this browser must allow location so LDA can keep your working-day location live.");
        return;
      }

      return shareWorkLocation(point, "log_on")
        .then(() => {
          publishInstructorWorkStatus(true);
          publishInstructorWorkLocation(point);
        })
        .catch(() => {
          setMessage("You are logged on, but this browser must allow location so LDA can keep your working-day location live.");
        });
    });
  }, [initiallyLive, requestCurrentPosition]);

  async function updateWorkState(action: "log_on" | "log_off") {
    setBusyAction(action);
    setMessage("");

    try {
      let initialPosition: LiveGpsPoint | null = null;

      if (action === "log_on") {
        setMessage("Requesting live location before putting you into the work pool...");
        initialPosition = await requestCurrentPosition();
        if (!initialPosition) {
          throw new Error("Location permission is required while you are logged on for work. Allow location in your browser, then press Log On again.");
        }
      }

      const response = await fetch("/api/instructor-availability", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action })
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || "LDA could not update your work status.");
      }

      const nextIsLive = Boolean(result?.isLive);
      setIsLive(nextIsLive);
      publishInstructorWorkStatus(nextIsLive);

      if (action === "log_off") {
        clearCachedLiveLocation("instructor-work", "working-day");
      }

      if (action === "log_on" && initialPosition) {
        try {
          await shareWorkLocation(initialPosition, "log_on");
          writeCachedLiveLocation("instructor-work", "working-day", initialPosition);
          publishInstructorWorkLocation(initialPosition);
        } catch {
          setMessage("You are logged on, but LDA could not refresh the map location. Keep location permission enabled and try again.");
          return;
        }
      }

      setMessage(
        result?.message ||
          (action === "log_on"
            ? "You are now logged on. Live location is active while you are working."
            : idleLocationPreferenceIsOn()
              ? "You are now logged off. You will no longer receive work, and your account location preference remains on."
              : "You are now logged off. Work live location has stopped because your account location preference is off.")
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "LDA could not update your work status.");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <section className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
      <article className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 text-sm font-black uppercase text-brand">
              {isLive ? <CheckCircle2 size={17} /> : <CircleAlert size={17} />} Start Work
            </div>
            <h2 className="mt-2 text-2xl font-black">{isLive ? "You are logged on." : "Log on when you are ready to teach."}</h2>
            <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-zinc-600">
              Log On puts you into the live booking pool and requires live location until you Log Off. Your account location preference is optional while you are not working, but LDA must be able to see your current or last known work location for operational safety.
            </p>
            <p className="mt-3 inline-flex items-start gap-2 rounded border border-red-200 bg-red-50 p-3 text-xs font-black leading-5 text-red-950">
              <MapPin className="mt-0.5 shrink-0 text-brand" size={16} />
              If location permission is blocked, you cannot go live for work until it is allowed.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => updateWorkState("log_on")}
              disabled={busyAction !== null || isLive}
              className="lda-pill lda-pill-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LogIn size={17} /> Log On
            </button>
            <button
              type="button"
              onClick={() => updateWorkState("log_off")}
              disabled={busyAction !== null || !isLive}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-zinc-300 bg-white px-5 py-2 text-sm font-black text-zinc-900 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LogOut size={17} /> Log Off
            </button>
          </div>
        </div>
        {message ? (
          <p className="mt-4 rounded border border-zinc-200 bg-zinc-50 p-3 text-sm font-bold leading-6 text-zinc-700">
            {message}
          </p>
        ) : null}
        <p className="mt-3 text-xs font-bold leading-5 text-zinc-500">
          Work GPS: {gpsStatusLabel(gpsStatus)}{gpsLastSentDisplay ? ` - last shared ${gpsLastSentDisplay}` : ""}
        </p>
        {gpsError ? (
          <p className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-xs font-black leading-5 text-red-950">
            {gpsError}
          </p>
        ) : null}
      </article>
    </section>
  );
}
