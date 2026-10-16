import { redirect } from "next/navigation";
import { CreditCard } from "lucide-react";
import { LearnerPaymentHelp } from "@/components/learner-payment-help";
import { PageTopBar } from "@/components/page-top-bar";
import { SiteFooter } from "@/components/site-footer";
import { redirectIfWrongMarketplaceRole } from "@/lib/account-route-guard";
import { getLearnerPaymentHelpData } from "@/lib/learner-payment-help";
import { requireSignedInPage } from "@/lib/page-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PaymentHelpPageProps = {
  searchParams?: Promise<{ message?: string; submitted?: string }>;
};

export default async function PaymentHelpPage({ searchParams }: PaymentHelpPageProps) {
  const { supabase, user } = await requireSignedInPage("Sign in to get help with a learner payment.");
  await redirectIfWrongMarketplaceRole(supabase, user.id, "learner");
  if (!user.email) redirect("/account/personal-info?message=Add an email address before opening payment support.");

  const [paymentData, resolvedSearchParams] = await Promise.all([
    getLearnerPaymentHelpData(supabase, user.id),
    searchParams
  ]);

  return (
    <>
      <PageTopBar backHref="/support/learner" backLabel="Back to learner support" />
      <main className="min-h-screen bg-white text-black">
        <section className="bg-black text-white">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
            <div className="inline-flex items-center gap-2 rounded border border-red-500/60 bg-red-500/15 px-3 py-2 text-sm font-black text-red-100">
              <CreditCard size={18} /> Learner support
            </div>
            <h1 className="mt-5 text-5xl font-black tracking-normal sm:text-6xl">Payment Help</h1>
            <p className="mt-5 max-w-3xl text-lg font-semibold leading-8 text-zinc-300">
              Get help with payment issues, refunds, booking charges and payment confirmations.
            </p>
          </div>
        </section>
        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
          <LearnerPaymentHelp
            {...paymentData}
            message={resolvedSearchParams?.message}
            submitted={resolvedSearchParams?.submitted}
          />
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

