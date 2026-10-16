import { redirect } from "next/navigation";
import { Phone, Save } from "lucide-react";
import { updateRecoveryPhone } from "@/app/account/recovery-phone/actions";
import { Brand } from "@/components/brand";
import { DynamicBackLink } from "@/components/dynamic-back-link";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

type RecoveryPhonePageProps = {
  searchParams?: Promise<{ message?: string }>;
};

export default async function RecoveryPhonePage({ searchParams }: RecoveryPhonePageProps) {
  const params = await searchParams;
  const supabase = await createClient();

  if (!hasSupabaseConfig() || !supabase) {
    redirect("/auth/login?message=Sign in before updating your recovery phone number.");
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?message=Sign in before updating your recovery phone number.");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("phone")
    .eq("id", user.id)
    .maybeSingle();

  const message = params?.message;
  const isSuccessMessage = message?.toLowerCase().includes("saved") ?? false;

  return (
    <main className="min-h-screen bg-white text-black">
      <header className="lda-universal-topbar border-b border-zinc-200 bg-black text-white">
        <div className="lda-universal-topbar-inner flex w-full items-center justify-between gap-4 px-[15px]">
          <div className="flex min-w-0 items-center gap-5">
            <Brand size="home" href="/dashboard" label="LDA account" />
            <div className="min-w-0">
              <div className="text-sm font-black uppercase text-red-200">LDA Account</div>
              <h1 className="mt-1 truncate text-2xl font-black sm:text-3xl">Add recovery phone number</h1>
            </div>
          </div>
          <DynamicBackLink
            fallbackHref="/account"
            fallbackLabel="Back to account"
            className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-black text-white transition"
          />
        </div>
      </header>

      <section className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        <article className="rounded border border-zinc-200 bg-white p-5 shadow-2xl">
          <div className="text-black">
            <div className="inline-flex items-center gap-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-black uppercase text-brand">
              <Phone size={18} /> Recovery phone number
            </div>
            <h2 className="mt-3 text-3xl font-black tracking-normal">Add real recovery number</h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-zinc-700">
              Add a real phone number LDA can keep on your account for recovery and important account contact.
            </p>
          </div>

          <form action={updateRecoveryPhone} className="mt-5 grid gap-5">
            {message ? (
              <div className={`rounded border p-3 text-sm font-bold ${isSuccessMessage ? "border-emerald-500/30 bg-emerald-50 text-emerald-800" : "border-red-500/30 bg-red-50 text-brand"}`}>
                {message}
              </div>
            ) : null}

            <label className="grid gap-2">
              <span className="text-sm font-black text-zinc-700">Recovery phone number</span>
              <input
                required
                name="recoveryPhone"
                type="tel"
                defaultValue={profile?.phone ?? ""}
                autoComplete="tel"
                inputMode="tel"
                className="rounded border border-zinc-300 bg-white px-4 py-3 text-base font-bold text-black placeholder:text-zinc-500"
                placeholder="07... or +44..."
              />
              <span className="text-sm font-semibold leading-6 text-zinc-600">
                UK mobile numbers can start with 07. International numbers should include the country code.
              </span>
            </label>

            <button type="submit" className="lda-pill w-full justify-center">
              <Save size={18} /> Save recovery phone number
            </button>
          </form>
        </article>
      </section>
    </main>
  );
}
