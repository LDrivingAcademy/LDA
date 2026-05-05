import Link from "next/link";
import { ArrowRight, BadgeCheck, CalendarCheck, FileCheck2, ShieldCheck } from "lucide-react";
import { signOut } from "@/app/auth/actions";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();

  if (!hasSupabaseConfig() || !supabase) {
    return (
      <main className="min-h-screen bg-background px-4 py-10">
        <section className="mx-auto max-w-3xl rounded border border-border bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-black">Connect Supabase to unlock dashboards</h1>
          <p className="mt-3 leading-7 text-muted">
            Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and server keys in Vercel, then run the migration in `supabase/migrations`.
          </p>
        </section>
      </main>
    );
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="min-h-screen bg-background px-4 py-10">
        <section className="mx-auto max-w-3xl rounded border border-border bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-black">Sign in to open your LDA dashboard</h1>
          <Link href="/auth/login" className="mt-5 inline-flex items-center gap-2 rounded bg-brand px-4 py-3 text-sm font-black text-white">
            Sign in <ArrowRight size={16} />
          </Link>
        </section>
      </main>
    );
  }

  const [{ data: profile }, { data: roles }, { data: instructorProfile }] = await Promise.all([
    supabase.from("profiles").select("full_name,email").eq("id", user.id).maybeSingle(),
    supabase.from("account_roles").select("role").eq("user_id", user.id),
    supabase.from("instructor_profiles").select("verification_status,hourly_rate_pence,areas_covered").eq("user_id", user.id).maybeSingle()
  ]);

  const roleLabels = roles?.map((role) => role.role).join(", ") || "learner";

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-ink text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <div className="text-sm font-bold text-red-200">LDA dashboard</div>
            <h1 className="text-2xl font-black">{profile?.full_name || user.email}</h1>
          </div>
          <form action={signOut}>
            <button className="rounded bg-white px-3 py-2 text-sm font-black text-ink">Sign out</button>
          </form>
        </div>
      </header>
      <section className="mx-auto grid max-w-7xl gap-5 px-4 py-8 sm:px-6 lg:grid-cols-3 lg:px-8">
        <article className="rounded border border-border bg-white p-5 shadow-sm">
          <ShieldCheck className="text-brand" />
          <h2 className="mt-4 text-xl font-black">Account role</h2>
          <p className="mt-2 text-muted">{roleLabels}</p>
        </article>
        <article className="rounded border border-border bg-white p-5 shadow-sm">
          <CalendarCheck className="text-brand" />
          <h2 className="mt-4 text-xl font-black">Learner bookings</h2>
          <p className="mt-2 text-muted">Upcoming, completed, cancelled, and review flows are ready for booking data.</p>
        </article>
        <article className="rounded border border-border bg-white p-5 shadow-sm">
          <FileCheck2 className="text-brand" />
          <h2 className="mt-4 text-xl font-black">Instructor verification</h2>
          <p className="mt-2 text-muted">
            Status: <span className="font-black">{instructorProfile?.verification_status ?? "not started"}</span>
          </p>
        </article>
        <article className="rounded border border-border bg-white p-5 shadow-sm lg:col-span-3">
          <BadgeCheck className="text-brand" />
          <h2 className="mt-4 text-xl font-black">Next build step</h2>
          <p className="mt-2 max-w-3xl text-muted">
            This dashboard is now backed by Supabase Auth and RLS-ready tables. Next we can add real instructor onboarding forms, postcode search, and booking creation.
          </p>
        </article>
      </section>
    </main>
  );
}
