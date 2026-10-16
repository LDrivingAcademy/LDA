import Link from "next/link";
import { CheckCircle2, Sparkles } from "lucide-react";
import { LearnerPackageCheckoutButton } from "@/components/learner-package-checkout-button";
import {
  getPackageActionLabel,
  type LearnerPackage,
  type LearnerPackageId
} from "@/lib/learner-packages";

type LearnerPackageCardProps = {
  learnerPackage: LearnerPackage;
  currentPackageId?: LearnerPackageId;
  fromDashboard?: boolean;
  displayPrice: string;
};

export function LearnerPackageCard({
  learnerPackage,
  currentPackageId = "learner",
  fromDashboard = false,
  displayPrice
}: LearnerPackageCardProps) {
  const isCurrentPlan = learnerPackage.id === currentPackageId;
  const actionLabel = getPackageActionLabel(learnerPackage.id, currentPackageId);

  return (
    <article
      className={`group relative flex h-full flex-col rounded border p-4 sm:p-5 transition focus-within:border-brand focus-within:ring-2 focus-within:ring-brand focus-within:shadow-lg hover:-translate-y-0.5 hover:border-brand hover:ring-2 hover:ring-brand hover:shadow-lg ${
        isCurrentPlan ? "border-brand bg-red-50 ring-2 ring-brand shadow-lg" : "border-zinc-200 bg-white"
      }`}
    >
      <Link
        className="flex flex-1 flex-col focus:outline-none"
        href={`/learner-plus/${learnerPackage.slug}${fromDashboard ? "?from=dashboard" : ""}`}
      >
        <h2 className="min-h-8 break-normal text-2xl font-black leading-8">{learnerPackage.name}</h2>
        <div className="mt-3 flex min-h-8 items-start">
          <span className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-black uppercase text-brand">
            {isCurrentPlan ? "Current plan" : learnerPackage.label}
          </span>
        </div>
        <p className="mt-4 min-h-8 text-lg font-black leading-8 text-brand">{displayPrice}</p>
        <p className="mt-3 min-h-24 text-sm font-bold leading-6 text-zinc-700">{learnerPackage.summary}</p>
        <div className="mt-5 grid min-h-48 content-start gap-3">
          {learnerPackage.features.map((feature) => (
            <div key={feature} className="flex items-start gap-3 text-sm font-bold leading-6 text-zinc-800">
              {isCurrentPlan ? (
                <Sparkles className="mt-0.5 shrink-0 text-brand" size={18} />
              ) : (
                <CheckCircle2 className="mt-0.5 shrink-0 text-brand" size={18} />
              )}
              <span>{feature}</span>
            </div>
          ))}
        </div>
        <span className="mt-auto inline-flex pt-5 text-sm font-black text-brand">View full package details</span>
      </Link>
      <div className="mt-6">
        {isCurrentPlan ? (
          <button
            className="lda-pill lda-pill-sm min-h-11 w-full justify-center whitespace-normal text-center leading-5 opacity-60"
            type="button"
            disabled
          >
            Current plan
          </button>
        ) : (
          <LearnerPackageCheckoutButton
            packageId={learnerPackage.id}
            currentPackageId={currentPackageId}
            billingInterval="monthly"
            label={actionLabel.replace("Upgrade to Learner ", "Upgrade to ")}
            compact
          />
        )}
      </div>
    </article>
  );
}
