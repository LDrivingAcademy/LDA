import { KeyRound, ShieldCheck } from "lucide-react";
import { PageTopBar } from "@/components/page-top-bar";
import { createClient } from "@/lib/supabase/server";
import { updatePassword } from "../actions";

export default async function UpdatePasswordPage({
  searchParams
}: {
  searchParams: Promise<{ email?: string; message?: string; role?: string }>;
}) {
  const { email, message, role } = await searchParams;
  const supabase = await createClient();
  const { data } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  const accountEmail = email ?? data.user?.email ?? "";
  const accountRole = role === "instructor" ? "instructor" : "learner";

  return (
    <main className="min-h-screen bg-white text-black">
      <PageTopBar />
      <div className="mx-auto max-w-4xl px-4 py-8">
        <section className="grid gap-6 lg:grid-cols-[1fr_420px]">
          <div>
            <div className="inline-flex items-center gap-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-black text-brand">
              <ShieldCheck size={16} /> LDA secure reset
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-normal sm:text-5xl">Reset your password.</h1>
            <p className="mt-4 text-lg leading-8 text-zinc-700">
              Confirm the email linked to your account, enter your new password twice, then return to login.
            </p>
          </div>

          <section className="rounded border border-zinc-200 bg-white p-5 shadow-2xl">
            <div className="flex items-center gap-2 text-sm font-black uppercase text-brand">
              <KeyRound size={16} /> Account password
            </div>
            <h2 className="mt-1 text-2xl font-black">Choose a new password</h2>
            {message ? <div className="mt-4 rounded border border-red-500/30 bg-red-500/10 p-3 text-sm font-bold text-brand">{message}</div> : null}
            <form action={updatePassword} className="mt-5 grid gap-3">
              <input type="hidden" name="role" value={accountRole} />
              <label className="grid gap-1">
                <span className="text-sm font-bold text-zinc-600">Email</span>
                <input required readOnly aria-readonly="true" name="identifier" type="email" autoComplete="username" defaultValue={accountEmail} className="rounded border border-zinc-300 bg-zinc-100 px-3 py-3 text-zinc-700 placeholder:text-zinc-600" placeholder="you@example.com" />
              </label>
              <label className="grid gap-1">
                <span className="text-sm font-bold text-zinc-600">New password</span>
                <input required name="password" type="password" minLength={8} autoComplete="new-password" className="rounded border border-zinc-300 bg-white px-3 py-3 text-black placeholder:text-zinc-600" placeholder="New password" />
              </label>
              <label className="grid gap-1">
                <span className="text-sm font-bold text-zinc-600">Confirm password</span>
                <input required name="confirmPassword" type="password" minLength={8} autoComplete="new-password" className="rounded border border-zinc-300 bg-white px-3 py-3 text-black placeholder:text-zinc-600" placeholder="Confirm password" />
              </label>
              <button className="lda-pill mt-2">
                <KeyRound size={18} /> Change password
              </button>
            </form>
          </section>
        </section>
      </div>
    </main>
  );
}
