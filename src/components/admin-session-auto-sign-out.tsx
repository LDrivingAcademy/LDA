"use client";

import { useEffect, useRef, useState } from "react";

type PrivilegedSessionRole = "admin" | "support";

function roleLabel(role: PrivilegedSessionRole) {
  return role === "admin" ? "admin" : "technical support";
}

export function AdminSessionAutoSignOut({
  role = "admin",
  signedOutRole,
  idleMinutes,
  warningMinutes
}: {
  role?: PrivilegedSessionRole;
  signedOutRole?: PrivilegedSessionRole;
  idleMinutes?: number;
  warningMinutes?: number;
}) {
  const redirectRole = signedOutRole ?? role;
  const totalIdleSeconds = Math.max(1, Math.round((idleMinutes ?? (role === "admin" ? 10 : 15)) * 60));
  const warningAfterSeconds = Math.max(0, Math.round((warningMinutes ?? (role === "admin" ? 8 : 13)) * 60));
  const [isWarningOpen, setIsWarningOpen] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(Math.max(0, totalIdleSeconds - warningAfterSeconds));
  const warningTimeoutRef = useRef<number | null>(null);
  const signOutTimeoutRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);
  const signingOutRef = useRef(false);
  const warningOpenRef = useRef(false);
  const lastServerRefreshAtRef = useRef(Date.now());

  useEffect(() => {
    const warningDelayMs = warningAfterSeconds * 1000;
    const signOutDelayMs = totalIdleSeconds * 1000;
    const countdownStartSeconds = Math.max(0, totalIdleSeconds - warningAfterSeconds);

    function clearTimers() {
      if (warningTimeoutRef.current !== null) {
        window.clearTimeout(warningTimeoutRef.current);
        warningTimeoutRef.current = null;
      }
      if (signOutTimeoutRef.current !== null) {
        window.clearTimeout(signOutTimeoutRef.current);
        signOutTimeoutRef.current = null;
      }
      if (countdownIntervalRef.current !== null) {
        window.clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    }

    function startCountdown() {
      warningOpenRef.current = true;
      setIsWarningOpen(true);
      setSecondsRemaining(countdownStartSeconds);
      if (countdownIntervalRef.current !== null) {
        window.clearInterval(countdownIntervalRef.current);
      }
      countdownIntervalRef.current = window.setInterval(() => {
        setSecondsRemaining((current) => Math.max(0, current - 1));
      }, 1000);
    }

    function resetTimer() {
      if (signingOutRef.current || warningOpenRef.current) return;
      const now = Date.now();
      if (now - lastServerRefreshAtRef.current > 60 * 1000) {
        lastServerRefreshAtRef.current = now;
        void fetch("/api/admin/session/refresh", {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store"
        }).catch(() => undefined);
      }
      clearTimers();
      warningTimeoutRef.current = window.setTimeout(startCountdown, warningDelayMs);
      signOutTimeoutRef.current = window.setTimeout(endSession, signOutDelayMs);
    }

    async function endSession() {
      if (signingOutRef.current) return;
      signingOutRef.current = true;
      clearTimers();
      try {
        const endSessionUrl = new URL("/api/admin/session/end", window.location.origin);
        endSessionUrl.searchParams.set("role", redirectRole);
        const response = await fetch(endSessionUrl.toString(), {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: { Accept: "application/json" }
        });
        const body = await response.json().catch(() => null) as { redirectTo?: string } | null;
        const loginHref = body?.redirectTo && body.redirectTo.startsWith("/") ? body.redirectTo : "/";
        window.location.assign(loginHref);
      } catch {
        window.location.assign("/");
      }
    }

    resetTimer();
    const events: Array<keyof WindowEventMap> = ["click", "keydown", "pointermove", "scroll", "touchstart"];
    events.forEach((eventName) => window.addEventListener(eventName, resetTimer, { passive: true }));
    window.addEventListener("lda-privileged-session-reset", resetTimer as EventListener);
    document.addEventListener("visibilitychange", resetTimer);

    return () => {
      clearTimers();
      events.forEach((eventName) => window.removeEventListener(eventName, resetTimer));
      window.removeEventListener("lda-privileged-session-reset", resetTimer as EventListener);
      document.removeEventListener("visibilitychange", resetTimer);
    };
  }, [redirectRole, role, totalIdleSeconds, warningAfterSeconds]);

  async function staySignedIn() {
    if (signingOutRef.current) return;

    try {
      const response = await fetch("/api/admin/session/refresh", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error("refresh_failed");
      }

      warningOpenRef.current = false;
      lastServerRefreshAtRef.current = Date.now();
      setIsWarningOpen(false);
      setSecondsRemaining(Math.max(0, totalIdleSeconds - warningAfterSeconds));
      window.dispatchEvent(new Event("lda-privileged-session-reset"));
    } catch {
      signingOutRef.current = true;
      const endSessionUrl = new URL("/api/admin/session/end", window.location.origin);
      endSessionUrl.searchParams.set("role", redirectRole);
      fetch(endSessionUrl.toString(), {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { Accept: "application/json" }
      })
        .then((response) => response.json())
        .then((body: { redirectTo?: string } | null) => body?.redirectTo && body.redirectTo.startsWith("/") ? body.redirectTo : "/")
        .then((loginHref) => window.location.assign(loginHref))
        .catch(() => window.location.assign("/"));
    }
  }

  if (!isWarningOpen) {
    return null;
  }

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = String(secondsRemaining % 60).padStart(2, "0");

  return (
    <div className="fixed inset-x-0 top-4 z-[9999] flex justify-center px-4">
      <section
        role="dialog"
        aria-modal="false"
        aria-labelledby="privileged-session-warning-title"
        className="w-full max-w-md rounded border border-red-200 bg-white p-4 text-black shadow-2xl"
      >
        <div className="text-xs font-black uppercase text-brand">Secure {roleLabel(role)} session</div>
        <h2 id="privileged-session-warning-title" className="mt-1 text-xl font-black">
          Session expires in {minutes}:{seconds}
        </h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-zinc-700">
          There has been no activity. Stay signed in to continue securely, or LDA will sign this session out automatically.
        </p>
        <div className="mt-4 flex justify-end">
          <button type="button" onClick={staySignedIn} className="lda-pill lda-pill-sm">
            Stay signed in
          </button>
        </div>
      </section>
    </div>
  );
}
