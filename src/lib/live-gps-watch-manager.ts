"use client";

import {
  type LiveGpsPoint,
  normaliseGpsAccuracy,
  normaliseGpsCoordinate,
  normaliseGpsHeading,
  normaliseGpsSpeed,
  parseGpsRecordedAt
} from "@/lib/live-gps-utils";

type WatchOptions = {
  source: string;
  enableHighAccuracy?: boolean;
  maximumAge?: number;
  timeout?: number;
};

type Subscriber = {
  onPoint: (point: LiveGpsPoint) => void;
  onError: (error: GeolocationPositionError) => void;
};

type SharedWatcher = {
  watchId: number;
  subscribers: Set<Subscriber>;
};

const watchers = new Map<string, SharedWatcher>();
const latestPoints = new Map<string, LiveGpsPoint>();

function watcherKey(options: Required<WatchOptions>) {
  return `${options.source}:${options.enableHighAccuracy ? "high" : "balanced"}:${options.maximumAge}:${options.timeout}`;
}

function normaliseOptions(options: WatchOptions): Required<WatchOptions> {
  return {
    source: options.source,
    enableHighAccuracy: options.enableHighAccuracy ?? true,
    maximumAge: options.maximumAge ?? 2500,
    timeout: options.timeout ?? 15000
  };
}

export function pointFromGeolocationPosition(position: GeolocationPosition, source: string): LiveGpsPoint | null {
  const lat = normaliseGpsCoordinate(position.coords.latitude, "lat");
  const lng = normaliseGpsCoordinate(position.coords.longitude, "lng");
  if (lat === null || lng === null) return null;

  return {
    lat,
    lng,
    accuracy: normaliseGpsAccuracy(position.coords.accuracy),
    heading: normaliseGpsHeading(position.coords.heading),
    speed: normaliseGpsSpeed(position.coords.speed),
    recordedAt: parseGpsRecordedAt(position.timestamp),
    source
  };
}

export function getCachedGpsPoint(source: string, maxAgeMs = 120000, nowMs = Date.now()) {
  const point = latestPoints.get(source);
  if (!point) return null;

  const recordedAtMs = new Date(point.recordedAt).getTime();
  if (!Number.isFinite(recordedAtMs) || nowMs - recordedAtMs > maxAgeMs) {
    latestPoints.delete(source);
    return null;
  }

  return point;
}

export function requestFreshGpsPoint(options: WatchOptions) {
  const nextOptions = normaliseOptions(options);

  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve(null);
  }

  return new Promise<LiveGpsPoint | null>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point = pointFromGeolocationPosition(position, nextOptions.source);
        if (point) latestPoints.set(nextOptions.source, point);
        resolve(point);
      },
      () => resolve(null),
      {
        enableHighAccuracy: nextOptions.enableHighAccuracy,
        maximumAge: nextOptions.maximumAge,
        timeout: nextOptions.timeout
      }
    );
  });
}

export function subscribeLiveGps(options: WatchOptions, subscriber: Subscriber) {
  const nextOptions = normaliseOptions(options);

  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return () => undefined;
  }

  const key = watcherKey(nextOptions);
  const existing = watchers.get(key);
  if (existing) {
    existing.subscribers.add(subscriber);
    return () => unsubscribeLiveGps(key, subscriber);
  }

  const subscribers = new Set<Subscriber>([subscriber]);
  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      const point = pointFromGeolocationPosition(position, nextOptions.source);
      if (!point) return;

      latestPoints.set(nextOptions.source, point);
      subscribers.forEach((entry) => entry.onPoint(point));
    },
    (error) => {
      subscribers.forEach((entry) => entry.onError(error));
    },
    {
      enableHighAccuracy: nextOptions.enableHighAccuracy,
      maximumAge: nextOptions.maximumAge,
      timeout: nextOptions.timeout
    }
  );

  watchers.set(key, {
    watchId,
    subscribers
  });

  return () => unsubscribeLiveGps(key, subscriber);
}

function unsubscribeLiveGps(key: string, subscriber: Subscriber) {
  const watcher = watchers.get(key);
  if (!watcher) return;

  watcher.subscribers.delete(subscriber);
  if (watcher.subscribers.size > 0) return;

  if (typeof navigator !== "undefined" && navigator.geolocation) {
    navigator.geolocation.clearWatch(watcher.watchId);
  }
  watchers.delete(key);
}
