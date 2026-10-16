import { AlertTriangle, BadgePoundSterling, CalendarDays, CreditCard, RefreshCcw, TrendingUp, type LucideIcon } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";
import { AdminTopBar } from "@/components/admin-top-bar";
import { isLiveAdminPaymentRow } from "@/lib/admin-live-data";
import { requireAdminDashboardClient } from "@/lib/admin-dashboard";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true
  }
};

type PaymentRow = {
  id: string;
  booking_id: string;
  gross_amount_pence: number;
  platform_fee_pence: number;
  instructor_net_pence: number;
  stripe_payment_intent_id: string | null;
  stripe_checkout_session_id: string | null;
  status: string;
  created_at: string;
};

type BookingRow = {
  id: string;
  learner_id: string;
  instructor_id: string;
  pickup_postcode: string | null;
  status: string | null;
  payment_status: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type InstructorRow = {
  user_id: string;
  display_name: string | null;
  instructor_package: string | null;
  instructor_subscription_status: string | null;
  stripe_subscription_id: string | null;
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB");
}

function inRange(value: string, start: Date) {
  return new Date(value) >= start;
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

function statusTone(status: string) {
  const normalised = status.toLowerCase();
  if (normalised === "paid") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-100";
  if (normalised === "refunded" || normalised === "disputed") return "border-red-500/40 bg-red-500/10 text-red-100";
  return "border-amber-500/40 bg-amber-500/10 text-amber-100";
}

export default async function AdminPaymentsPage() {
  const { supabase } = await requireAdminDashboardClient();

  const [{ data: payments }, { data: bookings }, { data: instructors }] = await Promise.all([
    supabase.from("payments").select("id,booking_id,gross_amount_pence,platform_fee_pence,instructor_net_pence,stripe_payment_intent_id,stripe_checkout_session_id,status,created_at").order("created_at", { ascending: false }).limit(5000),
    supabase.from("bookings").select("id,learner_id,instructor_id,pickup_postcode,status,payment_status").limit(5000),
    supabase.from("instructor_profiles").select("user_id,display_name,instructor_package,instructor_subscription_status,stripe_subscription_id").limit(1000)
  ]);

  const paymentRows = ((payments as PaymentRow[] | null) ?? []).filter(isLiveAdminPaymentRow);
  const bookingRows = (bookings as BookingRow[] | null) ?? [];
  const bookingById = new Map(bookingRows.map((booking) => [booking.id, booking]));
  const profileIds = Array.from(new Set(bookingRows.flatMap((booking) => [booking.learner_id, booking.instructor_id]).filter(Boolean)));
  const { data: profiles } = profileIds.length
    ? await supabase.from("profiles").select("id,full_name,email").in("id", profileIds)
    : { data: [] };
  const profileById = new Map((profiles as ProfileRow[] | null ?? []).map((profile) => [profile.id, profile]));
  const instructorById = new Map((instructors as InstructorRow[] | null ?? []).map((instructor) => [instructor.user_id, instructor]));

  const now = new Date();
  const todayKey = londonDateKey(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const paid = paymentRows.filter((payment) => payment.status === "paid");
  const refunded = paymentRows.filter((payment) => payment.status === "refunded");
  const disputed = paymentRows.filter((payment) => payment.status === "disputed");
  const incomplete = paymentRows.filter((payment) => payment.status !== "paid" && payment.status !== "refunded" && payment.status !== "disputed");
  const dayPayments = paymentRows.filter((payment) => londonDateKey(payment.created_at) === todayKey);
  const monthPayments = paymentRows.filter((payment) => inRange(payment.created_at, monthStart));
  const yearPayments = paymentRows.filter((payment) => inRange(payment.created_at, yearStart));
  const paidToday = paid.filter((payment) => londonDateKey(payment.created_at) === todayKey);
  const paidThisMonth = monthPayments.filter((payment) => payment.status === "paid");
  const paidThisYear = yearPayments.filter((payment) => payment.status === "paid");
  const todayGross = paidToday.reduce((sum, payment) => sum + payment.gross_amount_pence, 0);
  const todayNet = paidToday.reduce((sum, payment) => sum + payment.platform_fee_pence, 0);
  const monthGross = paidThisMonth.reduce((sum, payment) => sum + payment.gross_amount_pence, 0);
  const monthNet = paidThisMonth.reduce((sum, payment) => sum + payment.platform_fee_pence, 0);
  const yearGross = paidThisYear.reduce((sum, payment) => sum + payment.gross_amount_pence, 0);
  const yearNet = paidThisYear.reduce((sum, payment) => sum + payment.platform_fee_pence, 0);
  const paidRevenue = paid.reduce((sum, payment) => sum + payment.gross_amount_pence, 0);
  const platformRevenue = paid.reduce((sum, payment) => sum + payment.platform_fee_pence, 0);
  const trialCancelWatch = ((instructors as InstructorRow[] | null) ?? []).filter((instructor) =>
    instructor.stripe_subscription_id &&
    instructor.instructor_package?.includes("plus") &&
    instructor.instructor_subscription_status &&
    !["active", "trialing"].includes(instructor.instructor_subscription_status)
  );

  return (
    <main className="min-h-screen bg-black text-white">
      <AdminTopBar autoSignOutOnLeave />
      <AdminPageHeader
        eyebrow="Payment operations"
        title="Payment analytics"
        description="Admin-only live payment ledger with daily, monthly, yearly, paid, incomplete, refunded, disputed, and subscription-cancellation pattern monitoring. Stripe test-mode payments are excluded."
      />

      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid gap-4 md:grid-cols-4">
          <Metric icon={CreditCard} label="Payments taken" value={paymentRows.length} detail="Live Stripe payment records" />
          <Metric icon={CalendarDays} label="Today" value={dayPayments.length} detail={`${formatMoney(todayGross)} gross / ${formatMoney(todayNet)} net`} />
          <Metric icon={CalendarDays} label="This month" value={monthPayments.length} detail={`${formatMoney(monthGross)} gross / ${formatMoney(monthNet)} net`} />
          <Metric icon={TrendingUp} label="This year" value={yearPayments.length} detail={`${formatMoney(yearGross)} gross / ${formatMoney(yearNet)} net`} />
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-4">
          <Metric icon={BadgePoundSterling} label="Gross paid value" value={formatMoney(paidRevenue)} detail={`${formatMoney(platformRevenue)} platform revenue`} />
          <Metric icon={AlertTriangle} label="Incomplete" value={incomplete.length} detail="Unpaid or requires payment" />
          <Metric icon={RefreshCcw} label="Refunded" value={refunded.length} detail="Payment status refunded" />
          <Metric icon={AlertTriangle} label="Disputed" value={disputed.length} detail="Payment status disputed" />
        </div>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="rounded border border-zinc-800 bg-zinc-950 p-5">
            <h2 className="text-2xl font-black">Payment ledger</h2>
            <div className="mt-5 grid gap-3">
              {paymentRows.map((payment) => {
                const booking = bookingById.get(payment.booking_id);
                const learner = booking ? profileById.get(booking.learner_id) : null;
                const instructorProfile = booking ? profileById.get(booking.instructor_id) : null;
                const instructor = booking ? instructorById.get(booking.instructor_id) : null;

                return (
                  <article key={payment.id} className="rounded border border-zinc-800 bg-black p-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-3 py-1 text-xs font-black uppercase ${statusTone(payment.status)}`}>{payment.status}</span>
                          <h3 className="text-lg font-black">{formatMoney(payment.gross_amount_pence)}</h3>
                          <span className="text-sm font-bold text-zinc-500">{formatDate(payment.created_at)}</span>
                        </div>
                        <div className="mt-2 grid gap-1 text-sm font-semibold text-zinc-400 md:grid-cols-3">
                          <div>Learner: <span className="text-zinc-200">{learner?.full_name || learner?.email || "Not linked"}</span></div>
                          <div>Instructor: <span className="text-zinc-200">{instructor?.display_name || instructorProfile?.full_name || instructorProfile?.email || "Not linked"}</span></div>
                          <div>Pickup: <span className="text-zinc-200">{booking?.pickup_postcode ?? "Not recorded"}</span></div>
                        </div>
                      </div>
                      <div className="text-right text-sm font-semibold text-zinc-400">
                        <div>Platform: <span className="font-black text-zinc-100">{formatMoney(payment.platform_fee_pence)}</span></div>
                        <div>Instructor net: <span className="font-black text-zinc-100">{formatMoney(payment.instructor_net_pence)}</span></div>
                      </div>
                    </div>
                  </article>
                );
              })}
              {paymentRows.length ? null : <Empty text="No payment records found yet." />}
            </div>
          </div>

          <aside className="rounded border border-zinc-800 bg-zinc-950 p-5">
            <h2 className="text-2xl font-black">Pattern watch</h2>
            <div className="mt-4 rounded border border-zinc-800 bg-black p-4">
              <div className="text-sm font-black uppercase text-red-200">Trial / package churn</div>
              <div className="mt-2 text-3xl font-black">{trialCancelWatch.length}</div>
              <p className="mt-2 text-sm font-semibold leading-6 text-zinc-400">
                Instructors on paid plus-style packages with a Stripe subscription id but non-active status.
              </p>
            </div>
            <div className="mt-4 rounded border border-zinc-800 bg-black p-4">
              <div className="text-sm font-black uppercase text-red-200">Important data gap</div>
              <p className="mt-2 text-sm font-semibold leading-6 text-zinc-400">
                Stripe failed-payment attempts and trial cancellation events need a dedicated event table to track every attempt, not just final payment records.
              </p>
            </div>
          </aside>
        </section>
      </section>
    </main>
  );
}

function Metric({ icon: Icon, label, value, detail }: { icon: LucideIcon; label: string; value: number | string; detail: string }) {
  return (
    <article className="rounded border border-zinc-800 bg-zinc-950 p-5">
      <Icon className="text-brand" size={22} />
      <div className="mt-3 text-sm font-bold text-zinc-400">{label}</div>
      <div className="mt-2 text-3xl font-black">{value}</div>
      <p className="mt-1 text-sm font-semibold leading-6 text-zinc-400">{detail}</p>
    </article>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded border border-zinc-800 bg-black p-6 text-sm font-semibold text-zinc-400">{text}</div>;
}
