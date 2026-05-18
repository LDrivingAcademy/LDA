import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Brand } from "@/components/brand";
import { LanguageSelector } from "@/components/language-selector";
import { MainMenu } from "@/components/main-menu";
import { SiteFooter } from "@/components/site-footer";
import { SmartMatchExperience } from "@/components/smart-match-experience";

type SmartMatchPageProps = {
  searchParams?: Promise<{
    from?: string;
  }>;
};

export default async function SmartMatchPage({ searchParams }: SmartMatchPageProps) {
  const params = await searchParams;
  const fromDashboard = params?.from === "dashboard";
  const backHref = fromDashboard ? "/learner-dashboard" : "/";
  const backLabel = fromDashboard ? "Back to dashboard" : "Back to homepage";

  return (
    <>
      <header className="sticky top-0 z-30 bg-black text-white">
        <div className="flex w-full items-center justify-between gap-5 px-[15px] py-4">
          <Brand size="page" />
          <div className="flex items-center gap-3 sm:gap-6">
            <LanguageSelector />
            <Link href={backHref} className="lda-pill lda-pill-sm">
              <ArrowLeft size={17} /> {backLabel}
            </Link>
          </div>
          <div className="hidden">
            <MainMenu />
          </div>
        </div>
      </header>
      <main className="min-h-screen bg-black text-white">
        <section className="border-b border-zinc-800 bg-black">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-red-500/60 bg-red-500/15 px-4 py-2 text-sm font-black text-red-100">
              <Sparkles size={17} /> LDA SmartMatch
            </div>
            <h1 className="mt-5 max-w-4xl text-5xl font-black tracking-normal sm:text-6xl">
              A matching system that adapts to the learner, not just the postcode.
            </h1>
            <p className="mt-5 max-w-3xl text-lg font-semibold leading-8 text-zinc-300">
              Build a learner profile, compare instructor capabilities, and turn the result into a practical first lesson plan.
            </p>
          </div>
        </section>
        <SmartMatchExperience />
      </main>
      <SiteFooter />
    </>
  );
}
