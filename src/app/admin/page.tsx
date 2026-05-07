import Link from "next/link";
import { cookies } from "next/headers";
import { BadgePoundSterling, CalendarDays, CarFront, ShieldAlert, Star, UsersRound } from "lucide-react";
import { signOut } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";
import { adminKpis } from "@/lib/marketplace-content";
import { formatMoney } from "@/lib/money";

type CountableTable = "profiles" | "account_roles" | "instructor_profiles" | "bookings" | "payments" | "reviews";

async function countRows(supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>, table: CountableTable) {
  const { count } = await supabase.from(table).select("*", { count: "exact", head: true });
  return count ?? 0;
}

export default async function AdminPage() {
  const demoRole = (await cookies()).get("lda_demo_role")?.value;

  if (demoRole === "admin") {
    return <AdminDemoDashboard />;
  }

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

  const [
    users,
    learners,
    instructors,
    activeInstructors,
    bookings,
    paymentCount,
    reviewCount,
    { data: payments },
    { data: reviews },
    { data: recentBookings }
  ] = await Promise.all([
    countRows(supabase, "profiles"),
    supabase.from("account_roles").select("*", { count: "exact", head: true }).eq("role", "learner").then(({ count }) => count ?? 0),
    countRows(supabase, "instructor_profiles"),
    supabase.from("instructor_profiles").select("*", { count: "exact", head: true }).eq("verification_status", "approved").then(({ count }) => count ?? 0),
    countRows(supabase, "bookings"),
    countRows(supabase, "payments"),
    countRows(supabase, "reviews"),
    supabase.from("payments").select("gross_amount_pence,platform_fee_pence,instructor_net_pence,status,created_at").limit(5000),
    supabase.from("reviews").select("rating,created_at").limit(5000),
    supabase.from("bookings").select("status,payment_status,lesson_price_pence,created_at").order("created_at", { ascending: false }).limit(8)
  ]);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const paidPayments = payments?.filter((payment) => payment.status === "paid") ?? [];
  const platformRevenueMonth = paidPayments
    .filter((payment) => new Date(payment.created_at) >= monthStart)
    .reduce((sum, payment) => sum + payment.platform_fee_pence, 0);
  const platformRevenueYtd = paidPayments
    .filter((payment) => new Date(payment.created_at) >= yearStart)
    .reduce((sum, payment) => sum + payment.platform_fee_pence, 0);
  const grossLessonValue = paidPayments.reduce((sum, payment) => sum + payment.gross_amount_pence, 0);
  const avgInstructorRating = reviews?.length
    ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1)
    : "0.0";

  const liveKpis = [
    { label: "Drivers on platform", value: activeInstructors, detail: `${instructors} total instructor profiles`, icon: CarFront },
    { label: "Learners on platform", value: learners, detail: `${users} total users`, icon: UsersRound },
    { label: "Bookings", value: bookings, detail: "All statuses across the marketplace", icon: CalendarDays },
    { label: "Payments", value: paymentCount, detail: "Stripe payment records", icon: BadgePoundSterling },
    { label: "Revenue this month", value: formatMoney(platformRevenueMonth), detail: "Platform commission this month", icon: BadgePoundSterling },
    { label: "Revenue YTD", value: formatMoney(platformRevenueYtd), detail: "Platform commission for this calendar year", icon: BadgePoundSterling },
    { label: "Gross lesson value", value: formatMoney(grossLessonValue), detail: "Learner spend before platform commission", icon: BadgePoundSterling },
    { label: "Instructor reviews", value: reviewCount, detail: `${avgInstructorRating} average instructor rating`, icon: Star }
  ];

  return (
    <main className="min-h-screen bg-black">
      <header className="border-b border-zinc-800 bg-ink px-4 py-8 text-white">
        <section className="mx-auto max-w-7xl">
          <div className="text-sm font-black uppercase text-red-200">Admin dashboard</div>
          <h1 className="mt-2 text-4xl font-black">Online driving school control room</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-300">
            Separate admin area for platform health: learners, instructors, bookings, payments, refunds, disputes, revenue, payouts, cancellation rate, and instructor reviews.
          </p>
        </section>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {liveKpis.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <article key={kpi.label} className="rounded border border-zinc-800 bg-zinc-950 p-5 shadow-sm">
                <Icon className="text-brand" />
                <div className="mt-4 text-sm font-bold text-zinc-400">{kpi.label}</div>
                <div className="mt-2 text-3xl font-black">{kpi.value}</div>
                <p className="mt-1 text-sm leading-6 text-zinc-400">{kpi.detail}</p>
              </article>
            );
          })}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px]">
          <section className="rounded border border-zinc-800 bg-zinc-950 p-5 shadow-sm">
            <h2 className="text-2xl font-black">Recent booking/payment activity</h2>
            <div className="mt-4 overflow-hidden rounded border border-zinc-800">
              <div className="grid grid-cols-4 bg-ink px-4 py-3 text-xs font-black uppercase text-white">
                <div>Status</div>
                <div>Payment</div>
                <div>Lesson value</div>
                <div>Created</div>
              </div>
              {(recentBookings ?? []).map((booking) => (
                <div key={`${booking.created_at}-${booking.lesson_price_pence}`} className="grid grid-cols-4 border-t border-zinc-800 px-4 py-3 text-sm">
                  <div className="font-black">{booking.status}</div>
                  <div>{booking.payment_status}</div>
                  <div>{formatMoney(booking.lesson_price_pence)}</div>
                  <div>{new Date(booking.created_at).toLocaleDateString("en-GB")}</div>
                </div>
              ))}
              {recentBookings?.length ? null : (
                <div className="px-4 py-6 text-sm text-zinc-400">No live bookings yet. Demo KPI examples are shown alongside the live counters until real payments arrive.</div>
              )}
            </div>
          </section>

          <aside className="rounded border border-zinc-800 bg-ink p-5 text-white shadow-sm">
            <h2 className="text-2xl font-black">Analytics to watch</h2>
            <div className="mt-4 grid gap-3">
              {adminKpis.map((kpi) => (
                <div key={kpi.label} className="rounded border border-zinc-800 bg-zinc-950 p-3">
                  <div className="text-sm font-bold text-zinc-400">{kpi.label}</div>
                  <div className="mt-1 text-xl font-black">{kpi.value}</div>
                  <p className="mt-1 text-sm leading-6 text-zinc-400">{kpi.detail}</p>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

function AdminDemoDashboard() {
  return (
    <main className="min-h-screen bg-black">
      <header className="border-b border-zinc-800 bg-ink px-4 py-8 text-white">
        <section className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-black uppercase text-red-200">Demo admin dashboard</div>
            <h1 className="mt-2 text-4xl font-black">Online driving school control room</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-300">Demo analytics for testing the owner/admin flow.</p>
          </div>
          <form action={signOut}>
            <button className="lda-pill lda-pill-sm">Exit demo</button>
          </form>
        </section>
      </header>
      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {adminKpis.map((kpi) => (
            <article key={kpi.label} className="rounded border border-zinc-800 bg-zinc-950 p-5 shadow-sm">
              <div className="text-sm font-bold text-zinc-400">{kpi.label}</div>
              <div className="mt-2 text-3xl font-black">{kpi.value}</div>
              <p className="mt-1 text-sm leading-6 text-zinc-400">{kpi.detail}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function AdminMessage({ title, body }: { title: string; body: string }) {
  return (
    <main className="min-h-screen bg-black px-4 py-10">
      <section className="mx-auto max-w-3xl rounded border border-zinc-800 bg-zinc-950 p-6 shadow-sm">
        <ShieldAlert className="text-brand" />
        <h1 className="mt-4 text-3xl font-black">{title}</h1>
        <p className="mt-3 leading-7 text-zinc-400">{body}</p>
        <Link href="/auth/login?role=admin&next=/admin" className="lda-pill lda-pill-sm mt-5">Go to admin login</Link>
      </section>
    </main>
  );
}
