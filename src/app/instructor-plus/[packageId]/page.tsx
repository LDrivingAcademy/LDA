import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2, Sparkles } from "lucide-react";

import { InstructorPackageCheckoutButton } from "@/components/instructor-package-checkout-button";
import { PageTopBar } from "@/components/page-top-bar";
import { SubscriptionLockedFeatureGrid } from "@/components/subscription-locked-feature-grid";
import { redirectIfWrongMarketplaceRole } from "@/lib/account-route-guard";
import { getSignedInInstructorPackageAccess, isSignedInAdmin } from "@/lib/account-package-state";
import {
  getInstructorPackage,
  getInstructorPackageActionLabel,
  getInstructorPackagePriceEnv,
  instructorPackages,
} from "@/lib/instructor-packages";
import { getPageBackLink } from "@/lib/page-back-link";
import { getSubscriptionPricingContext } from "@/lib/subscription-pricing";
import {
  getStripeBackedSubscriptionPrice,
  getStripeBackedSubscriptionStartingPrice,
} from "@/lib/stripe-price-display";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseAuthCookie } from "@/lib/supabase/auth-cookie";

type InstructorPackageDetailPageProps = {
  params: Promise<{ packageId: string }>;
  searchParams: Promise<{ checkout?: string; billing?: string; from?: string }>;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export function generateStaticParams() {
  return instructorPackages.map((instructorPackage) => ({ packageId: instructorPackage.slug }));
}

export async function generateMetadata({ params }: InstructorPackageDetailPageProps): Promise<Metadata> {
  const { packageId } = await params;
  const instructorPackage = getInstructorPackage(packageId);

  return {
    title: instructorPackage
      ? `${instructorPackage.name} | L Driving Academy`
      : "Instructor package | L Driving Academy",
  };
}

export default async function InstructorPackageDetailPage({
  params,
  searchParams,
}: InstructorPackageDetailPageProps) {
  const [{ packageId }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const instructorPackage = getInstructorPackage(packageId);

  if (!instructorPackage) {
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
      await redirectIfWrongMarketplaceRole(supabase, user.id, "instructor");
    }
  }

  const instructorAccess = hasAuthSession
    ? await getSignedInInstructorPackageAccess()
    : {
        packageId: "instructor" as const,
        verificationStatus: null,
        isApproved: false,
        isApplicationInProgress: false
      };
  const currentPackageId = instructorAccess.packageId;
  const packageLocked = instructorAccess.isApplicationInProgress;
  const isCurrent = instructorPackage.id === currentPackageId;
  const checkoutState = resolvedSearchParams.checkout;
  const { backHref, backLabel } = await getPageBackLink(Promise.resolve(resolvedSearchParams));
  const pricingContext = getSubscriptionPricingContext(await headers());
  const priceEnvName = getInstructorPackagePriceEnv(instructorPackage.id, "monthly");
  const displayPrice = await getStripeBackedSubscriptionStartingPrice({
    fallbackPence: instructorPackage.monthlyPricePence,
    priceEnvName,
    pricingContext,
  });
  const monthlyPrice = await getStripeBackedSubscriptionPrice({
    fallbackPence: instructorPackage.monthlyPricePence,
    priceEnvName,
    pricingContext,
  });

  return (
    <main className="min-h-screen bg-white text-black">
      <PageTopBar backHref={backHref} backLabel={backLabel} />
      <section className="mx-auto max-w-6xl px-5 py-14">
        <div className="rounded-md border border-neutral-200 bg-white p-6 shadow-sm sm:p-10">
          {checkoutState === "success" ? (
            <div className="mb-8 rounded-md border border-green-200 bg-green-50 p-5 text-base font-bold text-green-800">
              Subscription checkout completed. LDA will update this instructor account
              automatically once Stripe confirms the subscription.
            </div>
          ) : null}
          {checkoutState === "cancelled" ? (
            <div className="mb-8 rounded-md border border-red-200 bg-red-50 p-5 text-base font-bold text-brand">
              Checkout was cancelled. You can choose a package again when you are ready.
            </div>
          ) : null}

          <div className="inline-flex items-center gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-black uppercase text-brand">
            <Sparkles size={18} />
            {instructorPackage.label}
          </div>
          <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_360px]">
            <div>
              <h1 className="text-5xl font-black leading-tight text-black sm:text-6xl">
                {instructorPackage.name}
              </h1>
              <p className="mt-5 text-2xl font-black text-brand">{displayPrice}</p>
              <p className="mt-6 text-xl font-medium leading-9 text-neutral-600">
                {packageLocked
                  ? "Your instructor application is in progress. LDA package changes unlock once your verification is approved."
                  : instructorPackage.summary}
              </p>

              <div className="mt-10 grid gap-4 sm:grid-cols-2">
                {instructorPackage.breakdown.map((item) => (
                  <section key={item.heading} className="rounded-md border border-neutral-200 bg-white p-5">
                    <h2 className="text-xl font-black text-black">{item.heading}</h2>
                    <p className="mt-3 text-base font-medium leading-7 text-neutral-600">{item.body}</p>
                  </section>
                ))}
              </div>
            </div>

            <aside className="rounded-md border border-neutral-200 bg-neutral-50 p-5">
              <h2 className="text-2xl font-black text-black">Monthly billing</h2>
              <div className="mt-5 space-y-4">
                <div className="rounded-md border border-neutral-200 bg-white p-4">
                  <p className="text-sm font-black uppercase text-neutral-500">Monthly</p>
                  <p className="mt-2 text-xl font-black text-black">{monthlyPrice}</p>
                  <p className="mt-2 text-sm font-medium leading-6 text-neutral-600">
                    Flexible monthly access with secure LDA checkout.
                  </p>
                  <div className="mt-4">
                    <InstructorPackageCheckoutButton
                      packageId={instructorPackage.id}
                      currentPackageId={currentPackageId}
                      billingInterval="monthly"
                      label={packageLocked ? "In progress" : getInstructorPackageActionLabel(instructorPackage.id, currentPackageId)}
                      disabled={packageLocked || isCurrent}
                      compact
                    />
                  </div>
                </div>
              </div>
            </aside>
          </div>

          <section className="mt-10 rounded-md border border-neutral-200 bg-white p-6">
            <h2 className="text-2xl font-black text-black">Included features</h2>
            <ul className="mt-5 grid gap-4 sm:grid-cols-2">
              {instructorPackage.features.map((feature) => (
                <li key={feature} className="flex gap-3 text-base font-bold text-neutral-800">
                  <CheckCircle2 className="mt-1 shrink-0 text-brand" size={18} />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </section>
          <SubscriptionLockedFeatureGrid
            role="instructor"
            currentPackageId={currentPackageId}
            returnPath={`/instructor-plus/${instructorPackage.slug}`}
            packageLocked={packageLocked}
          />
        </div>
      </section>
    </main>
  );
}
