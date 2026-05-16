import { Mail, RotateCcw } from "lucide-react";
import { PageTopBar } from "@/components/page-top-bar";

export default async function ForgotPasswordPage({
  searchParams
}: {
  searchParams: Promise<{ message?: string; role?: string }>;
}) {
  const { message, role } = await searchParams;
  const isInstructor = role === "instructor";

  return (
    <main className="min-h-screen bg-white text-black">
      <PageTopBar backHref={`/auth/login?role=${isInstructor ? "instructor" : "learner"}`} backLabel="Back to login" />
      <div className="mx-auto max-w-5xl px-4 py-8">
        <section className="mt-10 grid gap-8 lg:grid-cols-[1fr_460px] lg:items-start">
          <div>
            <div className="inline-flex items-center gap-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-black text-brand">
              <RotateCcw size={16} /> Account recovery
            </div>
            <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-normal sm:text-5xl">
              Reset your LDA password securely.
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-zinc-700">
              Enter the email attached to your account. LDA will send a secure reset link that opens the new-password page.
            </p>
          </div>

          <section className="rounded border border-zinc-200 bg-white p-5 shadow-2xl">
            <div className="text-sm font-black uppercase text-brand">{isInstructor ? "Instructor recovery" : "Learner recovery"}</div>
            <h2 className="mt-1 text-2xl font-black">Send reset confirmation</h2>
            {message ? <div className="mt-4 rounded border border-red-500/30 bg-red-500/10 p-3 text-sm font-bold text-brand">{message}</div> : null}
            <form action="/api/auth/password-reset" method="post" className="mt-5 grid gap-3">
              <input type="hidden" name="accountIntent" value={isInstructor ? "instructor" : "learner"} />
              <input type="hidden" name="returnTo" value={`/auth/forgot-password?role=${isInstructor ? "instructor" : "learner"}`} />
              <label className="grid gap-1">
                <span className="text-sm font-bold text-zinc-600">Email</span>
                <input required name="email" type="email" autoComplete="email" className="rounded border border-zinc-300 bg-white px-3 py-3 text-black placeholder:text-zinc-600" placeholder="you@example.com" />
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
