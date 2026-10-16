"use client";

import {
  AlertTriangle,
  BarChart3,
  CalendarCheck,
  CheckCircle2,
  MessageSquareText,
  ShieldCheck,
  Star,
  Target,
  TrendingUp,
  UsersRound,
  XCircle
} from "lucide-react";
import { PerformanceAiCoach } from "@/components/performance-ai-coach";

type ReviewTone = "positive" | "neutral" | "negative";

type InstructorReview = {
  id: string;
  learner: string;
  date: string;
  rating: number;
  tone: ReviewTone;
  lessonFocus: string;
  body: string;
  privateNote: string;
};

type PerformanceRow = {
  label: string;
  value: string;
  benchmark: string;
  insight: string;
  tone: "green" | "amber" | "red" | "zinc";
};

export type InstructorPerformanceMetrics = {
  passRate: number;
  positiveFeedbackRate: number;
  firstTimePassRate: number;
  retentionRate: number;
  lessonsDelivered: number;
  cancellationRate: number;
  learnerCancellationRate: number;
  averageRating: number;
  reviewCount: number;
  positiveReviewCount: number;
  negativeReviewCount: number;
  lessonsBookedThisMonth: number;
  learnerCount: number;
  repeatLearnerCount: number;
  averageLessonGapDays: number;
  signedProgressRecords: number;
  readinessRiskCount: number;
  passOutcomeCount: number;
};

export type InstructorPerformanceReview = InstructorReview;

function toneClass(tone: PerformanceRow["tone"]) {
  return {
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
    zinc: "bg-zinc-100 text-zinc-700"
  }[tone];
}

function reviewClass(tone: ReviewTone) {
  return {
    positive: "border-emerald-200 bg-emerald-50 text-emerald-800",
    neutral: "border-zinc-200 bg-zinc-50 text-zinc-700",
    negative: "border-red-200 bg-red-50 text-red-800"
  }[tone];
}

function metricTonePercent(value: number, greenAt: number, amberAt: number): PerformanceRow["tone"] {
  if (value >= greenAt) return "green";
  if (value >= amberAt) return "amber";
  return value > 0 ? "red" : "zinc";
}

function cancellationTone(value: number): PerformanceRow["tone"] {
  if (value === 0) return "zinc";
  if (value < 8) return "green";
  if (value < 15) return "amber";
  return "red";
}

function buildPerformanceRows(metrics: InstructorPerformanceMetrics): PerformanceRow[] {
  return [
    {
      label: "Pass rate",
      value: `${metrics.passRate}%`,
      benchmark: metrics.passOutcomeCount ? "Based on learner test outcomes" : "Awaiting pass evidence",
      insight: metrics.passOutcomeCount
        ? "This updates when learners submit practical-test outcomes after being taught through LDA."
        : "No practical-test pass outcomes have been submitted yet, so this stays at zero.",
      tone: metricTonePercent(metrics.passRate, 75, 60)
    },
    {
      label: "First-time pass",
      value: `${metrics.firstTimePassRate}%`,
      benchmark: metrics.passOutcomeCount ? "First attempt evidence" : "Awaiting pass evidence",
      insight: metrics.passOutcomeCount
        ? "This rises when learners confirm they passed first time after being marked test-ready."
        : "No first-attempt pass outcomes have been submitted yet, so this stays at zero.",
      tone: metricTonePercent(metrics.firstTimePassRate, 60, 45)
    },
    {
      label: "Lessons delivered",
      value: String(metrics.lessonsDelivered),
      benchmark: "Completed LDA bookings",
      insight: metrics.lessonsDelivered
        ? "Completed platform bookings are feeding this count."
        : "No completed LDA lessons are recorded yet.",
      tone: metrics.lessonsDelivered ? "green" : "zinc"
    },
    {
      label: "Student retention",
      value: `${metrics.retentionRate}%`,
      benchmark: `${metrics.repeatLearnerCount}/${metrics.learnerCount} repeat learners`,
      insight: metrics.learnerCount
        ? "Retention counts learners who return to this instructor for more than one booking."
        : "Retention starts once learners book with this instructor.",
      tone: metricTonePercent(metrics.retentionRate, 85, 60)
    },
    {
      label: "Cancellation rate",
      value: `${metrics.cancellationRate}%`,
      benchmark: "Instructor cancellations only",
      insight: metrics.cancellationRate
        ? "This only counts cancellations made by the instructor, not learner cancellations."
        : "No instructor-side cancellations are recorded.",
      tone: cancellationTone(metrics.cancellationRate)
    },
    {
      label: "Average rating",
      value: metrics.averageRating.toFixed(1),
      benchmark: metrics.reviewCount ? `${metrics.reviewCount} learner review${metrics.reviewCount === 1 ? "" : "s"}` : "No learner reviews yet",
      insight: metrics.reviewCount
        ? "This is calculated from learner reviews after completed lessons."
        : "Average rating starts at zero until real learner reviews come in.",
      tone: metrics.averageRating >= 4.5 ? "green" : metrics.averageRating >= 3.5 ? "amber" : metrics.averageRating > 0 ? "red" : "zinc"
    }
  ];
}

function buildProgressEfficiencyRows(metrics: InstructorPerformanceMetrics) {
  return [
    {
      label: "Average lesson gap",
      value: metrics.averageLessonGapDays ? `${metrics.averageLessonGapDays} days` : "0 days",
      insight: metrics.averageLessonGapDays
        ? "Calculated from the spacing between this instructor's learner bookings."
        : "Lesson spacing will appear once repeat booking dates exist."
    },
    {
      label: "Syllabus pace",
      value: String(metrics.signedProgressRecords),
      insight: metrics.signedProgressRecords
        ? "Instructor-sent progress records are feeding the learner development signal."
        : "No after-lesson progress records have been sent yet."
    },
    {
      label: "Positive feedback",
      value: `${metrics.positiveFeedbackRate}%`,
      insight: metrics.reviewCount
        ? "Positive feedback counts learner reviews rated four or five stars."
        : "Positive feedback starts at zero until learners submit real reviews."
    },
    {
      label: "Readiness risk",
      value: `${metrics.readinessRiskCount} pupils`,
      insight: metrics.readinessRiskCount
        ? "These learners have test-ready signals without enough completed platform evidence."
        : "No readiness risk is currently detected."
    }
  ];
}

function buildCoachingSignals(metrics: InstructorPerformanceMetrics) {
  if (
    metrics.lessonsDelivered === 0 &&
    metrics.reviewCount === 0 &&
    metrics.learnerCount === 0 &&
    metrics.signedProgressRecords === 0
  ) {
    return [
      "No live learner performance data is recorded yet.",
      "Completed LDA lessons will increase lessons delivered.",
      "Learner reviews will update positive feedback and average rating.",
      "Repeat learner bookings will update student retention.",
      "Instructor-side cancellations will update the cancellation rate."
    ];
  }

  return [
    metrics.positiveFeedbackRate >= 80
      ? "Learner feedback is currently strong. Keep asking learners to leave honest reviews after good lessons."
      : "Positive feedback can improve as learners submit more post-lesson reviews.",
    metrics.retentionRate >= 70
      ? "Learners are returning to this instructor, which supports the retention score."
      : "Retention improves when learners book again with the same instructor.",
    metrics.cancellationRate > 0
      ? "Instructor cancellations are being tracked separately from learner cancellations."
      : "No instructor-side cancellations are currently recorded.",
    metrics.signedProgressRecords
      ? "After-lesson progress records are feeding the learner progress signal."
      : "Sending after-lesson progress notes will improve the evidence trail.",
    metrics.passOutcomeCount
      ? "Practical-test outcome evidence is feeding pass-rate reporting."
      : "Pass-rate reporting is waiting for learner practical-test outcome evidence."
  ];
}

export function InstructorPerformanceWorkspace({
  instructorName,
  metrics,
  reviews
}: {
  instructorName: string;
  metrics: InstructorPerformanceMetrics;
  reviews: InstructorPerformanceReview[];
}) {
  const performanceRows = buildPerformanceRows(metrics);
  const progressEfficiencyRows = buildProgressEfficiencyRows(metrics);
  const coachingSignals = buildCoachingSignals(metrics);

  return (
    <main className="min-h-screen bg-white text-black">
      <section className="border-b border-zinc-200 bg-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-red-500/60 bg-red-500/15 px-4 py-2 text-sm font-black text-red-100">
            <BarChart3 size={17} /> Instructor performance
          </div>
          <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_340px] lg:items-end">
            <div>
              <h1 className="max-w-4xl text-5xl font-black tracking-normal sm:text-6xl">Performance metrics.</h1>
              <p className="mt-4 max-w-3xl text-lg font-semibold leading-8 text-zinc-300">
                Track pass results, retention, reviews, cancellations, and learner feedback so lessons can improve before issues become patterns.
              </p>
            </div>
            <aside className="rounded border border-zinc-800 bg-zinc-950 p-5">
              <div className="text-sm font-black uppercase text-zinc-500">Private instructor view</div>
              <div className="mt-2 text-2xl font-black">{instructorName}</div>
              <div className="mt-1 text-sm font-bold text-zinc-400">Reviews shown here are not public search reviews.</div>
            </aside>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_380px] lg:px-8">
          <div className="grid gap-5">
          <div className="grid gap-3 md:grid-cols-4">
            <Metric icon={Target} label="Pass rate" value={`${metrics.passRate}%`} tone={metricTonePercent(metrics.passRate, 75, 60)} />
            <Metric icon={Star} label="Positive feedback" value={`${metrics.positiveFeedbackRate}%`} tone={metricTonePercent(metrics.positiveFeedbackRate, 80, 60)} />
            <Metric icon={CheckCircle2} label="First-time pass" value={`${metrics.firstTimePassRate}%`} tone={metricTonePercent(metrics.firstTimePassRate, 60, 45)} />
            <Metric icon={UsersRound} label="Retention" value={`${metrics.retentionRate}%`} tone={metricTonePercent(metrics.retentionRate, 85, 60)} />
          </div>

          <section className="rounded border border-zinc-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 p-4">
              <div>
                <h2 className="text-2xl font-black">Instructor scorecard</h2>
                <p className="mt-1 text-sm font-bold text-zinc-500">Private operational signals calculated from live bookings, learner reviews, cancellations, and progress records.</p>
              </div>
            </div>
            <div className="grid gap-4 p-4 md:grid-cols-2">
              {performanceRows.map((row) => (
                <article key={row.label} className="rounded border border-zinc-200 bg-zinc-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-black uppercase text-zinc-500">{row.label}</div>
                      <div className="mt-2 text-4xl font-black">{row.value}</div>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${toneClass(row.tone)}`}>{row.benchmark}</span>
                  </div>
                  <p className="mt-4 text-sm font-bold leading-6 text-zinc-700">{row.insight}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-200 p-4">
              <h2 className="text-2xl font-black">Pupil progress intelligence</h2>
              <p className="mt-1 text-sm font-bold text-zinc-500">
                LDA AI separates slow learner consistency from inefficient lesson structure.
              </p>
            </div>
            <div className="grid gap-4 p-4 md:grid-cols-2">
              {progressEfficiencyRows.map((row) => (
                <article key={row.label} className="rounded border border-zinc-200 bg-zinc-50 p-4">
                  <div className="text-sm font-black uppercase text-zinc-500">{row.label}</div>
                  <div className="mt-2 text-4xl font-black">{row.value}</div>
                  <p className="mt-4 text-sm font-bold leading-6 text-zinc-700">{row.insight}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-200 p-4">
              <h2 className="text-2xl font-black">Private learner reviews</h2>
              <p className="mt-1 text-sm font-bold text-zinc-500">
                Real learner reviews update these metrics and stay visible only to the instructor.
              </p>
            </div>
            <div className="grid gap-3 p-4">
              {reviews.length === 0 ? (
                <div className="rounded border border-zinc-200 bg-zinc-50 p-4 text-sm font-bold leading-6 text-zinc-600">
                  No learner reviews have been submitted yet. Once learners review completed LDA lessons, this section and the scorecard will update automatically.
                </div>
              ) : null}
              {reviews.map((review) => (
                <article key={review.id} className="rounded border border-zinc-200 bg-zinc-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-black">{review.learner}</div>
                      <div className="mt-1 text-sm font-bold text-zinc-500">{review.date} - {review.lessonFocus}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full border px-3 py-1 text-xs font-black uppercase ${reviewClass(review.tone)}`}>{review.tone}</span>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-zinc-700 ring-1 ring-zinc-200">{review.rating}/5</span>
                    </div>
                  </div>
                  <p className="mt-4 text-sm font-bold leading-6 text-zinc-700">{review.body}</p>
                  <div className="mt-3 rounded border border-zinc-200 bg-white p-3 text-xs font-black leading-5 text-zinc-600">
                    Instructor note: {review.privateNote}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>

        <aside className="grid content-start gap-5">
          <section className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-black uppercase text-brand">Review scorecard</div>
            <div className="mt-4 grid gap-3">
              <MetricLine icon={Star} label="Average rating" value={metrics.averageRating.toFixed(1)} />
              <MetricLine icon={MessageSquareText} label="Positive reviews" value={String(metrics.positiveReviewCount)} />
              <MetricLine icon={AlertTriangle} label="Negative reviews" value={String(metrics.negativeReviewCount)} />
              <MetricLine icon={XCircle} label="Learner cancellation rate" value={`${metrics.learnerCancellationRate}%`} />
              <MetricLine icon={CalendarCheck} label="Lessons booked this month" value={String(metrics.lessonsBookedThisMonth)} />
            </div>
          </section>

          <section className="rounded border border-zinc-200 bg-zinc-950 p-5 text-white shadow-sm">
            <TrendingUp className="text-brand" />
            <h2 className="mt-3 text-2xl font-black">Coaching signals</h2>
            <div className="mt-4 grid gap-3 text-sm font-bold leading-6 text-zinc-300">
              {coachingSignals.map((signal) => (
                <div key={signal} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 shrink-0 text-brand" size={18} />
                  {signal}
                </div>
              ))}
            </div>
          </section>

          <PerformanceAiCoach />

          <section className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
            <ShieldCheck className="text-brand" />
            <h2 className="mt-3 text-2xl font-black">Privacy rule</h2>
            <p className="mt-3 text-sm font-bold leading-6 text-zinc-600">
              These operational reviews are private to the signed-in instructor. Public platform ratings should use separate moderation rules before anything appears to learners.
            </p>
          </section>
        </aside>
      </section>
    </main>
  );
}

function Metric({ icon: Icon, label, value, tone }: { icon: typeof BarChart3; label: string; value: string; tone: "green" | "amber" | "red" | "zinc" }) {
  return (
    <article className="rounded border border-zinc-200 bg-white p-4 shadow-sm">
      <div className={`grid h-11 w-11 place-items-center rounded ${toneClass(tone)}`}>
        <Icon size={22} />
      </div>
      <div className="mt-4 text-3xl font-black">{value}</div>
      <div className="mt-1 text-sm font-black uppercase text-zinc-500">{label}</div>
    </article>
  );
}

function MetricLine({ icon: Icon, label, value }: { icon: typeof Star; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded border border-zinc-200 bg-zinc-50 p-3">
      <div className="flex items-center gap-3 text-sm font-black text-zinc-700">
        <Icon className="text-brand" size={17} />
        {label}
      </div>
      <div className="text-lg font-black">{value}</div>
    </div>
  );
}
