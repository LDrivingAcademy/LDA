"use client";

import { useState } from "react";
import { Accessibility, Brain, CarFront, CheckCircle2, Moon, Sparkles, Star } from "lucide-react";
import { formatMoney } from "@/lib/money";
import type { SmartMatchInput } from "@/lib/smart-match";

type SmartMatchResult = {
  summary: string;
  accessibilityPlan: string[];
  ldaExclusive: string[];
  plan: string[];
  matches: Array<{
    id: string;
    name: string;
    badge: string;
    pricePence: number;
    transmission: string;
    distanceMiles: number;
    rating: number;
    reviewCount: number;
    car: string;
    nextSlot: string;
    strengths: string[];
    qualifications: string[];
    lessonAdaptations: string[];
    postPassTags: string[];
    teachingStyle: string;
    matchScore: number;
    reasons: string[];
  }>;
};

const supportOptions = [
  { value: "anxiety", label: "Anxiety aware" },
  { value: "sensory", label: "Sensory aware" },
  { value: "extra processing time", label: "Extra processing time" },
  { value: "visual prompts", label: "Visual prompts" },
  { value: "checklists", label: "Checklist learning" },
  { value: "ADHD-friendly pacing", label: "ADHD-friendly pacing" },
  { value: "autism-aware", label: "Autism-aware structure" },
  { value: "dyslexia-friendly", label: "Dyslexia-friendly recap" },
  { value: "hearing support", label: "Hearing support" },
  { value: "mobility-aware", label: "Mobility-aware pickup" },
  { value: "non-judgemental disclosure", label: "Private disclosure support" }
];

const goalOptions = [
  { value: "night", label: "Night driving", icon: Moon },
  { value: "motorway", label: "Motorway driving", icon: CarFront },
  { value: "pass plus", label: "Pass Plus", icon: Star },
  { value: "refresher", label: "Refresher lessons", icon: Brain },
  { value: "parking", label: "Parking", icon: CarFront },
  { value: "roundabouts", label: "Roundabouts", icon: Sparkles },
  { value: "advanced", label: "Advanced coaching", icon: Star }
];

const lessonPreferenceOptions = [
  { value: "written recap", label: "Written recap" },
  { value: "visual prompts", label: "Visual prompts" },
  { value: "predictable lesson structure", label: "Predictable structure" },
  { value: "quiet explanations", label: "Quiet explanations" },
  { value: "one-instruction-at-a-time", label: "One instruction at a time" },
  { value: "pre-lesson written plan", label: "Plan before lesson" }
];

export function SmartMatchExperience() {
  const [input, setInput] = useState<SmartMatchInput>({
    postcode: "EN5",
    budgetPence: 4200,
    transmission: "either",
    availability: "flexible",
    confidence: "nervous",
    lessonStage: "new",
    learningSupport: ["anxiety"],
    lessonPreferences: ["written recap"],
    goals: ["parking"],
    disclosureConsent: false
  });
  const [result, setResult] = useState<SmartMatchResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function runMatch() {
    setLoading(true);
    const response = await fetch("/api/smart-match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    });
    const data = (await response.json()) as SmartMatchResult;
    setResult(data);
    setLoading(false);
  }

  function toggleArray(key: "learningSupport" | "goals", value: string) {
    setInput((current) => {
      const values = current[key] ?? [];
      return {
        ...current,
        [key]: values.includes(value) ? values.filter((item) => item !== value) : [...values, value]
      };
    });
  }

  function togglePreference(value: string) {
    setInput((current) => {
      const values = current.lessonPreferences ?? [];
      return {
        ...current,
        lessonPreferences: values.includes(value) ? values.filter((item) => item !== value) : [...values, value]
      };
    });
  }

  return (
    <section className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[420px_1fr] lg:px-8">
      <aside className="rounded border border-zinc-800 bg-zinc-950 p-5 text-white shadow-sm">
        <div className="flex items-center gap-2 text-sm font-black uppercase text-brand">
          <Brain size={16} /> Adaptive learner profile
        </div>
        <div className="mt-5 grid gap-4">
          <label className="grid gap-1">
            <span className="text-xs font-black uppercase text-zinc-400">Area or postcode</span>
            <input value={input.postcode ?? ""} onChange={(event) => setInput({ ...input, postcode: event.target.value.toUpperCase() })} className="rounded border border-zinc-800 bg-black px-3 py-3 text-sm font-bold text-white" />
          </label>
          <label className="grid gap-2">
            <span className="text-xs font-black uppercase text-zinc-400">Max lesson price: {formatMoney(input.budgetPence ?? 4200)}/hr</span>
            <input type="range" min="3000" max="6000" step="100" value={input.budgetPence ?? 4200} onChange={(event) => setInput({ ...input, budgetPence: Number(event.target.value) })} className="accent-red-600" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1">
              <span className="text-xs font-black uppercase text-zinc-400">Transmission</span>
              <select value={input.transmission} onChange={(event) => setInput({ ...input, transmission: event.target.value as SmartMatchInput["transmission"] })} className="rounded border border-zinc-800 bg-black px-3 py-3 text-sm font-bold text-white">
                <option value="either">Either</option>
                <option value="automatic">Automatic</option>
                <option value="manual">Manual</option>
              </select>
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-black uppercase text-zinc-400">Confidence</span>
              <select value={input.confidence} onChange={(event) => setInput({ ...input, confidence: event.target.value as SmartMatchInput["confidence"] })} className="rounded border border-zinc-800 bg-black px-3 py-3 text-sm font-bold text-white">
                <option value="nervous">Nervous</option>
                <option value="some">Some experience</option>
                <option value="confident">Confident</option>
              </select>
            </label>
          </div>
          <label className="grid gap-1">
            <span className="text-xs font-black uppercase text-zinc-400">Availability</span>
            <select value={input.availability} onChange={(event) => setInput({ ...input, availability: event.target.value as SmartMatchInput["availability"] })} className="rounded border border-zinc-800 bg-black px-3 py-3 text-sm font-bold text-white">
              <option value="asap">As soon as possible</option>
              <option value="weekdays">Weekdays</option>
              <option value="evenings">Evenings</option>
              <option value="weekends">Weekends</option>
              <option value="flexible">Flexible</option>
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-black uppercase text-zinc-400">What stage are you at?</span>
            <select value={input.lessonStage} onChange={(event) => setInput({ ...input, lessonStage: event.target.value as SmartMatchInput["lessonStage"] })} className="rounded border border-zinc-800 bg-black px-3 py-3 text-sm font-bold text-white">
              <option value="new">New learner</option>
              <option value="test-soon">Test coming soon</option>
              <option value="refresher">Refresher lessons</option>
              <option value="returning">Returning after time off road</option>
              <option value="post-pass">Post-pass development</option>
            </select>
          </label>
          <div>
            <div className="text-xs font-black uppercase text-zinc-400">Support preferences</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {supportOptions.map((option) => (
                <button key={option.value} type="button" onClick={() => toggleArray("learningSupport", option.value)} className={`rounded-full border px-3 py-2 text-xs font-black ${input.learningSupport?.includes(option.value) ? "border-brand bg-brand text-white" : "border-zinc-800 bg-black text-zinc-300"}`}>
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs font-black uppercase text-zinc-400">How should lessons be adapted?</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {lessonPreferenceOptions.map((option) => (
                <button key={option.value} type="button" onClick={() => togglePreference(option.value)} className={`rounded-full border px-3 py-2 text-xs font-black ${input.lessonPreferences?.includes(option.value) ? "border-brand bg-brand text-white" : "border-zinc-800 bg-black text-zinc-300"}`}>
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs font-black uppercase text-zinc-400">Goals</div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {goalOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <button key={option.value} type="button" onClick={() => toggleArray("goals", option.value)} className={`inline-flex items-center gap-2 rounded border px-3 py-2 text-xs font-black ${input.goals?.includes(option.value) ? "border-brand bg-brand text-white" : "border-zinc-800 bg-black text-zinc-300"}`}>
                    <Icon size={15} /> {option.label}
                  </button>
                );
              })}
            </div>
          </div>
          <label className="grid gap-1">
            <span className="text-xs font-black uppercase text-zinc-400">Anything LDA should adapt around?</span>
            <textarea value={input.notes ?? ""} onChange={(event) => setInput({ ...input, notes: event.target.value })} rows={4} className="rounded border border-zinc-800 bg-black px-3 py-3 text-sm font-bold text-white" placeholder="Example: I get overwhelmed at busy roundabouts, prefer written steps, or need a calmer first lesson." />
          </label>
          <label className="flex items-start gap-3 rounded border border-zinc-800 bg-black p-3 text-sm font-bold leading-6 text-zinc-300">
            <input
              checked={Boolean(input.disclosureConsent)}
              onChange={(event) => setInput({ ...input, disclosureConsent: event.target.checked })}
              type="checkbox"
              className="mt-1"
            />
            I am happy for LDA to share my selected support preferences with my chosen instructor after I book.
          </label>
          <button onClick={runMatch} className="lda-pill w-full" disabled={loading}>
            <Sparkles size={18} /> {loading ? "Building match..." : "Run LDA SmartMatch"}
          </button>
        </div>
      </aside>

      <section className="grid gap-5">
        <article className="rounded border border-zinc-800 bg-zinc-950 p-5 text-white shadow-sm">
          <div className="flex items-center gap-2 text-sm font-black uppercase text-brand">
            <Accessibility size={16} /> Exclusive LDA matching engine
          </div>
          <h2 className="mt-3 text-3xl font-black">Less thinking, better fit.</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">
            SmartMatch scores approved instructors against price, distance, reviews, ADI/PDI status, special skills, night-driving ability, Pass Plus and motorway routes, confidence needs, hidden disability support, and accessibility preferences. It then turns that into a plain-English lesson plan.
          </p>
        </article>

        {result ? (
          <>
            <article className="rounded border border-red-500/30 bg-red-500/10 p-5 text-red-50">
              <h3 className="text-2xl font-black">{result.summary}</h3>
              <div className="mt-4 grid gap-2">
                {result.plan.map((step) => (
                  <div key={step} className="flex items-start gap-3 text-sm font-bold leading-6">
                    <CheckCircle2 className="mt-0.5 shrink-0" size={18} /> {step}
                  </div>
                ))}
              </div>
            </article>
            <div className="grid gap-4 xl:grid-cols-2">
              <article className="rounded border border-zinc-800 bg-zinc-950 p-5 text-white">
                <div className="text-sm font-black uppercase text-brand">Private learner support plan</div>
                <div className="mt-4 grid gap-2">
                  {result.accessibilityPlan.map((step) => (
                    <div key={step} className="flex items-start gap-3 text-sm font-bold leading-6 text-zinc-300">
                      <CheckCircle2 className="mt-0.5 shrink-0 text-brand" size={17} /> {step}
                    </div>
                  ))}
                </div>
              </article>
              <article className="rounded border border-zinc-800 bg-zinc-950 p-5 text-white">
                <div className="text-sm font-black uppercase text-brand">Exclusive to LDA</div>
                <div className="mt-4 grid gap-2">
                  {result.ldaExclusive.map((item) => (
                    <div key={item} className="rounded border border-zinc-800 bg-black p-3 text-sm font-bold leading-6 text-zinc-300">
                      {item}
                    </div>
                  ))}
                </div>
              </article>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              {result.matches.map((match) => (
                <article key={match.id} className="rounded border border-zinc-800 bg-zinc-950 p-5 text-white">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-black uppercase text-brand">{match.matchScore}% match</div>
                      <h3 className="mt-1 text-2xl font-black">{match.name}</h3>
                      <p className="mt-1 text-sm font-bold text-zinc-400">{match.badge} · {match.transmission} · {formatMoney(match.pricePence)}/hr · {match.distanceMiles} miles</p>
                    </div>
                    <div className="rounded bg-red-500/10 px-3 py-2 text-sm font-black text-brand">{match.rating} stars</div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-zinc-400">{match.teachingStyle}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {[...match.reasons, ...match.qualifications, ...match.lessonAdaptations, ...match.postPassTags].slice(0, 9).map((reason) => (
                      <span key={reason} className="rounded-full border border-zinc-800 bg-black px-3 py-1 text-xs font-bold text-zinc-300">{reason}</span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : (
          <article className="rounded border border-zinc-800 bg-zinc-950 p-8 text-white">
            <h3 className="text-2xl font-black">Press Run LDA SmartMatch to see the adaptive result.</h3>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
              The first version runs as a transparent rules engine. Later, we can connect verified review data, instructor calendar supply, accessibility notes, and AI explanations once the live database has enough real usage.
            </p>
          </article>
        )}
      </section>
    </section>
  );
}
