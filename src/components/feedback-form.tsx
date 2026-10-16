"use client";

import { useState } from "react";
import { Send } from "lucide-react";

type FeedbackFormProps = {
  compact?: boolean;
};

export function FeedbackForm({ compact = false }: FeedbackFormProps) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");
  const labelClass = compact ? "text-zinc-400" : "text-zinc-800";
  const optionalClass = compact ? "text-zinc-600" : "text-zinc-500";
  const fieldClass = compact
    ? "rounded border border-zinc-800 bg-zinc-950 px-3 py-3 text-white placeholder:text-zinc-600"
    : "rounded border border-zinc-300 bg-white px-3 py-3 text-black placeholder:text-zinc-500";
  const sentClass = compact
    ? "rounded border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold leading-6 text-red-100"
    : "rounded border border-red-200 bg-red-50 p-4 text-sm font-bold leading-6 text-red-900";

  async function submitFeedback(formData: FormData) {
    setStatus("sending");
    setError("");

    const response = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formData.get("name"),
        email: formData.get("email"),
        issue: formData.get("issue"),
        details: formData.get("details"),
        pageUrl: window.location.href
      })
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(result.error || "Feedback could not be sent. Please try again.");
      setStatus("error");
      return;
    }

    setStatus("sent");
  }

  if (status === "sent") {
    return (
      <div className={sentClass}>
        Thank you for the feedback.
      </div>
    );
  }

  return (
    <form action={submitFeedback} className={`grid gap-3 ${compact ? "mt-4" : ""}`}>
      <label className="grid gap-1">
        <span className={`text-sm font-bold ${labelClass}`}>Name <span className={`font-medium ${optionalClass}`}>(optional)</span></span>
        <input name="name" className={fieldClass} placeholder="Your name" />
      </label>
      <label className="grid gap-1">
        <span className={`text-sm font-bold ${labelClass}`}>Email <span className={`font-medium ${optionalClass}`}>(optional)</span></span>
        <input name="email" type="email" className={fieldClass} placeholder="you@example.com" />
      </label>
      <label className="grid gap-1">
        <span className={`text-sm font-bold ${labelClass}`}>Feedback issue</span>
        <input required name="issue" className={fieldClass} placeholder="What needs looking at?" />
      </label>
      <label className="grid gap-1">
        <span className={`text-sm font-bold ${labelClass}`}>Information</span>
        <textarea required name="details" rows={compact ? 5 : 7} className={fieldClass} placeholder="Add the details we need to review." />
      </label>
      {status === "error" ? <p className="text-sm font-bold text-brand">{error}</p> : null}
      <button disabled={status === "sending"} className="lda-pill mt-1">
        <Send size={18} /> {status === "sending" ? "Sending feedback..." : "Send feedback"}
      </button>
    </form>
  );
}
