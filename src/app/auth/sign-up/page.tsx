import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowRight, CarFront, GraduationCap, MailCheck, ShieldCheck } from "lucide-react";
import { PageTopBar } from "@/components/page-top-bar";
import { PasswordInput } from "@/components/password-input";
import { SignUpPasswordHelper } from "@/components/auth/sign-up-password-helper";
import { getHeaderAccountSummary } from "@/lib/current-account";
import { signOut, signUp } from "../actions";

export const metadata: Metadata = {
  title: "Secure Sign Up | L Driving Academy",
  description: "Create a protected L Driving Academy learner or instructor account.",
  robots: {
    index: false,
    follow: false,
    nocache: true
  }
};

export default async function SignUpPage({
  searchParams
}: {
  searchParams: Promise<{ message?: string; next?: string; role?: string; entry?: string }>;
}) {
  const { message, next, role, entry } = await searchParams;
  const isInstructor = role === "instructor";
  const isRoleLocked = role === "learner" || role === "instructor";
  const isGuestInstructorEntry = isInstructor && entry === "guest-instructor";
  const nextPath = next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  const loginHref = isRoleLocked
    ? `/auth/login?role=${isInstructor ? "instructor" : "learner"}&next=${encodeURIComponent(nextPath)}`
    : next
      ? `/auth/login?next=${encodeURIComponent(nextPath)}`
      : "/auth/login";
  const learnerSignUpHref = `/auth/sign-up?role=learner&next=${encodeURIComponent(nextPath)}`;
  const instructorSignUpHref = isGuestInstructorEntry
    ? `/auth/sign-up?role=instructor&entry=guest-instructor&next=${encodeURIComponent(nextPath)}`
    : `/auth/sign-up?role=instructor&next=${encodeURIComponent(nextPath)}`;
  const account = await getHeaderAccountSummary();

  if (account && !isRoleLocked) {
    redirect(account.dashboardHref);
  }

  if (account && account.role === (isInstructor ? "instructor" : "learner")) {
    redirect(nextPath);
  }
  const roleMismatch = Boolean(account);

  return (
    <main className="min-h-screen bg-white text-black">
      <PageTopBar backHref="/" backLabel="Back to homepage" />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className={`grid gap-6 ${isRoleLocked ? "lg:grid-cols-[1fr_500px]" : ""}`}>
          <section>
            <div className="inline-flex items-center gap-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-black text-brand">
              <ShieldCheck size={16} /> LDA secure sign up
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-normal sm:text-5xl">
              {isRoleLocked ? (isInstructor ? "Create your instructor account." : "Create your learner account.") : "Create your LDA account."}
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-zinc-700">
              {isRoleLocked
                ? "Sign up once with your email. LDA uses email confirmation to protect accounts, then asks for your profile details on the next secure step."
                : "Choose learner or instructor sign-up first. LDA will then show the correct account setup for that journey."}
            </p>
            <Link href={loginHref} className="lda-pill lda-pill-sm mt-5">
              Already have an account? Log in
            </Link>
            {!isRoleLocked && message ? <div className="mt-4 rounded border border-red-500/30 bg-red-500/10 p-3 text-sm font-bold text-brand">{message}</div> : null}
            <div className={`mt-6 grid gap-3 ${isRoleLocked || isGuestInstructorEntry ? "max-w-md" : "sm:grid-cols-2"}`}>
              {!isRoleLocked || !isInstructor ? (
                <Link href={learnerSignUpHref} className={`rounded border p-4 ${role === "learner" ? "border-red-500 bg-red-500/10" : "border-zinc-200 bg-white"}`}>
                  <GraduationCap className="mb-3 text-brand" />
                  <div className="font-black">Learner</div>
                  <p className="mt-1 text-sm leading-5 text-zinc-600">Verify age, provisional licence, and start booking.</p>
                </Link>
              ) : null}
              {!isRoleLocked || isInstructor ? (
                <Link href={instructorSignUpHref} className={`rounded border p-4 ${isInstructor ? "border-red-500 bg-red-500/10" : "border-zinc-200 bg-white"}`}>
                  <CarFront className="mb-3 text-brand" />
                  <div className="font-black">Instructor</div>
                  <p className="mt-1 text-sm leading-5 text-zinc-600">Verify ADI status and publish availability.</p>
                </Link>
              ) : null}
            </div>
          </section>

          {isRoleLocked ? <section className="rounded border border-zinc-200 bg-white p-5 text-black shadow-2xl">
            <div className="mb-5">
              <div className="text-sm font-black uppercase text-brand">{isInstructor ? "Instructor sign up" : "Learner sign up"}</div>
              <h2 className="mt-1 text-2xl font-black">Create and verify account</h2>
            </div>
            {message ? <div className="mb-4 rounded border border-red-500/30 bg-red-500/10 p-3 text-sm font-bold text-brand">{message}</div> : null}
            {roleMismatch ? (
              <div className="grid gap-4">
                <div className="rounded border border-zinc-200 bg-zinc-50 p-4 text-sm font-bold leading-6 text-zinc-700">
                  {isInstructor
                    ? "You are signed in as a learner. To use instructor features, sign up with a separate instructor email or request a learner-to-instructor transfer."
                    : "You are signed in as an instructor. Sign out of this account to use learner features, then log in to or create a learner account."}
                </div>
                {isInstructor ? (
                  <Link href="/account/instructor-transfer" className="lda-pill">
                    Request instructor transfer <ArrowRight size={18} />
                  </Link>
                ) : (
                  <form action={signOut}>
                    <button className="lda-pill w-full">
                      Sign out to use learner account <ArrowRight size={18} />
                    </button>
                  </form>
                )}
                <Link href={account?.dashboardHref ?? "/"} className="text-sm font-black text-brand underline decoration-brand decoration-2 underline-offset-4">
                  Back to your dashboard
                </Link>
              </div>
            ) : (
              <>
                <form id="lda-account-signup-form" action={signUp} className="grid gap-3" autoComplete="on">
                  <input type="hidden" name="accountIntent" value={isInstructor ? "instructor" : "learner"} />
                  <input type="hidden" name="next" value={nextPath} />
                  <label className="grid gap-1">
                    <span className="text-sm font-bold text-zinc-600">Email</span>
                    <input id="lda-signup-email" required name="email" type="email" autoComplete="username email" inputMode="email" autoCapitalize="none" spellCheck={false} className="rounded border border-zinc-300 bg-white px-3 py-3 text-black placeholder:text-zinc-600" placeholder="you@example.com" />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-sm font-bold text-zinc-600">Create password</span>
                    <PasswordInput id="lda-signup-password" required name="password" minLength={8} autoComplete="new-password" className="w-full rounded border border-zinc-300 bg-white px-3 py-3 text-black placeholder:text-zinc-600" placeholder="Minimum 8 characters" />
                  </label>
                  <div className="rounded border border-zinc-200 bg-zinc-50 p-3 text-sm leading-6 text-zinc-700">
                    <p className="font-bold">Before you create an account</p>
                    <p className="mt-1">LDA provides the booking platform; independent instructors provide and supervise lessons. LDA remains responsible for its own services and any legal duties that cannot be excluded.</p>
                    <p className="mt-2">{isInstructor
                      ? "You must provide accurate identity, driving licence, instructor registration and tuition insurance evidence, keep it current, and receive approval before accepting bookings."
                      : "You must provide your own accurate identity and licence details, be entitled to drive, and report changes. Creating an account does not confirm that verification has passed."}</p>
                    <p className="mt-2">Read the <Link href="/cancellation-policy" className="font-bold underline">cancellation and refund policy</Link> before booking and the <Link href="/privacy" className="font-bold underline">Privacy Policy</Link> to understand how your information is used.</p>
                  </div>
                  <label className="flex items-start gap-3 rounded border border-zinc-300 bg-white p-3 text-sm leading-6 text-zinc-700">
                    <input required name="termsAccepted" type="checkbox" className="mt-1" />
                    <span>
                      I accept the LDA <Link href="/terms" target="_blank" rel="noopener noreferrer" className="font-black text-blue-700 underline decoration-2 underline-offset-4 hover:text-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">Terms and Conditions<span className="sr-only"> (opens in a new tab)</span></Link>, including account and verification responsibilities, booking and cancellation rules, and live location rules. Accepting the terms does not mean my verification checks have passed.
                    </span>
                  </label>
                  <button className="lda-pill mt-2">
                    <MailCheck size={18} /> Create account by email
                  </button>
                  <SignUpPasswordHelper formId="lda-account-signup-form" />
                </form>
                <p className="mt-4 text-xs leading-5 text-zinc-500">
                  After you confirm the email link, LDA will bring you back to finish the secure setup. Learners will add date of birth, optional phone number, and provisional licence details before the learner account opens.
                </p>
              </>
            )}
          </section> : null}
        </div>
      </div>
    </main>
  );
}
