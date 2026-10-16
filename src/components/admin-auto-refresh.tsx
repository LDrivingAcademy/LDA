"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

export function AdminAutoRefresh({
  intervalMs = 60000,
  minIntervalMs = 30000,
}: {
  intervalMs?: number;
  minIntervalMs?: number;
}) {
  const router = useRouter();
  const lastRefreshAtRef = useRef(0);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible" || !document.hasFocus()) {
        return;
      }

      const now = Date.now();
      if (now - lastRefreshAtRef.current < minIntervalMs) {
        return;
      }

      lastRefreshAtRef.current = now;
      router.refresh();
    };

    const timer = window.setInterval(refresh, intervalMs);
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [intervalMs, minIntervalMs, router]);

  return null;
}
