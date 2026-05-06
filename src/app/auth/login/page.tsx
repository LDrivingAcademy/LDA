import Link from "next/link";
import { ArrowLeft, CarFront, GraduationCap, ShieldCheck } from "lucide-react";
import { signIn, signUp } from "../actions";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ message?: string; role?: string }>;
}) {
  const { message, role } = await searchParams;
  const isInstructor = role === "instructor";

  return (
    <main className="min-h-screen bg-ink px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-zinc-300 hover:text-white">
          <ArrowLeft size={16} /> Back to homepage
        </Link>
        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_460px]">
          <section>
            <div className="inline-flex items-center gap-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-black text-red-100">
              <ShieldCheck size={16} /> LDA secure access
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-normal sm:text-5xl">
              {isInstructor ? "Sign in to continue instructor onboarding." : "Sign in to find local instructors and book lessons."}
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-zinc-300">
              {isInstructor
                ? "Instructor accounts move through verification, profile setup, availability, and admin approval before appearing in learner search."
                : "Learners go from login to local approved instructors, then compare distance, price, rating, car, availability, and cancellation terms before payment."}
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Link href="/auth/login?role=learner" className={`rounded border p-4 ${!isInstructor ? "border-red-500 bg-red-500/10" : "border-zinc-800 bg-zinc-950"}`}>
                <GraduationCap className="mb-3 text-brand" />
                <div className="font-black">Learner</div>
                <p className="mt-1 text-sm leading-5 text-zinc-400">Search, compare, book, pay, and review.</p>
              </Link>
              <Link href="/auth/login?role=instructor" className={`rounded border p-4 ${isInstructor ? "border-red-500 bg-red-500/10" : "border-zinc-800 bg-zinc-950"}`}>
                <CarFront className="mb-3 text-brand" />
                <div className="font-black">Instructor</div>
                <p className="mt-1 text-sm leading-5 text-zinc-400">Verify, publish availability, manage bookings.</p>
              </Link>
            </div>
          </section>

          <section className="rounded border border-zinc-800 bg-white p-5 text-foreground shadow-2xl">
            <div className="mb-5">
              <div className="text-sm font-black uppercase text-brand">{isInstructor ? "Instructor access" : "Learner access"}</div>
              <h2 className="mt-1 text-2xl font-black">Log in or create account</h2>
            </div>
            {message ? <div className="mb-4 rounded bg-red-50 p-3 text-sm font-bold text-brand">{message}</div> : null}
            <form className="grid gap-3">
              <input type="hidden" name="accountIntent" value={isInstructor ? "instructor" : "learner"} />
              <label className="grid gap-1">
                <span className="text-sm font-bold text-muted">Full name for sign up</span>
                <input name="fullName" className="rounded border border-border px-3 py-3" placeholder="Your name" />
              </label>
              <label className="grid gap-1">
                <span className="text-sm font-bold text-muted">Email</span>
                <input required name="email" type="email" className="rounded border border-border px-3 py-3" placeholder="you@example.com" />
              </label>
              <label className="grid gap-1">
                <span className="text-sm font-bold text-muted">Password</span>
                <input required name="password" type="password" minLength={8} className="rounded border border-border px-3 py-3" placeholder="Minimum 8 characters" />
              </label>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <button formAction={signIn} className="rounded bg-ink px-4 py-3 text-sm font-black text-white hover:bg-brand">Sign in</button>
                <button formAction={signUp} className="rounded bg-brand px-4 py-3 text-sm font-black text-white hover:bg-brand-strong">Create account</button>
              </div>
            </form>
            <p className="mt-4 text-xs leading-5 text-muted">
              By continuing, users should be shown and asked to accept final terms, privacy, and cancellation wording before live paid bookings are enabled.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
