"use client";

import { useMemo, useState } from "react";
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

const initialReviews: InstructorReview[] = [
  {
    id: "rev-1",
    learner: "Mia Thompson",
    date: "8 Jun 2026",
    rating: 5,
    tone: "positive",
    lessonFocus: "Junction confidence",
    body: "Very calm lesson. I understood mirrors and timing much better by the end.",
    privateNote: "Keep using calm walkthroughs before independent attempts."
  },
  {
    id: "rev-2",
    learner: "Aaliyah Grant",
    date: "4 Jun 2026",
    rating: 4,
    tone: "positive",
    lessonFocus: "Mock test route",
    body: "Helpful feedback and clear route planning. I know what to practise next.",
    privateNote: "Progress tracker notes are working well for test-ready pupils."
  },
  {
    id: "rev-3",
    learner: "Owen Patel",
    date: "30 May 2026",
    rating: 2,
    tone: "negative",
    lessonFocus: "Roundabouts",
    body: "I wanted more time practising instead of talking through the route.",
    privateNote: "Increase drive time for confident learners and shorten recap blocks."
  }
];

const performanceRows: PerformanceRow[] = [
  { label: "Pass rate", value: "82%", benchmark: "UK target: 75%+", insight: "Strong result. Keep mock-test evidence updated before practical bookings.", tone: "green" },
  { label: "First-time pass", value: "64%", benchmark: "Target: 60%+", insight: "Good first-attempt readiness. Focus weak learners earlier in the syllabus.", tone: "green" },
  { label: "Lessons delivered", value: "96", benchmark: "This quarter", insight: "Healthy workload. Protect admin slots to avoid fatigue and cancellations.", tone: "zinc" },
  { label: "Student retention", value: "88%", benchmark: "Target: 85%+", insight: "Learners are staying with you. Keep next-lesson focus notes consistent.", tone: "green" },
  { label: "Cancellation rate", value: "6%", benchmark: "Target: under 8%", insight: "Within target. Watch short-notice evening cancellations.", tone: "amber" },
  { label: "Average rating", value: "4.6", benchmark: "From private learner feedback", insight: "Positive learner sentiment. Review negative comments quickly.", tone: "green" }
];

const coachingSignals = [
  "Learners mention calm instruction most often in positive reviews.",
  "Roundabouts and independent driving generate the most improvement notes.",
  "Evening lessons have the highest cancellation risk.",
  "Test-ready pupils perform best when mock-test results are logged within 24 hours.",
  "Retention improves when the next lesson focus is sent after every session."
];

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

export function InstructorPerformanceWorkspace({ instructorName }: { instructorName: string }) {
  const [reviews, setReviews] = useState(initialReviews);
  const positiveReviews = reviews.filter((review) => review.tone === "positive").length;
  const negativeReviews = reviews.filter((review) => review.tone === "negative").length;
  const averageRating = useMemo(
    () => (reviews.reduce((total, review) => total + review.rating, 0) / reviews.length).toFixed(1),
    [reviews]
  );
  const positiveFeedbackRate = Math.round((positiveReviews / reviews.length) * 100);

  function addDemoPositiveReview() {
    setReviews((current) => [
      {
        id: `rev-${Date.now()}`,
        learner: "New learner",
        date: "Today",
        rating: 5,
        tone: "positive",
        lessonFocus: "Clutch control",
        body: "Great lesson. The steps were easy to follow and I felt more confident.",
        privateNote: "This would be created automatically when a learner submits a new positive review."
      },
      ...current
    ]);
  }

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
            <Metric icon={Target} label="Pass rate" value="82%" tone="green" />
            <Metric icon={Star} label="Positive feedback" value={`${positiveFeedbackRate}%`} tone="green" />
            <Metric icon={CheckCircle2} label="First-time pass" value="64%" tone="green" />
            <Metric icon={UsersRound} label="Retention" value="88%" tone="zinc" />
          </div>

          <section className="rounded border border-zinc-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 p-4">
              <div>
                <h2 className="text-2xl font-black">Instructor scorecard</h2>
                <p className="mt-1 text-sm font-bold text-zinc-500">Private operational signals for coaching, ranking health, and lesson planning.</p>
              </div>
              <button type="button" onClick={addDemoPositiveReview} className="lda-pill lda-pill-sm">
                <MessageSquareText size={17} /> Simulate learner review
              </button>
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
              <h2 className="text-2xl font-black">Private learner reviews</h2>
              <p className="mt-1 text-sm font-bold text-zinc-500">
                Good and negative reviews update these metrics and stay visible only to the instructor.
              </p>
            </div>
            <div className="grid gap-3 p-4">
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
            <div className="text-sm font-black uppercase text-brand">Review health</div>
            <div className="mt-4 grid gap-3">
              <MetricLine icon={Star} label="Average rating" value={averageRating} />
              <MetricLine icon={MessageSquareText} label="Positive reviews" value={String(positiveReviews)} />
              <MetricLine icon={AlertTriangle} label="Negative reviews" value={String(negativeReviews)} />
              <MetricLine icon={XCircle} label="Cancellation rate" value="6%" />
              <MetricLine icon={CalendarCheck} label="Lessons this month" value="32" />
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

          <section className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
            <ShieldCheck className="text-brand" />
            <h2 className="mt-3 text-2xl font-black">Privacy rule</h2>
            <p className="mt-3 text-sm font-bold leading-6 text-zinc-600">
              These operational reviews are private to the signed-in instructor. Public marketplace ratings should use separate moderation rules before anything appears to learners.
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
