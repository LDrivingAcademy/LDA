import { AlertTriangle, BadgePoundSterling, BrainCircuit, FileText, UserRoundCheck, type LucideIcon } from "lucide-react";
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
  status: string;
  stripe_payment_intent_id: string | null;
  stripe_checkout_session_id: string | null;
  created_at: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB");
}

function disputeSummary(booking: BookingRow, payment?: PaymentRow) {
  if (payment?.status === "disputed") {
    return "Prioritise Stripe evidence: booking record, learner details, instructor details, pickup postcode, lesson status, cancellation policy, and any messages. Decide whether to accept liability or submit evidence before the Stripe deadline.";
  }

  if (booking.status === "disputed") {
    return "Treat as an operational dispute first. Confirm whether the lesson happened, collect both sides of the story, check cancellation timing, then decide whether a refund, credit, warning, or account restriction is appropriate.";
  }

  return "No active dispute status is present. Keep this under observation only if there are repeated cancellations, refunds, or support reports linked to the same person.";
}

export default async function AdminDisputesPage() {
  const { supabase } = await requireAdminDashboardClient();

  const [{ data: bookings }, { data: payments }] = await Promise.all([
    supabase.from("bookings").select("id,learner_id,instructor_id,pickup_postcode,lesson_price_pence,status,payment_status,cancellation_reason,created_at").order("created_at", { ascending: false }).limit(5000),
    supabase.from("payments").select("booking_id,gross_amount_pence,status,stripe_payment_intent_id,stripe_checkout_session_id,created_at").order("created_at", { ascending: false }).limit(5000)
  ]);

  const rawBookingRows = (bookings as BookingRow[] | null) ?? [];
  const paymentRows = ((payments as PaymentRow[] | null) ?? []).filter(isLiveAdminPaymentRow);
  const paymentByBooking = new Map(paymentRows.map((payment) => [payment.booking_id, payment]));
  const bookingRows = rawBookingRows.filter((booking) => paymentByBooking.has(booking.id));
  const disputeRows = bookingRows.filter((booking) => {
    const payment = paymentByBooking.get(booking.id);
    return String(booking.status ?? "").toLowerCase().includes("dispute") ||
      String(booking.payment_status ?? "").toLowerCase().includes("dispute") ||
      payment?.status === "disputed";
  });
  const profileIds = Array.from(new Set(disputeRows.flatMap((booking) => [booking.learner_id, booking.instructor_id]).filter(Boolean)));
  const { data: profiles } = profileIds.length
    ? await supabase.from("profiles").select("id,full_name,email").in("id", profileIds)
    : { data: [] };
  const profileById = new Map((profiles as ProfileRow[] | null ?? []).map((profile) => [profile.id, profile]));
  const disputedValue = disputeRows.reduce((sum, booking) => sum + (paymentByBooking.get(booking.id)?.gross_amount_pence ?? booking.lesson_price_pence ?? 0), 0);
  const stripeDisputes = disputeRows.filter((booking) => paymentByBooking.get(booking.id)?.status === "disputed").length;

  return (
    <main className="min-h-screen bg-black text-white">
      <AdminTopBar autoSignOutOnLeave />
      <AdminPageHeader
        eyebrow="Disputes"
        title="Dispute command centre"
        description="Admin-only list of live disputed bookings and payments with amount, context, and an operational next-step summary. Stripe test-mode records are excluded."
      />

      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid gap-4 md:grid-cols-4">
          <Metric icon={AlertTriangle} label="Open dispute records" value={disputeRows.length} detail="Booking/payment statuses marked disputed" />
          <Metric icon={BadgePoundSterling} label="Disputed value" value={formatMoney(disputedValue)} detail="Gross value under dispute" />
          <Metric icon={FileText} label="Stripe disputes" value={stripeDisputes} detail="Payment status disputed" />
          <Metric icon={BrainCircuit} label="AI summaries" value="Ready" detail="Rule-based triage shown per dispute" />
        </div>

        <section className="mt-6 rounded border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-2xl font-black">Current disputes</h2>
          <div className="mt-5 grid gap-4">
            {disputeRows.map((booking) => {
              const payment = paymentByBooking.get(booking.id);
              const learner = profileById.get(booking.learner_id);
              const instructor = profileById.get(booking.instructor_id);
              return (
                <article key={booking.id} className="rounded border border-red-500/40 bg-red-500/10 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <AlertTriangle className="text-red-100" size={20} />
                        <h3 className="text-xl font-black">Dispute opened {formatDate(booking.created_at)}</h3>
                      </div>
                      <div className="mt-2 grid gap-1 text-sm font-semibold text-red-100/80 sm:grid-cols-3">
                        <div>Learner: <span className="text-white">{learner?.full_name || learner?.email || "Not linked"}</span></div>
                        <div>Instructor: <span className="text-white">{instructor?.full_name || instructor?.email || "Not linked"}</span></div>
                        <div>Amount: <span className="text-white">{formatMoney(payment?.gross_amount_pence ?? booking.lesson_price_pence ?? 0)}</span></div>
                      </div>
                    </div>
                    <div className="rounded border border-red-500/30 bg-black px-3 py-2 text-sm font-black text-red-100">
                      {payment?.status ?? booking.status ?? "disputed"}
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <Detail icon={UserRoundCheck} label="Learner email" value={learner?.email ?? "Not recorded"} />
                    <Detail icon={UserRoundCheck} label="Instructor email" value={instructor?.email ?? "Not recorded"} />
                    <Detail icon={BadgePoundSterling} label="Stripe intent" value={payment?.stripe_payment_intent_id ?? "Not recorded"} />
                  </div>
                  <div className="mt-4 rounded border border-zinc-800 bg-black p-4">
                    <div className="flex items-center gap-2 text-sm font-black uppercase text-red-200"><BrainCircuit size={16} /> Suggested next step</div>
                    <p className="mt-2 text-sm font-semibold leading-6 text-zinc-300">{disputeSummary(booking, payment)}</p>
                    {booking.cancellation_reason ? <p className="mt-2 text-sm font-semibold text-zinc-400">Cancellation note: {booking.cancellation_reason}</p> : null}
                  </div>
                </article>
              );
            })}
            {disputeRows.length ? null : <Empty text="No active dispute records found yet." />}
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
      <div className="mt-1 truncate text-sm font-black text-zinc-100">{value}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded border border-zinc-800 bg-black p-6 text-sm font-semibold text-zinc-400">{text}</div>;
}
