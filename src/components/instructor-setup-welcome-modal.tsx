"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2, X } from "lucide-react";
import { dismissInstructorSetupPromptAction, enableInstructorSetupGuideAction } from "@/app/instructor-setup/actions";

export function InstructorSetupWelcomeModal({ show }: { show: boolean }) {
  const [visible, setVisible] = useState(show);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (!visible) {
    return null;
  }

  function closePrompt() {
    if (!window.confirm("Are you sure you do not want to set it up now? You will need to set it up manually later before you can appear in learner searches or receive bookings.")) {
      return;
    }

    startTransition(async () => {
      await dismissInstructorSetupPromptAction();
      setVisible(false);
      router.refresh();
    });
  }

  function startGuide() {
    startTransition(async () => {
      await enableInstructorSetupGuideAction();
      setVisible(false);
      router.push("/instructor-setup?from=welcome");
    });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4">
      <section className="relative w-full max-w-xl rounded border border-zinc-800 bg-white p-6 text-black shadow-2xl">
        <button
          type="button"
          onClick={closePrompt}
          disabled={isPending}
          className="absolute right-4 top-4 grid size-10 place-items-center rounded-full border border-zinc-300 bg-white text-black hover:ring-2 hover:ring-brand disabled:opacity-60"
          aria-label="Close setup prompt"
        >
          <X size={18} />
        </button>
        <div className="grid size-12 place-items-center rounded bg-emerald-50 text-emerald-700">
          <CheckCircle2 size={26} />
        </div>
        <div className="mt-5 text-sm font-black uppercase text-brand">Congratulations</div>
        <h2 className="mt-2 pr-10 text-3xl font-black">Would you like help setting up your instructor account?</h2>
        <p className="mt-4 text-base font-semibold leading-7 text-zinc-700">
          Your LDA instructor application has been approved. LDA can guide you through finance, tax, payment, pricing, and learner-facing profile details before your account appears in learner searches.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={startGuide} disabled={isPending} className="lda-pill lda-pill-sm disabled:opacity-60">
            Yes, help me set it up
          </button>
          <button
            type="button"
            onClick={closePrompt}
            disabled={isPending}
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-zinc-300 bg-white px-5 py-2 text-sm font-black text-black hover:ring-2 hover:ring-brand disabled:opacity-60"
          >
            Set up later
          </button>
        </div>
        <Link href="/instructor-setup?from=welcome" className="mt-4 inline-flex text-sm font-black text-brand hover:underline">
          Open full setup page
        </Link>
      </section>
    </div>
  );
}
