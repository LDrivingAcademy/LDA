import { PlusCircle } from "lucide-react";
import { LearnerPackageCard } from "@/components/learner-package-card";
import { PageTopBar } from "@/components/page-top-bar";
import { getSignedInLearnerPackageId } from "@/lib/account-package-state";
import { getCurrentLearnerPackage, learnerPackages } from "@/lib/learner-packages";
import { getPageBackLink, type PageSourceSearchParams } from "@/lib/page-back-link";

type LearnerPlusPageProps = {
  searchParams?: PageSourceSearchParams;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function LearnerPlusPage({ searchParams }: LearnerPlusPageProps) {
  const { backHref, backLabel, fromDashboard } = await getPageBackLink(searchParams);
  const currentPackageId = await getSignedInLearnerPackageId();
  const currentPackage = getCurrentLearnerPackage(currentPackageId);

  return (
    <main className="min-h-screen bg-white text-black">
      <PageTopBar backHref={backHref} backLabel={backLabel} />
      <div className="mx-auto max-w-7xl px-4 py-8">
        <section className="rounded border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="inline-flex items-center gap-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-black text-brand">
            <PlusCircle size={16} /> Learner Plus
          </div>
          <h1 className="mt-5 text-4xl font-black tracking-normal sm:text-5xl">Choose your LDA learner package.</h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-zinc-700">
            Your current package is {currentPackage.name}. Each tile opens a full breakdown, and existing paid package changes are confirmed before LDA updates your Stripe subscription.
          </p>
          <div className="mt-7 grid items-stretch gap-4 lg:grid-cols-3">
            {learnerPackages.map((learnerPackage) => (
              <LearnerPackageCard
                key={learnerPackage.id}
                learnerPackage={learnerPackage}
                currentPackageId={currentPackageId}
                fromDashboard={fromDashboard}
              />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
