import { notFound } from "next/navigation";
import { CheckCircle2, Sparkles } from "lucide-react";
import { LearnerPackageCheckoutButton } from "@/components/learner-package-checkout-button";
import { PageTopBar } from "@/components/page-top-bar";
import {
  currentLearnerPackageId,
  getLearnerPackage,
  getPackageActionLabel,
  learnerPackages
} from "@/lib/learner-packages";

type LearnerPackageDetailPageProps = {
  params: Promise<{
    packageId: string;
  }>;
  searchParams: Promise<{
    checkout?: string;
    billing?: string;
  }>;
};

export function generateStaticParams() {
  return learnerPackages.map((learnerPackage) => ({
    packageId: learnerPackage.slug
  }));
}

export async function generateMetadata({ params }: LearnerPackageDetailPageProps) {
  const { packageId } = await params;
  const learnerPackage = getLearnerPackage(packageId);

  return {
    title: learnerPackage ? `${learnerPackage.name} | L Driving Academy` : "Learner package | L Driving Academy"
  };
}

export default async function LearnerPackageDetailPage({ params, searchParams }: LearnerPackageDetailPageProps) {
  const [{ packageId }, query] = await Promise.all([params, searchParams]);
  const learnerPackage = getLearnerPackage(packageId);

  if (!learnerPackage) {
    notFound();
  }

  const isCurrentPlan = learnerPackage.id === currentLearnerPackageId;
  const actionLabel = getPackageActionLabel(learnerPackage.id);

  return (
    <main className="min-h-screen bg-white text-black">
      <PageTopBar backHref="/learner-plus" backLabel="Back to packages" />
      <div className="mx-auto max-w-5xl px-4 py-8">
        {query.checkout === "success" ? (
          <div className="mb-5 rounded border border-red-500/30 bg-red-500/10 p-4 text-sm font-black text-brand">
            Stripe checkout returned successfully for {learnerPackage.name} {query.billing ? `(${query.billing})` : ""}.
          </div>
        ) : null}
        {query.checkout === "cancelled" ? (
          <div className="mb-5 rounded border border-zinc-200 bg-white p-4 text-sm font-black text-zinc-700">
            Checkout was cancelled. You can choose monthly or yearly when you are ready.
          </div>
        ) : null}
        <section className="rounded border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="inline-flex items-center gap-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-black text-brand">
            <Sparkles size={16} /> {learnerPackage.label}
          </div>
          <h1 className="mt-5 text-4xl font-black tracking-normal sm:text-5xl">{learnerPackage.name}</h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-zinc-700">{learnerPackage.summary}</p>

          <div className="mt-7 grid gap-4 lg:grid-cols-2">
            <div className="rounded border border-zinc-200 bg-white p-5">
              <p className="text-sm font-black uppercase text-zinc-500">Monthly</p>
              <p className="mt-2 text-2xl font-black text-brand">{learnerPackage.monthlyPrice}</p>
              <p className="mt-3 text-sm font-bold leading-6 text-zinc-700">
                Flexible monthly access with secure billing through Stripe Checkout.
              </p>
              <div className="mt-5">
                <LearnerPackageCheckoutButton
                  packageId={learnerPackage.id}
                  billingInterval="monthly"
                  label={isCurrentPlan ? "Current plan" : `${actionLabel} monthly`}
                  disabled={isCurrentPlan}
                />
              </div>
            </div>
            <div className="rounded border border-zinc-200 bg-white p-5">
              <p className="text-sm font-black uppercase text-zinc-500">Yearly</p>
              <p className="mt-2 text-2xl font-black text-brand">{learnerPackage.yearlyPrice}</p>
              <p className="mt-3 text-sm font-bold leading-6 text-zinc-700">
                Annual access for learners who want a longer LDA support plan at better value.
              </p>
              <div className="mt-5">
                <LearnerPackageCheckoutButton
                  packageId={learnerPackage.id}
                  billingInterval="yearly"
                  label={isCurrentPlan ? "Current plan" : `${actionLabel} yearly`}
                  disabled={isCurrentPlan}
                />
              </div>
            </div>
          </div>

          <div className="mt-7 grid gap-4 lg:grid-cols-3">
            {learnerPackage.breakdown.map((section) => (
              <article key={section.heading} className="rounded border border-zinc-200 bg-white p-5">
                <CheckCircle2 className="text-brand" size={22} />
                <h2 className="mt-4 text-xl font-black">{section.heading}</h2>
                <p className="mt-3 text-sm font-bold leading-6 text-zinc-700">{section.body}</p>
              </article>
            ))}
          </div>

          <div className="mt-7 rounded border border-zinc-200 bg-zinc-50 p-5">
            <h2 className="text-2xl font-black">Included features</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {learnerPackage.features.map((feature) => (
                <div key={feature} className="flex items-start gap-3 text-sm font-bold leading-6 text-zinc-800">
                  <CheckCircle2 className="mt-0.5 shrink-0 text-brand" size={18} />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
