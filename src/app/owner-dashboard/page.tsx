import Link from "next/link";
import { ArrowLeft, BadgePoundSterling, CalendarDays, CarFront, Star, TrendingUp, UsersRound } from "lucide-react";
import { adminKpis } from "@/lib/marketplace-content";

const ownerStats = [
  { label: "Drivers on platform", value: "128", detail: "Active verified ADI/PDI instructors", icon: CarFront },
  { label: "Learners on platform", value: "2,840", detail: "Registered learner accounts", icon: UsersRound },
  { label: "Bookings", value: "9,420", detail: "Completed, upcoming, cancelled, and disputed", icon: CalendarDays },
  { label: "Revenue this month", value: "£18.4k", detail: "Platform commission from paid lessons", icon: BadgePoundSterling },
  { label: "Revenue YTD", value: "£146k", detail: "Calendar-year platform revenue", icon: TrendingUp },
  { label: "Instructor reviews", value: "4.8", detail: "Average instructor rating only", icon: Star }
];

export default function OwnerDashboardPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-black text-zinc-300 hover:text-white">
          <ArrowLeft size={17} /> Back to LDA
        </Link>

        <header className="mt-8 rounded border border-zinc-800 bg-zinc-950 p-6">
          <div className="text-sm font-black uppercase text-red-200">Owner analytics preview</div>
          <h1 className="mt-2 text-4xl font-black tracking-normal sm:text-5xl">
            Shareable LDA dashboard for colleagues.
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-400">
            This preview shows the online driving school analytics view without putting admin access on the public sign-in screen. Live role-protected admin access remains at the real admin route once Supabase roles are configured.
          </p>
        </header>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ownerStats.map((stat) => {
            const Icon = stat.icon;
            return (
              <article key={stat.label} className="rounded border border-zinc-800 bg-zinc-950 p-5 shadow-sm">
                <Icon className="text-brand" />
                <div className="mt-4 text-sm font-bold text-zinc-400">{stat.label}</div>
                <div className="mt-2 text-3xl font-black">{stat.value}</div>
                <p className="mt-1 text-sm leading-6 text-zinc-400">{stat.detail}</p>
              </article>
            );
          })}
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <article className="rounded border border-zinc-800 bg-zinc-950 p-5">
            <h2 className="text-2xl font-black">Marketplace KPIs</h2>
            <div className="mt-4 grid gap-3">
              {adminKpis.map((kpi) => (
                <div key={kpi.label} className="rounded border border-zinc-800 bg-black p-4">
                  <div className="text-sm font-bold text-zinc-400">{kpi.label}</div>
                  <div className="mt-1 text-2xl font-black">{kpi.value}</div>
                  <p className="mt-1 text-sm leading-6 text-zinc-400">{kpi.detail}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded border border-zinc-800 bg-zinc-950 p-5">
            <h2 className="text-2xl font-black">What colleagues can review</h2>
            <div className="mt-4 grid gap-3 text-sm font-bold leading-6 text-zinc-300">
              {[
                "Monthly and calendar-year platform revenue",
                "Year-to-date revenue and gross lesson value",
                "Drivers and learners on the platform",
                "Booking volume, conversion, cancellation, refund, and dispute indicators",
                "Instructor ratings and review quality",
                "Payout and Stripe Connect status once live payments are configured"
              ].map((item) => (
                <div key={item} className="rounded border border-zinc-800 bg-black p-4">{item}</div>
              ))}
            </div>
            <Link href="/admin" className="lda-pill lda-pill-sm mt-5">
              Open protected admin route
            </Link>
          </article>
        </section>
      </section>
    </main>
  );
}
