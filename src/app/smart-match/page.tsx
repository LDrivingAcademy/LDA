import { Sparkles } from "lucide-react";
import { PageTopBar } from "@/components/page-top-bar";
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
      <PageTopBar backHref={backHref} backLabel={backLabel} />
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
