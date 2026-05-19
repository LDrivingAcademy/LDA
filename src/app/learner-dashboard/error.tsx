"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { PageTopBar } from "@/components/page-top-bar";

export default function LearnerDashboardError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("LDA learner dashboard crashed", error);
  }, [error]);

  return (
    <main className="min-h-screen bg-white text-black">
      <PageTopBar />
      <section className="mx-auto grid max-w-4xl gap-6 px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded border border-red-200 bg-red-50 p-6">
          <div className="flex items-center gap-2 text-sm font-black uppercase text-brand">
            <AlertTriangle size={18} /> Learner dashboard recovery
          </div>
          <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">We could not load your dashboard cleanly.</h1>
          <p className="mt-4 max-w-2xl text-base font-bold leading-7 text-zinc-600">
            Refresh the dashboard below. If the browser blocked location, storage, or map permissions, the dashboard will now fall back safely instead of showing a blank application error.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" onClick={reset} className="lda-pill lda-pill-sm">
              <RefreshCw size={17} /> Reload dashboard
            </button>
            <Link href="/" className="lda-pill lda-pill-sm">
              Back to homepage
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
