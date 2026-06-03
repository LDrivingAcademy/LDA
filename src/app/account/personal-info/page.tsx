import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Save, UserRound } from "lucide-react";

import { updatePersonalInfo } from "@/app/account/personal-info/actions";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

type PersonalInfoPageProps = {
  searchParams?: Promise<{ message?: string }>;
};

function splitName(value?: string | null) {
  const parts = String(value ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const [firstName = "", ...lastNameParts] = parts;

  return {
    firstName,
    lastName: lastNameParts.join(" ")
  };
}

export default async function PersonalInfoPage({ searchParams }: PersonalInfoPageProps) {
  const params = await searchParams;
  const supabase = await createClient();

  if (!hasSupabaseConfig() || !supabase) {
    redirect("/auth/login?message=Sign in before updating your account.");
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?message=Sign in before updating your account.");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name,email,phone")
    .eq("id", user.id)
    .maybeSingle();
  const { firstName, lastName } = splitName(profile?.full_name ?? user.user_metadata?.full_name);
  const email = profile?.email ?? user.email ?? "";

  return (
    <main className="min-h-screen bg-white text-black">
      <header className="border-b border-zinc-200 bg-black text-white">
        <div className="flex w-full items-center justify-between px-[15px] py-5">
          <div>
            <div className="text-sm font-black uppercase text-red-200">LDA Account</div>
            <h1 className="mt-1 text-3xl font-black">Personal information</h1>
          </div>
          <Link href="/account" className="lda-pill lda-pill-sm">
            <ArrowLeft size={16} /> Back to account
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <article className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
          <UserRound className="text-brand" />
          <h2 className="mt-4 text-2xl font-black">Manage your profile</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Update the contact details attached to your LDA dashboard. This page is for existing accounts, not first-time verification.
          </p>
          {params?.message ? (
            <div className="mt-5 rounded border border-red-500/30 bg-red-500/10 p-3 text-sm font-bold text-brand">
              {params.message}
            </div>
          ) : null}
          <form action={updatePersonalInfo} className="mt-5 grid gap-4">
            <label className="grid gap-1">
              <span className="text-sm font-black text-zinc-700">First name</span>
              <input
                required
                name="firstName"
                defaultValue={firstName}
                autoComplete="given-name"
                className="rounded border border-zinc-300 bg-white px-4 py-3 font-bold text-black"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-sm font-black text-zinc-700">Last name</span>
              <input
                required
                name="lastName"
                defaultValue={lastName}
                autoComplete="family-name"
                className="rounded border border-zinc-300 bg-white px-4 py-3 font-bold text-black"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-sm font-black text-zinc-700">Email</span>
              <input
                required
                name="email"
                type="email"
                defaultValue={email}
                autoComplete="email"
                className="rounded border border-zinc-300 bg-white px-4 py-3 font-bold text-black"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-sm font-black text-zinc-700">Phone number</span>
              <input
                name="phone"
                type="tel"
                defaultValue={profile?.phone ?? ""}
                autoComplete="tel"
                className="rounded border border-zinc-300 bg-white px-4 py-3 font-bold text-black"
              />
            </label>
            <button type="submit" className="lda-pill mt-2 w-full justify-center">
              <Save size={18} /> Save personal information
            </button>
          </form>
        </article>
      </section>
    </main>
  );
}
