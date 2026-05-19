export function readStoredJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;

  try {
    const stored = window.localStorage.getItem(key);
    if (!stored) return fallback;
    return JSON.parse(stored) as T;
  } catch {
    window.localStorage.removeItem(key);
    return fallback;
  }
}

export function readStoredJsonOrNull<T>(key: string): T | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = window.localStorage.getItem(key);
    if (!stored) return null;
    return JSON.parse(stored) as T;
  } catch {
    window.localStorage.removeItem(key);
    return null;
  }
}
