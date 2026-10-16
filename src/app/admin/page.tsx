import Link from "next/link";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  BadgePoundSterling,
  BarChart3,
  CalendarDays,
  CarFront,
  FileCheck2,
  Gauge,
  Headphones,
  MapPinned,
  RefreshCcw,
  ShieldAlert,
  Star,
  TrendingDown,
  UsersRound,
  Wallet
} from "lucide-react";
import { signOut } from "@/app/auth/actions";
import { AdminAutoRefresh } from "@/components/admin-auto-refresh";
import { AdminAreaLinks } from "@/components/admin-area-links";
import { AdminTopBar } from "@/components/admin-top-bar";
import { hasApprovedAdminRole } from "@/lib/admin-access";
import { adminEntryCookieName, hasValidAdminEntry } from "@/lib/admin-entry";
import { recordAuthAudit, requireActiveLdaAuthSession } from "@/lib/auth-sessions";
import { isLiveAdminPaymentRow } from "@/lib/admin-live-data";
import {
  getValidPrivilegedSessionRole,
  privilegedSessionCookieName
} from "@/lib/privileged-session-cookie";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/money";

type CountableTable = "profiles" | "account_roles" | "instructor_profiles" | "bookings" | "reviews";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true
    }
  }
};

async function countRows(supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>, table: CountableTable) {
  const { count } = await supabase.from(table).select("*", { count: "exact", head: true });
  return count ?? 0;
}

const londonDayFormatter = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "Europe/London",
  year: "numeric"
});

function londonDateKey(value: Date | string) {
  return londonDayFormatter.format(new Date(value));
}

export default async function AdminPage() {
  const cookieStore = await cookies();
  const demoRole = cookieStore.get("lda_demo_role")?.value;
  const hasAdminEntry = hasValidAdminEntry(cookieStore.get(adminEntryCookieName)?.value);
  const privilegedSessionRole = getValidPrivilegedSessionRole(cookieStore.get(privilegedSessionCookieName)?.value);

  if (!hasAdminEntry && privilegedSessionRole !== "admin") {
    redirect("/");
  }

  if (demoRole === "admin") {
    return <AdminDemoDashboard />;
  }

  const supabase = await createClient();

  if (!supabase) {
    if (!hasAdminEntry) redirect("/");
    return <AdminMessage title="Supabase not configured" body="Admin access is temporarily unavailable." />;
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    if (!hasAdminEntry) redirect("/");
    return <AdminMessage title="Admin sign in required" body="Sign in before opening the admin dashboard." />;
  }

  if (!(await hasApprovedAdminRole(supabase, user))) {
    if (!hasAdminEntry) redirect("/");
    return <AdminMessage title="Admin access denied" body="This account is not authorised for LDA admin access." />;
  }

  const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aalError || aal?.currentLevel !== "aal2") {
    redirect("/admin-mfa");
  }

  const adminClient = createAdminClient();
  const requestHeaders = await headers();
  const activeSession = await requireActiveLdaAuthSession({
    adminClient,
    cookieStore,
    headers: requestHeaders,
    userId: user.id,
    role: "admin",
    readOnly: true
  });

  if (!activeSession.ok) {
    redirect(hasAdminEntry
      ? "/admin-access?message=Admin access expired. Sign in again and complete authenticator verification."
      : "/");
  }

  await recordAuthAudit({
    adminClient,
    actorUserId: user.id,
    subjectUserId: user.id,
    role: "admin",
    action: "admin.access.authorized",
    targetType: "admin_workspace",
    sessionId: activeSession.sessionId,
    headers: requestHeaders
  });

  const [
    users,
    learners,
    instructors,
    inProgressInstructors,
    activeInstructors,
    reviewCount,
    { data: payments },
    { data: reviews },
    { data: recentBookings },
    { data: bookingStatuses },
    { data: accountCreatedRows },
    { data: visitorRows },
    supportTicketResult,
    supportFeedbackResult,
    supportIncidentResult
  ] = await Promise.all([
    countRows(supabase, "profiles"),
    supabase.from("account_roles").select("*", { count: "exact", head: true }).eq("role", "learner").then(({ count }) => count ?? 0),
    countRows(supabase, "instructor_profiles"),
    supabase.from("instructor_profiles").select("*", { count: "exact", head: true }).neq("verification_status", "approved").then(({ count }) => count ?? 0),
    supabase.from("instructor_profiles").select("*", { count: "exact", head: true }).eq("verification_status", "approved").then(({ count }) => count ?? 0),
    countRows(supabase, "reviews"),
    supabase.from("payments").select("booking_id,gross_amount_pence,platform_fee_pence,instructor_net_pence,status,stripe_checkout_session_id,created_at").limit(5000),
    supabase.from("reviews").select("rating,created_at").limit(5000),
    supabase.from("bookings").select("id,status,payment_status,lesson_price_pence,created_at").order("created_at", { ascending: false }).limit(100),
    supabase.from("bookings").select("id,status,payment_status,created_at").limit(5000),
    supabase.from("profiles").select("created_at").order("created_at", { ascending: false }).limit(5000),
    supabase.from("site_analytics_visitors").select("first_seen_at").order("first_seen_at", { ascending: false }).limit(5000),
    supabase.from("support_tickets").select("id", { count: "exact", head: true }).neq("status", "resolved"),
    supabase.from("product_feedback").select("id", { count: "exact", head: true }).neq("support_status", "resolved"),
    supabase.from("technical_incidents").select("id", { count: "exact", head: true }).neq("status", "resolved")
  ]);

  const now = new Date();
  const todayKey = londonDateKey(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const livePayments = payments?.filter(isLiveAdminPaymentRow) ?? [];
  const paidPayments = livePayments.filter((payment) => payment.status === "paid");
  const liveBookingIds = new Set(livePayments.map((payment) => payment.booking_id).filter(Boolean));
  const bookingStatusRows = (bookingStatuses ?? []).filter((booking) => liveBookingIds.has(booking.id));
  const liveRecentBookings = (recentBookings ?? []).filter((booking) => liveBookingIds.has(booking.id)).slice(0, 8);
  const bookings = liveBookingIds.size;
  const todayPaidPayments = paidPayments.filter((payment) => londonDateKey(payment.created_at) === todayKey);
  const todayBookings = bookingStatusRows.filter((booking) => londonDateKey(booking.created_at) === todayKey).length;
  const todayNewAccounts = (accountCreatedRows ?? []).filter((profile) => londonDateKey(profile.created_at) === todayKey).length;
  const todayNewVisitors = (visitorRows ?? []).filter((visitor) => londonDateKey(visitor.first_seen_at) === todayKey).length;
  const todayGrossRevenue = todayPaidPayments.reduce((sum, payment) => sum + payment.gross_amount_pence, 0);
  const todayPlatformNetRevenue = todayPaidPayments.reduce((sum, payment) => sum + payment.platform_fee_pence, 0);
  const todayInstructorNetRevenue = todayPaidPayments.reduce((sum, payment) => sum + payment.instructor_net_pence, 0);
  const platformRevenueMonth = paidPayments
    .filter((payment) => new Date(payment.created_at) >= monthStart)
    .reduce((sum, payment) => sum + payment.platform_fee_pence, 0);
  const platformRevenueYtd = paidPayments
    .filter((payment) => new Date(payment.created_at) >= yearStart)
    .reduce((sum, payment) => sum + payment.platform_fee_pence, 0);
  const grossLessonValue = paidPayments.reduce((sum, payment) => sum + payment.gross_amount_pence, 0);
  const instructorPayoutDue = paidPayments.reduce((sum, payment) => sum + payment.instructor_net_pence, 0);
  const cancelledBookings = bookingStatusRows.filter((booking) => (booking.status ?? "").toLowerCase().includes("cancel")).length;
  const refundRecords = bookingStatusRows.filter((booking) => {
    const status = `${booking.status ?? ""} ${booking.payment_status ?? ""}`.toLowerCase();
    return status.includes("refund");
  }).length + livePayments.filter((payment) => payment.status === "refunded").length;
  const disputeRecords = bookingStatusRows.filter((booking) => {
    const status = `${booking.status ?? ""} ${booking.payment_status ?? ""}`.toLowerCase();
    return status.includes("dispute");
  }).length + livePayments.filter((payment) => payment.status === "disputed").length;
  const cancellationRate = bookingStatusRows.length ? `${((cancelledBookings / bookingStatusRows.length) * 100).toFixed(1)}%` : "0.0%";
  const avgInstructorRating = reviews?.length
    ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1)
    : "0.0";
  const platformHealthScore = 100;
  const platformHealthTone = platformHealthScore >= 98 ? "text-emerald-100" : platformHealthScore >= 95 ? "text-amber-100" : "text-red-100";
  const platformHealthDetail =
    platformHealthScore >= 98
      ? "Protected dashboard and live data layer are responding."
      : "Review site-health alerts and platform logs.";
  const activeSupportItems =
    (supportTicketResult.count ?? 0) +
    (supportFeedbackResult.count ?? 0) +
    (supportIncidentResult.count ?? 0);

  const liveKpis = [
    { label: "New visits today", value: todayNewVisitors, detail: "Unique public-site visitors by secure hashed IP", icon: UsersRound, href: "/admin/analytics" },
    { label: "Bookings today", value: todayBookings, detail: `${bookings} total booking${bookings === 1 ? "" : "s"} tracked across the platform`, icon: CalendarDays, href: "/admin/bookings" },
    { label: "Gross today", value: formatMoney(todayGrossRevenue), detail: "Live Stripe-backed learner payments received today", icon: BadgePoundSterling, href: "/admin/revenue" },
    { label: "Net today", value: formatMoney(todayPlatformNetRevenue), detail: "LDA net platform revenue retained today", icon: TrendingDown, href: "/admin/revenue" },
    { label: "New accounts today", value: todayNewAccounts, detail: `${users} total account${users === 1 ? "" : "s"} on the platform`, icon: UsersRound, href: "/admin/learners" }
  ];

  const operationsSections = [
    {
      id: "learners",
      title: "Learners",
      value: learners,
      detail: "Registered learner accounts, eligibility checks, account growth, and learner-side operational support.",
      icon: UsersRound,
      href: "/admin/learners",
      action: "Open learner view"
    },
    {
      id: "instructors",
      title: "Instructors",
      value: `${activeInstructors}/${instructors}`,
      detail: "Approved instructors against total profiles, verification workload, ADI checks, and onboarding health.",
      icon: CarFront,
      href: "/admin/instructors",
      action: "Review instructors"
    },
    {
      id: "in-progress-instructors",
      title: "In progress instructors",
      value: inProgressInstructors,
      detail: "Instructor applications waiting for LDA document review, document decisions, or final approval before full instructor access unlocks.",
      icon: FileCheck2,
      href: "/admin/instructors#in-progress-instructors",
      action: "Review documents"
    },
    {
      id: "active-drivers",
      title: "Active drivers",
      value: "Map",
      detail: "Admin-only live location control for instructors who have shared device location today, with Google Maps focus for safety support.",
      icon: MapPinned,
      href: "/admin/active-drivers",
      action: "Open driver map"
    },
    {
      id: "bookings",
      title: "Bookings",
      value: todayBookings,
      detail: `${bookings} total booking${bookings === 1 ? "" : "s"} tracked. Open bookings for day, week, month, year, status, payment, and cancellation detail.`,
      icon: CalendarDays,
      href: "/admin/bookings",
      action: "Open bookings"
    },
    {
      id: "refunds",
      title: "Refunds",
      value: refundRecords,
      detail: "Refund requests, refunded payments, and cancellation/refund repeat patterns by learner account.",
      icon: RefreshCcw,
      href: "/admin/refunds",
      action: "Open refund monitor"
    },
    {
      id: "disputes",
      title: "Disputes",
      value: disputeRecords,
      detail: "Disputed booking/payment records with learner, instructor, amount, and suggested next steps.",
      icon: AlertTriangle,
      href: "/admin/disputes",
      action: "Open disputes"
    },
    {
      id: "revenue",
      title: "Revenue",
      value: formatMoney(platformRevenueMonth),
      detail: `${formatMoney(todayGrossRevenue)} gross today, ${formatMoney(todayPlatformNetRevenue)} net today, and ${formatMoney(platformRevenueYtd)} net platform revenue year to date.`,
      icon: BarChart3,
      href: "/admin/revenue",
      action: "Open analytics"
    },
    {
      id: "support",
      title: "Support",
      value: activeSupportItems,
      detail: "The shared support workspace for AI-guided tickets, customer feedback, technical incidents, consent reporting, website health, and admin escalation.",
      icon: Headphones,
      href: "/technical-support",
      action: "Open support"
    },
    {
      id: "website-analytics",
      title: "Website analytics",
      value: "Live",
      detail: "Real public-site visits, stay signals, most visited pages, most visited sections, and clicked buttons/links.",
      icon: BarChart3,
      href: "/admin/analytics",
      action: "Open website analytics"
    },
    {
      id: "payouts",
      title: "Payouts",
      value: formatMoney(instructorPayoutDue),
      detail: `${formatMoney(todayInstructorNetRevenue)} instructor net generated today. Use this for payout reconciliation and finance checks.`,
      icon: Wallet,
      href: "/admin/revenue",
      action: "Open finance"
    },
    {
      id: "cancellation-rate",
      title: "Cancellation rate",
      value: cancellationRate,
      detail: `${cancelledBookings} cancelled booking${cancelledBookings === 1 ? "" : "s"} across ${bookingStatusRows.length} tracked booking status records.`,
      icon: TrendingDown,
      href: "/admin/bookings",
      action: "Review cancellations"
    },
    {
      id: "instructor-reviews",
      title: "Instructor reviews",
      value: `${avgInstructorRating}/5`,
      detail: `${reviewCount} instructor review${reviewCount === 1 ? "" : "s"} tracked across the platform.`,
      icon: Star,
      href: "/admin/instructors",
      action: "Open reviews"
    }
  ];

  return (
    <main className="min-h-screen bg-black">
      <AdminAutoRefresh />
      <AdminTopBar autoSignOutOnLeave />
      <header className="border-b border-zinc-800 bg-ink px-4 py-8 text-white">
        <section className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-sm font-black uppercase text-red-200">Admin operations</div>
              <h1 className="mt-2 text-4xl font-black tracking-normal">LDA Control Centre</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-300">
                A protected command centre for platform health, learner demand, instructor supply, live bookings, refunds, disputes, revenue, payouts, cancellation rate, and instructor reviews.
              </p>
            </div>
            <Link href="/owner-dashboard" className="rounded-full border border-red-500/40 px-5 py-3 text-sm font-black text-red-100 hover:border-red-400 hover:text-white">
              Owner analytics
            </Link>
          </div>
        </section>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8 text-white">
        <section className="mb-5 rounded border border-zinc-800 bg-zinc-950 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded border border-red-500/30 bg-red-500/10 text-brand">
                <Gauge size={22} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white">Live platform health</h2>
                <p className="mt-1 text-sm font-semibold leading-6 text-zinc-400">{platformHealthDetail}</p>
              </div>
            </div>
            <div className={`text-4xl font-black ${platformHealthTone}`}>{platformHealthScore}%</div>
          </div>
        </section>

        <section id="platform-health" className="scroll-mt-24 rounded border border-zinc-800 bg-zinc-950 p-5 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="mt-1 text-2xl font-black text-white">Executive operating view</h2>
            </div>
            <div className="rounded-full border border-zinc-800 px-4 py-2 text-sm font-black text-zinc-300">MFA protected</div>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {liveKpis.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <Link key={kpi.label} href={kpi.href} className="rounded border border-zinc-800 bg-black p-5 shadow-sm transition hover:border-red-500 hover:bg-zinc-950">
                <Icon className="text-brand" />
                <div className="mt-4 text-sm font-bold text-zinc-400">{kpi.label}</div>
                <div className="mt-2 text-3xl font-black">{kpi.value}</div>
                <p className="mt-1 text-sm leading-6 text-zinc-400">{kpi.detail}</p>
              </Link>
            );
          })}
          </div>
        </section>

        <section className="mt-8 grid gap-4 lg:grid-cols-3">
          {operationsSections.map((section) => {
            const Icon = section.icon;

            return (
              <article key={section.id} id={section.id} className="scroll-mt-24 rounded border border-zinc-800 bg-zinc-950 p-5 text-white shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="grid h-11 w-11 place-items-center rounded border border-red-500/30 bg-red-500/10 text-brand">
                    <Icon size={22} />
                  </div>
                  <div className="rounded-full border border-zinc-800 px-3 py-1 text-xs font-black uppercase text-zinc-400">Control area</div>
                </div>
                <h2 className="mt-5 text-2xl font-black">{section.title}</h2>
                <div className="mt-2 text-3xl font-black text-white">{section.value}</div>
                <p className="mt-3 min-h-20 text-sm font-semibold leading-6 text-zinc-400">{section.detail}</p>
                <Link href={section.href} className="mt-5 inline-flex items-center gap-2 text-sm font-black text-red-100 hover:text-brand">
                  {section.action}
                  <ArrowRight size={16} />
                </Link>
              </article>
            );
          })}
        </section>

        <div className="mt-8">
          <section id="recent-activity" className="scroll-mt-24 rounded border border-zinc-800 bg-zinc-950 p-5 shadow-sm">
            <h2 className="text-2xl font-black">Recent booking/payment activity</h2>
            <div className="mt-4 overflow-hidden rounded border border-zinc-800">
              <div className="grid grid-cols-4 bg-ink px-4 py-3 text-xs font-black uppercase text-white">
                <div>Status</div>
                <div>Payment</div>
                <div>Lesson value</div>
                <div>Created</div>
              </div>
              {liveRecentBookings.map((booking) => (
                <div key={booking.id} className="grid grid-cols-4 border-t border-zinc-800 px-4 py-3 text-sm">
                  <div className="font-black">{booking.status}</div>
                  <div>{booking.payment_status}</div>
                  <div>{formatMoney(booking.lesson_price_pence)}</div>
                  <div>{new Date(booking.created_at).toLocaleDateString("en-GB")}</div>
                </div>
              ))}
              {liveRecentBookings.length ? null : (
                <div className="px-4 py-6 text-sm text-zinc-400">No live bookings yet.</div>
              )}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function AdminDemoDashboard() {
  return (
    <main className="min-h-screen bg-black">
      <AdminTopBar autoSignOutOnLeave />
      <header className="border-b border-zinc-800 bg-ink px-4 py-8 text-white">
        <section className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-black uppercase text-red-200">Admin dashboard</div>
            <h1 className="mt-2 text-4xl font-black">LDA Control Centre</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-300">Protected admin area for testing access controls before opening the full live dashboard.</p>
          </div>
          <form action={signOut}>
            <button className="lda-pill lda-pill-sm">Exit demo</button>
          </form>
        </section>
      </header>
      <section className="mx-auto max-w-7xl px-4 py-8">
        <AdminAreaLinks />

        <div className="mt-6 rounded border border-zinc-800 bg-zinc-950 p-5 text-white shadow-sm">
          <h2 className="text-2xl font-black">Live analytics only</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-zinc-400">
            LDA now uses live admin data only. Open the protected admin dashboard to view real operational counters.
          </p>
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
        <Link href="/admin-access" className="lda-pill lda-pill-sm mt-5">Go to admin login</Link>
      </section>
    </main>
  );
}
