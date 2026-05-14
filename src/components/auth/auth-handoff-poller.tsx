"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Smartphone } from "lucide-react";

type HandoffState = "pending" | "authenticated" | "expired" | "error";

export function AuthHandoffPoller({
  requestId,
  role
}: {
  requestId?: string;
  role: "learner" | "instructor";
}) {
  const [state, setState] = useState<HandoffState>(requestId ? "pending" : "error");
  const [message, setMessage] = useState(
    requestId
      ? "Keep this tab open. Once you approve the email link, this device will continue automatically."
      : "This login tab cannot auto-continue because the hand-off request is missing. Request a fresh email link from this device."
  );

  useEffect(() => {
    if (!requestId) {
      return;
    }

    const activeRequestId = requestId;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const response = await fetch(`/api/auth/handoff?request=${encodeURIComponent(activeRequestId)}`, {
          cache: "no-store"
        });
        const data = await response.json();

        if (cancelled) {
          return;
        }

        if (data.status === "authenticated") {
          setState("authenticated");
          setMessage("Approved. Taking you to your LDA verification page now.");
          window.location.assign(data.redirectTo || `/auth/verify?role=${role}`);
          return;
        }

        if (data.status === "expired") {
          setState("expired");
          setMessage("This login request expired. Please request a fresh email link.");
          return;
        }

        if (response.ok && ["pending", "approved"].includes(data.status)) {
          timer = setTimeout(poll, 2000);
          return;
        }

        setState("error");
        setMessage(data.message || "This device could not complete the login hand-off. Request a fresh email link from this device.");
      } catch {
        if (!cancelled) {
          timer = setTimeout(poll, 3000);
        }
      }
    }

    poll();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [requestId, role]);

  const Icon = state === "authenticated" ? CheckCircle2 : state === "pending" ? Loader2 : Smartphone;

  return (
    <div className="mt-6 rounded border border-red-500/30 bg-red-500/10 p-4">
      <div className="flex items-start gap-3">
        <Icon className={`mt-1 text-brand ${state === "pending" ? "animate-spin" : ""}`} size={20} />
        <div>
          <h2 className="font-black text-white">
            {state === "pending"
              ? "Waiting for approval"
              : state === "authenticated"
                ? "Approved"
                : "Login hand-off needs a fresh link"}
          </h2>
          <p className="mt-1 text-sm leading-6 text-red-100">{message}</p>
        </div>
      </div>
    </div>
  );
}
