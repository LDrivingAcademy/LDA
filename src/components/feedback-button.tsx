"use client";

import { useEffect, useState } from "react";
import { MessageSquareText, X } from "lucide-react";
import { FeedbackForm } from "@/components/feedback-form";

export function FeedbackButton() {
  const [open, setOpen] = useState(false);

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

  return (
    <div id="lda-feedback" className="fixed bottom-5 right-5 z-50">
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

          <FeedbackForm compact />
        </section>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="lda-pill shadow-2xl">
          <MessageSquareText size={18} /> Feedback
        </button>
      )}
    </div>
  );
}
