"use client";

import { useMemo, useState } from "react";
import { Brain, CheckCircle2, MessageSquareText, Send, TrendingUp } from "lucide-react";

type CoachingFocus = "progress" | "reviews" | "first-pass" | "retention" | "cancellations";

const coachingOptions: Array<{
  label: string;
  value: CoachingFocus;
  summary: string;
  actions: string[];
}> = [
  {
    label: "Pupil progress",
    value: "progress",
    summary:
      "Compare lesson gaps against syllabus movement. If a pupil waits too long between lessons, the issue is consistency. If they attend regularly but repeat the same skill, the lesson structure needs changing.",
    actions: [
      "Flag pupils with more than 14 days between lessons.",
      "Spot skills repeated for three lessons without progress.",
      "Use the next lesson focus to set one measurable outcome."
    ]
  },
  {
    label: "Reviews",
    value: "reviews",
    summary:
      "Positive reviews should show the habits to repeat. Negative reviews should be treated as private coaching evidence before they become public reputation problems.",
    actions: [
      "Group review themes by instruction clarity, practice time, confidence, and lesson pacing.",
      "Turn one negative review into a specific next-session adjustment.",
      "Send clearer post-lesson notes when feedback mentions uncertainty."
    ]
  },
  {
    label: "First-time pass",
    value: "first-pass",
    summary:
      "First-time pass rate improves when pupils are only sent to test with evidence: mock results, independent driving confidence, and completed DVSA syllabus areas.",
    actions: [
      "Require recent mock-test evidence before test-ready status.",
      "Track serious and dangerous faults separately from general confidence.",
      "Delay test push notifications when readiness evidence is incomplete."
    ]
  },
  {
    label: "Retention",
    value: "retention",
    summary:
      "Retention often drops when learners do not understand progress. The instructor should make each lesson feel like it clearly moved them forward.",
    actions: [
      "Send the learner one completed skill and one next focus after every lesson.",
      "Watch for learners who stop booking after a difficult topic.",
      "Offer a calmer route when confidence dips after a hard session."
    ]
  },
  {
    label: "Cancellations",
    value: "cancellations",
    summary:
      "Cancellation patterns can show fatigue, unsuitable lesson times, poor reminder timing, or low learner confidence before difficult topics.",
    actions: [
      "Separate instructor cancellations from learner cancellations.",
      "Compare cancellations by time of day and lesson topic.",
      "Offer alternative slots before the learner breaks their rhythm."
    ]
  }
];

export function PerformanceAiCoach() {
  const [focus, setFocus] = useState<CoachingFocus>("progress");
  const [note, setNote] = useState("");
  const selected = coachingOptions.find((option) => option.value === focus) ?? coachingOptions[0];

  const tailoredAdvice = useMemo(() => {
    const cleanNote = note.trim();

    if (!cleanNote) {
      return "Add a pupil or performance note and LDA AI will turn it into a practical coaching adjustment.";
    }

    if (/gap|weeks|days|missed|spacing|long time/i.test(cleanNote)) {
      return "This looks like a learner-consistency issue first. Keep the plan simpler, reduce the gap between lessons, and use short recap drills at the start so the learner does not restart every session.";
    }

    if (/roundabout|junction|stall|clutch|repeat|same/i.test(cleanNote)) {
      return "This looks like a lesson-structure issue. Change the teaching pattern: shorter explanation, more driving repetitions, one measurable target, then review whether the pupil improves within the same lesson.";
    }

    if (/review|rating|complain|negative|feedback/i.test(cleanNote)) {
      return "Treat this as private reputation coaching. Identify the exact theme, change the next lesson plan, then ask for feedback after the adjustment so the metric can recover quickly.";
    }

    return "Use this as a coaching signal: decide whether the blocker is lesson spacing, learner confidence, topic difficulty, or instructor delivery, then set one measurable next-lesson outcome.";
  }, [note]);

  return (
    <section className="rounded border border-zinc-800 bg-black p-5 text-white shadow-sm">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded bg-red-500/15 text-brand">
          <Brain size={23} />
        </div>
        <div>
          <div className="text-xs font-black uppercase text-red-200">LDA performance AI</div>
          <h2 className="text-2xl font-black leading-tight">Private coaching intelligence.</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-zinc-300">
            Analyse whether slow progress is caused by learner lesson gaps, difficult topics, confidence, or the way lessons are being delivered.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        {coachingOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setFocus(option.value)}
            className={`flex items-center justify-between rounded border px-3 py-3 text-left text-sm font-black transition ${
              focus === option.value
                ? "border-brand bg-white text-black ring-2 ring-red-500/25"
                : "border-zinc-800 bg-zinc-950 text-zinc-200 hover:border-brand"
            }`}
          >
            {option.label}
            <TrendingUp size={17} className={focus === option.value ? "text-brand" : "text-zinc-500"} />
          </button>
        ))}
      </div>

      <article className="mt-4 rounded bg-white p-4 text-black">
        <div className="flex items-center gap-2 text-sm font-black">
          <CheckCircle2 size={17} className="text-brand" />
          {selected.label} insight
        </div>
        <p className="mt-3 text-sm font-semibold leading-6 text-zinc-700">{selected.summary}</p>
        <ul className="mt-3 grid gap-2 text-sm font-semibold leading-6 text-zinc-700">
          {selected.actions.map((action) => (
            <li key={action} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
              <span>{action}</span>
            </li>
          ))}
        </ul>
      </article>

      <label className="mt-4 grid gap-2 text-xs font-black uppercase text-zinc-400">
        Ask about a pupil or metric
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={4}
          placeholder="Example: Pupil has had three roundabout lessons but still repeats the same faults..."
          className="rounded border border-zinc-700 bg-white px-3 py-3 text-sm font-bold normal-case text-black placeholder:text-zinc-500"
        />
      </label>
      <div className="mt-3 rounded bg-zinc-950 p-3 text-sm font-semibold leading-6 text-zinc-200">
        <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase text-red-200">
          <MessageSquareText size={15} /> AI coaching response
        </div>
        {tailoredAdvice}
      </div>
      <button type="button" className="lda-pill lda-pill-sm mt-4 w-full justify-center">
        Save coaching action <Send size={16} />
      </button>
    </section>
  );
}
