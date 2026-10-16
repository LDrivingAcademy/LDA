import Link from "next/link";
import { UsersRound } from "lucide-react";
import { LearnerAdminActions, LearnerCampaignAction } from "@/components/admin-learner-actions";
import { AdminPageHeader } from "@/components/admin-page-header";
import { AdminTopBar } from "@/components/admin-top-bar";
import { isLiveStripeCheckoutSessionId, isProductionLessonMetricRow } from "@/lib/admin-live-data";
import { requireAdminDashboardClient } from "@/lib/admin-dashboard";
import { hasCompletedLearnerEligibility } from "@/lib/learner-eligibility";
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

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  marketing_opt_in: boolean | null;
  created_at: string;
};

type LearnerProfileRow = {
  user_id: string;
  date_of_birth: string | null;
  provisional_licence_confirmed_at: string | null;
  terms_accepted_at: string | null;
  learner_package: string | null;
  learner_subscription_status: string | null;
  learner_package_expires_at: string | null;
  learner_plus_active: boolean | null;
};

type BookingRow = {
  id: string;
  learner_id: string;
  pickup_postcode: string | null;
  lesson_price_pence: number | null;
  status: string | null;
  payment_status: string | null;
  cancellation_reason: string | null;
  starts_at: string | null;
  created_at: string;
  updated_at: string;
};

type PaymentSessionRow = {
  booking_id: string;
  stripe_checkout_session_id: string | null;
};

type LessonBookingRecordRow = {
  booking_reference: string;
  learner_id: string | null;
  learner_email: string | null;
  lesson_price_pence: number | null;
  status: string | null;
  payment_status: string | null;
  stripe_checkout_session_id: string | null;
  cancellation_actor: string | null;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  starts_at: string | null;
  created_at: string;
};

type MarketingSubscriberRow = {
  email: string | null;
};

type LearnerWatchEvent = {
  learnerId: string;
  status: string;
  paymentStatus: string;
  value: number;
  startsAt: string | null;
  eventAt: string;
  source: "booking" | "lesson_record";
};

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("en-GB") : "Not recorded";
}

function formatDateTime(value?: string | null) {
  return value
    ? new Date(value).toLocaleString("en-GB", {
        dateStyle: "medium",
        timeStyle: "short"
      })
    : "No lesson yet";
}

function statusTone(isReady: boolean) {
  return isReady ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100" : "border-red-500/50 bg-red-600 text-white lda-red-pill";
}

function isRefundLike(booking: BookingRow) {
  const bookingStatus = String(booking.status ?? "").toLowerCase();
  const paymentStatus = String(booking.payment_status ?? "").toLowerCase();
  return bookingStatus.includes("refund") || bookingStatus.includes("cancel") || paymentStatus.includes("refund");
}

function isLearnerTriggeredLessonReview(record: LessonBookingRecordRow) {
  const actor = String(record.cancellation_actor ?? "").toLowerCase();
  const bookingStatus = String(record.status ?? "").toLowerCase();
  const paymentStatus = String(record.payment_status ?? "").toLowerCase();

  if (actor === "instructor" || actor === "admin") return false;

  return actor === "learner" || bookingStatus.includes("cancel") || bookingStatus.includes("refund") || paymentStatus.includes("refund");
}

function isRefundWatchEvent(event: LearnerWatchEvent) {
  return event.status.includes("refund") || event.paymentStatus.includes("refund");
}

function isCancellationWatchEvent(event: LearnerWatchEvent) {
  return event.status.includes("cancel");
}

function isLastMinuteWatchEvent(event: LearnerWatchEvent) {
  if (!event.startsAt) return false;

  const lessonTime = new Date(event.startsAt).getTime();
  const decisionTime = new Date(event.eventAt).getTime();
  const hoursBeforeLesson = (lessonTime - decisionTime) / (1000 * 60 * 60);

  return hoursBeforeLesson >= 0 && hoursBeforeLesson <= 24;
}

function isInRollingWindow(event: LearnerWatchEvent, windowDays: number) {
  const eventTime = new Date(event.eventAt).getTime();
  if (!Number.isFinite(eventTime)) return false;

  return Date.now() - eventTime <= windowDays * 24 * 60 * 60 * 1000;
}

function isTrackedSpendBooking(booking: BookingRow) {
  const bookingStatus = String(booking.status ?? "").toLowerCase();
  const paymentStatus = String(booking.payment_status ?? "").toLowerCase();

  if (paymentStatus !== "paid") return false;
  return !["cancelled", "declined", "refunded", "refund_requested", "disputed"].includes(bookingStatus);
}

export default async function AdminLearnersPage({
  searchParams
}: {
  searchParams?: Promise<{ message?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const message = typeof params?.message === "string" ? params.message : "";
  const { supabase } = await requireAdminDashboardClient();

  const [{ data: roles }, { data: learnerProfiles }, { data: bookings }, { data: payments }, { data: lessonRecords }, { data: marketingSubscribers }] = await Promise.all([
    supabase.from("account_roles").select("user_id,created_at").eq("role", "learner").order("created_at", { ascending: false }).limit(500),
    supabase
      .from("learner_profiles")
      .select("user_id,date_of_birth,provisional_licence_confirmed_at,terms_accepted_at,learner_package,learner_subscription_status,learner_package_expires_at,learner_plus_active")
      .limit(500),
    supabase
      .from("bookings")
      .select("id,learner_id,pickup_postcode,lesson_price_pence,status,payment_status,cancellation_reason,starts_at,created_at,updated_at")
      .order("created_at", { ascending: false })
      .limit(5000),
    supabase
      .from("payments")
      .select("booking_id,stripe_checkout_session_id")
      .limit(5000),
    supabase
      .from("lesson_booking_records")
      .select("booking_reference,learner_id,learner_email,lesson_price_pence,status,payment_status,stripe_checkout_session_id,cancellation_actor,cancellation_reason,cancelled_at,starts_at,created_at")
      .order("created_at", { ascending: false })
      .limit(5000),
    supabase.from("marketing_subscribers").select("email").is("unsubscribed_at", null).limit(5000)
  ]);

  const learnerIds = Array.from(new Set((roles ?? []).map((role) => role.user_id).filter(Boolean)));
  const { data: profiles } = learnerIds.length
    ? await supabase.from("profiles").select("id,full_name,email,phone,marketing_opt_in,created_at").in("id", learnerIds)
    : { data: [] };

  const subscriberEmails = new Set(
    ((marketingSubscribers as MarketingSubscriberRow[] | null) ?? [])
      .map((subscriber) => String(subscriber.email ?? "").trim().toLowerCase())
      .filter(Boolean)
  );
  const profileById = new Map((profiles as ProfileRow[] | null ?? []).map((profile) => [profile.id, profile]));
  const learnerProfileById = new Map((learnerProfiles as LearnerProfileRow[] | null ?? []).map((profile) => [profile.user_id, profile]));
  const paymentByBooking = new Map(((payments as PaymentSessionRow[] | null) ?? []).map((payment) => [payment.booking_id, payment]));
  const bookingsByLearner = new Map<string, BookingRow[]>();
  const watchEventsByLearner = new Map<string, LearnerWatchEvent[]>();

  for (const booking of (bookings as BookingRow[] | null ?? [])) {
    if (!booking.learner_id) continue;
    if (!isLiveStripeCheckoutSessionId(paymentByBooking.get(booking.id)?.stripe_checkout_session_id)) continue;
    bookingsByLearner.set(booking.learner_id, [...(bookingsByLearner.get(booking.learner_id) ?? []), booking]);

    if (isRefundLike(booking)) {
      const event: LearnerWatchEvent = {
        learnerId: booking.learner_id,
        status: String(booking.status ?? "").toLowerCase(),
        paymentStatus: String(booking.payment_status ?? "").toLowerCase(),
        value: booking.lesson_price_pence ?? 0,
        startsAt: booking.starts_at,
        eventAt: booking.updated_at || booking.created_at,
        source: "booking"
      };
      watchEventsByLearner.set(booking.learner_id, [...(watchEventsByLearner.get(booking.learner_id) ?? []), event]);
    }
  }

  for (const record of (lessonRecords as LessonBookingRecordRow[] | null ?? [])) {
    if (!record.learner_id || !isLearnerTriggeredLessonReview(record)) continue;
    if (!isProductionLessonMetricRow(record)) continue;

    const event: LearnerWatchEvent = {
      learnerId: record.learner_id,
      status: String(record.status ?? "").toLowerCase(),
      paymentStatus: String(record.payment_status ?? "").toLowerCase(),
      value: record.lesson_price_pence ?? 0,
      startsAt: record.starts_at,
      eventAt: record.cancelled_at || record.created_at,
      source: "lesson_record"
    };
    watchEventsByLearner.set(record.learner_id, [...(watchEventsByLearner.get(record.learner_id) ?? []), event]);
  }

  const learnerRows = learnerIds.map((id) => {
    const profile = profileById.get(id);
    const learnerProfile = learnerProfileById.get(id);
    const learnerBookings = bookingsByLearner.get(id) ?? [];
    const trackedSpend = learnerBookings.filter(isTrackedSpendBooking).reduce((sum, booking) => sum + (booking.lesson_price_pence ?? 0), 0);
    const latestLesson = [...learnerBookings].sort((left, right) => {
      const rightTime = new Date(right.starts_at ?? right.created_at).getTime();
      const leftTime = new Date(left.starts_at ?? left.created_at).getTime();
      return rightTime - leftTime;
    })[0];
    const ready = hasCompletedLearnerEligibility(learnerProfile);

    return {
      id,
      profile,
      learnerProfile,
      learnerBookings,
      latestLesson,
      ready,
      trackedSpend
    };
  });

  const hasCampaignConsent = (profile?: ProfileRow) => Boolean(profile?.marketing_opt_in || (profile?.email && subscriberEmails.has(profile.email.trim().toLowerCase())));
  const standardLearnerCount = learnerRows.filter((row) => {
    const packageId = row.learnerProfile?.learner_package ?? "learner";
    return packageId !== "learner-plus" && packageId !== "learner-pro";
  }).length;
  const plusCount = learnerRows.filter((row) => row.learnerProfile?.learner_package === "learner-plus").length;
  const proCount = learnerRows.filter((row) => row.learnerProfile?.learner_package === "learner-pro").length;
  const consentedLearnerIds = learnerRows.filter((row) => hasCampaignConsent(row.profile)).map((row) => row.id);
  const underReviewRows = learnerRows.map((row) => {
    const reviewEvents = (watchEventsByLearner.get(row.id) ?? []).sort((left, right) => new Date(right.eventAt).getTime() - new Date(left.eventAt).getTime());
    const recentReviewEvents = reviewEvents.filter((event) => isInRollingWindow(event, 90));
    const refundCount = recentReviewEvents.filter(isRefundWatchEvent).length;
    const cancellationCount = recentReviewEvents.filter(isCancellationWatchEvent).length;
    const lastMinuteCount = recentReviewEvents.filter(isLastMinuteWatchEvent).length;
    const value = recentReviewEvents.reduce((sum, event) => sum + event.value, 0);
    const totalBookingFootprint = Math.max(row.learnerBookings.length, reviewEvents.length);
    const reviewRatio = totalBookingFootprint ? recentReviewEvents.length / totalBookingFootprint : 0;
    const sourceCount = new Set(recentReviewEvents.map((event) => event.source)).size;
    const signals = [
      refundCount >= 2 ? `${refundCount} refund-linked records` : "",
      cancellationCount >= 3 ? `${cancellationCount} cancellation-linked records` : "",
      lastMinuteCount >= 2 ? `${lastMinuteCount} last-minute cancellation/refund events` : "",
      recentReviewEvents.length >= 4 ? `${recentReviewEvents.length} review events in 90 days` : "",
      reviewRatio >= 0.5 && totalBookingFootprint >= 4 ? "High cancellation/refund ratio" : "",
      value >= 15000 ? `${formatMoney(value)} cancellation/refund value` : "",
      sourceCount > 1 ? "Pattern appears across booking systems" : ""
    ].filter(Boolean);

    return {
      ...row,
      refundLikeBookings: recentReviewEvents,
      refundCount,
      cancellationCount,
      lastMinuteCount,
      reviewValue: value,
      signals
    };
  }).filter((row) => row.signals.length > 0).sort((left, right) => {
    if (right.signals.length !== left.signals.length) return right.signals.length - left.signals.length;
    return right.refundLikeBookings.length - left.refundLikeBookings.length;
  });

  return (
    <main className="min-h-screen bg-black text-white">
      <AdminTopBar autoSignOutOnLeave />
      <AdminPageHeader
        eyebrow="Learner operations"
        title="Learner account control"
        description="Admin-only learner register with account tiers, booking activity, eligibility records, spend tracking, and account support controls."
        right={(
          <div className="rounded border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-black text-zinc-200">
            {learnerRows.length} learner account{learnerRows.length === 1 ? "" : "s"}
          </div>
        )}
      />

      <section className="mx-auto max-w-7xl px-4 py-8">
        {message ? (
          <div className="mb-5 rounded border border-red-500/40 bg-red-600 px-4 py-3 text-sm font-black text-white">
            {message}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-4">
          <Metric label="Learners" value={learnerRows.length} detail="Registered learner role accounts" />
          <Metric label="Learner" value={standardLearnerCount} detail="Standard learner accounts" />
          <Metric label="Learner Plus" value={plusCount} detail="Active Plus learner tier" />
          <Metric label="Learner Pro" value={proCount} detail="Active Pro learner tier" />
        </div>

        <section className="mt-6 rounded border border-red-500/40 bg-red-950/25 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-sm font-black uppercase text-red-200">Platform behaviour bot</div>
              <h2 className="mt-1 text-2xl font-black">{underReviewRows.length} learner account{underReviewRows.length === 1 ? "" : "s"} flagged</h2>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-zinc-300">
                LDA monitors every learner account for repeated cancellations, last-minute cancellations, refund-linked activity, higher refund exposure, and patterns that sit outside normal booking behaviour. This queue is for admin review, so you can decide whether to leave it, contact the learner, issue a warning, suspend access, or investigate further.
              </p>
            </div>
            <Link href="/admin/refunds" className="rounded-full border border-red-500/50 bg-red-600 px-4 py-2 text-sm font-black text-white hover:bg-red-500 lda-red-pill">
              Open refund monitor
            </Link>
          </div>

          <div className="mt-5 grid gap-3">
            {underReviewRows.slice(0, 6).map((row) => {
              const profile = row.profile;
              const displayName = profile?.full_name || profile?.email || "Unnamed learner";

              return (
                <article key={row.id} className="rounded border border-red-500/30 bg-black p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-black">{displayName}</h3>
                      <div className="mt-1 text-sm font-semibold text-zinc-400">
                        {profile?.email ?? "No email recorded"} - latest lesson {formatDateTime(row.latestLesson?.starts_at ?? row.latestLesson?.created_at)}
                      </div>
                    </div>
                    <div className="rounded-full border border-red-500/40 bg-red-600 px-3 py-1 text-xs font-black uppercase text-white lda-red-pill">
                      Manual review
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {row.signals.map((signal) => (
                      <span key={signal} className="rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1 text-xs font-black text-zinc-200">
                        {signal}
                      </span>
                    ))}
                  </div>
                </article>
              );
            })}
            {underReviewRows.length ? null : (
              <div className="rounded border border-zinc-800 bg-black p-4 text-sm font-semibold text-zinc-400">
                No learner cancellation, refund, or last-minute booking patterns are currently above the review threshold.
              </div>
            )}
          </div>
        </section>

        <section className="mt-6 rounded border border-zinc-800 bg-zinc-950 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black">Learner profiles</h2>
              <p className="mt-1 text-sm font-semibold text-zinc-400">Learner records combine account details, eligibility checks, bookings, tracked spend, and latest lesson activity.</p>
            </div>
            <LearnerCampaignAction learnerIds={consentedLearnerIds} />
          </div>

          <div className="mt-5 grid gap-4">
            {learnerRows.map((row) => {
              const profile = row.profile;
              const learnerProfile = row.learnerProfile;
              const displayName = profile?.full_name || profile?.email || "Unnamed learner";

              return (
                <article key={row.id} className="rounded border border-zinc-800 bg-black p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <UsersRound className="text-brand" size={20} />
                        <h3 className="text-xl font-black">{displayName}</h3>
                        <span className={`rounded-full border px-3 py-1 text-xs font-black uppercase ${statusTone(row.ready)}`}>
                          {row.ready ? "Eligibility clear" : "Eligibility incomplete"}
                        </span>
                      </div>
                      <div className="mt-2 grid gap-1 text-sm font-semibold text-zinc-400 sm:grid-cols-2 lg:grid-cols-4">
                        <div>Email: <span className="text-zinc-200">{profile?.email ?? "Not recorded"}</span></div>
                        <div>Phone: <span className="text-zinc-200">{profile?.phone ?? "Not recorded"}</span></div>
                        <div>Joined: <span className="text-zinc-200">{formatDate(profile?.created_at)}</span></div>
                        <div>Latest lesson: <span className="text-zinc-200">{formatDateTime(row.latestLesson?.starts_at ?? row.latestLesson?.created_at)}</span></div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-zinc-400">Package</div>
                      <div className="text-2xl font-black">{learnerProfile?.learner_package ?? "learner"}</div>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-4">
                    <Detail label="Date of birth" value={formatDate(learnerProfile?.date_of_birth)} />
                    <Detail
                      label="Provisional licence"
                      value={learnerProfile?.provisional_licence_confirmed_at ? `Verified ${formatDate(learnerProfile.provisional_licence_confirmed_at)}` : "Not verified"}
                    />
                    <Detail label="Bookings" value={String(row.learnerBookings.length)} />
                    <Detail label="Tracked spend" value={formatMoney(row.trackedSpend)} />
                  </div>

                  <LearnerAdminActions
                    learnerId={row.id}
                    learnerName={displayName}
                    marketingOptIn={hasCampaignConsent(profile)}
                    currentPackage={learnerProfile?.learner_package ?? "learner"}
                  />
                </article>
              );
            })}
            {learnerRows.length ? null : (
              <div className="rounded border border-zinc-800 bg-black p-6 text-sm font-semibold text-zinc-400">No learner accounts found yet.</div>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

function Metric({ label, value, detail }: { label: string; value: number | string; detail: string }) {
  return (
    <article className="rounded border border-zinc-800 bg-zinc-950 p-5">
      <div className="text-sm font-bold text-zinc-400">{label}</div>
      <div className="mt-2 text-3xl font-black">{value}</div>
      <p className="mt-1 text-sm font-semibold leading-6 text-zinc-400">{detail}</p>
    </article>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-950 p-3">
      <div className="text-xs font-black uppercase text-zinc-500">{label}</div>
      <div className="mt-1 text-sm font-black text-zinc-100">{value}</div>
    </div>
  );
}
