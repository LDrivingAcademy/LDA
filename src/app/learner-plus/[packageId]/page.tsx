import { notFound, redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { CheckCircle2, Sparkles } from "lucide-react";
import { LearnerPackageCheckoutButton } from "@/components/learner-package-checkout-button";
import { PageTopBar } from "@/components/page-top-bar";
import { redirectIfWrongMarketplaceRole } from "@/lib/account-route-guard";
import { getSignedInLearnerPackageId, isSignedInAdmin } from "@/lib/account-package-state";
import {
  getLearnerPackage,
  getPackagePriceEnv,
  getPackageActionLabel,
  learnerPackages
} from "@/lib/learner-packages";
import { getPageBackLink } from "@/lib/page-back-link";
import { getSubscriptionPricingContext } from "@/lib/subscription-pricing";
import { getStripeBackedSubscriptionPrice } from "@/lib/stripe-price-display";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseAuthCookie } from "@/lib/supabase/auth-cookie";

type LearnerPackageDetailPageProps = {
  params: Promise<{
    packageId: string;
  }>;
  searchParams: Promise<{
    checkout?: string;
    billing?: string;
    from?: string;
  }>;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

  const hasAuthSession = hasSupabaseAuthCookie((await cookies()).getAll());

  if (hasAuthSession) {
    if (await isSignedInAdmin()) {
      redirect("/admin");
    }

    const supabase = await createClient();
    const {
      data: { user }
    } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
    if (supabase && user) {
      await redirectIfWrongMarketplaceRole(supabase, user.id, "learner");
    }
  }

  const currentPackageId = hasAuthSession ? await getSignedInLearnerPackageId() : "learner";
  const isCurrentPlan = learnerPackage.id === currentPackageId;
  const actionLabel = getPackageActionLabel(learnerPackage.id, currentPackageId);
  const { backHref, backLabel } = await getPageBackLink(Promise.resolve(query));
  const pricingContext = getSubscriptionPricingContext(await headers());
  const monthlyPrice = await getStripeBackedSubscriptionPrice({
    fallbackPence: learnerPackage.monthlyPricePence,
    priceEnvName: getPackagePriceEnv(learnerPackage.id, "monthly"),
    pricingContext,
  });

  return (
    <main className="min-h-screen bg-white text-black">
      <PageTopBar backHref={backHref} backLabel={backLabel} />
      <div className="mx-auto max-w-5xl px-4 py-8">
        {query.checkout === "success" ? (
          <div className="mb-5 rounded border border-red-500/30 bg-red-500/10 p-4 text-sm font-black text-brand">
            Stripe checkout returned successfully for {learnerPackage.name} {query.billing ? `(${query.billing})` : ""}. LDA will update this learner account automatically once Stripe confirms the subscription.
          </div>
        ) : null}
        {query.checkout === "cancelled" ? (
          <div className="mb-5 rounded border border-zinc-200 bg-white p-4 text-sm font-black text-zinc-700">
            Checkout was cancelled. You can choose the monthly package when you are ready.
          </div>
        ) : null}
        <section className="rounded border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="inline-flex items-center gap-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-black text-brand">
            <Sparkles size={16} /> {learnerPackage.label}
          </div>
          <h1 className="mt-5 text-4xl font-black tracking-normal sm:text-5xl">{learnerPackage.name}</h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-zinc-700">{learnerPackage.summary}</p>

          <div className="mt-7 max-w-xl">
            <div className="rounded border border-zinc-200 bg-white p-5">
              <p className="text-sm font-black uppercase text-zinc-500">Monthly</p>
              <p className="mt-2 text-2xl font-black text-brand">{monthlyPrice}</p>
              <p className="mt-3 text-sm font-bold leading-6 text-zinc-700">
                Flexible monthly access with secure LDA checkout.
              </p>
              <div className="mt-5">
                <LearnerPackageCheckoutButton
                  packageId={learnerPackage.id}
                  currentPackageId={currentPackageId}
                  billingInterval="monthly"
                  label={isCurrentPlan ? "Current plan" : `${actionLabel} monthly`}
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
            <p className="mt-2 text-sm font-bold leading-6 text-zinc-600">
              This is the practical value included with {learnerPackage.name}. Core booking, payment, safety, support, and account tools remain available on the free Learner plan.
            </p>
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
