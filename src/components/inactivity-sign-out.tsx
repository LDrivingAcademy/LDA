"use client";

import { useEffect, useRef } from "react";

const INACTIVITY_LIMIT_MS = 30 * 60 * 1000;
const LAST_ACTIVITY_KEY = "lda:last-activity-at";
const EXCLUDED_PATHS = new Set([
  "/auth/login",
  "/auth/sign-up",
  "/auth/forgot-password",
  "/auth/update-password",
  "/auth/callback",
  "/auth/confirm"
]);
const SIGN_OUT_MESSAGE =
  "For your data protection, LDA signed you out after 30 minutes of inactivity.";

export function InactivitySignOut({ enabled }: { enabled: boolean }) {
  const timeoutRef = useRef<number | null>(null);
  const signedOutRef = useRef(false);

  useEffect(() => {
    if (!enabled || EXCLUDED_PATHS.has(window.location.pathname)) {
      return;
    }

    function clearExistingTimer() {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    }

    async function signOutForInactivity() {
      if (signedOutRef.current) {
        return;
      }

      signedOutRef.current = true;
      clearExistingTimer();

      try {
        await fetch("/api/auth/inactivity-signout", {
          method: "POST",
          credentials: "include",
          cache: "no-store"
        });
      } finally {
        window.location.href = `/auth/login?message=${encodeURIComponent(SIGN_OUT_MESSAGE)}`;
      }
    }

    function scheduleTimeout() {
      clearExistingTimer();
      const lastActivityAt = Number(window.sessionStorage.getItem(LAST_ACTIVITY_KEY) ?? Date.now());
      const elapsed = Date.now() - lastActivityAt;
      const remaining = Math.max(INACTIVITY_LIMIT_MS - elapsed, 0);

      timeoutRef.current = window.setTimeout(signOutForInactivity, remaining);
    }

    function recordActivity() {
      if (signedOutRef.current) {
        return;
      }

      window.sessionStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
      scheduleTimeout();
    }

    window.sessionStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));

    const events: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "scroll", "touchstart", "focus"];
    events.forEach((eventName) => window.addEventListener(eventName, recordActivity, { passive: true }));
    scheduleTimeout();

    return () => {
      clearExistingTimer();
      events.forEach((eventName) => window.removeEventListener(eventName, recordActivity));
    };
  }, [enabled]);

  return null;
}
