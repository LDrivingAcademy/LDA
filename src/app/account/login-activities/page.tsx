import type { Metadata } from "next";
import { Activity } from "lucide-react";
import { AccountLoginActivityPanel } from "@/components/account-login-activity-panel";
import { Brand } from "@/components/brand";
import { DynamicBackLink } from "@/components/dynamic-back-link";
import { LoginActivityReporter } from "@/components/login-activity-reporter";
import { getLoginDevices } from "@/lib/login-activity";
import { requireSignedInPage } from "@/lib/page-auth";

export const metadata: Metadata = {
  title: "Login Activities | L Driving Academy",
  description: "Review recent LDA account sign-in activity.",
  robots: {
    index: false,
    follow: false
  }
};

export const dynamic = "force-dynamic";

export default async function LoginActivitiesPage() {
  const { supabase, user, roleState } = await requireSignedInPage("Sign in before viewing your login activities.");
  const accountRole = roleState.effectiveRole === "instructor" ? "instructor" : "learner";
  const loginDevices = await getLoginDevices(supabase, user.id);

  return (
    <>
      <LoginActivityReporter shouldRecord />
      <main className="min-h-screen bg-white text-black">
        <header className="lda-universal-topbar border-b border-zinc-200 bg-black text-white">
          <div className="lda-universal-topbar-inner flex w-full items-center justify-between gap-4 px-[15px]">
            <div className="flex min-w-0 items-center gap-5">
              <Brand size="home" href="/dashboard" label="LDA account" />
              <div className="min-w-0">
                <div className="text-sm font-black uppercase text-red-200">LDA Account</div>
                <h1 className="mt-1 truncate text-xl font-black sm:text-2xl">Login activities</h1>
              </div>
            </div>
            <DynamicBackLink
              fallbackHref="/account"
              fallbackLabel="Back to account"
              className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-black text-white transition"
            />
          </div>
        </header>

        <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-black uppercase text-brand">
            <Activity size={16} /> Account security
          </div>
          <h2 className="mt-5 text-4xl font-black tracking-normal">Your login activities</h2>
          <p className="mt-3 max-w-3xl text-base font-semibold leading-7 text-zinc-700">
            Review the devices and approximate locations that have signed in to your LDA account.
          </p>
          <div className="mt-7">
            <AccountLoginActivityPanel loginActivities={loginDevices} accountRole={accountRole} />
          </div>
        </section>
      </main>
    </>
  );
}
