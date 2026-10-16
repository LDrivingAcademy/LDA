import { CheckCircle2, LockKeyhole } from "lucide-react";

import { InstructorPackageCheckoutButton } from "@/components/instructor-package-checkout-button";
import { LearnerPackageCheckoutButton } from "@/components/learner-package-checkout-button";
import {
  instructorPackageIncludesFeature,
  instructorPremiumFeatures,
  learnerPackageIncludesFeature,
  learnerPremiumFeatures,
} from "@/lib/subscription-tier-entitlements";
import type { InstructorPackageId } from "@/lib/instructor-packages";
import type { LearnerPackageId } from "@/lib/learner-packages";

type SubscriptionLockedFeatureGridProps =
  | {
      role: "learner";
      currentPackageId: LearnerPackageId;
      returnPath: string;
    }
  | {
      role: "instructor";
      currentPackageId: InstructorPackageId;
      returnPath: string;
      packageLocked?: boolean;
    };

export function SubscriptionLockedFeatureGrid(props: SubscriptionLockedFeatureGridProps) {
  const features = props.role === "learner" ? learnerPremiumFeatures : instructorPremiumFeatures;

  return (
    <section className="mt-7 rounded border border-zinc-200 bg-zinc-50 p-5">
      <h2 className="text-2xl font-black text-black">Premium features</h2>
      <p className="mt-2 text-sm font-bold leading-6 text-zinc-600">
        Core booking, safety, payment, support, and account tools stay available on the free plan. These cards show what Plus and Pro unlock.
      </p>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {features.map((feature) => {
          const included =
            props.role === "learner"
              ? learnerPackageIncludesFeature(props.currentPackageId, feature.minimumPackageId as LearnerPackageId)
              : instructorPackageIncludesFeature(props.currentPackageId, feature.minimumPackageId as InstructorPackageId);

          return (
            <article key={feature.key} className="rounded border border-zinc-200 bg-white p-4">
              <div className="flex items-start gap-3">
                {included ? (
                  <CheckCircle2 className="mt-1 shrink-0 text-emerald-600" size={20} />
                ) : (
                  <LockKeyhole className="mt-1 shrink-0 text-brand" size={20} />
                )}
                <div>
                  <p className="text-base font-black text-black">{feature.title}</p>
                  <p className="mt-2 text-sm font-bold leading-6 text-zinc-600">{feature.description}</p>
                  <p className="mt-3 text-xs font-black uppercase tracking-[0.12em] text-zinc-500">
                    {included ? "Included in your plan" : `Requires ${feature.minimumPackageId.replace(/-/g, " ")}`}
                  </p>
                </div>
              </div>
              {!included ? (
                <div className="mt-4">
                  {props.role === "learner" ? (
                    <LearnerPackageCheckoutButton
                      packageId={feature.minimumPackageId as LearnerPackageId}
                      currentPackageId={props.currentPackageId}
                      billingInterval="monthly"
                      label={`Upgrade to ${feature.minimumPackageId === "learner-pro" ? "Learner Pro" : "Learner Plus"}`}
                      featureKey={feature.key}
                      returnPath={props.returnPath}
                      compact
                    />
                  ) : (
                    <InstructorPackageCheckoutButton
                      packageId={feature.minimumPackageId as InstructorPackageId}
                      currentPackageId={props.currentPackageId}
                      billingInterval="monthly"
                      label={`Upgrade to ${feature.minimumPackageId === "instructor-pro" ? "Instructor Pro" : "Instructor Plus"}`}
                      featureKey={feature.key}
                      returnPath={props.returnPath}
                      disabled={props.packageLocked}
                      compact
                    />
                  )}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
