import { BadgeCheck } from "lucide-react";

import { InstructorPackageCard } from "@/components/instructor-package-card";
import { PageTopBar } from "@/components/page-top-bar";
import { getInstructorPackagePriceEnv } from "@/lib/instructor-packages";
import { instructorPackages } from "@/lib/instructor-packages";
import { getSubscriptionPricingContext } from "@/lib/subscription-pricing";
import { getStripeBackedSubscriptionStartingPrice } from "@/lib/stripe-price-display";

export const revalidate = 300;

export default async function InstructorPlusPage() {
  const backHref = "/";
  const backLabel = "Back to homepage";
  const fromDashboard = false;
  const currentPackageId = "instructor";
  const packageLocked = false;
  const pricingContext = getSubscriptionPricingContext(new Headers({ "x-vercel-ip-country": "GB" }));
  const displayPrices = new Map(
    await Promise.all(
      instructorPackages.map(async (instructorPackage) => [
        instructorPackage.id,
        await getStripeBackedSubscriptionStartingPrice({
          fallbackPence: instructorPackage.monthlyPricePence,
          priceEnvName: getInstructorPackagePriceEnv(instructorPackage.id, "monthly"),
          pricingContext,
        }),
      ] as const),
    ),
  );

  return (
    <main className="min-h-screen bg-white text-black">
      <PageTopBar backHref={backHref} backLabel={backLabel} />
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-5 sm:py-14">
        <div className="rounded-md border border-neutral-200 bg-white p-3 shadow-sm sm:p-10">
          <div className="inline-flex items-center gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-black uppercase text-brand">
            <BadgeCheck size={18} />
            Instructor packages
          </div>
          <h1 className="mt-8 max-w-4xl text-3xl font-black leading-tight tracking-tight text-black sm:text-6xl">
            Choose your LDA instructor package.
          </h1>
          <p className="mt-6 max-w-4xl text-base font-medium leading-7 sm:text-xl sm:leading-9 text-neutral-600">
            {packageLocked
              ? "Your instructor application is in progress. Instructor packages unlock once LDA approves your verification."
              : "Compare instructor growth tools and choose the monthly package that fits your teaching business."}
          </p>

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {instructorPackages.map((instructorPackage) => (
              <InstructorPackageCard
                key={instructorPackage.id}
                instructorPackage={instructorPackage}
                currentPackageId={currentPackageId}
                fromDashboard={fromDashboard}
                displayPrice={displayPrices.get(instructorPackage.id) ?? instructorPackage.price}
                packageLocked={packageLocked}
              />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
