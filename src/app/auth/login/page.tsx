import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CarFront, GraduationCap, KeyRound, ShieldCheck } from "lucide-react";
import { LoginRememberHelper } from "@/components/auth/login-remember-helper";
import { PageTopBar } from "@/components/page-top-bar";
import { PasswordInput } from "@/components/password-input";
import { getHeaderAccountSummary } from "@/lib/current-account";
import { signIn } from "../actions";

export const metadata: Metadata = {
  title: "Secure Login | L Driving Academy",
  description: "Secure L Driving Academy account access for learners and instructors.",
  robots: {
    index: false,
    follow: false,
    nocache: true
  }
};

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ identifier?: string; message?: string; next?: string; role?: string }>;
}) {
  const { identifier, message, next, role } = await searchParams;
  const isInstructor = role === "instructor";
  const isRoleLocked = role === "learner" || role === "instructor";
  const nextPath = next?.startsWith("/") && !next.startsWith("//") ? next : isInstructor ? "/instructor-dashboard" : "/learner-dashboard";
  const signUpHref = isRoleLocked
    ? `/auth/sign-up?role=${isInstructor ? "instructor" : "learner"}&next=${encodeURIComponent(nextPath)}`
    : next
      ? `/auth/sign-up?next=${encodeURIComponent(nextPath)}`
      : "/auth/sign-up";
  const learnerLoginHref = `/auth/login?role=learner&next=${encodeURIComponent(nextPath)}`;
  const instructorLoginHref = `/auth/login?role=instructor&next=${encodeURIComponent(nextPath)}`;
  const account = await getHeaderAccountSummary();

  if (account && !message && !isRoleLocked && !next) {
    redirect(isRoleLocked ? nextPath : account.dashboardHref);
  }

  const rememberedIdentifier = identifier ?? (await cookies()).get("lda_remember_identifier")?.value ?? "";

  return (
    <main className="min-h-screen bg-white text-black">
      <PageTopBar />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className={`grid gap-6 ${isRoleLocked ? "lg:grid-cols-[1fr_460px]" : ""}`}>
          <section>
            <div className="inline-flex items-center gap-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-black text-brand">
              <ShieldCheck size={16} /> LDA secure access
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-normal sm:text-5xl">
              {isRoleLocked ? (isInstructor ? "Log in to your instructor account." : "Log in to your learner account.") : "Log in to your LDA account."}
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-zinc-700">
              {!isRoleLocked
                ? "Choose learner or instructor access first, then continue with the email or mobile number linked to that account."
                : isInstructor
                ? "Use the email or mobile number you used when you signed up, then continue managing onboarding, availability, and bookings."
                : "Use the email or mobile number you used when you signed up, then continue booking, tracking, and lesson progress."}
            </p>
            <Link href={signUpHref} className="lda-pill lda-pill-sm mt-5">
              New to LDA? Sign up
            </Link>
            {!isRoleLocked && message ? <div className="mt-4 rounded border border-red-500/30 bg-red-500/10 p-3 text-sm font-bold text-brand">{message}</div> : null}
            <div className={`mt-6 grid gap-3 ${isRoleLocked ? "max-w-md" : "sm:grid-cols-2"}`}>
              {!isRoleLocked || !isInstructor ? (
                <Link href={learnerLoginHref} className={`rounded border p-4 ${role === "learner" ? "border-red-500 bg-red-500/10" : "border-zinc-200 bg-white"}`}>
                  <GraduationCap className="mb-3 text-brand" />
                  <div className="font-black">Learner</div>
                  <p className="mt-1 text-sm leading-5 text-zinc-600">Search, compare, book, pay, and review.</p>
                </Link>
              ) : null}
              {!isRoleLocked || isInstructor ? (
                <Link href={instructorLoginHref} className={`rounded border p-4 ${isInstructor ? "border-red-500 bg-red-500/10" : "border-zinc-200 bg-white"}`}>
                  <CarFront className="mb-3 text-brand" />
                  <div className="font-black">Instructor</div>
                  <p className="mt-1 text-sm leading-5 text-zinc-600">Verify, publish availability, manage bookings.</p>
                </Link>
              ) : null}
            </div>
          </section>

          {isRoleLocked ? <section className="rounded border border-zinc-200 bg-white p-5 text-black shadow-2xl">
            <div className="mb-5">
              <div className="text-sm font-black uppercase text-brand">{isInstructor ? "Instructor access" : "Learner access"}</div>
              <h2 className="mt-1 text-2xl font-black">Account login</h2>
            </div>
            {message ? <div className="mb-4 rounded border border-red-500/30 bg-red-500/10 p-3 text-sm font-bold text-brand">{message}</div> : null}
            <>
              <form id="lda-account-login-form" action={signIn} className="grid gap-3" autoComplete="on">
                <input type="hidden" name="accountIntent" value={isInstructor ? "instructor" : "learner"} />
                <input type="hidden" name="next" value={nextPath} />
                <label className="grid gap-1">
                  <span className="text-sm font-bold text-zinc-600">Email or mobile number</span>
                  <input id="lda-login-identifier" required name="username" autoComplete="username" inputMode="email" autoCapitalize="none" spellCheck={false} defaultValue={rememberedIdentifier} className="rounded border border-zinc-300 bg-white px-3 py-3 text-black placeholder:text-zinc-600" placeholder="you@example.com or 07123 456789" />
                </label>
                <label className="grid gap-1">
                  <span className="text-sm font-bold text-zinc-600">Password</span>
                  <PasswordInput id="lda-login-password" required name="password" autoComplete="current-password" className="w-full rounded border border-zinc-300 bg-white px-3 py-3 text-black placeholder:text-zinc-600" placeholder="Your password" />
                </label>
                <label className="flex items-start gap-3 rounded border border-zinc-300 bg-white p-3 text-sm font-bold leading-6 text-zinc-700">
                  <input name="rememberMe" type="checkbox" defaultChecked={Boolean(rememberedIdentifier)} className="mt-1 accent-red-600" />
                  <span>
                    Remember me on this device
                    <span className="block text-xs font-medium leading-5 text-zinc-500">
                      Creates a 30-day trusted device session for {isInstructor ? "instructor" : "learner"} access. Do not use this on a shared device.
                    </span>
                  </span>
                </label>
                <button className="lda-pill mt-2">
                  <KeyRound size={18} /> Log in
                </button>
                <LoginRememberHelper formId="lda-account-login-form" rememberedIdentifier={rememberedIdentifier} />
              </form>
              <p className="mt-4 text-xs leading-5 text-zinc-500">
                Verification is only used when you first sign up or reset your password. Returning accounts log in with the email or mobile number and password already linked to the account.
              </p>
              <Link href={`/auth/forgot-password?role=${isInstructor ? "instructor" : "learner"}`} className="mt-4 inline-flex text-sm font-black text-brand underline decoration-brand decoration-2 underline-offset-4 hover:text-brand">
                Forgot password?
              </Link>
            </>
          </section> : null}
        </div>
      </div>
    </main>
  );
}
