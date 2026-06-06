"use client";

import { useEffect, useState } from "react";
import { MessageSquareText, Send, X } from "lucide-react";

export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    function openFeedback() {
      setOpen(true);
    }

    function openFeedbackFromHash() {
      if (window.location.hash === "#lda-feedback") {
        openFeedback();
      }
    }

    openFeedbackFromHash();

    window.addEventListener("lda:open-feedback", openFeedback);
    window.addEventListener("hashchange", openFeedbackFromHash);

    return () => {
      window.removeEventListener("lda:open-feedback", openFeedback);
      window.removeEventListener("hashchange", openFeedbackFromHash);
    };
  }, []);

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

  return (
    <div id="lda-feedback" className="fixed bottom-5 right-5 z-50">
      {status === "sent" && !open ? (
        <div className="max-w-xs rounded border border-red-500/30 bg-black px-4 py-3 text-sm font-black text-white shadow-2xl">
          Thank you for the feedback.
        </div>
      ) : null}

      {open ? (
        <section className="w-[min(92vw,420px)] rounded border border-zinc-800 bg-black p-4 text-white shadow-2xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-black uppercase text-brand">LDA feedback</div>
              <h2 className="text-xl font-black">Tell us what to improve</h2>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="grid h-9 w-9 place-items-center rounded-full border border-zinc-800 text-zinc-300 hover:ring-2 hover:ring-brand"
              aria-label="Close feedback form"
            >
              <X size={18} />
            </button>
          </div>

          {status === "sent" ? (
            <div className="mt-4 rounded border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold leading-6 text-red-100">
              Thank you for the feedback.
            </div>
          ) : (
            <form action={submitFeedback} className="mt-4 grid gap-3">
              <label className="grid gap-1">
                <span className="text-sm font-bold text-zinc-400">Name <span className="font-medium text-zinc-600">(optional)</span></span>
                <input name="name" className="rounded border border-zinc-800 bg-zinc-950 px-3 py-3 text-white placeholder:text-zinc-600" placeholder="Your name" />
              </label>
              <label className="grid gap-1">
                <span className="text-sm font-bold text-zinc-400">Email <span className="font-medium text-zinc-600">(optional)</span></span>
                <input name="email" type="email" className="rounded border border-zinc-800 bg-zinc-950 px-3 py-3 text-white placeholder:text-zinc-600" placeholder="you@example.com" />
              </label>
              <label className="grid gap-1">
                <span className="text-sm font-bold text-zinc-400">Feedback issue</span>
                <input required name="issue" className="rounded border border-zinc-800 bg-zinc-950 px-3 py-3 text-white placeholder:text-zinc-600" placeholder="What needs looking at?" />
              </label>
              <label className="grid gap-1">
                <span className="text-sm font-bold text-zinc-400">Information</span>
                <textarea required name="details" rows={5} className="rounded border border-zinc-800 bg-zinc-950 px-3 py-3 text-white placeholder:text-zinc-600" placeholder="Add the details we need to review." />
              </label>
              {status === "error" ? <p className="text-sm font-bold text-brand">{error}</p> : null}
              <button disabled={status === "sending"} className="lda-pill mt-1">
                <Send size={18} /> {status === "sending" ? "Sending feedback..." : "Send feedback"}
              </button>
            </form>
          )}
        </section>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="lda-pill shadow-2xl">
          <MessageSquareText size={18} /> Feedback
        </button>
      )}
    </div>
  );
}
