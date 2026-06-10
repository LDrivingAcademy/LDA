"use client";

import { FormEvent, useEffect, useState } from "react";
import { AlertTriangle, Bot, Brain, CarFront, ChevronDown, Minimize2, RotateCcw, Send, Sparkles, Wrench } from "lucide-react";

type VehicleAiResponse = {
  answer: string;
  nextSteps: string[];
  mode: "demo" | "live";
  safetyCritical: boolean;
  topics: string[];
};

type VehicleRole = "learner" | "instructor" | "visitor";
type VehicleType = "manual" | "automatic" | "electric" | "hybrid" | "unknown";
type ConfidenceLevel = "new" | "building" | "confident";

type AdaptiveProfile = {
  confidence: ConfidenceLevel;
  preferredRole: VehicleRole;
  preferredVehicle: VehicleType;
  questionCount: number;
  recurringTopics: Record<string, number>;
  lastQuestions: string[];
};

const adaptiveProfileKey = "lda.vehicle-ai.profile.v1";

const defaultAdaptiveProfile: AdaptiveProfile = {
  confidence: "building",
  preferredRole: "learner",
  preferredVehicle: "manual",
  questionCount: 0,
  recurringTopics: {},
  lastQuestions: []
};

const quickPrompts = [
  "What does this dashboard warning light mean?",
  "How do I stop stalling in a manual car?",
  "What checks should I do before a lesson?",
  "How should an instructor track vehicle compliance?"
];

const roleOptions: { label: string; value: VehicleRole }[] = [
  { label: "Learner", value: "learner" },
  { label: "Instructor", value: "instructor" },
  { label: "Visitor", value: "visitor" }
];

const vehicleOptions: { label: string; value: VehicleType }[] = [
  { label: "Manual", value: "manual" },
  { label: "Automatic", value: "automatic" },
  { label: "Electric", value: "electric" },
  { label: "Hybrid", value: "hybrid" },
  { label: "Not sure", value: "unknown" }
];

const safetyPattern =
  /\b(brake|brakes|steering|tyre blowout|flat tyre|smoke|burning|overheat|overheating|engine light|warning light|red light|airbag|abs|crash|accident|fuel leak|oil leak|no control|unsafe|danger|dangerous)\b/i;
const transmissionPattern = /\b(clutch|gear|gears|bite point|stall|stalling|hill start|automatic|manual|paddle|transmission|neutral|park|drive)\b/i;
const checksPattern = /\b(show me|tell me|cockpit|mirrors|blind spot|oil|coolant|washer|lights|horn|demister|wipers|brake fluid|tyre pressure)\b/i;
const evPattern = /\b(electric|ev|hybrid|battery|charging|regen|regenerative|range|charge)\b/i;
const compliancePattern = /\b(mot|tax|insurance|service|servicing|adi|pdi|licence|license|expiry|compliance|maintenance|defect|record)\b/i;

function readAdaptiveProfile() {
  if (typeof window === "undefined") {
    return defaultAdaptiveProfile;
  }

  try {
    const saved = window.localStorage.getItem(adaptiveProfileKey);
    if (!saved) {
      return defaultAdaptiveProfile;
    }

    const parsed = JSON.parse(saved) as Partial<AdaptiveProfile>;
    return {
      ...defaultAdaptiveProfile,
      ...parsed,
      recurringTopics: parsed.recurringTopics ?? {},
      lastQuestions: parsed.lastQuestions ?? []
    };
  } catch {
    return defaultAdaptiveProfile;
  }
}

function saveAdaptiveProfile(profile: AdaptiveProfile) {
  try {
    window.localStorage.setItem(adaptiveProfileKey, JSON.stringify(profile));
  } catch {
    // If local storage is unavailable, the assistant still works without memory.
  }
}

function classify(question: string) {
  const topics = [];
  if (safetyPattern.test(question)) topics.push("Safety");
  if (transmissionPattern.test(question)) topics.push("Transmission");
  if (checksPattern.test(question)) topics.push("Vehicle checks");
  if (evPattern.test(question)) topics.push("EV or hybrid");
  if (compliancePattern.test(question)) topics.push("Compliance");
  return topics.length ? [...new Set(topics)] : ["Vehicle guidance"];
}

function confidenceCopy(confidence: ConfidenceLevel) {
  if (confidence === "new") {
    return "I’ll keep this step-by-step because your profile is set to new/confidence-building.";
  }

  if (confidence === "confident") {
    return "I’ll keep this sharper and more operational because your profile is set to confident.";
  }

  return "I’ll keep this practical and coached because your profile is still building confidence.";
}

function strongestMemory(profile: AdaptiveProfile) {
  const [topic] = Object.entries(profile.recurringTopics).sort((first, second) => second[1] - first[1])[0] ?? [];
  return topic;
}

function adaptiveIntro(profile: AdaptiveProfile, topics: string[]) {
  const strongestTopic = strongestMemory(profile);
  const memoryLine = strongestTopic
    ? `I can see you have asked most about ${strongestTopic.toLowerCase()}, so I’ll connect this answer back to that pattern.`
    : "I’ll start building your vehicle profile from this question.";
  const topicLine = topics.length ? `Current focus: ${topics.join(", ")}.` : "";

  return `${confidenceCopy(profile.confidence)} ${memoryLine} ${topicLine}`.trim();
}

function buildVehicleResponse(role: VehicleRole, vehicleType: VehicleType, situation: string, question: string, profile: AdaptiveProfile): VehicleAiResponse {
  const combinedQuestion = `${situation} ${question}`;
  const roleLabel = role === "instructor" ? "instructor" : role === "learner" ? "learner" : "driver";
  const vehicleLabel = vehicleType === "unknown" ? "vehicle" : vehicleType;
  const safetyCritical = safetyPattern.test(combinedQuestion);
  const topics = classify(combinedQuestion);
  const intro = adaptiveIntro(profile, topics);

  if (safetyCritical) {
    return {
      answer:
        `${intro}\n\nThis sounds safety-related. Do not continue driving if the vehicle feels unsafe, has braking or steering issues, visible smoke, a serious warning light, a tyre problem, or a fluid leak. Stop somewhere safe if you are already moving, switch on hazard lights if needed, and contact your instructor, recovery provider, garage, or emergency services depending on the situation.`,
      nextSteps: [
        "Treat red warning lights, brake faults, steering faults, smoke, overheating, and tyre failures as stop-driving issues.",
        "Take a photo of the warning or defect only when parked safely.",
        roleLabel === "instructor"
          ? "Record the defect in your LDA vehicle compliance log before accepting more lessons."
          : "Tell your instructor what happened before booking or continuing the next lesson."
      ],
      mode: "demo",
      safetyCritical,
      topics
    };
  }

  if (transmissionPattern.test(combinedQuestion)) {
    const manualAdvice =
      "For a manual car, think in this order: clutch fully down, choose the right gear, find the bite point gently, add light gas, check mirrors and surroundings, then release smoothly. If you stall, secure the car, restart calmly, and reset the same sequence.";
    const automaticAdvice =
      "For an automatic, focus on smooth brake control, correct selector use, creep control, safe observation, and avoiding left-foot braking unless your instructor has specifically trained you that way.";

    return {
      answer:
        vehicleType === "automatic" || vehicleType === "electric" || vehicleType === "hybrid"
          ? `${intro}\n\n${automaticAdvice}`
          : `${intro}\n\n${manualAdvice} If you are in an automatic or EV, the key habit changes from clutch control to brake, selector, speed, and observation control.`,
      nextSteps: [
        "Ask your instructor to isolate the skill for five minutes before using it in traffic.",
        "Practise the same routine out loud until the order feels automatic.",
        "If the car jumps, stalls repeatedly, or makes unusual noises, pause and ask for an instructor check."
      ],
      mode: "demo",
      safetyCritical,
      topics
    };
  }

  if (checksPattern.test(combinedQuestion)) {
    return {
      answer:
        `${intro}\n\nFor UK learner driving, vehicle confidence comes from repeatable checks: seating and belt, mirrors, blind spots, lights, tyres, fluids, demisters, wipers, horn, and warning lights. For show-me/tell-me style questions, learn what the control does, when to use it, and how to check it without taking attention away from the road.`,
      nextSteps: [
        "Use the cockpit drill before every lesson: doors, seat, belt, mirrors, controls.",
        "Ask your instructor to link each check to a real driving situation, not just a memorised answer.",
        "Keep a short list of controls you still hesitate on and review it before your next booking."
      ],
      mode: "demo",
      safetyCritical,
      topics
    };
  }

  if (evPattern.test(combinedQuestion)) {
    return {
      answer:
        `${intro}\n\nFor EVs and hybrids, the big learning differences are smoother acceleration, regenerative braking, range planning, charging awareness, and understanding that the car may move or respond very quietly. Treat the silence as a reason to be more observant around pedestrians, cyclists, and car parks.`,
      nextSteps: [
        "Ask how regenerative braking changes the feel of slowing down.",
        "Check the vehicle range and charging plan before longer lessons.",
        "Practise low-speed control in a quiet area because EV torque can feel immediate."
      ],
      mode: "demo",
      safetyCritical,
      topics
    };
  }

  if (compliancePattern.test(combinedQuestion)) {
    return {
      answer:
        roleLabel === "instructor"
          ? `${intro}\n\nFor instructor use, vehicle compliance should stay visible before lessons: MOT, tax, insurance, servicing, tyres, lights, registration status, defects, and expiry reminders. LDA should be your operating record so a lesson is never accepted with a compliance gap.`
          : `${intro}\n\nFor learners, you do not need to manage the instructor vehicle compliance record, but you should feel confident the car is roadworthy. If you notice a defect, warning light, tyre issue, or anything unsafe, ask the instructor before driving.`,
      nextSteps: [
        roleLabel === "instructor" ? "Update the vehicle compliance page after any service, MOT, insurance, or defect event." : "Raise any vehicle concern before the lesson starts.",
        "Never ignore a warning light just because the lesson is already booked.",
        "Keep photos or documents only where LDA asks for them and avoid sharing unnecessary personal data."
      ],
      mode: "demo",
      safetyCritical,
      topics
    };
  }

  return {
    answer:
      `${intro}\n\nFor a ${roleLabel} using a ${vehicleLabel}, the safest way to learn a vehicle topic is to split it into three parts: what the control or system does, when it matters during a lesson, and what action to take if something feels wrong. I can help with manual or automatic control, EV and hybrid driving, warning lights, cockpit checks, show-me/tell-me questions, tyres, brakes, fluids, MOT, tax, insurance, and instructor compliance records.`,
    nextSteps: [
      "Ask one specific question at a time for a sharper answer.",
      "Include the car type, warning light colour, lesson situation, and whether the vehicle is moving or parked.",
      "If the issue could affect braking, steering, tyres, smoke, overheating, or visibility, stop and treat it as safety-critical."
    ],
    mode: "demo",
    safetyCritical,
    topics
  };
}

function updateAdaptiveProfile(profile: AdaptiveProfile, role: VehicleRole, vehicleType: VehicleType, question: string, topics: string[]) {
  const recurringTopics = { ...profile.recurringTopics };
  topics.forEach((topic) => {
    recurringTopics[topic] = (recurringTopics[topic] ?? 0) + 1;
  });

  return {
    ...profile,
    preferredRole: role,
    preferredVehicle: vehicleType,
    questionCount: profile.questionCount + 1,
    recurringTopics,
    lastQuestions: [question.trim(), ...profile.lastQuestions].filter(Boolean).slice(0, 3)
  };
}

export function VehicleAiAssistant({ variant = "floating" }: { variant?: "floating" | "inline" }) {
  const [isOpen, setIsOpen] = useState(variant === "inline");
  const [role, setRole] = useState<VehicleRole>("learner");
  const [vehicleType, setVehicleType] = useState<VehicleType>("manual");
  const [situation, setSituation] = useState("");
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState<VehicleAiResponse | null>(null);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<AdaptiveProfile>(defaultAdaptiveProfile);

  useEffect(() => {
    const savedProfile = readAdaptiveProfile();
    setProfile(savedProfile);
    setRole(savedProfile.preferredRole);
    setVehicleType(savedProfile.preferredVehicle);
  }, []);

  useEffect(() => {
    saveAdaptiveProfile(profile);
  }, [profile]);

  function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResponse(null);

    if (question.trim().length < 3) {
      setError("Ask a vehicle question first.");
      return;
    }

    const nextResponse = buildVehicleResponse(role, vehicleType, situation, question, profile);
    const nextProfile = updateAdaptiveProfile(profile, role, vehicleType, question, nextResponse.topics);
    setResponse(nextResponse);
    setProfile(nextProfile);
  }

  function resetAdaptiveProfile() {
    setProfile(defaultAdaptiveProfile);
    setRole(defaultAdaptiveProfile.preferredRole);
    setVehicleType(defaultAdaptiveProfile.preferredVehicle);
    setResponse(null);
    setError("");
  }

  const panel = (
    <section className={`${variant === "floating" ? "max-h-[78vh] overflow-y-auto rounded border border-zinc-800 bg-zinc-950 shadow-2xl" : "rounded bg-black shadow-2xl"} p-4 text-white sm:p-5`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded bg-red-500/15 text-brand">
            <Bot size={23} />
          </div>
          <div>
            <div className="text-xs font-black uppercase text-red-200">LDA Vehicle AI</div>
            <h2 className="text-xl font-black leading-tight">Ask anything about the car.</h2>
          </div>
        </div>
        {variant === "floating" ? (
          <button
            type="button"
            aria-label="Minimise LDA Vehicle AI"
            onClick={() => setIsOpen(false)}
            className="grid h-9 w-9 shrink-0 place-items-center rounded border border-zinc-800 text-zinc-300 hover:border-red-500 hover:text-white"
          >
            <Minimize2 size={18} />
          </button>
        ) : null}
      </div>

      <p className="mt-3 text-sm font-semibold leading-6 text-zinc-300">
        Vehicle guidance for learners and instructors: gears, clutch, dashboard warnings, EVs, checks, MOT, insurance, safety, and compliance.
      </p>

      <div className="mt-4 rounded border border-zinc-800 bg-black p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase text-red-200">
              <Brain size={15} /> Adaptive profile
            </div>
            <p className="mt-2 text-xs font-semibold leading-5 text-zinc-400">
              {profile.questionCount
                ? `Learning from ${profile.questionCount} question${profile.questionCount === 1 ? "" : "s"}. Strongest focus: ${strongestMemory(profile) ?? "building profile"}.`
                : "No memory yet. Ask a question and LDA will begin tailoring this assistant to you."}
            </p>
          </div>
          <button
            type="button"
            onClick={resetAdaptiveProfile}
            className="grid h-8 w-8 shrink-0 place-items-center rounded border border-zinc-800 text-zinc-400 hover:border-red-500 hover:text-white"
            aria-label="Reset adaptive Vehicle AI profile"
          >
            <RotateCcw size={15} />
          </button>
        </div>
        <label className="mt-3 grid gap-1 text-xs font-black uppercase text-zinc-500">
          Confidence
          <select value={profile.confidence} onChange={(event) => setProfile({ ...profile, confidence: event.target.value as ConfidenceLevel })} className="rounded border border-zinc-700 bg-white px-3 py-2 text-sm font-black text-black">
            <option value="new">New / nervous</option>
            <option value="building">Building confidence</option>
            <option value="confident">Confident</option>
          </select>
        </label>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {quickPrompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => setQuestion(prompt)}
            className="rounded border border-zinc-800 bg-black px-3 py-3 text-left text-sm font-bold text-zinc-200 hover:border-red-500 hover:text-white"
          >
            {prompt}
          </button>
        ))}
      </div>

      <form onSubmit={submitQuestion} className="mt-4 grid gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-black uppercase text-zinc-400">
            Account type
            <select value={role} onChange={(event) => setRole(event.target.value as VehicleRole)} className="rounded border border-zinc-700 bg-white px-3 py-3 text-sm font-black text-black">
              {roleOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-black uppercase text-zinc-400">
            Vehicle
            <select value={vehicleType} onChange={(event) => setVehicleType(event.target.value as VehicleType)} className="rounded border border-zinc-700 bg-white px-3 py-3 text-sm font-black text-black">
              {vehicleOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>

        <input
          value={situation}
          onChange={(event) => setSituation(event.target.value)}
          placeholder="Situation, e.g. parked, lesson, test prep, warning light"
          className="rounded border border-zinc-700 bg-white px-3 py-3 text-sm font-bold text-black placeholder:text-zinc-500"
        />
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask about the vehicle, controls, transmission, warning lights, checks, or compliance"
          rows={variant === "floating" ? 4 : 5}
          className="rounded border border-zinc-700 bg-white px-3 py-3 text-sm font-bold text-black placeholder:text-zinc-500"
        />

        <button type="submit" className="lda-pill lda-pill-sm justify-center">
          Ask Vehicle AI <Send size={16} />
        </button>
      </form>

      {error ? (
        <p className="mt-4 rounded border border-red-500/40 bg-red-500/10 p-3 text-sm font-bold text-red-100">{error}</p>
      ) : null}

      {response ? (
        <article className="mt-4 rounded bg-white p-4 text-black">
          <div className="flex flex-wrap items-center gap-2 text-xs font-black uppercase text-zinc-500">
            {response.safetyCritical ? <AlertTriangle size={16} className="text-brand" /> : <Sparkles size={16} className="text-brand" />}
            {response.mode === "live" ? "AI response" : "Guided response"}
            {response.topics.map((topic) => (
              <span key={topic} className="rounded-full bg-zinc-100 px-2 py-1 text-[11px] text-zinc-700">{topic}</span>
            ))}
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-6 text-zinc-800">{response.answer}</p>
          {response.nextSteps.length ? (
            <div className="mt-4 rounded bg-zinc-100 p-4">
              <div className="flex items-center gap-2 text-sm font-black text-black">
                <Wrench size={17} className="text-brand" /> Action plan
              </div>
              <ul className="mt-2 grid gap-2 text-sm font-semibold leading-6 text-zinc-700">
                {response.nextSteps.map((step) => (
                  <li key={step} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </article>
      ) : null}

      <p className="mt-3 text-xs font-semibold leading-5 text-zinc-500">
        Vehicle AI is guidance only. If the car may be unsafe, stop safely and contact your instructor, garage, recovery provider, or emergency services.
      </p>
    </section>
  );

  if (variant === "inline") {
    return panel;
  }

  return (
    <div className="fixed bottom-5 left-5 z-50 w-[min(calc(100vw-2.5rem),430px)]">
      {isOpen ? (
        panel
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex max-w-full items-center gap-3 rounded-full border border-red-500/40 bg-black px-4 py-3 text-left text-white shadow-2xl transition hover:border-red-500 hover:ring-2 hover:ring-red-500/30"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand text-white">
            <CarFront size={22} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-black">LDA Vehicle AI</span>
            <span className="block truncate text-xs font-bold text-zinc-400">Ask about the car, safety, checks, or gears</span>
          </span>
          <ChevronDown className="-rotate-90 text-zinc-400" size={18} />
        </button>
      )}
    </div>
  );
}
