import Link from "next/link";
import { ArrowLeft, CarFront, GraduationCap, MailCheck, MessageSquareText, ShieldCheck } from "lucide-react";
import { Brand } from "@/components/brand";
import { signUp, signUpWithPhonePassword } from "../actions";

export default async function SignUpPage({
  searchParams
}: {
  searchParams: Promise<{ message?: string; role?: string }>;
}) {
  const { message, role } = await searchParams;
  const isInstructor = role === "instructor";
  const nextPath = "/dashboard";

  return (
    <main className="min-h-screen bg-ink px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between gap-4">
          <Brand />
          <Link href="/" className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-bold text-zinc-300 hover:text-white hover:ring-2 hover:ring-brand">
            <ArrowLeft size={16} /> Back to homepage
          </Link>
        </div>
        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_500px]">
          <section>
            <div className="inline-flex items-center gap-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-black text-red-100">
              <ShieldCheck size={16} /> LDA secure sign up
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-normal sm:text-5xl">
              {isInstructor ? "Create your instructor account." : "Create your learner account."}
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-zinc-300">
              Sign up once with your email or mobile number. LDA stores your verified profile in Supabase so you can return later through Log in without repeating the whole setup.
            </p>
            <Link href={`/auth/login?role=${isInstructor ? "instructor" : "learner"}`} className="lda-pill lda-pill-sm mt-5">
              Already have an account? Log in
            </Link>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Link href="/auth/sign-up?role=learner" className={`rounded border p-4 ${!isInstructor ? "border-red-500 bg-red-500/10" : "border-zinc-800 bg-zinc-950"}`}>
                <GraduationCap className="mb-3 text-brand" />
                <div className="font-black">Learner</div>
                <p className="mt-1 text-sm leading-5 text-zinc-400">Verify age, provisional licence, and start booking.</p>
              </Link>
              <Link href="/auth/sign-up?role=instructor" className={`rounded border p-4 ${isInstructor ? "border-red-500 bg-red-500/10" : "border-zinc-800 bg-zinc-950"}`}>
                <CarFront className="mb-3 text-brand" />
                <div className="font-black">Instructor</div>
                <p className="mt-1 text-sm leading-5 text-zinc-400">Verify ADI/PDI status and publish availability.</p>
              </Link>
            </div>
          </section>

          <section className="rounded border border-zinc-800 bg-zinc-950 p-5 text-white shadow-2xl">
            <div className="mb-5">
              <div className="text-sm font-black uppercase text-brand">{isInstructor ? "Instructor sign up" : "Learner sign up"}</div>
              <h2 className="mt-1 text-2xl font-black">Create and verify account</h2>
            </div>
            {message ? <div className="mb-4 rounded border border-red-500/30 bg-red-500/10 p-3 text-sm font-bold text-red-100">{message}</div> : null}
            <form action={signUp} className="grid gap-3">
              <input type="hidden" name="accountIntent" value={isInstructor ? "instructor" : "learner"} />
              <input type="hidden" name="next" value={nextPath} />
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1">
                  <span className="text-sm font-bold text-zinc-400">First name</span>
                  <input required name="firstName" autoComplete="given-name" className="rounded border border-zinc-800 bg-black px-3 py-3 text-white placeholder:text-zinc-600" placeholder="First name" />
                </label>
                <label className="grid gap-1">
                  <span className="text-sm font-bold text-zinc-400">Last name</span>
                  <input required name="lastName" autoComplete="family-name" className="rounded border border-zinc-800 bg-black px-3 py-3 text-white placeholder:text-zinc-600" placeholder="Last name" />
                </label>
              </div>
              <label className="grid gap-1">
                <span className="text-sm font-bold text-zinc-400">Email</span>
                <input required name="email" type="email" autoComplete="email" className="rounded border border-zinc-800 bg-black px-3 py-3 text-white placeholder:text-zinc-600" placeholder="you@example.com" />
              </label>
              <label className="grid gap-1">
                <span className="text-sm font-bold text-zinc-400">Create password</span>
                <input required name="password" type="password" minLength={8} autoComplete="new-password" className="rounded border border-zinc-800 bg-black px-3 py-3 text-white placeholder:text-zinc-600" placeholder="Minimum 8 characters" />
              </label>
              <button className="lda-pill mt-2">
                <MailCheck size={18} /> Create account by email
              </button>
            </form>
            <p className="mt-4 text-xs leading-5 text-zinc-500">
              After you confirm the email link, LDA will ask for learner eligibility or instructor verification details and store them against your account. After that, use Log in with your email and password.
            </p>
            <div className="mt-5 border-t border-zinc-800 pt-5">
              <div className="mb-3">
                <div className="text-sm font-black uppercase text-brand">Prefer text message?</div>
                <h3 className="mt-1 text-xl font-black">Use a mobile code</h3>
              </div>
              <form action={signUpWithPhonePassword} className="grid gap-3">
                <input type="hidden" name="accountIntent" value={isInstructor ? "instructor" : "learner"} />
                <input type="hidden" name="next" value={nextPath} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1">
                    <span className="text-sm font-bold text-zinc-400">First name</span>
                    <input required name="firstName" autoComplete="given-name" className="rounded border border-zinc-800 bg-black px-3 py-3 text-white placeholder:text-zinc-600" placeholder="First name" />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-sm font-bold text-zinc-400">Last name</span>
                    <input required name="lastName" autoComplete="family-name" className="rounded border border-zinc-800 bg-black px-3 py-3 text-white placeholder:text-zinc-600" placeholder="Last name" />
                  </label>
                </div>
                <label className="grid gap-1">
                  <span className="text-sm font-bold text-zinc-400">Mobile number</span>
                  <input required name="phone" type="tel" autoComplete="tel" className="rounded border border-zinc-800 bg-black px-3 py-3 text-white placeholder:text-zinc-600" placeholder="07123 456789" />
                </label>
                <label className="grid gap-1">
                  <span className="text-sm font-bold text-zinc-400">Create password</span>
                  <input required name="password" type="password" minLength={8} autoComplete="new-password" className="rounded border border-zinc-800 bg-black px-3 py-3 text-white placeholder:text-zinc-600" placeholder="Minimum 8 characters" />
                </label>
                <button className="lda-pill mt-2">
                  <MessageSquareText size={18} /> Create account by text
                </button>
              </form>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
