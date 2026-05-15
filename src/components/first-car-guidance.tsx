"use client";

import { useMemo, useState } from "react";
import { BadgePoundSterling, CarFront, CheckCircle2, ExternalLink, ShieldCheck, Sparkles, Star, Wrench } from "lucide-react";

const carShortlist = [
  { make: "Toyota", model: "Yaris", budget: "£6k-£11k", insurance: "Low-medium", safety: 5, seller: "Approved dealer friendly", why: "Reliable, easy to park, strong safety history, sensible first-car running costs." },
  { make: "Hyundai", model: "i10", budget: "£5k-£10k", insurance: "Low", safety: 4, seller: "Franchise and independent", why: "Small, economical, good visibility, simple controls for new drivers." },
  { make: "Volkswagen", model: "Polo", budget: "£7k-£13k", insurance: "Medium", safety: 5, seller: "Approved used common", why: "Stable motorway feel, strong build, broad parts support." },
  { make: "Ford", model: "Fiesta", budget: "£5k-£12k", insurance: "Low-medium", safety: 4, seller: "Large UK used market", why: "Easy to source, familiar to many instructors, affordable servicing." }
];

const viewingChecks = ["V5C logbook and MOT history", "Insurance group and annual tax", "Tyres, brakes, lights, and warning lights", "Service history and spare key", "Trusted seller reviews", "Test drive comfort and visibility"];

export function FirstCarGuidance() {
  const [passDate, setPassDate] = useState("");
  const [budget, setBudget] = useState(9000);
  const [priority, setPriority] = useState("insurance");

  const recommendedCars = useMemo(() => {
    if (priority === "safety") return [...carShortlist].sort((a, b) => b.safety - a.safety);
    if (budget < 7000) return carShortlist.filter((car) => car.budget.includes("£5k") || car.budget.includes("£6k"));
    return carShortlist;
  }, [budget, priority]);

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <aside className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
          <Sparkles className="text-brand" />
          <h2 className="mt-4 text-2xl font-black">First-car profile</h2>
          <label className="mt-5 grid gap-2 text-sm font-black text-zinc-700">
            Date you passed
            <input type="date" value={passDate} onChange={(event) => setPassDate(event.target.value)} className="rounded border border-zinc-300 px-3 py-3 text-black" />
          </label>
          <label className="mt-4 grid gap-2 text-sm font-black text-zinc-700">
            Budget: £{budget.toLocaleString("en-GB")}
            <input type="range" min="3000" max="20000" step="500" value={budget} onChange={(event) => setBudget(Number(event.target.value))} className="accent-red-600" />
          </label>
          <label className="mt-4 grid gap-2 text-sm font-black text-zinc-700">
            Priority
            <select value={priority} onChange={(event) => setPriority(event.target.value)} className="rounded border border-zinc-300 px-3 py-3 text-black">
              <option value="insurance">Lowest insurance pressure</option>
              <option value="safety">Safety rating first</option>
              <option value="running">Running costs</option>
            </select>
          </label>
          <p className="mt-5 text-sm font-semibold leading-6 text-zinc-600">
            Live AutoTrader-style stock needs a vehicle marketplace API or affiliate feed. This page is ready to connect once LDA has supplier access.
          </p>
          <a href="https://www.autotrader.co.uk/" target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 text-sm font-black text-brand underline decoration-brand decoration-2 underline-offset-4">
            Open AutoTrader <ExternalLink size={16} />
          </a>
        </aside>

        <div className="grid gap-5">
          <article className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <CarFront className="text-brand" />
              <h2 className="text-2xl font-black">LDA first-car shortlist</h2>
            </div>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {recommendedCars.map((car) => (
                <div key={`${car.make}-${car.model}`} className="rounded border border-zinc-200 bg-zinc-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-black">{car.make} {car.model}</h3>
                      <p className="mt-2 text-sm font-semibold leading-6 text-zinc-600">{car.why}</p>
                    </div>
                    <div className="rounded bg-red-50 px-3 py-1 text-xs font-black text-brand">{car.budget}</div>
                  </div>
                  <div className="mt-4 grid gap-2 text-sm font-bold text-zinc-700">
                    <span className="flex items-center gap-2"><BadgePoundSterling className="text-brand" size={16} /> Insurance: {car.insurance}</span>
                    <span className="flex items-center gap-2"><ShieldCheck className="text-brand" size={16} /> Safety signal: {car.safety}/5</span>
                    <span className="flex items-center gap-2"><Star className="text-brand" size={16} /> Seller signal: {car.seller}</span>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <Wrench className="text-brand" />
              <h2 className="text-2xl font-black">Viewing checklist</h2>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {viewingChecks.map((check) => (
                <div key={check} className="flex items-start gap-2 rounded border border-zinc-200 bg-zinc-50 p-3 text-sm font-bold text-zinc-700">
                  <CheckCircle2 className="mt-0.5 shrink-0 text-brand" size={16} />
                  {check}
                </div>
              ))}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
