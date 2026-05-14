import Link from "next/link";
import { ArrowLeft, Mail, RotateCcw } from "lucide-react";
import { Brand } from "@/components/brand";
import { requestPasswordReset } from "../actions";

export default async function ForgotPasswordPage({
  searchParams
}: {
  searchParams: Promise<{ message?: string; role?: string }>;
}) {
  const { message, role } = await searchParams;
  const isInstructor = role === "instructor";

  return (
    <main className="min-h-screen bg-ink px-4 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between gap-4">
          <Brand />
          <Link href={`/auth/login?role=${isInstructor ? "instructor" : "learner"}`} className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-bold text-zinc-300 hover:text-white hover:ring-2 hover:ring-brand">
            <ArrowLeft size={16} /> Back to login
          </Link>
        </div>

        <section className="mt-10 grid gap-8 lg:grid-cols-[1fr_460px] lg:items-start">
          <div>
            <div className="inline-flex items-center gap-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-black text-red-100">
              <RotateCcw size={16} /> Account recovery
            </div>
            <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-normal sm:text-5xl">
              Reset your LDA password securely.
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-zinc-300">
              Enter the email attached to your account. Add the recovery phone number if you linked one so support can match the request if needed.
            </p>
          </div>

          <section className="rounded border border-zinc-800 bg-zinc-950 p-5 shadow-2xl">
            <div className="text-sm font-black uppercase text-brand">{isInstructor ? "Instructor recovery" : "Learner recovery"}</div>
            <h2 className="mt-1 text-2xl font-black">Send reset confirmation</h2>
            {message ? <div className="mt-4 rounded border border-red-500/30 bg-red-500/10 p-3 text-sm font-bold text-red-100">{message}</div> : null}
            <form action={requestPasswordReset} className="mt-5 grid gap-3">
              <input type="hidden" name="accountIntent" value={isInstructor ? "instructor" : "learner"} />
              <input type="hidden" name="returnTo" value={`/auth/forgot-password?role=${isInstructor ? "instructor" : "learner"}`} />
              <label className="grid gap-1">
                <span className="text-sm font-bold text-zinc-400">Email</span>
                <input required name="email" type="email" autoComplete="email" className="rounded border border-zinc-800 bg-black px-3 py-3 text-white placeholder:text-zinc-600" placeholder="you@example.com" />
              </label>
              <label className="grid gap-1">
                <span className="text-sm font-bold text-zinc-400">Recovery phone number <span className="font-medium text-zinc-600">(optional)</span></span>
                <input name="recoveryPhone" type="tel" autoComplete="tel" className="rounded border border-zinc-800 bg-black px-3 py-3 text-white placeholder:text-zinc-600" placeholder="07123 456789" />
              </label>
              <button className="lda-pill mt-2">
                <Mail size={18} /> Send reset email
              </button>
            </form>
          </section>
        </section>
      </div>
    </main>
  );
}
