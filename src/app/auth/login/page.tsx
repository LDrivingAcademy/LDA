import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CarFront, GraduationCap, KeyRound, ShieldCheck } from "lucide-react";
import { LoginRememberHelper } from "@/components/auth/login-remember-helper";
import { PageTopBar } from "@/components/page-top-bar";
import { getHeaderAccountSummary } from "@/lib/current-account";
import { signIn } from "../actions";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ identifier?: string; message?: string; role?: string }>;
}) {
  const { identifier, message, role } = await searchParams;
  const isInstructor = role === "instructor";
  const nextPath = isInstructor ? "/instructor-dashboard" : "/learner-dashboard";
  const account = await getHeaderAccountSummary();

  if (account) {
    redirect(isInstructor && account.dashboardHref === "/instructor-dashboard" ? "/instructor-dashboard" : account.dashboardHref);
  }

  const rememberedIdentifier = identifier ?? (await cookies()).get("lda_remember_identifier")?.value ?? "";

  return (
    <main className="min-h-screen bg-white text-black">
      <PageTopBar />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_460px]">
          <section>
            <div className="inline-flex items-center gap-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-black text-brand">
              <ShieldCheck size={16} /> LDA secure access
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-normal sm:text-5xl">
              {isInstructor ? "Log in to your instructor account." : "Log in to your learner account."}
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-zinc-700">
              {isInstructor
                ? "Use the email or mobile number you used when you signed up, then continue managing onboarding, availability, and bookings."
                : "Use the email or mobile number you used when you signed up, then continue booking, tracking, and lesson progress."}
            </p>
            <Link href={`/auth/sign-up?role=${isInstructor ? "instructor" : "learner"}`} className="lda-pill lda-pill-sm mt-5">
              New to LDA? Sign up
            </Link>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Link href="/auth/login?role=learner" className={`rounded border p-4 ${!isInstructor ? "border-red-500 bg-red-500/10" : "border-zinc-200 bg-white"}`}>
                <GraduationCap className="mb-3 text-brand" />
                <div className="font-black">Learner</div>
                <p className="mt-1 text-sm leading-5 text-zinc-600">Search, compare, book, pay, and review.</p>
              </Link>
              <Link href="/auth/login?role=instructor" className={`rounded border p-4 ${isInstructor ? "border-red-500 bg-red-500/10" : "border-zinc-200 bg-white"}`}>
                <CarFront className="mb-3 text-brand" />
                <div className="font-black">Instructor</div>
                <p className="mt-1 text-sm leading-5 text-zinc-600">Verify, publish availability, manage bookings.</p>
              </Link>
            </div>
          </section>

          <section className="rounded border border-zinc-200 bg-white p-5 text-black shadow-2xl">
            <div className="mb-5">
              <div className="text-sm font-black uppercase text-brand">{isInstructor ? "Instructor access" : "Learner access"}</div>
              <h2 className="mt-1 text-2xl font-black">Account login</h2>
            </div>
            {message ? <div className="mb-4 rounded border border-red-500/30 bg-red-500/10 p-3 text-sm font-bold text-brand">{message}</div> : null}
            <form id="lda-account-login-form" action={signIn} className="grid gap-3" autoComplete="on">
              <input type="hidden" name="accountIntent" value={isInstructor ? "instructor" : "learner"} />
              <input type="hidden" name="next" value={nextPath} />
              <label className="grid gap-1">
                <span className="text-sm font-bold text-zinc-600">Email or mobile number</span>
                <input id="lda-login-identifier" required name="username" autoComplete="username" inputMode="email" autoCapitalize="none" spellCheck={false} defaultValue={rememberedIdentifier} className="rounded border border-zinc-300 bg-white px-3 py-3 text-black placeholder:text-zinc-600" placeholder="you@example.com or 07123 456789" />
              </label>
              <label className="grid gap-1">
                <span className="text-sm font-bold text-zinc-600">Password</span>
                <input id="lda-login-password" required name="password" type="password" autoComplete="current-password" className="rounded border border-zinc-300 bg-white px-3 py-3 text-black placeholder:text-zinc-600" placeholder="Your password" />
              </label>
              <label className="flex items-start gap-3 rounded border border-zinc-300 bg-white p-3 text-sm font-bold leading-6 text-zinc-700">
                <input name="rememberMe" type="checkbox" defaultChecked={Boolean(rememberedIdentifier)} className="mt-1 accent-red-600" />
                <span>
                  Remember me on this device
                  <span className="block text-xs font-medium leading-5 text-zinc-500">
                    LDA remembers your email or phone on this browser. Your browser can fill the password if you saved it.
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
          </section>
        </div>
      </div>
    </main>
  );
}
