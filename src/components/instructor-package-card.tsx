import Link from "next/link";
import { CheckCircle2, Sparkles } from "lucide-react";

import { InstructorPackageCheckoutButton } from "@/components/instructor-package-checkout-button";
import {
  getInstructorPackageActionLabel,
  type InstructorPackage,
  type InstructorPackageId,
} from "@/lib/instructor-packages";

type InstructorPackageCardProps = {
  instructorPackage: InstructorPackage;
  currentPackageId?: InstructorPackageId;
  fromDashboard?: boolean;
  displayPrice: string;
  packageLocked?: boolean;
};

export function InstructorPackageCard({
  instructorPackage,
  currentPackageId = "instructor",
  fromDashboard = false,
  displayPrice,
  packageLocked = false,
}: InstructorPackageCardProps) {
  const isCurrent = instructorPackage.id === currentPackageId;
  const actionLabel = packageLocked ? "In progress" : getInstructorPackageActionLabel(instructorPackage.id, currentPackageId);
  const cardBody = (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-col-reverse items-start gap-3 sm:flex-row sm:justify-between sm:gap-4">
        <h2 className="min-w-0 break-normal text-2xl font-black text-black sm:text-3xl">{instructorPackage.name}</h2>
        <span className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-xs font-black uppercase text-brand">
          {packageLocked ? "Application in progress" : isCurrent ? "Current plan" : instructorPackage.label}
        </span>
      </div>
      <p className="mt-5 text-xl font-black text-brand">{displayPrice}</p>
      <p className="mt-5 text-base font-bold leading-8 text-neutral-700">{instructorPackage.summary}</p>
      <ul className="mt-7 space-y-4 text-base font-bold text-neutral-800">
        {instructorPackage.features.map((feature) => (
          <li key={feature} className="flex gap-3">
            {isCurrent ? (
              <Sparkles className="mt-1 shrink-0 text-brand" size={18} />
            ) : (
              <CheckCircle2 className="mt-1 shrink-0 text-brand" size={18} />
            )}
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <span className="mt-7 block text-sm font-black text-brand">
        {packageLocked ? "Packages unlock after LDA approval" : "View full package details"}
      </span>
    </div>
  );

  return (
    <article
      className={[
        "group relative flex h-full flex-col rounded-md border bg-white p-4 shadow-sm sm:p-6 transition focus-within:border-brand focus-within:ring-2 focus-within:ring-brand focus-within:shadow-xl hover:-translate-y-1 hover:border-brand hover:ring-2 hover:ring-brand hover:shadow-xl",
        isCurrent ? "border-brand bg-red-50 ring-2 ring-brand shadow-lg" : "border-neutral-200",
      ].join(" ")}
    >
      {packageLocked ? cardBody : (
        <Link href={`/instructor-plus/${instructorPackage.slug}${fromDashboard ? "?from=dashboard" : ""}`} className="flex flex-1 flex-col focus:outline-none">
          {cardBody}
        </Link>
      )}
      <div className="mt-7">
        <InstructorPackageCheckoutButton
          packageId={instructorPackage.id}
          currentPackageId={currentPackageId}
          billingInterval="monthly"
          label={actionLabel.replace("Upgrade to Instructor ", "Upgrade to ")}
          disabled={packageLocked || isCurrent}
          compact
        />
      </div>
    </article>
  );
}
