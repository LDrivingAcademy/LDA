import { CalendarDays, FileText, Mail, ShieldCheck } from "lucide-react";
import { PageTopBar } from "@/components/page-top-bar";
import { SiteFooter } from "@/components/site-footer";
import type { LegalPageContent } from "@/lib/legal-content";

export function LegalPage({ content }: { content: LegalPageContent }) {
  const highlights = content.highlights || [
    "Clear information for LDA users.",
    "Reviewed against UK compliance guidance.",
    "Contact LDA if anything needs another format."
  ];

  return (
    <>
      <PageTopBar />
      <main className="min-h-screen bg-background">
        <section className="bg-ink px-4 py-8 text-white sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl">
            <div className="py-10">
              <div className="inline-flex items-center gap-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-black text-red-100">
                <FileText size={16} /> Compliance
              </div>
              <h1 className="mt-5 text-4xl font-black tracking-normal sm:text-6xl">{content.title}</h1>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-zinc-300">{content.intro}</p>
              <p className="mt-4 inline-flex items-center gap-2 rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm font-bold text-red-100">
                <CalendarDays size={15} /> {content.updated}
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-5xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[280px_1fr] lg:px-8">
          <aside className="h-fit rounded border border-border bg-white p-5 shadow-sm lg:sticky lg:top-6">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded bg-red-50 text-brand">
              <ShieldCheck size={20} />
            </div>
            <h2 className="mt-4 text-xl font-black">At a glance</h2>
            <div className="mt-4 grid gap-3 text-sm font-semibold leading-6 text-muted">
              {highlights.map((highlight) => (
                <p key={highlight} className="rounded border border-zinc-100 bg-zinc-50 p-3">
                  {highlight}
                </p>
              ))}
            </div>
            <a
              href="mailto:info@ldrivingacademy.co.uk"
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded bg-black px-4 py-3 text-sm font-black text-white hover:bg-zinc-900"
            >
              <Mail size={16} /> Email LDA
            </a>
          </aside>

          <div className="grid gap-5">
            {content.sections.map((section) => (
              <article key={section.heading} className="rounded border border-border bg-white p-5 shadow-sm sm:p-6">
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
            <div className="rounded border border-red-100 bg-red-50 p-5 text-sm font-bold leading-6 text-red-950">
              These pages are kept under review as LDA develops. They are written for clear UK compliance, but specialist legal advice should be taken before relying on them for a material launch, regulated financial service, or major policy change.
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
