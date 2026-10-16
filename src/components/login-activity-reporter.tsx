"use client";

import { useEffect } from "react";

const LOCATION_PREF_KEY = "lda-location-sharing-enabled";
const ACTIVITY_RECORDED_AT_KEY = "lda_login_activity_recorded_at";

function getBrowserName(userAgent: string) {
  if (/Edg\//i.test(userAgent)) return "Microsoft Edge";
  if (/CriOS|Chrome\//i.test(userAgent) && !/Edg\//i.test(userAgent)) return "Chrome";
  if (/Firefox\//i.test(userAgent)) return "Firefox";
  if (/Safari\//i.test(userAgent) && !/Chrome\//i.test(userAgent)) return "Safari";
  if (/SamsungBrowser/i.test(userAgent)) return "Samsung Internet";
  return "Browser";
}

function getDeviceLabel() {
  const userAgent = navigator.userAgent;
  const platform = navigator.platform;
  const maxTouchPoints = navigator.maxTouchPoints || 0;

  if (/iPad/i.test(userAgent) || (platform === "MacIntel" && maxTouchPoints > 1)) return "iPad";
  if (/iPhone/i.test(userAgent)) return "iPhone";
  if (/Android/i.test(userAgent) && /Mobile/i.test(userAgent)) return "Android phone";
  if (/Android/i.test(userAgent)) return "Android tablet";
  if (/Windows/i.test(userAgent)) return /Mobile|Tablet|Touch/i.test(userAgent) ? "Windows tablet" : "Windows PC";
  if (/Macintosh|Mac OS X/i.test(userAgent)) return "MacBook or iMac";
  if (/Linux/i.test(userAgent)) return "Linux computer";
  return "Unknown device";
}

function getBrowserLocation() {
  if (localStorage.getItem(LOCATION_PREF_KEY) === "false" || !navigator.geolocation) {
    return Promise.resolve({});
  }

  return new Promise<Record<string, number>>((resolve) => {
    const timeout = window.setTimeout(() => resolve({}), 8000);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        window.clearTimeout(timeout);
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
      },
      () => {
        window.clearTimeout(timeout);
        resolve({});
      },
      { enableHighAccuracy: false, maximumAge: 5 * 60 * 1000, timeout: 7000 }
    );
  });
}

export function LoginActivityReporter({ shouldRecord }: { shouldRecord: boolean }) {
  useEffect(() => {
    if (!shouldRecord) return;

    const lastRecordedAt = Number(sessionStorage.getItem(ACTIVITY_RECORDED_AT_KEY) ?? 0);
    if (lastRecordedAt && Date.now() - lastRecordedAt < 10 * 60 * 1000) {
      return;
    }

    let cancelled = false;

    async function record() {
      const location = await getBrowserLocation();
      if (cancelled) return;

      await fetch("/api/login-activities/record", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceLabel: getDeviceLabel(),
          browserName: getBrowserName(navigator.userAgent),
          ...location
        }),
        keepalive: true
      })
        .then((response) => {
          if (response.ok) {
            sessionStorage.setItem(ACTIVITY_RECORDED_AT_KEY, String(Date.now()));
          }
        })
        .catch(() => undefined);
    }

    void record();

    return () => {
      cancelled = true;
    };
  }, [shouldRecord]);

  return null;
}
