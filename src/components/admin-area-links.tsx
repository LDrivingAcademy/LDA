import Link from "next/link";
import {
  BadgePoundSterling,
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  Headphones,
  LayoutDashboard,
  LifeBuoy,
  LockKeyhole,
  ShieldCheck,
  UsersRound
} from "lucide-react";

const adminAreas = [
  {
    title: "Protected admin",
    body: "Live platform counters, revenue, bookings, payments, and admin-only health checks.",
    href: "/admin",
    icon: LayoutDashboard,
    status: "MFA protected"
  },
  {
    title: "Owner analytics",
    body: "Shareable owner view for business KPIs and colleague conversations.",
    href: "/owner-dashboard",
    icon: UsersRound,
    status: "Preview"
  },
  {
    title: "Instructor accounts",
    body: "Instructor evidence, onboarding documents, ADI/PDI checks, compliance, and review flags.",
    href: "/admin/instructors",
    icon: ShieldCheck,
    status: "Operations"
  },
  {
    title: "Booking ledger",
    body: "Learner bookings, lesson values, statuses, cancellations, and payment records.",
    href: "/admin/bookings",
    icon: CalendarDays,
    status: "Activity"
  },
  {
    title: "Learner accounts",
    body: "Learner profiles, eligibility checks, package state, marketing consent, and account support.",
    href: "/admin/learners",
    icon: UsersRound,
    status: "Accounts"
  },
  {
    title: "Tech Support Dashboard",
    body: "The shared ticket, feedback, incident, consent, and website-health workspace used by admin and the technical team.",
    href: "/technical-support",
    icon: Headphones,
    status: "Operations"
  },
  {
    title: "Tech Support Escalations",
    body: "Only technical incidents, health alerts, and feedback items deliberately sent forward by the support team.",
    href: "/admin/support-escalations",
    icon: ShieldCheck,
    status: "Decisions"
  },
  {
    title: "Website analytics",
    body: "Real visitor counts, stay signals, most visited pages, most visited sections, and most clicked buttons.",
    href: "/admin/analytics",
    icon: BarChart3,
    status: "Traffic"
  },
  {
    title: "Payment analytics",
    body: "Payments taken, daily/monthly/yearly totals, incomplete payments, refunds, disputes, and package churn watch.",
    href: "/admin/payments",
    icon: BadgePoundSterling,
    status: "Money"
  },
  {
    title: "Revenue analytics",
    body: "Whole-business revenue, platform commission, instructor earnings, and area/instructor breakdowns.",
    href: "/admin/revenue",
    icon: BadgePoundSterling,
    status: "Revenue"
  },
  {
    title: "Site preview",
    body: "Open the learner or instructor side as an admin without a second sign-in or Stripe checkout.",
    href: "/admin-preview",
    icon: ClipboardCheck,
    status: "Preview"
  },
  {
    title: "Customer support preview",
    body: "Preview the learner and instructor support entry points used by customers.",
    href: "/support/learner?from=admin",
    icon: LifeBuoy,
    status: "Help"
  },
  {
    title: "Admin sign-in",
    body: "Private sign-in route used before the authenticator MFA step.",
    href: "/admin-access",
    icon: LockKeyhole,
    status: "Access"
  }
];

export function AdminAreaLinks({ compact = false }: { compact?: boolean }) {
  return (
    <section className="rounded border border-zinc-800 bg-zinc-950 p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-sm font-black uppercase text-red-200">Admin areas</div>
          <h2 className="mt-1 text-2xl font-black text-white">Connected control centre</h2>
        </div>
        <Link href="/admin-mfa" className="rounded-full border border-red-500/40 px-4 py-2 text-sm font-black text-red-100 hover:border-red-400 hover:text-white">
          MFA check
        </Link>
      </div>
      <div className={`mt-5 grid gap-3 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-4"}`}>
        {adminAreas.map((area) => {
          const Icon = area.icon;

          return (
            <Link
              key={area.title}
              href={area.href}
              className="group rounded border border-zinc-800 bg-black p-4 text-white transition hover:border-red-500 hover:bg-zinc-950"
            >
              <div className="flex items-start justify-between gap-3">
                <Icon className="text-brand" size={22} />
                <span className="rounded-full border border-zinc-800 px-2 py-1 text-[11px] font-black uppercase text-zinc-400 group-hover:border-red-500/60 group-hover:text-red-100">
                  {area.status}
                </span>
              </div>
              <h3 className="mt-4 text-base font-black">{area.title}</h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-zinc-400">{area.body}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
