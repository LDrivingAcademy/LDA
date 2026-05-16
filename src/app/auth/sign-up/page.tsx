import Link from "next/link";
import { CarFront, GraduationCap, MailCheck, ShieldCheck } from "lucide-react";
import { PageTopBar } from "@/components/page-top-bar";
import { signUp } from "../actions";

export default async function SignUpPage({
  searchParams
}: {
  searchParams: Promise<{ message?: string; role?: string }>;
}) {
  const { message, role } = await searchParams;
  const isInstructor = role === "instructor";
  const nextPath = "/dashboard";

  return (
    <main className="min-h-screen bg-white text-black">
      <PageTopBar />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_500px]">
          <section>
            <div className="inline-flex items-center gap-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-black text-brand">
              <ShieldCheck size={16} /> LDA secure sign up
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-normal sm:text-5xl">
              {isInstructor ? "Create your instructor account." : "Create your learner account."}
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-zinc-700">
              Sign up once with your email. LDA uses email confirmation to protect accounts, then asks for your profile details on the next secure step.
            </p>
            <Link href={`/auth/login?role=${isInstructor ? "instructor" : "learner"}`} className="lda-pill lda-pill-sm mt-5">
              Already have an account? Log in
            </Link>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Link href="/auth/sign-up?role=learner" className={`rounded border p-4 ${!isInstructor ? "border-red-500 bg-red-500/10" : "border-zinc-200 bg-white"}`}>
                <GraduationCap className="mb-3 text-brand" />
                <div className="font-black">Learner</div>
                <p className="mt-1 text-sm leading-5 text-zinc-600">Verify age, provisional licence, and start booking.</p>
              </Link>
              <Link href="/auth/sign-up?role=instructor" className={`rounded border p-4 ${isInstructor ? "border-red-500 bg-red-500/10" : "border-zinc-200 bg-white"}`}>
                <CarFront className="mb-3 text-brand" />
                <div className="font-black">Instructor</div>
                <p className="mt-1 text-sm leading-5 text-zinc-600">Verify ADI/PDI status and publish availability.</p>
              </Link>
            </div>
          </section>

          <section className="rounded border border-zinc-200 bg-white p-5 text-black shadow-2xl">
            <div className="mb-5">
              <div className="text-sm font-black uppercase text-brand">{isInstructor ? "Instructor sign up" : "Learner sign up"}</div>
              <h2 className="mt-1 text-2xl font-black">Create and verify account</h2>
            </div>
            {message ? <div className="mb-4 rounded border border-red-500/30 bg-red-500/10 p-3 text-sm font-bold text-brand">{message}</div> : null}
            <form action={signUp} className="grid gap-3">
              <input type="hidden" name="accountIntent" value={isInstructor ? "instructor" : "learner"} />
              <input type="hidden" name="next" value={nextPath} />
              <label className="grid gap-1">
                <span className="text-sm font-bold text-zinc-600">Email</span>
                <input required name="email" type="email" autoComplete="email" className="rounded border border-zinc-300 bg-white px-3 py-3 text-black placeholder:text-zinc-600" placeholder="you@example.com" />
              </label>
              <label className="grid gap-1">
                <span className="text-sm font-bold text-zinc-600">Create password</span>
                <input required name="password" type="password" minLength={8} autoComplete="new-password" className="rounded border border-zinc-300 bg-white px-3 py-3 text-black placeholder:text-zinc-600" placeholder="Minimum 8 characters" />
              </label>
              <button className="lda-pill mt-2">
                <MailCheck size={18} /> Create account by email
              </button>
            </form>
            <p className="mt-4 text-xs leading-5 text-zinc-500">
              After you confirm the email link, LDA will ask for your first name, last name, optional phone number, and learner eligibility or instructor verification details. A phone number can be added later for lesson updates and can be used for returning login once linked to your account.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
