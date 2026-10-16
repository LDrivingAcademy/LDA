import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { KeyRound, ShieldCheck } from "lucide-react";
import { Brand } from "@/components/brand";
import { PasswordInput } from "@/components/password-input";
import {
  hasApprovedTechnicalSupportRole
} from "@/lib/technical-support-access";
import {
  hasValidTechnicalSupportEntry,
  technicalSupportEntryCookieName
} from "@/lib/technical-support-entry";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = {
  title: "Technical team sign in | L Driving Academy",
  robots: { index: false, follow: false, nocache: true }
};

export default async function TechnicalSupportAccessPage({
  searchParams
}: {
  searchParams: Promise<{ message?: string; identifier?: string }>;
}) {
  const { message, identifier } = await searchParams;
  const cookieStore = await cookies();
  const hasEntry = hasValidTechnicalSupportEntry(
    cookieStore.get(technicalSupportEntryCookieName)?.value
  );

  if (hasEntry) {
    const supabase = await createClient();
    if (supabase) {
      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (user && (await hasApprovedTechnicalSupportRole(supabase, user))) {
        const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        redirect(aal?.currentLevel === "aal2" ? "/technical-support" : "/technical-support-mfa");
      }
    }
  }

  return (
    <main className="min-h-screen bg-white text-black">
      <header className="lda-universal-topbar border-b border-zinc-800 bg-black text-white">
        <div className="lda-universal-topbar-inner mx-auto flex max-w-6xl items-center justify-between px-4">
          <Brand size="home" href="/technical-support-access" label="LDA technical support access" />
          <div className="text-sm font-black text-zinc-300">Secure technical access</div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_460px]">
          <section>
            <div className="inline-flex items-center gap-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-black text-brand">
              <ShieldCheck size={16} /> LDA technical team
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-normal sm:text-5xl">
              Sign in to technical support.
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-zinc-700">
              This secure workspace is for approved LDA technical support personnel.
              Sign in to review support cases, monitor service issues, investigate platform
              feedback, and coordinate the next action for the LDA operations team.
            </p>
            <div className="mt-6 max-w-2xl rounded border border-zinc-200 bg-zinc-50 p-4 text-sm font-semibold leading-6 text-zinc-700">
              Access is limited to technical support duties. Customer account changes,
              bookings, payments, and business decisions remain controlled through the
              approved LDA admin process.
            </div>
          </section>

          <section className="rounded border border-zinc-200 bg-white p-5 shadow-2xl">
            <div className="mb-5">
              <div className="text-sm font-black uppercase text-brand">Technical team sign in</div>
              <h2 className="mt-1 text-2xl font-black">Protected access</h2>
            </div>
            {message ? (
              <div className="mb-4 rounded border border-red-500/30 bg-red-500/10 p-3 text-sm font-bold text-brand">
                {message}
              </div>
            ) : null}
            <form action="/api/auth/technical-support-sign-in" method="post" className="grid gap-3" autoComplete="on">
              <input type="hidden" name="accountIntent" value="support" />
              <input type="hidden" name="next" value="/technical-support-mfa" />
              <label className="grid gap-1">
                <span className="text-sm font-bold text-zinc-600">Work email</span>
                <input
                  required
                  name="username"
                  type="email"
                  autoComplete="username"
                  inputMode="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  defaultValue={identifier ?? ""}
                  className="rounded border border-zinc-300 bg-white px-3 py-3 text-black placeholder:text-zinc-600"
                  placeholder="support@ldrivingacademy.co.uk"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-sm font-bold text-zinc-600">Password</span>
                <PasswordInput
                  required
                  name="password"
                  autoComplete="current-password"
                  className="w-full rounded border border-zinc-300 bg-white px-3 py-3 text-black placeholder:text-zinc-600"
                  placeholder="Your password"
                />
              </label>
              <div className="rounded border border-zinc-200 bg-zinc-50 p-3 text-sm font-bold leading-6 text-zinc-700">
                An approved authenticator code is required after your password.
              </div>
              <button className="lda-pill mt-2">
                <KeyRound size={18} /> Continue to authenticator
              </button>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
