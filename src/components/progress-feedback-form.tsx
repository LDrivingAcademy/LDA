"use client";

import { FormEvent, useMemo, useState } from "react";
import { Mail, Plus, Save, Send, Trash2 } from "lucide-react";

const starterSkills = [
  "Cockpit drill and safety checks",
  "Moving off and stopping safely",
  "Steering control",
  "Clutch control",
  "Junctions and emerging",
  "Roundabouts",
  "Meeting traffic",
  "Reverse bay parking",
  "Parallel parking",
  "Independent driving"
];

export function ProgressFeedbackForm({ instructorName }: { instructorName: string }) {
  const [learnerName, setLearnerName] = useState("");
  const [learnerEmail, setLearnerEmail] = useState("");
  const [lessonReference, setLessonReference] = useState("");
  const [skills, setSkills] = useState(starterSkills.map((title, index) => ({ title, complete: index < 3 })));
  const [newSkill, setNewSkill] = useState("");
  const [instructorNotes, setInstructorNotes] = useState("Good progress with control and observations. Keep practising mirror checks before changing speed or direction.");
  const [nextLessonFocus, setNextLessonFocus] = useState("Next lesson should focus on junction judgement, meeting traffic, and smoother clutch control in slow traffic.");
  const [recommendedVideos, setRecommendedVideos] = useState("Search: UK driving lesson clutch control\nSearch: UK junction observations MSPSL routine");
  const [status, setStatus] = useState<"idle" | "looking-up" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  const completedSkills = useMemo(() => skills.filter((skill) => skill.complete).map((skill) => skill.title), [skills]);

  function addSkill() {
    const trimmed = newSkill.trim();
    if (!trimmed) {
      return;
    }
    setSkills((current) => [...current, { title: trimmed, complete: false }]);
    setNewSkill("");
  }

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
        Tick what was covered, add notes, and share links so the next lesson does not waste time repeating old ground.
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
        <div className="text-sm font-black uppercase text-zinc-500">Checklist</div>
        <div className="mt-3 grid gap-2">
          {skills.map((skill, index) => (
            <label key={`${skill.title}-${index}`} className="flex items-center gap-3 rounded bg-white p-3 text-sm font-bold">
              <input
                type="checkbox"
                checked={skill.complete}
                onChange={(event) => setSkills((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, complete: event.target.checked } : item))}
              />
              <input
                value={skill.title}
                onChange={(event) => setSkills((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item))}
                className="min-w-0 flex-1 bg-transparent font-bold outline-none"
              />
              <button type="button" onClick={() => setSkills((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="grid h-9 w-9 place-items-center rounded-full text-zinc-500 hover:bg-red-50 hover:text-brand" aria-label="Remove skill">
                <Trash2 size={16} />
              </button>
            </label>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input value={newSkill} onChange={(event) => setNewSkill(event.target.value)} className="min-h-11 min-w-0 flex-1 rounded border border-zinc-300 px-4 font-bold" placeholder="Add another skill or topic" />
          <button type="button" onClick={addSkill} className="lda-pill lda-pill-sm">
            <Plus size={16} /> Add
          </button>
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
