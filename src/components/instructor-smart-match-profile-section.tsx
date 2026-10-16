"use client";

import { useEffect, useMemo, useState } from "react";
import { Brain, CheckCircle2, Save, ShieldCheck, Sparkles } from "lucide-react";
import { formatMoney } from "@/lib/money";

type SmartMatchProfile = {
  inclusiveLearningEnabled: boolean;
  teachingStyles: string[];
  specialisms: string[];
  inclusiveLessonRatePence: number | null;
};

const styleOptions = [
  "Calm coaching",
  "Step-by-step instruction",
  "Visual examples",
  "Written lesson recaps",
  "Structured lesson plans",
  "Flexible pacing",
  "Confidence building",
  "Quiet explanations",
  "One instruction at a time",
  "Extra processing time",
  "Low-distraction lesson starts",
  "Predictable lesson structure",
  "Written or visual directions",
  "Sign language support"
];

const specialismOptions = [
  "New learners",
  "Nervous learners",
  "Refresher lessons",
  "Parking",
  "Roundabouts",
  "Motorway driving",
  "Night driving",
  "Test preparation",
  "Pass Plus",
  "Accessible pickup planning",
  "Memory support",
  "Hearing-aware communication",
  "Sign language support",
  "Written or visual directions",
  "Mobility considerations",
  "Confidence rebuilding",
  "Inclusive learning"
];

function toggle(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export function InstructorSmartMatchProfileSection({
  standardRatePence
}: {
  standardRatePence?: number | null;
}) {
  const [profile, setProfile] = useState<SmartMatchProfile>({
    inclusiveLearningEnabled: false,
    teachingStyles: [],
    specialisms: [],
    inclusiveLessonRatePence: null
  });
  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "saved" | "error">("loading");
  const [message, setMessage] = useState("");
  const rateLabel = useMemo(() => formatMoney(profile.inclusiveLessonRatePence ?? standardRatePence ?? 0), [profile.inclusiveLessonRatePence, standardRatePence]);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        const response = await fetch("/api/instructor-smart-match-profile", {
          cache: "no-store",
          credentials: "same-origin"
        });
        const result = await response.json();
        if (!active) return;

        if (!response.ok) {
          setStatus("error");
          setMessage(result.error || "Smart Match profile settings are not available yet.");
          return;
        }

        if (result.profile) {
          setProfile(result.profile);
        }
        setStatus("idle");
      } catch {
        if (!active) return;
        setStatus("error");
        setMessage("Smart Match profile settings could not load.");
      }
    }

    void loadProfile();

    return () => {
      active = false;
    };
  }, []);

  async function saveProfile() {
    setStatus("saving");
    setMessage("");

    try {
      const response = await fetch("/api/instructor-smart-match-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(profile)
      });
      const result = await response.json();

      if (!response.ok) {
        setStatus("error");
        setMessage(result.error || "Smart Match profile could not be saved.");
        return;
      }

      setProfile(result.profile ?? profile);
      setStatus("saved");
      setMessage("Smart Match profile saved.");
      window.setTimeout(() => {
        setStatus((current) => (current === "saved" ? "idle" : current));
      }, 3500);
    } catch {
      setStatus("error");
      setMessage("Smart Match profile could not be saved.");
    }
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <article className="rounded border border-zinc-200 bg-white p-5 text-black shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 text-sm font-black uppercase text-brand">
              <Sparkles size={17} /> Smart Match instructor profile
            </div>
            <h2 className="mt-3 text-3xl font-black tracking-normal">Show learners how you teach best.</h2>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-zinc-600">
              These settings strengthen your Smart Match profile without changing your standard hourly rate. Add only the support you can confidently provide, so learners see accurate compatibility scores.
            </p>
          </div>
          <div className="rounded border border-zinc-200 bg-zinc-50 p-4 text-sm font-bold text-zinc-700">
            <div className="text-xs font-black uppercase text-zinc-500">Standard rate stays intact</div>
            <div className="mt-2 text-2xl font-black text-black">{formatMoney(standardRatePence ?? 0)}/hr</div>
            <div className="mt-1 text-xs font-black uppercase text-brand">Inclusive rate: {rateLabel}/hr</div>
          </div>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_340px]">
          <div className="grid gap-5">
            <label className="flex items-start gap-3 rounded border border-zinc-200 bg-zinc-50 p-4 text-sm font-bold leading-6 text-zinc-700">
              <input
                type="checkbox"
                checked={profile.inclusiveLearningEnabled}
                onChange={(event) => setProfile({ ...profile, inclusiveLearningEnabled: event.target.checked })}
                className="mt-1"
              />
              Enable inclusive learning visibility on Smart Match. This helps learners find instructors who offer calm, structured, preference-led lessons.
            </label>

            <div>
              <div className="text-xs font-black uppercase text-zinc-500">Teaching styles</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {styleOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setProfile({ ...profile, teachingStyles: toggle(profile.teachingStyles, option) })}
                    className={`rounded-full border px-3 py-2 text-xs font-black ${profile.teachingStyles.includes(option) ? "border-brand bg-red-50 text-brand" : "border-zinc-200 bg-white text-zinc-700"}`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs font-black uppercase text-zinc-500">Specialisms</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {specialismOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setProfile({ ...profile, specialisms: toggle(profile.specialisms, option) })}
                    className={`rounded-full border px-3 py-2 text-xs font-black ${profile.specialisms.includes(option) ? "border-brand bg-red-50 text-brand" : "border-zinc-200 bg-white text-zinc-700"}`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <aside className="grid gap-4">
            <label className="grid gap-2 rounded border border-zinc-200 bg-zinc-50 p-4">
              <span className="text-xs font-black uppercase text-zinc-500">Optional inclusive lesson rate</span>
              <input
                type="number"
                min={0}
                max={120}
                step={1}
                value={profile.inclusiveLessonRatePence ? Math.round(profile.inclusiveLessonRatePence / 100) : ""}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setProfile({ ...profile, inclusiveLessonRatePence: value > 0 ? value * 100 : null });
                }}
                placeholder="Leave blank to use standard rate"
                className="h-12 rounded border border-zinc-300 bg-white px-3 text-sm font-black text-black"
              />
              <span className="text-xs font-bold leading-5 text-zinc-500">
                Leave blank if your standard hourly rate applies to every Smart Match booking.
              </span>
            </label>

            <div className="rounded border border-zinc-200 bg-white p-4">
              <div className="flex items-center gap-2 text-sm font-black">
                <ShieldCheck size={17} className="text-brand" /> Learner privacy
              </div>
              <p className="mt-2 text-sm font-semibold leading-6 text-zinc-600">
                Learner private notes are only prepared for the instructor they book. Your profile shows your teaching strengths, not learner-sensitive notes.
              </p>
            </div>

            <button type="button" onClick={saveProfile} disabled={status === "saving" || status === "loading"} className="lda-pill w-full justify-center">
              <Save size={18} /> {status === "saving" ? "Saving..." : "Save Smart Match profile"}
            </button>
            {message ? (
              <div className={`rounded p-3 text-sm font-bold leading-6 ${status === "error" ? "bg-red-50 text-red-800" : "bg-green-50 text-green-800"}`}>
                {status === "saved" ? <CheckCircle2 className="mr-2 inline" size={16} /> : <Brain className="mr-2 inline" size={16} />}
                {message}
              </div>
            ) : null}
          </aside>
        </div>
      </article>
    </section>
  );
}
