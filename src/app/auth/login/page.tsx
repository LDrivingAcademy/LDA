import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { signIn, signUp } from "../actions";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;

  return (
    <main className="min-h-screen bg-ink px-4 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-zinc-300 hover:text-white">
          <ArrowLeft size={16} /> Back to homepage
        </Link>
        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_440px]">
          <section>
            <div className="inline-flex items-center gap-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-black text-red-100">
              <ShieldCheck size={16} /> LDA secure access
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-normal sm:text-5xl">Sign in to manage lessons, verification, and bookings.</h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-zinc-300">
              Supabase Auth is wired for learners, instructors, and admins. Roles are stored in the database with RLS protection, not in user-editable metadata.
            </p>
          </section>
          <section className="rounded border border-zinc-800 bg-white p-5 text-foreground shadow-2xl">
            {message ? <div className="mb-4 rounded bg-red-50 p-3 text-sm font-bold text-brand">{message}</div> : null}
            <form className="grid gap-3">
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
          </section>
        </div>
      </div>
    </main>
  );
}
