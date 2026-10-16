import { Brand } from "@/components/brand";
import { DynamicBackLink } from "@/components/dynamic-back-link";
import { ProvisionalLicenceVerificationForm } from "@/components/provisional-licence-verification-form";
import { redirectIfWrongMarketplaceRole } from "@/lib/account-route-guard";
import { requireSignedInPage } from "@/lib/page-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = {
  title: "Provisional licence | LDA Account",
  robots: {
    index: false,
    follow: false,
    nocache: true
  }
};

export default async function ProvisionalLicencePage() {
  const { supabase, user } = await requireSignedInPage("Sign in before updating your provisional driving licence.");
  await redirectIfWrongMarketplaceRole(supabase, user.id, "learner");

  const { data: learnerProfile } = await supabase
    .from("learner_profiles")
    .select("provisional_licence_confirmed_at")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <main className="min-h-screen bg-white text-black">
      <header className="lda-universal-topbar border-b border-zinc-200 bg-black text-white">
        <div className="lda-universal-topbar-inner flex w-full items-center justify-between gap-4 px-[15px]">
          <div className="flex min-w-0 items-center gap-5">
            <Brand size="home" href="/dashboard" label="LDA learner dashboard" />
            <div className="min-w-0">
              <div className="text-sm font-black uppercase text-red-200">LDA Account</div>
              <h1 className="mt-1 truncate text-xl font-black sm:text-2xl">Change provisional licence</h1>
            </div>
          </div>
          <DynamicBackLink
            fallbackHref="/account"
            fallbackLabel="Back to account"
            className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-black text-white transition"
          />
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <ProvisionalLicenceVerificationForm
          provisionalLicenceConfirmedAt={learnerProfile?.provisional_licence_confirmed_at ?? null}
          initialLicenceNumber={
            typeof user.user_metadata?.provisional_licence_number === "string"
              ? user.user_metadata.provisional_licence_number
              : ""
          }
        />
      </section>
    </main>
  );
}
