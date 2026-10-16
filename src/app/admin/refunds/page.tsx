import { AlertTriangle, Mail, MapPin, RefreshCcw, UserRoundX, type LucideIcon } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";
import { AdminTopBar } from "@/components/admin-top-bar";
import { isLiveAdminPaymentRow, isProductionLessonMetricRow } from "@/lib/admin-live-data";
import { requireAdminDashboardClient } from "@/lib/admin-dashboard";
import { getLearnerCancellationPolicySteps } from "@/lib/learner-account-enforcement";
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

type BookingRow = {
  id: string;
  learner_id: string;
  instructor_id: string;
  pickup_postcode: string | null;
  lesson_price_pence: number;
  status: string | null;
  payment_status: string | null;
  cancellation_reason: string | null;
  created_at: string;
};

type PaymentRow = {
  booking_id: string;
  gross_amount_pence: number;
  stripe_checkout_session_id: string | null;
  status: string;
  created_at: string;
};

type LessonBookingRecordRow = {
  booking_reference: string;
  learner_id: string | null;
  learner_email: string | null;
  instructor_name: string | null;
  lesson_price_pence: number;
  status: string | null;
  payment_status: string | null;
  stripe_checkout_session_id: string | null;
  cancellation_actor: string | null;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  created_at: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
};

type EnforcementEventRow = {
  id: string;
  learner_id: string;
  enforcement_key: string;
  enforcement_action: string;
  event_count: number;
  window_days: number;
  reason: string;
  ban_duration: string | null;
  created_at: string;
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB");
}

function isRefundLike(booking: BookingRow, payment?: PaymentRow) {
  const bookingStatus = String(booking.status ?? "").toLowerCase();
  const paymentStatus = String(booking.payment_status ?? payment?.status ?? "").toLowerCase();
  return bookingStatus.includes("refund") || bookingStatus.includes("cancel") || paymentStatus.includes("refund");
}

function isRefundLikeLessonRecord(record: LessonBookingRecordRow) {
  const bookingStatus = String(record.status ?? "").toLowerCase();
  const paymentStatus = String(record.payment_status ?? "").toLowerCase();
  return bookingStatus.includes("refund") || bookingStatus.includes("cancel") || paymentStatus.includes("refund");
}

export default async function AdminRefundsPage() {
  const { supabase } = await requireAdminDashboardClient();
  const policySteps = getLearnerCancellationPolicySteps();

  const [{ data: bookings }, { data: payments }, { data: lessonRecords }, { data: enforcementEvents }] = await Promise.all([
    supabase.from("bookings").select("id,learner_id,instructor_id,pickup_postcode,lesson_price_pence,status,payment_status,cancellation_reason,created_at").order("created_at", { ascending: false }).limit(5000),
    supabase.from("payments").select("booking_id,gross_amount_pence,stripe_checkout_session_id,status,created_at").order("created_at", { ascending: false }).limit(5000),
    supabase
      .from("lesson_booking_records")
      .select("booking_reference,learner_id,learner_email,instructor_name,lesson_price_pence,status,payment_status,stripe_checkout_session_id,cancellation_actor,cancellation_reason,cancelled_at,created_at")
      .order("created_at", { ascending: false })
      .limit(5000),
    supabase
      .from("learner_account_enforcement_events")
      .select("id,learner_id,enforcement_key,enforcement_action,event_count,window_days,reason,ban_duration,created_at")
      .order("created_at", { ascending: false })
      .limit(500)
  ]);

  const rawBookingRows = (bookings as BookingRow[] | null) ?? [];
  const paymentRows = ((payments as PaymentRow[] | null) ?? []).filter(isLiveAdminPaymentRow);
  const lessonRecordRows = ((lessonRecords as LessonBookingRecordRow[] | null) ?? []).filter(isProductionLessonMetricRow);
  const paymentByBooking = new Map(paymentRows.map((payment) => [payment.booking_id, payment]));
  const bookingRows = rawBookingRows.filter((booking) => paymentByBooking.has(booking.id));
  const refundBookings = bookingRows.filter((booking) => isRefundLike(booking, paymentByBooking.get(booking.id)));
  const protectedLessonRecords = lessonRecordRows.filter(isRefundLikeLessonRecord);
  const liveReviewLearnerIds = new Set([
    ...refundBookings.map((booking) => booking.learner_id).filter(Boolean),
    ...protectedLessonRecords.map((record) => record.learner_id).filter(Boolean)
  ]);
  const enforcementRows = ((enforcementEvents as EnforcementEventRow[] | null) ?? []).filter((event) => liveReviewLearnerIds.has(event.learner_id));
  const learnerIds = Array.from(new Set([
    ...refundBookings.map((booking) => booking.learner_id).filter(Boolean),
    ...protectedLessonRecords.map((record) => record.learner_id).filter(Boolean),
    ...enforcementRows.map((event) => event.learner_id).filter(Boolean)
  ]));
  const { data: profiles } = learnerIds.length
    ? await supabase.from("profiles").select("id,full_name,email,phone").in("id", learnerIds)
    : { data: [] };
  const profileById = new Map((profiles as ProfileRow[] | null ?? []).map((profile) => [profile.id, profile]));
  const refundByLearner = new Map<string, BookingRow[]>();

  for (const booking of refundBookings) {
    refundByLearner.set(booking.learner_id, [...(refundByLearner.get(booking.learner_id) ?? []), booking]);
  }

  const learnerRows = Array.from(refundByLearner.entries()).map(([learnerId, learnerBookings]) => {
    const refundCount = learnerBookings.filter((booking) => String(booking.status ?? booking.payment_status ?? "").toLowerCase().includes("refund")).length;
    const cancelCount = learnerBookings.filter((booking) => String(booking.status ?? "").toLowerCase().includes("cancel")).length;
    const value = learnerBookings.reduce((sum, booking) => sum + (paymentByBooking.get(booking.id)?.gross_amount_pence ?? booking.lesson_price_pence ?? 0), 0);
    return {
      learnerId,
      profile: profileById.get(learnerId),
      bookings: learnerBookings,
      refundCount,
      cancelCount,
      value,
      latestPickup: learnerBookings[0]?.pickup_postcode ?? null,
      highRisk: refundCount >= 2 || learnerBookings.length >= 3
    };
  }).sort((left, right) => right.bookings.length - left.bookings.length);

  const totalValue = learnerRows.reduce((sum, row) => sum + row.value, 0);
  const protectedLessonValue = protectedLessonRecords.reduce((sum, record) => sum + (record.lesson_price_pence ?? 0), 0);
  const highRiskCount = learnerRows.filter((row) => row.highRisk).length;

  return (
    <main className="min-h-screen bg-black text-white">
      <AdminTopBar autoSignOutOnLeave />
      <AdminPageHeader
        eyebrow="Refund monitor"
        title="Refund and cancellation abuse watch"
        description="Admin-only live monitor for learners with refund, refunded, or cancellation-linked bookings so repeat patterns can be reviewed before access is restricted. Stripe test-mode records are excluded."
      />

      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid gap-4 md:grid-cols-4">
          <Metric icon={RefreshCcw} label="Refund/cancel records" value={refundBookings.length + protectedLessonRecords.length} detail="Bookings needing refund attention" />
          <Metric icon={UserRoundX} label="Learners involved" value={learnerRows.length} detail="Unique learner accounts" />
          <Metric icon={AlertTriangle} label="High-risk learners" value={highRiskCount} detail="Repeat refund/cancel pattern" />
          <Metric icon={RefreshCcw} label="Value involved" value={formatMoney(totalValue + protectedLessonValue)} detail="Gross lesson value under review" />
        </div>

        <section className="mt-6 rounded border border-red-500/40 bg-red-950/25 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-sm font-black uppercase text-red-200">Automatic enforcement policy</div>
              <h2 className="mt-1 text-2xl font-black">90-day learner cancellation and refund ladder</h2>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-zinc-300">
                The system counts learner-led cancellations and refund-linked records over a rolling 90-day window. It applies one new step at a time so warnings come before suspensions.
              </p>
            </div>
            <span className="rounded-full border border-red-500/40 px-3 py-1 text-xs font-black uppercase text-red-100">
              Auto monitored
            </span>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {policySteps.map((step) => (
              <div key={step.key} className="rounded border border-zinc-800 bg-black p-4">
                <div className="text-xs font-black uppercase text-zinc-500">{step.threshold} records</div>
                <div className="mt-1 text-lg font-black">{step.title}</div>
                <div className="mt-2 text-sm font-bold capitalize text-red-100">{step.action}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded border border-zinc-800 bg-zinc-950 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black">Learner refund watchlist</h2>
              <p className="mt-1 text-sm font-semibold text-zinc-400">Full postal address is not currently stored; pickup postcode is shown from booking data.</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4">
            {learnerRows.map((row) => (
              <article key={row.learnerId} className={`rounded border p-5 ${row.highRisk ? "border-red-500/40 bg-red-500/10" : "border-zinc-800 bg-black"}`}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xl font-black">{row.profile?.full_name || row.profile?.email || "Unnamed learner"}</h3>
                      {row.highRisk ? <span className="rounded-full border border-red-500/40 px-3 py-1 text-xs font-black uppercase text-red-100">Manual review</span> : null}
                    </div>
                    <div className="mt-2 grid gap-1 text-sm font-semibold text-zinc-400 sm:grid-cols-3">
                      <div>Email: <span className="text-zinc-200">{row.profile?.email ?? "Not recorded"}</span></div>
                      <div>Phone: <span className="text-zinc-200">{row.profile?.phone ?? "Not recorded"}</span></div>
                      <div>Pickup postcode: <span className="text-zinc-200">{row.latestPickup ?? "Not recorded"}</span></div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-zinc-400">Pattern count</div>
                    <div className="text-3xl font-black">{row.bookings.length}</div>
                  </div>
                </div>
                <div className="mt-5 grid gap-3 md:grid-cols-4">
                  <Detail icon={RefreshCcw} label="Refund records" value={String(row.refundCount)} />
                  <Detail icon={AlertTriangle} label="Cancellations" value={String(row.cancelCount)} />
                  <Detail icon={MapPin} label="Latest pickup" value={row.latestPickup ?? "Not recorded"} />
                  <Detail icon={Mail} label="Value involved" value={formatMoney(row.value)} />
                </div>
                <div className="mt-4 grid gap-2">
                  {row.bookings.slice(0, 4).map((booking) => (
                    <div key={booking.id} className="rounded border border-zinc-800 bg-zinc-950 p-3 text-sm font-semibold text-zinc-400">
                      {formatDate(booking.created_at)} - {booking.status ?? "no status"} / {booking.payment_status ?? "no payment status"} - {booking.cancellation_reason || "No cancellation reason recorded"}
                    </div>
                  ))}
                </div>
              </article>
            ))}
            {learnerRows.length ? null : <Empty text="No refund or cancellation patterns found yet." />}
          </div>
        </section>

        <section className="mt-6 rounded border border-zinc-800 bg-zinc-950 p-5">
          <div>
            <h2 className="text-2xl font-black">Automatic warning and suspension log</h2>
            <p className="mt-1 text-sm font-semibold text-zinc-400">
              Records created by the cancellation/refund policy bot. Learners receive an email and notification when a step is applied.
            </p>
          </div>
          <div className="mt-5 grid gap-3">
            {enforcementRows.slice(0, 50).map((event) => {
              const profile = profileById.get(event.learner_id);

              return (
                <article key={event.id} className="rounded border border-zinc-800 bg-black p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-black">{profile?.full_name || profile?.email || event.learner_id}</h3>
                      <p className="mt-1 text-sm font-semibold text-zinc-400">
                        {formatDate(event.created_at)} - {event.event_count} records in {event.window_days} days
                      </p>
                    </div>
                    <span className="rounded-full border border-red-500/40 px-3 py-1 text-xs font-black uppercase text-red-100">
                      {event.enforcement_action}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-semibold leading-6 text-zinc-400">{event.reason}</p>
                </article>
              );
            })}
            {enforcementRows.length ? null : <Empty text="No automatic learner warnings or suspensions have been issued yet." />}
          </div>
        </section>

        <section className="mt-6 rounded border border-zinc-800 bg-zinc-950 p-5">
          <div>
            <h2 className="text-2xl font-black">Protected Stripe booking records</h2>
            <p className="mt-1 text-sm font-semibold text-zinc-400">
              On-demand and durable lesson records with cancellation, refund, or refund-pending status.
            </p>
          </div>
          <div className="mt-5 grid gap-3">
            {protectedLessonRecords.slice(0, 80).map((record) => (
              <article key={record.booking_reference} className="rounded border border-zinc-800 bg-black p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black">{record.booking_reference}</h3>
                    <p className="mt-1 text-sm font-semibold text-zinc-400">
                      {record.learner_email || record.learner_id || "Learner not recorded"} with {record.instructor_name || "instructor not recorded"}
                    </p>
                  </div>
                  <span className="rounded-full border border-red-500/40 px-3 py-1 text-xs font-black uppercase text-red-100">
                    {record.status ?? record.payment_status ?? "review"}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <Detail icon={RefreshCcw} label="Payment status" value={record.payment_status ?? "Not recorded"} />
                  <Detail icon={AlertTriangle} label="Cancelled by" value={record.cancellation_actor ?? "Not recorded"} />
                  <Detail icon={Mail} label="Lesson value" value={formatMoney(record.lesson_price_pence ?? 0)} />
                  <Detail icon={MapPin} label="Date" value={formatDate(record.cancelled_at ?? record.created_at)} />
                </div>
                <p className="mt-3 text-sm font-semibold leading-6 text-zinc-400">
                  {record.cancellation_reason || "No cancellation reason recorded."}
                </p>
              </article>
            ))}
            {protectedLessonRecords.length ? null : <Empty text="No protected Stripe refund or cancellation records found yet." />}
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

function Detail({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded border border-zinc-800 bg-black p-3">
      <div className="flex items-center gap-2 text-xs font-black uppercase text-zinc-500"><Icon size={14} /> {label}</div>
      <div className="mt-1 text-sm font-black text-zinc-100">{value}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded border border-zinc-800 bg-black p-6 text-sm font-semibold text-zinc-400">{text}</div>;
}
