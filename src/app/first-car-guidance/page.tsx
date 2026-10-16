import Link from "next/link";
import { ArrowRight, CarFront, LockKeyhole, ShieldCheck } from "lucide-react";
import { Brand } from "@/components/brand";
import { DynamicBackLink } from "@/components/dynamic-back-link";
import { FirstCarGuidance } from "@/components/first-car-guidance";
import { getSignedInLearnerPackageId } from "@/lib/account-package-state";
import { getPageBackLink, type PageSourceSearchParams } from "@/lib/page-back-link";
import { learnerPackageIncludesFeature } from "@/lib/subscription-tier-entitlements";

type FirstCarGuidancePageProps = {
  searchParams?: PageSourceSearchParams;
};

export default async function FirstCarGuidancePage({ searchParams }: FirstCarGuidancePageProps) {
  const { backHref, backLabel } = await getPageBackLink(searchParams);
  const learnerPackageId = await getSignedInLearnerPackageId();
  const canOpenFirstCarGuidance = learnerPackageIncludesFeature(learnerPackageId, "learner-pro");

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
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_360px] lg:px-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm font-black text-red-100">
              <CarFront size={17} /> First car guidance
            </div>
            <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-normal sm:text-6xl">Find a sensible first car without drowning in listings.</h1>
            <p className="mt-5 max-w-3xl text-lg font-semibold leading-8 text-zinc-300">
              LDA turns budget, licence timing, safety, running costs, insurance group, and seller trust into a practical shortlist.
            </p>
          </div>
          <aside className="rounded border border-red-500/30 bg-zinc-950 p-5 shadow-2xl">
            <ShieldCheck className="text-brand" />
            <h2 className="mt-4 text-2xl font-black">Platform-ready</h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-zinc-300">
              First-car guidance is a shortlist and checklist tool. Live listings, finance, insurance, vehicle-history checks, or dealer referrals need approved partner data and clear disclosure before launch.
            </p>
          </aside>
        </div>
      </section>
      {canOpenFirstCarGuidance ? (
        <FirstCarGuidance />
      ) : (
        <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="rounded border border-red-200 bg-red-50 p-6 shadow-sm">
            <LockKeyhole className="text-brand" size={28} />
            <h2 className="mt-4 text-3xl font-black">Upgrade to Learner Pro to open this section.</h2>
            <p className="mt-3 text-sm font-bold leading-6 text-red-950">
              First-car guidance is a Learner Pro tool. Your current package can still book lessons, use core theory learning, and manage your learner account.
            </p>
            <Link href="/learner-plus/learner-pro?from=first-car-guidance" className="lda-pill lda-pill-sm mt-5">
              Upgrade to Learner Pro <ArrowRight size={17} />
            </Link>
          </div>
        </section>
      )}
    </main>
  );
}
