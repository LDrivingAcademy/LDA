import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, KeyRound, RotateCcw, ShieldCheck } from "lucide-react";
import { changeAccountPassword } from "@/app/account/change-password/actions";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

type ChangePasswordPageProps = {
  searchParams?: Promise<{ message?: string }>;
};

export default async function ChangePasswordPage({ searchParams }: ChangePasswordPageProps) {
  const params = await searchParams;
  const supabase = await createClient();
  const isSuccessMessage = params?.message?.toLowerCase().includes("successfully") ?? false;

  if (!hasSupabaseConfig() || !supabase) {
    redirect("/auth/login?message=Sign in before changing your password.");
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?message=Sign in before changing your password.");
  }

  const { data: roles } = await supabase.from("account_roles").select("role").eq("user_id", user.id);
  const isInstructor = roles?.some((accountRole) => accountRole.role === "instructor") ?? false;
  const recoveryHref = `/auth/forgot-password?role=${isInstructor ? "instructor" : "learner"}`;

  return (
    <main className="min-h-screen bg-white text-black">
      <header className="border-b border-zinc-200 bg-black text-white">
        <div className="flex w-full items-center justify-between px-[15px] py-5">
          <div>
            <div className="text-sm font-black uppercase text-red-200">LDA Account</div>
            <h1 className="mt-1 text-3xl font-black">Change password</h1>
          </div>
          <Link href="/account" className="lda-pill lda-pill-sm">
            <ArrowLeft size={16} /> Back to account
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-5xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_440px] lg:px-8">
        <div>
          <div className="inline-flex items-center gap-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-black uppercase text-brand">
            <ShieldCheck size={16} /> Signed-in security
          </div>
          <h2 className="mt-5 text-4xl font-black tracking-normal sm:text-5xl">Update your account password.</h2>
          <p className="mt-4 text-lg leading-8 text-zinc-700">
            Because you are already signed in, this page checks your current password first and then updates the account directly.
          </p>
          <p className="mt-4 text-sm font-bold leading-6 text-zinc-600">
            Forgotten your current password? Use the separate reset option so LDA can send a secure reset confirmation by email.
          </p>
          <Link href={recoveryHref} className="lda-pill lda-pill-sm mt-5">
            <RotateCcw size={16} /> Reset forgotten password
          </Link>
        </div>

        <section className="rounded border border-zinc-200 bg-white p-5 shadow-2xl">
          <div className="flex items-center gap-2 text-sm font-black uppercase text-brand">
            <KeyRound size={16} /> Account password
          </div>
          <h3 className="mt-1 text-2xl font-black">Change password now</h3>
          {params?.message ? (
            <div className={`mt-4 rounded border p-3 text-sm font-bold ${isSuccessMessage ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700" : "border-red-500/30 bg-red-500/10 text-brand"}`}>
              {params.message}
            </div>
          ) : null}
          <form action={changeAccountPassword} className="mt-5 grid gap-3">
            <label className="grid gap-1">
              <span className="text-sm font-bold text-zinc-600">Current password</span>
              <input required name="currentPassword" type="password" autoComplete="current-password" className="rounded border border-zinc-300 bg-white px-3 py-3 text-black placeholder:text-zinc-600" placeholder="Current password" />
            </label>
            <label className="grid gap-1">
              <span className="text-sm font-bold text-zinc-600">New password</span>
              <input required name="newPassword" type="password" minLength={8} autoComplete="new-password" className="rounded border border-zinc-300 bg-white px-3 py-3 text-black placeholder:text-zinc-600" placeholder="Minimum 8 characters" />
            </label>
            <label className="grid gap-1">
              <span className="text-sm font-bold text-zinc-600">Confirm new password</span>
              <input required name="confirmPassword" type="password" minLength={8} autoComplete="new-password" className="rounded border border-zinc-300 bg-white px-3 py-3 text-black placeholder:text-zinc-600" placeholder="Confirm new password" />
            </label>
            <button className="lda-pill mt-2 w-full">
              <KeyRound size={18} /> Change password
            </button>
          </form>
        </section>
      </section>
    </main>
  );
}
