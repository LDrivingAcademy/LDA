import { BadgePoundSterling, BarChart3, MapPin, TrendingUp, UserRoundCheck, Wallet, type LucideIcon } from "lucide-react";
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
  booking_id: string;
  gross_amount_pence: number;
  platform_fee_pence: number;
  instructor_net_pence: number;
  status: string;
  stripe_checkout_session_id: string | null;
  created_at: string;
};

type BookingRow = {
  id: string;
  learner_id: string;
  instructor_id: string;
  pickup_postcode: string | null;
  status: string | null;
  created_at: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type InstructorRow = {
  user_id: string;
  display_name: string | null;
  base_postcode: string | null;
};

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

function areaKey(value?: string | null) {
  const cleaned = String(value ?? "Unknown").trim().toUpperCase();
  const outward = cleaned.split(/\s+/)[0];
  return outward || "Unknown";
}

export default async function AdminRevenuePage() {
  const { supabase } = await requireAdminDashboardClient();

  const [{ data: payments }, { data: bookings }, { data: instructors }] = await Promise.all([
    supabase.from("payments").select("booking_id,gross_amount_pence,platform_fee_pence,instructor_net_pence,status,stripe_checkout_session_id,created_at").order("created_at", { ascending: false }).limit(5000),
    supabase.from("bookings").select("id,learner_id,instructor_id,pickup_postcode,status,created_at").limit(5000),
    supabase.from("instructor_profiles").select("user_id,display_name,base_postcode").limit(1000)
  ]);

  const paymentRows = ((payments as PaymentRow[] | null) ?? []).filter((payment) => payment.status === "paid" && isLiveAdminPaymentRow(payment));
  const bookingRows = (bookings as BookingRow[] | null) ?? [];
  const bookingById = new Map(bookingRows.map((booking) => [booking.id, booking]));
  const instructorById = new Map((instructors as InstructorRow[] | null ?? []).map((instructor) => [instructor.user_id, instructor]));
  const profileIds = Array.from(new Set(bookingRows.map((booking) => booking.instructor_id).filter(Boolean)));
  const { data: profiles } = profileIds.length
    ? await supabase.from("profiles").select("id,full_name,email").in("id", profileIds)
    : { data: [] };
  const profileById = new Map((profiles as ProfileRow[] | null ?? []).map((profile) => [profile.id, profile]));

  const now = new Date();
  const todayKey = londonDateKey(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const gross = paymentRows.reduce((sum, payment) => sum + payment.gross_amount_pence, 0);
  const platform = paymentRows.reduce((sum, payment) => sum + payment.platform_fee_pence, 0);
  const instructorNet = paymentRows.reduce((sum, payment) => sum + payment.instructor_net_pence, 0);
  const todayPayments = paymentRows.filter((payment) => londonDateKey(payment.created_at) === todayKey);
  const monthPayments = paymentRows.filter((payment) => inRange(payment.created_at, monthStart));
  const yearPayments = paymentRows.filter((payment) => inRange(payment.created_at, yearStart));
  const todayGross = todayPayments.reduce((sum, payment) => sum + payment.gross_amount_pence, 0);
  const todayNet = todayPayments.reduce((sum, payment) => sum + payment.platform_fee_pence, 0);
  const monthGross = monthPayments.reduce((sum, payment) => sum + payment.gross_amount_pence, 0);
  const monthNet = monthPayments.reduce((sum, payment) => sum + payment.platform_fee_pence, 0);
  const yearGross = yearPayments.reduce((sum, payment) => sum + payment.gross_amount_pence, 0);
  const yearNet = yearPayments.reduce((sum, payment) => sum + payment.platform_fee_pence, 0);

  const byInstructor = new Map<string, { id: string; gross: number; platform: number; bookings: number }>();
  const byArea = new Map<string, { area: string; gross: number; platform: number; bookings: number }>();

  for (const payment of paymentRows) {
    const booking = bookingById.get(payment.booking_id);
    const instructorId = booking?.instructor_id ?? "unknown";
    const instructorTotal = byInstructor.get(instructorId) ?? { id: instructorId, gross: 0, platform: 0, bookings: 0 };
    instructorTotal.gross += payment.gross_amount_pence;
    instructorTotal.platform += payment.platform_fee_pence;
    instructorTotal.bookings += 1;
    byInstructor.set(instructorId, instructorTotal);

    const area = areaKey(booking?.pickup_postcode);
    const areaTotal = byArea.get(area) ?? { area, gross: 0, platform: 0, bookings: 0 };
    areaTotal.gross += payment.gross_amount_pence;
    areaTotal.platform += payment.platform_fee_pence;
    areaTotal.bookings += 1;
    byArea.set(area, areaTotal);
  }

  const instructorRows = Array.from(byInstructor.values()).sort((left, right) => right.gross - left.gross);
  const areaRows = Array.from(byArea.values()).sort((left, right) => right.gross - left.gross);

  return (
    <main className="min-h-screen bg-black text-white">
      <AdminTopBar autoSignOutOnLeave />
      <AdminPageHeader
        eyebrow="Revenue analytics"
        title="Business revenue control"
        description="Live Stripe-backed paid-payment revenue across the whole business, with gross learner spend, LDA net platform revenue, instructor net, time windows, instructor breakdown, and area breakdown. Test-mode Stripe records are excluded."
      />

      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid gap-4 md:grid-cols-4">
          <Metric icon={BadgePoundSterling} label="Total gross revenue" value={formatMoney(gross)} detail="Paid learner spend" />
          <Metric icon={Wallet} label="Platform revenue" value={formatMoney(platform)} detail="LDA commission retained" />
          <Metric icon={UserRoundCheck} label="Instructor net" value={formatMoney(instructorNet)} detail="Instructor earnings due/paid" />
          <Metric icon={TrendingUp} label="Paid bookings" value={paymentRows.length} detail="Paid payment records" />
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Metric icon={BarChart3} label="Today" value={formatMoney(todayGross)} detail={`${formatMoney(todayNet)} net platform revenue`} />
          <Metric icon={BarChart3} label="This month" value={formatMoney(monthGross)} detail={`${formatMoney(monthNet)} net platform revenue`} />
          <Metric icon={BarChart3} label="This year" value={formatMoney(yearGross)} detail={`${formatMoney(yearNet)} net platform revenue`} />
        </div>

        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded border border-zinc-800 bg-zinc-950 p-5">
            <h2 className="text-2xl font-black">Revenue per instructor</h2>
            <div className="mt-5 grid gap-3">
              {instructorRows.map((row) => {
                const instructor = instructorById.get(row.id);
                const profile = profileById.get(row.id);
                const name = instructor?.display_name || profile?.full_name || profile?.email || "Unknown instructor";
                return (
                  <div key={row.id} className="rounded border border-zinc-800 bg-black p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-black">{name}</div>
                        <div className="mt-1 text-sm font-semibold text-zinc-400">{row.bookings} paid booking{row.bookings === 1 ? "" : "s"} - base {instructor?.base_postcode ?? "not recorded"}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-black">{formatMoney(row.gross)}</div>
                        <div className="text-sm font-semibold text-zinc-400">{formatMoney(row.platform)} platform</div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {instructorRows.length ? null : <Empty text="No paid instructor revenue yet." />}
            </div>
          </div>

          <div className="rounded border border-zinc-800 bg-zinc-950 p-5">
            <h2 className="text-2xl font-black">Revenue per area</h2>
            <p className="mt-1 text-sm font-semibold text-zinc-400">Area is based on booking pickup postcode outward code.</p>
            <div className="mt-5 grid gap-3">
              {areaRows.map((row) => (
                <div key={row.area} className="rounded border border-zinc-800 bg-black p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 font-black"><MapPin size={16} className="text-brand" /> {row.area}</div>
                      <div className="mt-1 text-sm font-semibold text-zinc-400">{row.bookings} paid booking{row.bookings === 1 ? "" : "s"}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-black">{formatMoney(row.gross)}</div>
                      <div className="text-sm font-semibold text-zinc-400">{formatMoney(row.platform)} platform</div>
                    </div>
                  </div>
                </div>
              ))}
              {areaRows.length ? null : <Empty text="No paid area revenue yet." />}
            </div>
          </div>
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
