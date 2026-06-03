import { PlusCircle } from "lucide-react";
import { LearnerPackageCard } from "@/components/learner-package-card";
import { PageTopBar } from "@/components/page-top-bar";
import { learnerPackages } from "@/lib/learner-packages";

export default function LearnerPlusPage() {
  return (
    <main className="min-h-screen bg-white text-black">
      <PageTopBar backHref="/learner-dashboard" backLabel="Back to learner dashboard" />
      <div className="mx-auto max-w-7xl px-4 py-8">
        <section className="rounded border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="inline-flex items-center gap-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-black text-brand">
            <PlusCircle size={16} /> Learner Plus
          </div>
          <h1 className="mt-5 text-4xl font-black tracking-normal sm:text-5xl">Choose your LDA learner package.</h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-zinc-700">
            Your current package is Learner Plus. Each tile opens a full breakdown, and paid packages can be selected with monthly or yearly billing through secure Stripe Checkout.
          </p>
          <div className="mt-7 grid items-stretch gap-4 lg:grid-cols-3">
            {learnerPackages.map((learnerPackage) => (
              <LearnerPackageCard key={learnerPackage.id} learnerPackage={learnerPackage} />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
