"use client";

import { useMemo, useState } from "react";
import { BookOpenCheck, CarFront, Clock3, PlayCircle, Search, ShieldCheck, SlidersHorizontal } from "lucide-react";

type FadePlan = {
  id: string;
  label: string;
  summary: string;
  videoCount: number;
  practice: string;
  focus: string[];
};

const fadePlans: FadePlan[] = [
  {
    id: "six-months",
    label: "Off the road 6 months",
    summary: "Usually a light confidence reset. Start with rules, mirrors, road position, and low-pressure junction practice.",
    videoCount: 4,
    practice: "Book 1 refresher lesson or a quiet-road assessment before busy traffic.",
    focus: ["Mirror routine and blind spots", "Road positioning", "Speed matching", "Junction priorities"]
  },
  {
    id: "one-year",
    label: "Off the road 1 year",
    summary: "Expect some skill fade in anticipation and decision timing, especially around roundabouts, cyclists, pedestrians, and complex junctions.",
    videoCount: 7,
    practice: "Book 1 to 2 refresher lessons, including town driving and parking.",
    focus: ["Hazard perception", "Roundabouts", "Parking and reversing", "Highway Code updates", "Vulnerable road users"]
  },
  {
    id: "two-years",
    label: "Off the road 2 years",
    summary: "Treat this as a structured rebuild. Cognitive skills and multi-step decisions normally need more practice than basic controls.",
    videoCount: 10,
    practice: "Book 2 to 4 refresher lessons before independent driving.",
    focus: ["Hazard anticipation", "Lane discipline", "Dual carriageways", "Emergency planning", "Night or poor-weather driving"]
  },
  {
    id: "over-two-years",
    label: "Off the road 2+ years",
    summary: "Assume meaningful skill fade until checked. Rebuild from quiet roads to complex traffic, then motorway or high-speed routes.",
    videoCount: 14,
    practice: "Book a full instructor assessment and phased refresher plan.",
    focus: ["Vehicle control", "Scanning patterns", "Complex junctions", "Motorway confidence", "Updated rules and signs"]
  }
];

const videoTopics = [
  {
    title: "Hazard perception refresh",
    category: "Hazards",
    reason: "Hazard anticipation is safety critical and research links it with crash risk and driver experience.",
    query: "UK hazard perception driving refresher"
  },
  {
    title: "Roundabouts and junction priorities",
    category: "Junctions",
    reason: "Decision timing fades quickly when you have not practised multi-step traffic situations.",
    query: "UK driving lesson roundabouts junction priority"
  },
  {
    title: "Road positioning and lane discipline",
    category: "Control",
    reason: "Driving inactivity research points to deterioration in lateral positioning control.",
    query: "UK driving lesson lane discipline road positioning"
  },
  {
    title: "Parking, reversing, and manoeuvres",
    category: "Manoeuvres",
    reason: "Low-speed control needs repetition because it combines observation, steering, clutch or brake control, and judgement.",
    query: "UK driving refresher parking reversing manoeuvres"
  },
  {
    title: "Cyclists, pedestrians, and safe passing",
    category: "Highway Code",
    reason: "The Highway Code hierarchy puts greater responsibility on drivers to reduce risk to vulnerable road users.",
    query: "Highway Code hierarchy cyclists pedestrians safe passing drivers"
  },
  {
    title: "Wales 20mph and speed-limit refresh",
    category: "Road rules",
    reason: "Speed-limit rules and signage can change while a driver is away from the road.",
    query: "UK Highway Code speed limits Wales 20mph driving"
  },
  {
    title: "Motorway confidence after a break",
    category: "Confidence",
    reason: "Higher-speed merging, spacing, and lane planning should come after town-road basics feel calm again.",
    query: "UK motorway driving refresher lesson confidence"
  },
  {
    title: "Driving anxiety after time away",
    category: "Confidence",
    reason: "Confidence affects observation, speed choice, and the amount of mental load available for hazard detection.",
    query: "driving anxiety refresher lessons UK"
  }
];

const ruleUpdates = [
  "Hierarchy of road users: drivers of vehicles that can cause greater harm carry greater responsibility.",
  "Pedestrians crossing or waiting at junctions need more priority awareness from turning traffic.",
  "Cyclists going straight ahead have priority when drivers are turning across them.",
  "Safe passing guidance includes at least 1.5 metres for cyclists at up to 30mph and more at higher speeds.",
  "The Highway Code added self-driving vehicle guidance in 2022.",
  "Mobile phone rules were clarified in 2022 to cover more hand-held interactive device use.",
  "Wales changed the national built-up-area default speed limit from 30mph to 20mph in 2023.",
  "In 2025, official Highway Code updates included traffic-sign and Scotland parking clarifications."
];

export function RoadworthyGuide() {
  const [selectedPlan, setSelectedPlan] = useState(fadePlans[1]);
  const [query, setQuery] = useState("");

  const filteredTopics = useMemo(() => {
    const normalised = query.trim().toLowerCase();
    if (!normalised) {
      return videoTopics;
    }

    return videoTopics.filter((topic) =>
      [topic.title, topic.category, topic.reason, topic.query].some((value) => value.toLowerCase().includes(normalised))
    );
  }, [query]);

  const recommendedTopics = useMemo(() => {
    const focusText = selectedPlan.focus.join(" ").toLowerCase();
    return videoTopics.filter((topic) => focusText.includes(topic.category.toLowerCase()) || focusText.includes(topic.title.split(" ")[0].toLowerCase())).slice(0, 4);
  }, [selectedPlan]);

  const youtubeSearch = `https://www.youtube.com/results?search_query=${encodeURIComponent(`UK driving refresher ${query || selectedPlan.focus.join(" ")}`)}`;

  return (
    <div className="grid gap-8">
      <section className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <aside className="rounded border border-zinc-800 bg-zinc-950 p-5 text-white">
          <div className="flex items-center gap-2 text-sm font-black uppercase text-brand">
            <SlidersHorizontal size={16} /> Skill fade selector
          </div>
          <h2 className="mt-3 text-2xl font-black">How long have you been off the road?</h2>
          <div className="mt-5 grid gap-3">
            {fadePlans.map((plan) => (
              <button
                key={plan.id}
                className={`lda-pill lda-pill-sm lda-pill-wide ${selectedPlan.id === plan.id ? "border-red-400 text-white" : ""}`}
                onClick={() => setSelectedPlan(plan)}
                type="button"
              >
                {plan.label}
              </button>
            ))}
          </div>
        </aside>

        <section className="rounded border border-zinc-800 bg-black p-5 text-white">
          <div className="flex items-center gap-2 text-sm font-black uppercase text-brand">
            <ShieldCheck size={16} /> Suggested refresh route
          </div>
          <h2 className="mt-3 text-3xl font-black">{selectedPlan.label}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-300">{selectedPlan.summary}</p>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <Metric label="Recommended videos" value={`${selectedPlan.videoCount}`} />
            <Metric label="Instructor check" value={selectedPlan.practice} />
            <Metric label="Priority" value="Rebuild confidence before speed" />
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {selectedPlan.focus.map((item) => (
              <div key={item} className="rounded border border-zinc-800 bg-zinc-950 p-3 text-sm font-bold text-zinc-200">
                {item}
              </div>
            ))}
          </div>
        </section>
      </section>

      <section className="rounded border border-zinc-800 bg-zinc-950 p-5 text-white">
        <div className="flex items-center gap-2 text-sm font-black uppercase text-brand">
          <Search size={16} /> Video search
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
          <input
            className="rounded border border-zinc-800 bg-black px-4 py-4 text-white placeholder:text-zinc-600"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search: roundabouts, parking, hazard perception, motorway..."
            value={query}
          />
          <a className="lda-pill" href={youtubeSearch} rel="noreferrer" target="_blank">
            <PlayCircle size={18} /> Search videos
          </a>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {(query ? filteredTopics : recommendedTopics.length ? recommendedTopics : videoTopics).map((topic) => (
            <article key={topic.title} className="rounded border border-zinc-800 bg-black p-4">
              <div className="text-xs font-black uppercase text-brand">{topic.category}</div>
              <h3 className="mt-2 text-xl font-black">{topic.title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-400">{topic.reason}</p>
              <a
                className="lda-pill lda-pill-sm mt-4"
                href={`https://www.youtube.com/results?search_query=${encodeURIComponent(topic.query)}`}
                rel="noreferrer"
                target="_blank"
              >
                Find clips
              </a>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1fr_420px]">
        <div className="rounded border border-zinc-800 bg-zinc-950 p-5 text-white">
          <div className="flex items-center gap-2 text-sm font-black uppercase text-brand">
            <CarFront size={16} /> What fades first
          </div>
          <div className="mt-4 grid gap-3">
            {[
              "Hazard anticipation and scanning, because it is a complex judgement skill built through exposure.",
              "Road positioning and lane control, especially after long driving inactivity.",
              "Junction timing, roundabout planning, and vulnerable-road-user decisions.",
              "Parking and reversing, because they combine observation, steering, spacing, and low-speed control.",
              "Rule memory, because Highway Code updates can happen while a driver is away from the road."
            ].map((item) => (
              <div key={item} className="flex gap-3 rounded border border-zinc-800 bg-black p-4">
                <BookOpenCheck className="mt-0.5 shrink-0 text-brand" size={18} />
                <p className="text-sm leading-6 text-zinc-300">{item}</p>
              </div>
            ))}
          </div>
        </div>

        <aside className="rounded border border-zinc-800 bg-black p-5 text-white">
          <div className="flex items-center gap-2 text-sm font-black uppercase text-brand">
            <Clock3 size={16} /> Rule refresh
          </div>
          <div className="mt-4 grid gap-3">
            {ruleUpdates.map((update) => (
              <div key={update} className="rounded bg-zinc-950 p-3 text-sm font-bold leading-6 text-zinc-300">
                {update}
              </div>
            ))}
          </div>
        </aside>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-950 p-4">
      <div className="text-xs font-black uppercase text-zinc-500">{label}</div>
      <div className="mt-2 text-sm font-black leading-6 text-white">{value}</div>
    </div>
  );
}
