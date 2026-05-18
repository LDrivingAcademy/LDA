import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import type { LegalPageContent } from "@/lib/legal-content";

export function LegalPage({ content }: { content: LegalPageContent }) {
  return (
    <>
      <main className="min-h-screen bg-background">
        <section className="bg-ink px-4 py-8 text-white sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl">
            <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-zinc-300 hover:text-white">
              <ArrowLeft size={16} /> Back to homepage
            </Link>
            <div className="py-10">
              <div className="inline-flex items-center gap-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-black text-red-100">
                <FileText size={16} /> Compliance
              </div>
              <h1 className="mt-5 text-4xl font-black tracking-normal sm:text-6xl">{content.title}</h1>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-zinc-300">{content.intro}</p>
              <p className="mt-4 inline-flex rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm font-bold text-red-100">{content.updated}</p>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-5xl gap-5 px-4 py-10 sm:px-6 lg:px-8">
          {content.sections.map((section) => (
            <article key={section.heading} className="rounded border border-border bg-white p-5 shadow-sm">
              <h2 className="text-2xl font-black">{section.heading}</h2>
              <div className="mt-4 grid gap-3">
                {section.body.map((paragraph) => (
                  <p key={paragraph} className="leading-7 text-muted">
                    {paragraph}
                  </p>
                ))}
              </div>
            </article>
          ))}
          <article className="rounded border border-red-200 bg-red-50 p-5 text-sm leading-7 text-brand">
            Policy governance note: LDA should review this page whenever the service, suppliers, payment flow, data processing, cookie use, cancellation rules, or applicable law changes. For live trading, keep business details, processor lists, retention periods, and customer communications accurate and version-controlled.
          </article>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
