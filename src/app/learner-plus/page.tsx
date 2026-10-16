import { PlusCircle } from "lucide-react";
import { LearnerPackageCard } from "@/components/learner-package-card";
import { PageTopBar } from "@/components/page-top-bar";
import { getPackagePriceEnv, learnerPackages } from "@/lib/learner-packages";
import { getSubscriptionPricingContext } from "@/lib/subscription-pricing";
import { getStripeBackedSubscriptionStartingPrice } from "@/lib/stripe-price-display";

export const revalidate = 300;

export default async function LearnerPlusPage() {
  const backHref = "/";
  const backLabel = "Back to homepage";
  const fromDashboard = false;
  const currentPackageId = "learner";
  const pricingContext = getSubscriptionPricingContext(new Headers({ "x-vercel-ip-country": "GB" }));
  const displayPrices = new Map(
    await Promise.all(
      learnerPackages.map(async (learnerPackage) => [
        learnerPackage.id,
        await getStripeBackedSubscriptionStartingPrice({
          fallbackPence: learnerPackage.monthlyPricePence,
          priceEnvName: getPackagePriceEnv(learnerPackage.id, "monthly"),
          pricingContext,
        }),
      ] as const),
    ),
  );

  return (
    <main className="min-h-screen bg-white text-black">
      <PageTopBar backHref={backHref} backLabel={backLabel} />
      <div className="mx-auto max-w-7xl px-4 py-8">
        <section className="rounded border border-zinc-200 bg-white p-3 shadow-sm sm:p-6">
          <div className="inline-flex items-center gap-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-black text-brand">
            <PlusCircle size={16} /> Learner Plus
          </div>
          <h1 className="mt-5 text-3xl font-black tracking-normal sm:text-5xl">Choose your LDA learner package.</h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-zinc-700">
            Compare learner support options and choose the monthly package that fits your driving journey.
          </p>
          <div className="mt-7 grid items-stretch gap-4 lg:grid-cols-3">
            {learnerPackages.map((learnerPackage) => (
              <LearnerPackageCard
                key={learnerPackage.id}
                learnerPackage={learnerPackage}
                currentPackageId={currentPackageId}
                fromDashboard={fromDashboard}
                displayPrice={displayPrices.get(learnerPackage.id) ?? learnerPackage.price}
              />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
