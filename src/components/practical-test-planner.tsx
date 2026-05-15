"use client";

import { useMemo, useState } from "react";
import { BadgeCheck, CheckCircle2, ClipboardCheck, ExternalLink, MapPinned, Route, Sparkles, Target } from "lucide-react";

const readinessItems = [
  "Independent driving feels calm for 20 minutes",
  "Mirrors, signal, position, speed, and look routines are consistent",
  "Bay parking, parallel parking, pull-up on the right, and reversing are controlled",
  "Roundabouts, junctions, dual carriageways, and meeting traffic are confident",
  "You can recover safely from mistakes without panic",
  "Instructor notes say you are test-ready"
];

const routeBanks = [
  {
    area: "Enfield test prep",
    routes: ["Great Cambridge Road dual carriageway loop", "Southbury roundabout and lane discipline", "Winchmore Hill residential meeting traffic", "A10 slip-road confidence"]
  },
  {
    area: "Barnet and North London prep",
    routes: ["High Barnet gradients and hill starts", "A1000 traffic light sequencing", "Residential reverse manoeuvres", "Town-centre pedestrian awareness"]
  },
  {
    area: "Tottenham and Wood Green prep",
    routes: ["Busy high-street hazard scanning", "Bus lane and cyclist awareness", "Box junction discipline", "Mini-roundabout judgement"]
  }
];

export function PracticalTestPlanner() {
  const [checked, setChecked] = useState<string[]>([]);
  const [booked, setBooked] = useState(false);
  const readinessPercent = useMemo(() => Math.round((checked.length / readinessItems.length) * 100), [checked.length]);

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="grid gap-5">
          <article className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <ClipboardCheck className="text-brand" />
              <h2 className="text-2xl font-black">Mock-ready checklist</h2>
            </div>
            <p className="mt-3 text-sm font-semibold leading-6 text-zinc-600">
              Use this with your instructor before booking. Instructor sign-off should be written into your end-of-lesson notes so you can see why you are ready.
            </p>
            <div className="mt-5 grid gap-3">
              {readinessItems.map((item) => (
                <label key={item} className="flex items-start gap-3 rounded border border-zinc-200 bg-zinc-50 p-4 text-sm font-bold">
                  <input
                    type="checkbox"
                    checked={checked.includes(item)}
                    onChange={(event) => setChecked((current) => (event.target.checked ? [...current, item] : current.filter((value) => value !== item)))}
                    className="mt-1 accent-red-600"
                  />
                  {item}
                </label>
              ))}
            </div>
          </article>

          <article className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <MapPinned className="text-brand" />
              <h2 className="text-2xl font-black">Local route confidence</h2>
            </div>
            <p className="mt-3 text-sm font-semibold leading-6 text-zinc-600">
              LDA can build local route banks from instructor knowledge. These are practice routes, not guaranteed official test routes.
            </p>
            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              {routeBanks.map((bank) => (
                <div key={bank.area} className="rounded border border-zinc-200 bg-zinc-50 p-4">
                  <h3 className="font-black">{bank.area}</h3>
                  <div className="mt-3 grid gap-2">
                    {bank.routes.map((route) => (
                      <div key={route} className="flex items-start gap-2 text-sm font-bold leading-6 text-zinc-700">
                        <Route className="mt-1 shrink-0 text-brand" size={15} />
                        {route}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </article>
        </div>

        <aside className="rounded border border-red-200 bg-red-50 p-5 shadow-sm">
          <Target className="text-brand" />
          <h2 className="mt-4 text-2xl font-black">Readiness score</h2>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-white">
            <div className="h-full bg-brand transition-all" style={{ width: `${readinessPercent}%` }} />
          </div>
          <p className="mt-3 text-sm font-black text-red-950">{readinessPercent}% ready based on this checklist.</p>
          <div className="mt-5 rounded border border-red-200 bg-white p-4 text-sm font-semibold leading-6 text-zinc-700">
            <BadgeCheck className="mb-2 text-brand" />
            Book when your instructor notes show test readiness and you can repeat this checklist without prompting.
          </div>
          <a href="https://www.gov.uk/book-driving-test" target="_blank" rel="noreferrer" className="lda-pill lda-pill-sm mt-5">
            Official booking <ExternalLink size={17} />
          </a>
          <button type="button" onClick={() => setBooked(true)} className="mt-3 w-full rounded-full border border-zinc-300 px-4 py-2 text-sm font-black hover:ring-2 hover:ring-brand">
            I have booked it
          </button>
          {booked ? (
            <div className="mt-4 rounded border border-emerald-200 bg-emerald-50 p-4 text-sm font-black leading-6 text-emerald-800">
              <Sparkles className="mb-2" size={18} />
              Thank you for booking your practical driving test through LDA. We wish you the very best of luck.
            </div>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
