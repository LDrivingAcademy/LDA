"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  type LiveGpsPoint,
  type SentLiveGpsPoint,
  shouldSendLiveGpsUpdate,
  smoothGpsPoint,
} from "@/lib/live-gps-utils";
import { getCachedGpsPoint, requestFreshGpsPoint, subscribeLiveGps } from "@/lib/live-gps-watch-manager";

export type LiveGpsTrackerStatus =
  | "idle"
  | "requesting"
  | "active"
  | "permission_denied"
  | "unavailable"
  | "gps_lost"
  | "offline"
  | "stopped";

type UseLiveGpsTrackerOptions = {
  enabled: boolean;
  source?: string;
  minIntervalMs?: number;
  minDistanceMeters?: number;
  maximumAgeMs?: number;
  timeoutMs?: number;
  onMeaningfulPoint?: (point: LiveGpsPoint) => void | Promise<void>;
};

export function useLiveGpsTracker({
  enabled,
  source = "browser_geolocation",
  minIntervalMs = 3000,
  minDistanceMeters = 10,
  maximumAgeMs = 0,
  timeoutMs = 15000,
  onMeaningfulPoint,
}: UseLiveGpsTrackerOptions) {
  const unsubscribeWatchRef = useRef<(() => void) | null>(null);
  const smoothedPointRef = useRef<LiveGpsPoint | null>(null);
  const lastSentPointRef = useRef<SentLiveGpsPoint | null>(null);
  const queuedPointRef = useRef<LiveGpsPoint | null>(null);
  const callbackRef = useRef<typeof onMeaningfulPoint>(onMeaningfulPoint);
  const [status, setStatus] = useState<LiveGpsTrackerStatus>("idle");
  const [latestPoint, setLatestPoint] = useState<LiveGpsPoint | null>(null);
  const [lastSentAt, setLastSentAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    callbackRef.current = onMeaningfulPoint;
  }, [onMeaningfulPoint]);

  const publishPoint = useCallback((point: LiveGpsPoint) => {
    const nowMs = Date.now();
    if (
      !shouldSendLiveGpsUpdate({
        previousSent: lastSentPointRef.current,
        current: point,
        nowMs,
        minIntervalMs,
        minDistanceMeters,
      })
    ) {
      return;
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      queuedPointRef.current = point;
      setStatus("offline");
      return;
    }

    lastSentPointRef.current = { ...point, sentAtMs: nowMs };
    setLastSentAt(new Date(nowMs).toISOString());
    void callbackRef.current?.(point);
  }, [minDistanceMeters, minIntervalMs]);

  const handlePoint = useCallback((point: LiveGpsPoint) => {
    const smoothedPoint = smoothGpsPoint(smoothedPointRef.current, point);
    smoothedPointRef.current = smoothedPoint;
    setLatestPoint(smoothedPoint);
    setStatus("active");
    setError(null);
    publishPoint(smoothedPoint);
  }, [publishPoint]);

  const requestCurrentPosition = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unavailable");
      return Promise.resolve(null);
    }

    setStatus("requesting");
    return requestFreshGpsPoint({ source, enableHighAccuracy: true, maximumAge: maximumAgeMs, timeout: timeoutMs }).then((rawPoint) => {
      const smoothedPoint = rawPoint ? smoothGpsPoint(smoothedPointRef.current, rawPoint) : null;
      if (smoothedPoint) {
        smoothedPointRef.current = smoothedPoint;
        setLatestPoint(smoothedPoint);
        setStatus("active");
        setError(null);
      } else {
        setStatus("gps_lost");
        setError("Live location is not available.");
      }
      return smoothedPoint;
    });
  }, [maximumAgeMs, source, timeoutMs]);

  useEffect(() => {
    if (!enabled) {
      unsubscribeWatchRef.current?.();
      unsubscribeWatchRef.current = null;
      setStatus("stopped");
      return;
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unavailable");
      setError("This browser does not support live location.");
      return;
    }

    setStatus("requesting");
    const cachedPoint = getCachedGpsPoint(source);
    if (cachedPoint) {
      handlePoint(cachedPoint);
    }

    unsubscribeWatchRef.current = subscribeLiveGps(
      { source, enableHighAccuracy: true, maximumAge: maximumAgeMs, timeout: timeoutMs },
      {
        onPoint: handlePoint,
        onError: (gpsError) => {
        setStatus(gpsError.code === gpsError.PERMISSION_DENIED ? "permission_denied" : "gps_lost");
        setError(gpsError.message || "Live location signal was interrupted.");
        }
      }
    );

    return () => {
      unsubscribeWatchRef.current?.();
      unsubscribeWatchRef.current = null;
    };
  }, [enabled, handlePoint, maximumAgeMs, source, timeoutMs]);

  useEffect(() => {
    const handleOffline = () => setStatus("offline");
    const handleOnline = () => {
      const queuedPoint = queuedPointRef.current;
      queuedPointRef.current = null;
      if (queuedPoint) publishPoint(queuedPoint);
      else if (enabled) setStatus("active");
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [enabled, publishPoint]);

  return {
    status,
    latestPoint,
    lastSentAt,
    error,
    requestCurrentPosition,
  };
}
