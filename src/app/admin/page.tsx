import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

async function countRows(supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>, table: string) {
  const { count } = await supabase.from(table).select("*", { count: "exact", head: true });
  return count ?? 0;
}

export default async function AdminPage() {
  const supabase = await createClient();

  if (!supabase) {
    return <AdminMessage title="Supabase not configured" body="Add Supabase env vars in Vercel to enable admin access." />;
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return <AdminMessage title="Admin sign in required" body="Sign in before opening the admin dashboard." />;
  }

  const { data: adminRole } = await supabase
    .from("account_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (!adminRole) {
    return <AdminMessage title="Not an admin yet" body="Add the admin role for this user in Supabase account_roles." />;
  }

  const [users, instructors, bookings, payments] = await Promise.all([
    countRows(supabase, "profiles"),
    countRows(supabase, "instructor_profiles"),
    countRows(supabase, "bookings"),
    countRows(supabase, "payments")
  ]);

  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <section className="mx-auto max-w-7xl">
        <div className="mb-8">
          <div className="text-sm font-black uppercase text-brand">Admin dashboard</div>
          <h1 className="mt-2 text-4xl font-black">Marketplace control centre</h1>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[["Users", users], ["Instructors", instructors], ["Bookings", bookings], ["Payments", payments]].map(([label, value]) => (
            <article key={label} className="rounded border border-border bg-white p-5 shadow-sm">
              <div className="text-sm font-bold text-muted">{label}</div>
              <div className="mt-2 text-3xl font-black">{value}</div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function AdminMessage({ title, body }: { title: string; body: string }) {
  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <section className="mx-auto max-w-3xl rounded border border-border bg-white p-6 shadow-sm">
        <ShieldAlert className="text-brand" />
        <h1 className="mt-4 text-3xl font-black">{title}</h1>
        <p className="mt-3 leading-7 text-muted">{body}</p>
        <Link href="/auth/login" className="mt-5 inline-flex rounded bg-brand px-4 py-3 text-sm font-black text-white">Go to login</Link>
      </section>
    </main>
  );
}
