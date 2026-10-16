import { redirect } from "next/navigation";
import { PageTopBar } from "@/components/page-top-bar";
import {
  InstructorPerformanceWorkspace,
  type InstructorPerformanceMetrics,
  type InstructorPerformanceReview
} from "@/components/instructor-performance-workspace";
import { getInstructorApprovalState, redirectUnlessApprovedInstructor } from "@/lib/instructor-approval";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type ProfileRow = {
  full_name: string | null;
  email: string | null;
};

type InstructorProfileRow = {
  display_name: string | null;
};

type LessonBookingRecordPerformanceRow = {
  booking_reference: string | null;
  learner_id: string | null;
  learner_email: string | null;
  status: string | null;
  payment_status: string | null;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string | null;
  cancellation_actor: string | null;
  cancelled_at: string | null;
};

type BookingPerformanceRow = {
  id: string;
  learner_id: string | null;
  status: string | null;
  payment_status: string | null;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string | null;
  cancellation_reason: string | null;
};

type ReviewRow = {
  id: string;
  learner_id: string | null;
  rating: number | null;
  comment: string | null;
  created_at: string | null;
};

type ProgressRecordRow = {
  id: string;
  learner_id: string | null;
  sent_at: string | null;
  completed_skills: string[] | null;
};

type LearnerNameRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

const emptyMetrics: InstructorPerformanceMetrics = {
  passRate: 0,
  positiveFeedbackRate: 0,
  firstTimePassRate: 0,
  retentionRate: 0,
  lessonsDelivered: 0,
  cancellationRate: 0,
  learnerCancellationRate: 0,
  averageRating: 0,
  reviewCount: 0,
  positiveReviewCount: 0,
  negativeReviewCount: 0,
  lessonsBookedThisMonth: 0,
  learnerCount: 0,
  repeatLearnerCount: 0,
  averageLessonGapDays: 0,
  signedProgressRecords: 0,
  readinessRiskCount: 0,
  passOutcomeCount: 0
};

export const dynamic = "force-dynamic";

function formatReviewDate(value: string | null) {
  const date = value ? new Date(value) : null;

  if (!date || Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/London"
  }).format(date);
}

function isCompletedStatus(status: string | null, paymentStatus: string | null) {
  const normalisedStatus = (status ?? "").toLowerCase();
  const normalisedPayment = (paymentStatus ?? "").toLowerCase();

  return normalisedPayment === "paid" && (normalisedStatus === "completed" || normalisedStatus === "lesson_completed");
}

function isPaidBooking(paymentStatus: string | null) {
  return (paymentStatus ?? "").toLowerCase() === "paid";
}

function isInstructorCancellation(row: Pick<LessonBookingRecordPerformanceRow, "status" | "cancellation_actor"> | Pick<BookingPerformanceRow, "status" | "cancellation_reason">) {
  const status = (row.status ?? "").toLowerCase();

  if ("cancellation_actor" in row) {
    return row.cancellation_actor === "instructor" || status === "cancelled_by_instructor";
  }

  return status === "cancelled_by_instructor" || /instructor/i.test(row.cancellation_reason ?? "");
}

function isLearnerCancellation(row: Pick<LessonBookingRecordPerformanceRow, "status" | "cancellation_actor"> | Pick<BookingPerformanceRow, "status" | "cancellation_reason">) {
  const status = (row.status ?? "").toLowerCase();

  if ("cancellation_actor" in row) {
    return row.cancellation_actor === "learner" || status === "cancelled_by_learner";
  }

  return status === "cancelled_by_learner" || /learner/i.test(row.cancellation_reason ?? "");
}

function learnerKey(row: { learner_id: string | null; learner_email?: string | null }) {
  return row.learner_id || row.learner_email?.trim().toLowerCase() || "";
}

function roundedPercent(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 100);
}

function dateFromBooking(row: { starts_at: string | null; created_at: string | null }) {
  const value = row.starts_at ?? row.created_at;
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function isThisMonth(date: Date, now = new Date()) {
  return date.getUTCFullYear() === now.getUTCFullYear() && date.getUTCMonth() === now.getUTCMonth();
}

function averageGapDays(rows: Array<{ learner_id: string | null; learner_email?: string | null; starts_at: string | null; created_at: string | null }>) {
  const byLearner = new Map<string, Date[]>();

  for (const row of rows) {
    const key = learnerKey(row);
    const date = dateFromBooking(row);
    if (!key || !date) continue;
    const dates = byLearner.get(key) ?? [];
    dates.push(date);
    byLearner.set(key, dates);
  }

  const gaps: number[] = [];
  for (const dates of byLearner.values()) {
    dates.sort((left, right) => left.getTime() - right.getTime());
    for (let index = 1; index < dates.length; index += 1) {
      gaps.push(Math.round((dates[index].getTime() - dates[index - 1].getTime()) / 86_400_000));
    }
  }

  if (!gaps.length) return 0;
  return Math.round(gaps.reduce((total, gap) => total + gap, 0) / gaps.length);
}

function reviewTone(rating: number | null): InstructorPerformanceReview["tone"] {
  if ((rating ?? 0) >= 4) return "positive";
  if ((rating ?? 0) <= 2) return "negative";
  return "neutral";
}

async function fetchInstructorPerformanceData({
  instructorId,
  instructorEmail,
  instructorName,
  readClient
}: {
  instructorId: string;
  instructorEmail?: string | null;
  instructorName?: string | null;
  readClient: NonNullable<ReturnType<typeof createAdminClient>> | NonNullable<Awaited<ReturnType<typeof createClient>>>;
}): Promise<{ metrics: InstructorPerformanceMetrics; reviews: InstructorPerformanceReview[] }> {
  const bookingRecordColumns =
    "booking_reference,learner_id,learner_email,status,payment_status,starts_at,ends_at,created_at,cancellation_actor,cancelled_at";
  const lessonRecordByReference = new Map<string, LessonBookingRecordPerformanceRow>();
  const normalisedEmail = instructorEmail?.trim();
  const normalisedName = instructorName?.trim();

  const lessonLookups = await Promise.all([
    readClient
      .from("lesson_booking_records")
      .select(bookingRecordColumns)
      .eq("instructor_id", instructorId)
      .limit(1000)
      .returns<LessonBookingRecordPerformanceRow[]>(),
    normalisedEmail
      ? readClient
          .from("lesson_booking_records")
          .select(bookingRecordColumns)
          .ilike("instructor_email", normalisedEmail)
          .limit(1000)
          .returns<LessonBookingRecordPerformanceRow[]>()
      : Promise.resolve({ data: [] as LessonBookingRecordPerformanceRow[], error: null }),
    normalisedName
      ? readClient
          .from("lesson_booking_records")
          .select(bookingRecordColumns)
          .ilike("instructor_name", normalisedName)
          .limit(1000)
          .returns<LessonBookingRecordPerformanceRow[]>()
      : Promise.resolve({ data: [] as LessonBookingRecordPerformanceRow[], error: null })
  ]);

  for (const result of lessonLookups) {
    if (result.error) {
      console.warn("[instructor-performance] lesson booking lookup failed", result.error.message);
      continue;
    }

    for (const record of result.data ?? []) {
      lessonRecordByReference.set(record.booking_reference || `${record.learner_id}-${record.created_at}`, record);
    }
  }

  const [bookingResult, reviewResult, progressResult] = await Promise.all([
    readClient
      .from("bookings")
      .select("id,learner_id,status,payment_status,starts_at,ends_at,created_at,cancellation_reason")
      .eq("instructor_id", instructorId)
      .limit(1000)
      .returns<BookingPerformanceRow[]>(),
    readClient
      .from("reviews")
      .select("id,learner_id,rating,comment,created_at")
      .eq("instructor_id", instructorId)
      .order("created_at", { ascending: false })
      .limit(50)
      .returns<ReviewRow[]>(),
    readClient
      .from("lesson_progress_records")
      .select("id,learner_id,sent_at,completed_skills")
      .eq("instructor_id", instructorId)
      .limit(1000)
      .returns<ProgressRecordRow[]>()
  ]);

  if (bookingResult.error) console.warn("[instructor-performance] bookings lookup failed", bookingResult.error.message);
  if (reviewResult.error) console.warn("[instructor-performance] reviews lookup failed", reviewResult.error.message);
  if (progressResult.error) console.warn("[instructor-performance] progress lookup failed", progressResult.error.message);

  const lessonRecords = Array.from(lessonRecordByReference.values());
  const legacyBookings = bookingResult.data ?? [];
  const allBookingEvidence = [...lessonRecords, ...legacyBookings];
  const paidBookings = allBookingEvidence.filter((row) => isPaidBooking(row.payment_status));
  const completedBookings = allBookingEvidence.filter((row) => isCompletedStatus(row.status, row.payment_status));
  const instructorCancellations = allBookingEvidence.filter(isInstructorCancellation).length;
  const learnerCancellations = allBookingEvidence.filter(isLearnerCancellation).length;
  const learnerBookingCounts = new Map<string, number>();

  for (const row of paidBookings) {
    const key = learnerKey(row);
    if (key) {
      learnerBookingCounts.set(key, (learnerBookingCounts.get(key) ?? 0) + 1);
    }
  }

  const learnerCount = learnerBookingCounts.size;
  const repeatLearnerCount = Array.from(learnerBookingCounts.values()).filter((count) => count > 1).length;
  const reviewsData = reviewResult.data ?? [];
  const positiveReviewCount = reviewsData.filter((review) => (review.rating ?? 0) >= 4).length;
  const negativeReviewCount = reviewsData.filter((review) => (review.rating ?? 0) <= 2).length;
  const averageRating = reviewsData.length
    ? reviewsData.reduce((total, review) => total + (review.rating ?? 0), 0) / reviewsData.length
    : 0;
  const lessonsBookedThisMonth = paidBookings.filter((row) => {
    const date = dateFromBooking(row);
    return date ? isThisMonth(date) : false;
  }).length;
  const progressRecords = progressResult.data ?? [];
  const learnerIds = Array.from(new Set(reviewsData.map((review) => review.learner_id).filter(Boolean) as string[]));
  const { data: learnerRows } = learnerIds.length
    ? await readClient.from("profiles").select("id,full_name,email").in("id", learnerIds).returns<LearnerNameRow[]>()
    : { data: [] as LearnerNameRow[] };
  const learnerById = new Map((learnerRows ?? []).map((learner) => [learner.id, learner]));

  const formattedReviews: InstructorPerformanceReview[] = reviewsData.map((review) => {
    const learner = review.learner_id ? learnerById.get(review.learner_id) : null;
    const rating = review.rating ?? 0;

    return {
      id: review.id,
      learner: learner?.full_name || learner?.email || "Learner",
      date: formatReviewDate(review.created_at),
      rating,
      tone: reviewTone(rating),
      lessonFocus: "Completed LDA lesson",
      body: review.comment || "Learner left a star rating without a written review.",
      privateNote:
        rating >= 4
          ? "Positive learner review. Keep reinforcing the lesson structure that worked."
          : rating <= 2
            ? "Low learner review. Review the lesson record and address the pattern early."
            : "Neutral learner review. Look for a specific improvement point before the next lesson."
    };
  });

  const metrics: InstructorPerformanceMetrics = {
    ...emptyMetrics,
    positiveFeedbackRate: roundedPercent(positiveReviewCount, reviewsData.length),
    retentionRate: roundedPercent(repeatLearnerCount, learnerCount),
    lessonsDelivered: completedBookings.length,
    cancellationRate: roundedPercent(instructorCancellations, paidBookings.length || allBookingEvidence.length),
    learnerCancellationRate: roundedPercent(learnerCancellations, paidBookings.length || allBookingEvidence.length),
    averageRating,
    reviewCount: reviewsData.length,
    positiveReviewCount,
    negativeReviewCount,
    lessonsBookedThisMonth,
    learnerCount,
    repeatLearnerCount,
    averageLessonGapDays: averageGapDays(paidBookings),
    signedProgressRecords: progressRecords.length,
    readinessRiskCount: 0,
    passOutcomeCount: 0
  };

  return { metrics, reviews: formattedReviews };
}

export default async function InstructorPerformancePage() {
  const supabase = await createClient();

  if (hasSupabaseConfig() && supabase) {
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/auth/login?role=instructor");
    }

    const [approvalState, { data: profile }, { data: instructorProfile }] = await Promise.all([
      getInstructorApprovalState(supabase, user.id),
      supabase.from("profiles").select("full_name,email").eq("id", user.id).maybeSingle<ProfileRow>(),
      supabase.from("instructor_profiles").select("display_name").eq("user_id", user.id).maybeSingle<InstructorProfileRow>()
    ]);
    redirectUnlessApprovedInstructor(approvalState);
    const instructorName = instructorProfile?.display_name || profile?.full_name || user.email || "LDA instructor";
    const readClient = createAdminClient() ?? supabase;
    const { metrics, reviews } = await fetchInstructorPerformanceData({
      instructorId: user.id,
      instructorEmail: profile?.email || user.email,
      instructorName,
      readClient
    });

    return (
      <>
        <PageTopBar backHref="/dashboard" backLabel="Back to dashboard" />
        <InstructorPerformanceWorkspace instructorName={instructorName} metrics={metrics} reviews={reviews} />
      </>
    );
  }

  return (
    <>
      <PageTopBar backHref="/dashboard" backLabel="Back to dashboard" />
      <InstructorPerformanceWorkspace instructorName="LDA instructor" metrics={emptyMetrics} reviews={[]} />
    </>
  );
}
