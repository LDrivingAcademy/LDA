import Link from "next/link";
import { CheckCircle2, Sparkles } from "lucide-react";

import { InstructorPackageCheckoutButton } from "@/components/instructor-package-checkout-button";
import {
  currentInstructorPackageId,
  getInstructorPackageActionLabel,
  type InstructorPackage,
} from "@/lib/instructor-packages";

type InstructorPackageCardProps = {
  instructorPackage: InstructorPackage;
};

export function InstructorPackageCard({ instructorPackage }: InstructorPackageCardProps) {
  const isCurrent = instructorPackage.id === currentInstructorPackageId;
  const actionLabel = getInstructorPackageActionLabel(instructorPackage.id);

  return (
    <article
      className={[
        "flex h-full flex-col rounded-md border bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl",
        instructorPackage.highlighted ? "border-brand bg-red-50" : "border-neutral-200",
      ].join(" ")}
    >
      <Link href={`/instructor-plus/${instructorPackage.slug}`} className="flex flex-1 flex-col">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-3xl font-black text-black">{instructorPackage.name}</h2>
          <span className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-xs font-black uppercase text-brand">
            {isCurrent ? "Current plan" : instructorPackage.label}
          </span>
        </div>
        <p className="mt-5 text-xl font-black text-brand">{instructorPackage.price}</p>
        <p className="mt-5 text-base font-bold leading-8 text-neutral-700">{instructorPackage.summary}</p>
        <ul className="mt-7 space-y-4 text-base font-bold text-neutral-800">
          {instructorPackage.features.map((feature) => (
            <li key={feature} className="flex gap-3">
              {instructorPackage.highlighted ? (
                <Sparkles className="mt-1 shrink-0 text-brand" size={18} />
              ) : (
                <CheckCircle2 className="mt-1 shrink-0 text-brand" size={18} />
              )}
              <span>{feature}</span>
            </li>
          ))}
        </ul>
        <span className="mt-7 block text-sm font-black text-brand">View full package details</span>
      </Link>
      <div className="mt-7">
        <InstructorPackageCheckoutButton
          packageId={instructorPackage.id}
          billingInterval="monthly"
          label={actionLabel}
          disabled={isCurrent}
          compact
        />
      </div>
    </article>
  );
}
