"use client";

import type { LiveGpsPoint } from "@/lib/live-gps-utils";

export type CachedLiveLocation = LiveGpsPoint & {
  expiresAtMs: number;
};

const CACHE_PREFIX = "lda-live-location";
const DEFAULT_TTL_MS = 120000;

export function liveLocationCacheKey(scope: string, id: string) {
  return `${CACHE_PREFIX}:${scope}:${id}`;
}

function readStorage() {
  if (typeof window === "undefined") return null;

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function readCachedLiveLocation(scope: string, id: string, nowMs = Date.now()): LiveGpsPoint | null {
  const storage = readStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(liveLocationCacheKey(scope, id));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<CachedLiveLocation>;
    if (
      typeof parsed.lat !== "number" ||
      typeof parsed.lng !== "number" ||
      typeof parsed.recordedAt !== "string" ||
      typeof parsed.expiresAtMs !== "number" ||
      parsed.expiresAtMs <= nowMs
    ) {
      storage.removeItem(liveLocationCacheKey(scope, id));
      return null;
    }

    return {
      lat: parsed.lat,
      lng: parsed.lng,
      accuracy: typeof parsed.accuracy === "number" ? parsed.accuracy : null,
      heading: typeof parsed.heading === "number" ? parsed.heading : null,
      speed: typeof parsed.speed === "number" ? parsed.speed : null,
      recordedAt: parsed.recordedAt,
      source: typeof parsed.source === "string" ? parsed.source : "short_live_cache"
    };
  } catch {
    return null;
  }
}

export function writeCachedLiveLocation(scope: string, id: string, point: LiveGpsPoint | null | undefined, ttlMs = DEFAULT_TTL_MS) {
  const storage = readStorage();
  if (!storage || !point) return;

  try {
    const cached: CachedLiveLocation = {
      ...point,
      expiresAtMs: Date.now() + ttlMs
    };
    storage.setItem(liveLocationCacheKey(scope, id), JSON.stringify(cached));
  } catch {
    // Storage can be unavailable in private browsing or constrained embedded views.
  }
}

export function clearCachedLiveLocation(scope: string, id: string) {
  const storage = readStorage();
  if (!storage) return;

  try {
    storage.removeItem(liveLocationCacheKey(scope, id));
  } catch {
    // Storage can be unavailable in private browsing or constrained embedded views.
  }
}
