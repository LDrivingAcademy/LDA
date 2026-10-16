import { AlertTriangle, CalendarDays, MapPin, PoundSterling, UserRoundCheck, type LucideIcon } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";
import { AdminTopBar } from "@/components/admin-top-bar";
import { isLiveStripeCheckoutSessionId, isProductionLessonMetricRow } from "@/lib/admin-live-data";
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
  starts_at: string;
  ends_at: string;
  pickup_postcode: string | null;
  lesson_price_pence: number;
  platform_fee_pence: number | null;
  status: string | null;
  payment_status: string | null;
  cancellation_reason: string | null;
  created_at: string;
};

type PaymentSessionRow = {
  booking_id: string;
  stripe_checkout_session_id: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
};

type InstructorRow = {
  user_id: string;
  display_name: string | null;
  base_postcode: string | null;
};

type LessonBookingRecordRow = {
  booking_reference: string;
  learner_id: string | null;
  learner_email: string | null;
  learner_phone: string | null;
  instructor_id: string | null;
  instructor_name: string | null;
  instructor_email: string | null;
  lesson_summary: string | null;
  starts_at: string | null;
  pickup_postcode: string | null;
  lesson_price_pence: number | null;
  status: string | null;
  payment_status: string | null;
  stripe_checkout_session_id: string | null;
  compliance_review_required: boolean | null;
  compliance_review_reason: string | null;
  compliance_review_flagged_at: string | null;
  created_at: string;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
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

function statusTone(value?: string | null) {
  const normalised = String(value ?? "").toLowerCase();
  if (normalised.includes("paid") || normalised.includes("confirmed") || normalised.includes("complete")) return "border-emerald-500/40 bg-emerald-500/10 text-emerald-100";
  if (normalised.includes("cancel") || normalised.includes("failed") || normalised.includes("dispute")) return "border-red-500/40 bg-red-500/10 text-red-100";
  return "border-amber-500/40 bg-amber-500/10 text-amber-100";
}

export default async function AdminBookingsPage({ searchParams }: { searchParams?: Promise<{ q?: string }> }) {
  const params = await searchParams;
  const referenceSearch = String(params?.q ?? "").trim();
  const normalisedSearch = referenceSearch.toLowerCase();
  const { supabase } = await requireAdminDashboardClient();

  const [{ data: bookings }, { data: payments }, referenceResult] = await Promise.all([
    supabase
      .from("bookings")
      .select("id,learner_id,instructor_id,starts_at,ends_at,pickup_postcode,lesson_price_pence,platform_fee_pence,status,payment_status,cancellation_reason,created_at")
      .order("starts_at", { ascending: false })
      .limit(1000),
    supabase
      .from("payments")
      .select("booking_id,stripe_checkout_session_id")
      .limit(5000),
    supabase
      .from("lesson_booking_records")
      .select("booking_reference,learner_id,learner_email,learner_phone,instructor_id,instructor_name,instructor_email,lesson_summary,starts_at,pickup_postcode,lesson_price_pence,status,payment_status,stripe_checkout_session_id,compliance_review_required,compliance_review_reason,compliance_review_flagged_at,created_at")
      .order("starts_at", { ascending: false, nullsFirst: false })
      .limit(1000)
  ]);

  const paymentRows = (payments as PaymentSessionRow[] | null) ?? [];
  const paymentByBooking = new Map(paymentRows.map((payment) => [payment.booking_id, payment]));
  const bookingRows = ((bookings as BookingRow[] | null) ?? []).filter((booking) => isLiveStripeCheckoutSessionId(paymentByBooking.get(booking.id)?.stripe_checkout_session_id));
  const referenceRowsRaw = ((referenceResult.data as LessonBookingRecordRow[] | null) ?? []).filter(isProductionLessonMetricRow);
  if (referenceResult.error) {
    console.warn("[admin-bookings] lesson booking reference lookup failed", {
      message: referenceResult.error.message
    });
  }
  const referenceRows = normalisedSearch
    ? referenceRowsRaw.filter((record) =>
        [
          record.booking_reference,
          record.learner_email,
          record.learner_phone,
          record.instructor_name,
          record.instructor_email,
          record.lesson_summary
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalisedSearch))
      )
    : referenceRowsRaw;
  const filteredBookingRows = normalisedSearch
    ? bookingRows.filter((booking) => booking.id.toLowerCase().includes(normalisedSearch))
    : bookingRows;
  const profileIds = Array.from(new Set(bookingRows.flatMap((booking) => [booking.learner_id, booking.instructor_id]).filter(Boolean)));
  const instructorIds = Array.from(new Set(bookingRows.map((booking) => booking.instructor_id).filter(Boolean)));

  const [{ data: profiles }, { data: instructors }] = await Promise.all([
    profileIds.length ? supabase.from("profiles").select("id,full_name,email,phone").in("id", profileIds) : Promise.resolve({ data: [] }),
    instructorIds.length ? supabase.from("instructor_profiles").select("user_id,display_name,base_postcode").in("user_id", instructorIds) : Promise.resolve({ data: [] })
  ]);

  const profileById = new Map((profiles as ProfileRow[] | null ?? []).map((profile) => [profile.id, profile]));
  const instructorById = new Map((instructors as InstructorRow[] | null ?? []).map((instructor) => [instructor.user_id, instructor]));
  const liveMetricBySession = new Map<string, { created_at: string; starts_at: string | null; lesson_price_pence: number; platform_fee_pence: number; status: string | null }>();
  for (const booking of filteredBookingRows) {
    const sessionId = paymentByBooking.get(booking.id)?.stripe_checkout_session_id;
    if (!sessionId) continue;
    liveMetricBySession.set(sessionId, {
      created_at: booking.created_at,
      starts_at: booking.starts_at,
      lesson_price_pence: booking.lesson_price_pence ?? 0,
      platform_fee_pence: booking.platform_fee_pence ?? 0,
      status: booking.status
    });
  }
  for (const booking of referenceRows) {
    const sessionId = booking.stripe_checkout_session_id;
    if (!sessionId || liveMetricBySession.has(sessionId)) continue;
    liveMetricBySession.set(sessionId, {
      created_at: booking.created_at,
      starts_at: booking.starts_at,
      lesson_price_pence: booking.lesson_price_pence ?? 0,
      platform_fee_pence: 0,
      status: booking.status
    });
  }
  const liveMetricRows = Array.from(liveMetricBySession.values());
  const today = startOfToday();
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const scheduledToday = liveMetricRows.filter((booking) => {
    if (!booking.starts_at) return false;
    const startsAt = new Date(booking.starts_at);
    return startsAt >= today && startsAt < tomorrow;
  });
  const now = new Date();
  const todayKey = londonDateKey(now);
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const bookedToday = liveMetricRows.filter((booking) => londonDateKey(booking.created_at) === todayKey).length;
  const bookedThisWeek = liveMetricRows.filter((booking) => new Date(booking.created_at) >= weekStart).length;
  const bookedThisMonth = liveMetricRows.filter((booking) => new Date(booking.created_at) >= monthStart).length;
  const bookedThisYear = liveMetricRows.filter((booking) => new Date(booking.created_at) >= yearStart).length;
  const oldestMetricRow = [...liveMetricRows].sort((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime())[0];
  const firstBookingDate = oldestMetricRow ? new Date(oldestMetricRow.created_at) : null;
  const daysTracked = firstBookingDate ? Math.max(1, Math.ceil((Date.now() - firstBookingDate.getTime()) / (24 * 60 * 60 * 1000))) : 1;
  const totalRowsTracked = liveMetricRows.length;
  const averagePerDay = (totalRowsTracked / daysTracked).toFixed(1);
  const grossValue = liveMetricRows.reduce((sum, booking) => sum + booking.lesson_price_pence, 0);
  const platformValue = liveMetricRows.reduce((sum, booking) => sum + booking.platform_fee_pence, 0);
  const cancelled = liveMetricRows.filter((booking) => String(booking.status ?? "").toLowerCase().includes("cancel")).length;
  const complianceReviewRows = referenceRows.filter((booking) => booking.compliance_review_required);

  return (
    <main className="min-h-screen bg-black text-white">
      <AdminTopBar autoSignOutOnLeave />
      <AdminPageHeader
        eyebrow="Booking operations"
        title="Platform booking control"
        description="Admin-only live booking ledger with learner, instructor, pickup, lesson value, payment status, cancellation status, and daily booking pace. Test-mode Stripe records are excluded."
        right={(
          <div className="rounded border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-black text-zinc-200">
            {totalRowsTracked} booking{totalRowsTracked === 1 ? "" : "s"} tracked
          </div>
        )}
      />

      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid gap-4 md:grid-cols-4">
          <Metric icon={CalendarDays} label="Booked today" value={bookedToday} detail="New booking records created today" />
          <Metric icon={CalendarDays} label="Booked this week" value={bookedThisWeek} detail="New booking records from the last 7 days" />
          <Metric icon={CalendarDays} label="Booked this month" value={bookedThisMonth} detail="New booking records this month" />
          <Metric icon={CalendarDays} label="Booked this year" value={bookedThisYear} detail="New booking records this year" />
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-4">
          <Metric icon={CalendarDays} label="Total bookings" value={totalRowsTracked} detail="All booking records in view" />
          <Metric icon={CalendarDays} label="Scheduled today" value={scheduledToday.length} detail="Lessons due to take place today" />
          <Metric icon={UserRoundCheck} label="Bookings per day" value={averagePerDay} detail={`Average across ${daysTracked} day${daysTracked === 1 ? "" : "s"}`} />
          <Metric icon={AlertTriangle} label="Compliance review" value={complianceReviewRows.length} detail={`${formatMoney(grossValue)} gross, ${formatMoney(platformValue)} platform fee tracked`} />
        </div>

        <section className="mt-6 rounded border border-zinc-800 bg-zinc-950 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black">Booking ledger</h2>
              <p className="mt-1 text-sm font-semibold text-zinc-400">
                Lesson notes are not currently stored on booking records. Cancellation reason is shown where it exists.
              </p>
            </div>
            <span className="rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-black text-red-100">
              {cancelled} cancellation{cancelled === 1 ? "" : "s"}
            </span>
          </div>

          <form className="mt-5 flex flex-wrap gap-3" action="/admin/bookings">
            <input
              name="q"
              defaultValue={referenceSearch}
              placeholder="Search booking reference, learner email, instructor, Stripe session..."
              className="min-h-11 flex-1 rounded border border-zinc-700 bg-black px-4 text-sm font-bold text-white placeholder:text-zinc-500"
            />
            <button className="lda-pill lda-pill-sm" type="submit">Search</button>
          </form>

          <div className="mt-5 grid gap-4">
            {referenceRows.map((booking) => {
              const startsAt = booking.starts_at ? formatDateTime(booking.starts_at) : "Lesson time not recorded";

              return (
                <article key={booking.booking_reference} className="rounded border border-red-500/30 bg-black p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <CalendarDays className="text-brand" size={20} />
                        <h3 className="text-xl font-black">{startsAt}</h3>
                        <span className={`rounded-full border px-3 py-1 text-xs font-black uppercase ${statusTone(booking.status)}`}>
                          {booking.status ?? "upcoming"}
                        </span>
                        <span className={`rounded-full border px-3 py-1 text-xs font-black uppercase ${statusTone(booking.payment_status)}`}>
                          {booking.payment_status ?? "paid"}
                        </span>
                        {booking.compliance_review_required ? (
                          <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-black uppercase text-amber-100">
                            Compliance review
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-2 grid gap-1 text-sm font-semibold text-zinc-400 sm:grid-cols-2 lg:grid-cols-4">
                        <div>Learner: <span className="text-zinc-200">{booking.learner_email ?? "Not recorded"}</span></div>
                        <div>Instructor: <span className="text-zinc-200">{booking.instructor_name ?? "Instructor not recorded"}</span></div>
                        <div>Pickup: <span className="text-zinc-200">{booking.pickup_postcode ?? "Not recorded"}</span></div>
                        <div>Value: <span className="text-zinc-200">{formatMoney(booking.lesson_price_pence ?? 0)}</span></div>
                      </div>
                    </div>
                    <div className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-right">
                      <div className="text-xs font-black uppercase text-red-200">Booking reference</div>
                      <div className="mt-1 max-w-44 truncate text-sm font-black">{booking.booking_reference}</div>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-4">
                    <Detail icon={MapPin} label="Pickup postcode" value={booking.pickup_postcode ?? "Not recorded"} />
                    <Detail icon={UserRoundCheck} label="Learner email" value={booking.learner_email ?? "Not recorded"} />
                    <Detail icon={UserRoundCheck} label="Instructor email" value={booking.instructor_email ?? "Not recorded"} />
                    <Detail icon={PoundSterling} label="Stripe session" value={booking.stripe_checkout_session_id ?? "Not recorded"} />
                  </div>
                  {booking.lesson_summary ? (
                    <div className="mt-4 rounded border border-zinc-800 bg-zinc-950 p-3 text-sm font-semibold text-zinc-300">
                      {booking.lesson_summary}
                    </div>
                  ) : null}
                  {booking.compliance_review_required ? (
                    <div className="mt-4 rounded border border-amber-500/40 bg-amber-500/10 p-3 text-sm font-semibold text-amber-100">
                      {booking.compliance_review_reason ?? "This booking needs admin review before the lesson can go ahead."}
                    </div>
                  ) : null}
                </article>
              );
            })}
            {filteredBookingRows.map((booking) => {
              const learner = profileById.get(booking.learner_id);
              const instructorProfile = profileById.get(booking.instructor_id);
              const instructor = instructorById.get(booking.instructor_id);
              const learnerName = learner?.full_name || learner?.email || "Learner not recorded";
              const instructorName = instructor?.display_name || instructorProfile?.full_name || instructorProfile?.email || "Instructor not recorded";

              return (
                <article key={booking.id} className="rounded border border-zinc-800 bg-black p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <CalendarDays className="text-brand" size={20} />
                        <h3 className="text-xl font-black">{formatDateTime(booking.starts_at)}</h3>
                        <span className={`rounded-full border px-3 py-1 text-xs font-black uppercase ${statusTone(booking.status)}`}>
                          {booking.status ?? "pending"}
                        </span>
                        <span className={`rounded-full border px-3 py-1 text-xs font-black uppercase ${statusTone(booking.payment_status)}`}>
                          {booking.payment_status ?? "unpaid"}
                        </span>
                      </div>
                      <div className="mt-2 grid gap-1 text-sm font-semibold text-zinc-400 sm:grid-cols-2 lg:grid-cols-4">
                        <div>Learner: <span className="text-zinc-200">{learnerName}</span></div>
                        <div>Instructor: <span className="text-zinc-200">{instructorName}</span></div>
                        <div>Pickup: <span className="text-zinc-200">{booking.pickup_postcode ?? "Not recorded"}</span></div>
                        <div>Value: <span className="text-zinc-200">{formatMoney(booking.lesson_price_pence)}</span></div>
                      </div>
                    </div>
                    <div className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-right">
                      <div className="text-xs font-black uppercase text-zinc-500">Booking id</div>
                      <div className="mt-1 max-w-36 truncate text-sm font-black">{booking.id}</div>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-4">
                    <Detail icon={MapPin} label="Pickup postcode" value={booking.pickup_postcode ?? "Not recorded"} />
                    <Detail icon={UserRoundCheck} label="Learner email" value={learner?.email ?? "Not recorded"} />
                    <Detail icon={UserRoundCheck} label="Instructor email" value={instructorProfile?.email ?? "Not recorded"} />
                    <Detail icon={PoundSterling} label="Platform fee" value={formatMoney(booking.platform_fee_pence ?? 0)} />
                  </div>

                  {booking.cancellation_reason ? (
                    <div className="mt-4 rounded border border-red-500/30 bg-red-500/10 p-3 text-sm font-semibold text-red-100">
                      Cancellation reason: {booking.cancellation_reason}
                    </div>
                  ) : null}
                </article>
              );
            })}
            {totalRowsTracked ? null : (
              <div className="rounded border border-zinc-800 bg-black p-6 text-sm font-semibold text-zinc-400">No bookings found yet.</div>
            )}
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
    <div className="rounded border border-zinc-800 bg-zinc-950 p-3">
      <div className="flex items-center gap-2 text-xs font-black uppercase text-zinc-500">
        <Icon size={14} />
        {label}
      </div>
      <div className="mt-1 text-sm font-black text-zinc-100">{value}</div>
    </div>
  );
}
