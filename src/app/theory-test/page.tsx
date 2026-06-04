import Link from "next/link";
import { ArrowLeft, BookOpenCheck, ExternalLink, ShieldCheck } from "lucide-react";
import { Brand } from "@/components/brand";
import { TheoryTestSuite } from "@/components/theory-test-suite";
import { getPageBackLink, type PageSourceSearchParams } from "@/lib/page-back-link";

type TheoryTestPageProps = {
  searchParams?: PageSourceSearchParams;
};

export default async function TheoryTestPage({ searchParams }: TheoryTestPageProps) {
  const { backHref, backLabel } = await getPageBackLink(searchParams);

  return (
    <main className="min-h-screen bg-white text-black">
      <header className="sticky top-0 z-30 border-b border-zinc-900 bg-black text-white">
        <div className="flex w-full items-center justify-between gap-4 px-[15px] py-4">
          <Brand />
          <Link href={backHref} className="lda-pill lda-pill-sm">
            <ArrowLeft size={16} /> {backLabel}
          </Link>
        </div>
      </header>

      <section className="bg-black text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_360px] lg:px-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm font-black text-red-100">
              <BookOpenCheck size={17} /> LDA theory centre
            </div>
            <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-normal sm:text-6xl">
              Revise, practise, and book your official theory test.
            </h1>
            <p className="mt-5 max-w-3xl text-lg font-semibold leading-8 text-zinc-300">
              Use LDA practice content to build confidence, then book through the official GOV.UK service when your mock scores are strong and consistent.
            </p>
          </div>
          <aside className="rounded border border-red-500/30 bg-zinc-950 p-5 shadow-2xl">
            <ShieldCheck className="text-brand" />
            <h2 className="mt-4 text-2xl font-black">Official source links</h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-zinc-300">
              LDA uses official GOV.UK guidance links for theory booking and keeps the practice experience separate from the government service.
            </p>
            <a href="https://www.gov.uk/book-theory-test" target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 text-sm font-black text-red-100 underline decoration-brand decoration-2 underline-offset-4">
              Open official booking <ExternalLink size={16} />
            </a>
          </aside>
        </div>
      </section>

      <TheoryTestSuite />
    </main>
  );
}
