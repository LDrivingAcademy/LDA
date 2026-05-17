import Link from "next/link";
import { CheckCircle2, Sparkles } from "lucide-react";
import { LearnerPackageCheckoutButton } from "@/components/learner-package-checkout-button";
import {
  currentLearnerPackageId,
  getPackageActionLabel,
  type LearnerPackage
} from "@/lib/learner-packages";

type LearnerPackageCardProps = {
  learnerPackage: LearnerPackage;
};

export function LearnerPackageCard({ learnerPackage }: LearnerPackageCardProps) {
  const isCurrentPlan = learnerPackage.id === currentLearnerPackageId;
  const actionLabel = getPackageActionLabel(learnerPackage.id);

  return (
    <article
      className={`rounded border p-5 transition hover:-translate-y-0.5 hover:shadow-lg ${
        learnerPackage.highlighted ? "border-brand bg-red-500/10" : "border-zinc-200 bg-white"
      }`}
    >
      <Link className="block focus:outline-none focus:ring-2 focus:ring-brand" href={`/learner-plus/${learnerPackage.slug}`}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-2xl font-black">{learnerPackage.name}</h2>
          <span className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-black uppercase text-brand">
            {isCurrentPlan ? "Current plan" : learnerPackage.label}
          </span>
        </div>
        <p className="mt-3 text-lg font-black text-brand">{learnerPackage.price}</p>
        <p className="mt-3 text-sm font-bold leading-6 text-zinc-700">{learnerPackage.summary}</p>
        <div className="mt-5 grid gap-3">
          {learnerPackage.features.map((feature) => (
            <div key={feature} className="flex items-start gap-3 text-sm font-bold leading-6 text-zinc-800">
              {learnerPackage.highlighted ? (
                <Sparkles className="mt-0.5 shrink-0 text-brand" size={18} />
              ) : (
                <CheckCircle2 className="mt-0.5 shrink-0 text-brand" size={18} />
              )}
              <span>{feature}</span>
            </div>
          ))}
        </div>
        <span className="mt-5 inline-flex text-sm font-black text-brand">View full package details</span>
      </Link>
      <div className="mt-6">
        {isCurrentPlan ? (
          <button className="lda-pill lda-pill-sm w-full justify-center opacity-60" type="button" disabled>
            Current plan
          </button>
        ) : (
          <LearnerPackageCheckoutButton
            packageId={learnerPackage.id}
            billingInterval="monthly"
            label={actionLabel}
            compact
          />
        )}
      </div>
    </article>
  );
}
