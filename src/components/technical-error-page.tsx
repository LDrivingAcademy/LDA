"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";

export function TechnicalErrorPage({
  error,
  reset,
  source = "application"
}: {
  error: Error & { digest?: string };
  reset: () => void;
  source?: string;
}) {
  useEffect(() => {
    const supportRoute = ["technical", "support"].join("-");

    fetch(`/api/${supportRoute}/incidents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Website page error",
        message: error.message,
        digest: error.digest,
        path: window.location.pathname,
        source
      }),
      keepalive: true
    }).catch(() => undefined);
  }, [error, source]);

  return (
    <main className="min-h-screen bg-white text-black">
      <section className="mx-auto max-w-3xl px-4 py-16">
        <div className="rounded border border-red-200 bg-red-50 p-6">
          <div className="flex items-center gap-2 text-sm font-black uppercase text-brand">
            <AlertTriangle size={18} /> Page recovery
          </div>
          <h1 className="mt-4 text-4xl font-black tracking-normal">This page could not load properly.</h1>
          <p className="mt-4 text-base font-semibold leading-7 text-zinc-700">
            LDA support has been notified. You can try the page again or return to the homepage.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" onClick={reset} className="lda-pill lda-pill-sm">
              <RefreshCw size={17} /> Try again
            </button>
            <Link href="/" className="lda-pill lda-pill-sm">Homepage</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
