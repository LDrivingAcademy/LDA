"use client";

import { FormEvent, useMemo, useState } from "react";
import { BadgeCheck, ExternalLink, Mail, Save, Send, Sparkles } from "lucide-react";
import { practicalReadinessChecklist } from "@/lib/practical-readiness-checklist";

type SkillState = {
  title: string;
  complete: boolean;
  locked: boolean;
};

function createStarterSkills(): SkillState[] {
  return practicalReadinessChecklist.map((title) => ({ title, complete: false, locked: false }));
}

function mergeLockedSkills(current: SkillState[], completedSkills: string[]): SkillState[] {
  const lockedByKey = new Map(
    completedSkills
      .map((title) => title.trim())
      .filter(Boolean)
      .map((title) => [title.toLowerCase(), title])
  );

  return current.map((skill) => {
    const key = skill.title.trim().toLowerCase();
    return lockedByKey.has(key) ? { ...skill, complete: true, locked: true } : skill;
  });
}

type ProgressFeedbackFormProps = {
  instructorName: string;
  initialLearnerName?: string;
  initialLearnerEmail?: string;
  initialLessonReference?: string;
};

export function ProgressFeedbackForm({
  instructorName,
  initialLearnerName = "",
  initialLearnerEmail = "",
  initialLessonReference = ""
}: ProgressFeedbackFormProps) {
  const [learnerName, setLearnerName] = useState(initialLearnerName);
  const [learnerEmail, setLearnerEmail] = useState(initialLearnerEmail);
  const [lessonReference, setLessonReference] = useState(initialLessonReference);
  const [skills, setSkills] = useState<SkillState[]>(createStarterSkills);
  const [markTestReady, setMarkTestReady] = useState(false);
  const [instructorNotes, setInstructorNotes] = useState("Good progress with control and observations. Keep practising mirror checks before changing speed or direction.");
  const [nextLessonFocus, setNextLessonFocus] = useState("Next lesson should focus on junction judgement, meeting traffic, and smoother clutch control in slow traffic.");
  const [recommendedVideos, setRecommendedVideos] = useState("Search: UK junction observations MSPSL routine\nSearch: UK roundabouts lane discipline\nSearch: UK reversing manoeuvres practical test");
  const [status, setStatus] = useState<"idle" | "looking-up" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  const completedSkills = useMemo(() => skills.filter((skill) => skill.complete).map((skill) => skill.title), [skills]);
  const checklistCompletion = skills.length ? Math.round((completedSkills.length / skills.length) * 100) : 0;
  const hasCompletedRequiredChecklist = skills.length > 0 && skills.every((skill) => skill.complete);
  const isTestReadySignedOff = hasCompletedRequiredChecklist && markTestReady;

  async function lookupLearnerEmail(name: string) {
    const trimmed = name.trim();
    setLearnerName(name);
    setLearnerEmail("");
    setMessage("");

    if (trimmed.length < 2) {
      return;
    }

    setStatus("looking-up");
    const response = await fetch(`/api/progress-feedback/learner-lookup?name=${encodeURIComponent(trimmed)}`);
    const result = await response.json();

    if (!response.ok) {
      setStatus("idle");
      setMessage(result.error ?? "Learner email could not be found from that name.");
      return;
    }

    setLearnerName(result.name ?? trimmed);
    setLearnerEmail(result.email ?? "");
    const mergedSkills = mergeLockedSkills(skills, Array.isArray(result.completedSkills) ? result.completedSkills : []);
    setSkills(mergedSkills);
    setMarkTestReady(false);
    setStatus("idle");
  }

  async function sendFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setMessage("");

    const response = await fetch("/api/progress-feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        learnerName,
        learnerEmail,
        instructorName,
        lessonReference,
        completedSkills,
        requiredChecklistSkills: practicalReadinessChecklist,
        totalChecklistSkills: skills.length,
        testReadySignedOff: isTestReadySignedOff,
        instructorNotes,
        nextLessonFocus,
        recommendedVideos
      })
    });
    const result = await response.json();

    if (!response.ok) {
      setStatus("error");
      setMessage(result.error ?? "Progress feedback could not be sent.");
      return;
    }

    setStatus("sent");
    setMessage(result.message ?? "Progress feedback sent.");
  }

  return (
    <form onSubmit={sendFeedback} className="rounded bg-white p-5 text-black shadow-2xl ring-1 ring-zinc-200">
      <div className="flex items-center gap-2 text-sm font-black uppercase text-brand">
        <Save size={16} /> Editable instructor record
      </div>
      <h2 className="mt-2 text-3xl font-black tracking-normal">Send learner progress after a lesson.</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-600">
        Tick what was covered, add notes, and share revision links. LDA saves this to the learner progress tracker and their after-lesson revision page.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1">
          <span className="text-sm font-black text-zinc-700">Learner name</span>
          <input value={learnerName} onChange={(event) => lookupLearnerEmail(event.target.value)} className="min-h-12 rounded border border-zinc-300 px-4 font-bold" placeholder="Start typing learner name" />
        </label>
        <label className="grid gap-1">
          <span className="text-sm font-black text-zinc-700">Learner email</span>
          <input readOnly type="email" value={learnerEmail} className="min-h-12 rounded border border-zinc-300 bg-zinc-100 px-4 font-bold text-zinc-700" placeholder={status === "looking-up" ? "Looking up learner..." : "Auto-filled from learner name"} />
        </label>
        <label className="grid gap-1">
          <span className="text-sm font-black text-zinc-700">Instructor</span>
          <input readOnly value={instructorName} className="min-h-12 rounded border border-zinc-300 bg-zinc-100 px-4 font-bold text-zinc-700" />
        </label>
        <label className="grid gap-1">
          <span className="text-sm font-black text-zinc-700">Lesson reference</span>
          <input value={lessonReference} onChange={(event) => setLessonReference(event.target.value)} className="min-h-12 rounded border border-zinc-300 px-4 font-mono text-sm font-black" placeholder="Manual lesson reference" />
        </label>
      </div>

      <section className="mt-6 rounded bg-zinc-100 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-black uppercase text-zinc-500">Checklist</div>
          <div className={`rounded-full px-3 py-1 text-xs font-black uppercase ${hasCompletedRequiredChecklist ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200" : "bg-white text-zinc-600 ring-1 ring-zinc-200"}`}>
            {checklistCompletion}% signed off
          </div>
        </div>
        <p className="mt-3 rounded border border-zinc-200 bg-white p-3 text-sm font-bold leading-6 text-zinc-600">
          This is the fixed LDA practical-test readiness checklist. Previously instructor-signed topics are locked, and every required item must be covered before a learner can be marked test-ready.
        </p>
        <div className="mt-3 grid gap-2">
          {skills.map((skill, index) => (
            <label key={`${skill.title}-${index}`} className="flex items-center gap-3 rounded bg-white p-3 text-sm font-bold">
              <input
                type="checkbox"
                checked={skill.complete}
                disabled={skill.locked}
                onChange={(event) =>
                  setSkills((current) =>
                    current.map((item, itemIndex) => {
                      if (itemIndex !== index || item.locked) {
                        return item;
                      }
                      return { ...item, complete: event.target.checked };
                    })
                  )
                }
              />
              <span className={`min-w-0 flex-1 font-bold ${skill.locked ? "text-zinc-500" : "text-zinc-900"}`}>{skill.title}</span>
              {skill.locked ? (
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase text-emerald-800 ring-1 ring-emerald-200">
                  Locked
                </span>
              ) : null}
            </label>
          ))}
        </div>
        <div className={`mt-4 rounded border p-4 ${hasCompletedRequiredChecklist ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-zinc-200 bg-white text-zinc-700"}`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-3">
              <div className={`grid h-10 w-10 shrink-0 place-items-center rounded ${hasCompletedRequiredChecklist ? "bg-emerald-100 text-emerald-800" : "bg-red-50 text-brand"}`}>
                {hasCompletedRequiredChecklist ? <BadgeCheck size={20} /> : <Sparkles size={20} />}
              </div>
              <div>
                <div className="text-sm font-black uppercase">{hasCompletedRequiredChecklist ? "Practical-test readiness complete" : "AI readiness bridge"}</div>
                <p className="mt-2 text-sm font-bold leading-6">
                  {hasCompletedRequiredChecklist
                    ? "Every required LDA practical-test topic is signed off. Use the test-ready action before sending this record if this was the learner's final readiness lesson."
                    : "Once every checklist item is ticked by the instructor, LDA can move the learner into a test-ready journey and send a privacy-safe next-step notification."}
                </p>
                <a href="https://www.gov.uk/book-driving-test" target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm font-black text-brand hover:underline">
                  Official DVSA booking page <ExternalLink size={15} />
                </a>
              </div>
            </div>
            <button
              type="button"
              disabled={!hasCompletedRequiredChecklist}
              onClick={() => setMarkTestReady((current) => !current)}
              className={`inline-flex min-h-12 shrink-0 items-center justify-center rounded-full px-5 text-sm font-black uppercase transition ${
                markTestReady && hasCompletedRequiredChecklist
                  ? "bg-emerald-700 text-white"
                  : "bg-brand text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-600"
              }`}
            >
              {markTestReady && hasCompletedRequiredChecklist ? "Test-ready email armed" : "Make learner test-ready"}
            </button>
          </div>
        </div>
      </section>

      <div className="mt-5 grid gap-3">
        <label className="grid gap-1">
          <span className="text-sm font-black text-zinc-700">Instructor notes</span>
          <textarea value={instructorNotes} onChange={(event) => setInstructorNotes(event.target.value)} className="min-h-28 rounded border border-zinc-300 px-4 py-3 font-bold leading-6" />
        </label>
        <label className="grid gap-1">
          <span className="text-sm font-black text-zinc-700">Next lesson focus</span>
          <textarea value={nextLessonFocus} onChange={(event) => setNextLessonFocus(event.target.value)} className="min-h-24 rounded border border-zinc-300 px-4 py-3 font-bold leading-6" />
        </label>
        <label className="grid gap-1">
          <span className="text-sm font-black text-zinc-700">Recommended videos or links</span>
          <textarea value={recommendedVideos} onChange={(event) => setRecommendedVideos(event.target.value)} className="min-h-24 rounded border border-zinc-300 px-4 py-3 font-bold leading-6" />
        </label>
      </div>

      <button disabled={status === "sending" || status === "looking-up"} className="lda-pill mt-6 w-full" type="submit">
        {status === "sending" ? <Mail size={18} /> : <Send size={18} />}
        {status === "sending" ? "Sending progress..." : "Send progress to learner"}
      </button>
      {message ? (
        <p className={`mt-3 rounded p-3 text-sm font-bold ${status === "error" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-800"}`}>
          {message}
        </p>
      ) : null}
    </form>
  );
}
