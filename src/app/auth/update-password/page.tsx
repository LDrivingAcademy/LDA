import { KeyRound, ShieldCheck } from "lucide-react";
import { PageTopBar } from "@/components/page-top-bar";
import { updatePassword } from "../actions";

export default async function UpdatePasswordPage({
  searchParams
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;

  return (
    <main className="min-h-screen bg-white text-black">
      <PageTopBar backHref="/auth/login" backLabel="Back to login" />
      <div className="mx-auto max-w-4xl px-4 py-8">
        <section className="grid gap-6 lg:grid-cols-[1fr_420px]">
          <div>
            <div className="inline-flex items-center gap-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-black text-brand">
              <ShieldCheck size={16} /> LDA secure reset
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-normal sm:text-5xl">Set a new password.</h1>
            <p className="mt-4 text-lg leading-8 text-zinc-700">
              Choose a password you can use for normal account login after your reset link has been confirmed.
            </p>
          </div>

          <section className="rounded border border-zinc-200 bg-white p-5 shadow-2xl">
            <div className="flex items-center gap-2 text-sm font-black uppercase text-brand">
              <KeyRound size={16} /> Account password
            </div>
            <h2 className="mt-1 text-2xl font-black">Update password</h2>
            {message ? <div className="mt-4 rounded border border-red-500/30 bg-red-500/10 p-3 text-sm font-bold text-brand">{message}</div> : null}
            <form action={updatePassword} className="mt-5 grid gap-3">
              <label className="grid gap-1">
                <span className="text-sm font-bold text-zinc-600">New password</span>
                <input required name="password" type="password" minLength={8} autoComplete="new-password" className="rounded border border-zinc-300 bg-white px-3 py-3 text-black placeholder:text-zinc-600" placeholder="Minimum 8 characters" />
              </label>
              <label className="grid gap-1">
                <span className="text-sm font-bold text-zinc-600">Confirm password</span>
                <input required name="confirmPassword" type="password" minLength={8} autoComplete="new-password" className="rounded border border-zinc-300 bg-white px-3 py-3 text-black placeholder:text-zinc-600" placeholder="Repeat password" />
              </label>
              <button className="lda-pill mt-2">
                <KeyRound size={18} /> Save password
              </button>
            </form>
          </section>
        </section>
      </div>
    </main>
  );
}
