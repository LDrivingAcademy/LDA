import { Target } from "lucide-react";
import { Brand } from "@/components/brand";
import { DynamicBackLink } from "@/components/dynamic-back-link";
import { PracticalTestPlanner } from "@/components/practical-test-planner";
import { redirectIfWrongMarketplaceRole } from "@/lib/account-route-guard";
import { getPageBackLink, type PageSourceSearchParams } from "@/lib/page-back-link";
import { createClient } from "@/lib/supabase/server";

type PracticalTestPageProps = {
  searchParams?: PageSourceSearchParams;
};

export default async function PracticalTestPage({ searchParams }: PracticalTestPageProps) {
  const { backHref, backLabel } = await getPageBackLink(searchParams);
  const supabase = await createClient();
  let progressRecords: Array<{ completed_skills: string[] | null }> = [];

  if (supabase) {
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (user) {
      await redirectIfWrongMarketplaceRole(supabase, user.id, "learner");

      const { data } = await supabase
        .from("lesson_progress_records")
        .select("completed_skills")
        .eq("learner_id", user.id)
        .order("sent_at", { ascending: false })
        .limit(50);

      progressRecords = data ?? [];
    }
  }

  return (
    <main className="min-h-screen bg-white text-black">
      <header className="lda-universal-topbar sticky top-0 z-30 border-b border-zinc-900 bg-black text-white">
        <div className="lda-universal-topbar-inner flex w-full items-center justify-between gap-4 px-[15px]">
          <Brand />
          <DynamicBackLink
            fallbackHref={backHref}
            fallbackLabel={backLabel}
            className="inline-flex items-center gap-2 text-sm font-black text-white transition hover:text-red-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          />
        </div>
      </header>
      <section className="bg-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm font-black text-red-100">
              <Target size={17} /> Practical test readiness
            </div>
            <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-normal sm:text-6xl">Book your test when your evidence says you are ready.</h1>
            <p className="mt-5 max-w-3xl text-lg font-semibold leading-8 text-zinc-300">
              Combine mock-test confidence, instructor sign-off, local route familiarity, and manoeuvre readiness before opening the official booking service.
            </p>
          </div>
        </div>
      </section>
      <PracticalTestPlanner progressRecords={progressRecords} />
    </main>
  );
}
