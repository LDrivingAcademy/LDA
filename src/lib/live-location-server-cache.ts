import "server-only";

type CacheEntry<T> = {
  expiresAtMs: number;
  value: T;
};

const liveLocationCache = new Map<string, CacheEntry<unknown>>();

export function readLiveLocationServerCache<T>(key: string, nowMs = Date.now()): T | null {
  const entry = liveLocationCache.get(key);
  if (!entry) return null;

  if (entry.expiresAtMs <= nowMs) {
    liveLocationCache.delete(key);
    return null;
  }

  return entry.value as T;
}

export function writeLiveLocationServerCache<T>(key: string, value: T, ttlMs = 3000) {
  liveLocationCache.set(key, {
    value,
    expiresAtMs: Date.now() + ttlMs
  });
}
