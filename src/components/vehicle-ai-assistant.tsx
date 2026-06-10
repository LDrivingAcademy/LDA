"use client";

import { FormEvent, useState } from "react";
import { AlertTriangle, Bot, CarFront, ChevronDown, Minimize2, Send, Sparkles, Wrench } from "lucide-react";

type VehicleAiResponse = {
  answer: string;
  nextSteps: string[];
  mode: "demo" | "live";
  safetyCritical: boolean;
  topics: string[];
};

type VehicleRole = "learner" | "instructor" | "visitor";
type VehicleType = "manual" | "automatic" | "electric" | "hybrid" | "unknown";

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

export function VehicleAiAssistant({ variant = "floating" }: { variant?: "floating" | "inline" }) {
  const [isOpen, setIsOpen] = useState(variant === "inline");
  const [role, setRole] = useState<VehicleRole>("learner");
  const [vehicleType, setVehicleType] = useState<VehicleType>("manual");
  const [situation, setSituation] = useState("");
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState<VehicleAiResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResponse(null);

    const apiResponse = await fetch("/api/vehicle-ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, vehicleType, situation, question })
    });

    const payload = await apiResponse.json();
    setLoading(false);

    if (!apiResponse.ok) {
      setError(payload.error || "Vehicle AI could not respond. Please try again.");
      return;
    }

    setResponse(payload);
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

        <button type="submit" disabled={loading} className="lda-pill lda-pill-sm justify-center disabled:cursor-wait disabled:opacity-70">
          {loading ? "Thinking..." : "Ask Vehicle AI"} <Send size={16} />
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
