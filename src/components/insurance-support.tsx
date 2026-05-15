"use client";

import { useMemo, useState } from "react";
import { BadgePoundSterling, CheckCircle2, FileText, ShieldCheck, Sparkles } from "lucide-react";

const insurerRows = [
  { provider: "Telematics starter policy", type: "Comprehensive", estimate: "£1,150-£1,650", strengths: ["Black-box discount", "Low mileage friendly", "Driving score coaching"], fit: "Best for careful new drivers" },
  { provider: "Mainstream comprehensive", type: "Comprehensive", estimate: "£1,450-£2,100", strengths: ["Windscreen options", "Courtesy car options", "No black box"], fit: "Best for flexible daily use" },
  { provider: "Third-party fire and theft", type: "TPFT", estimate: "£1,300-£1,950", strengths: ["Lower cover level", "May suit lower-value cars", "Check excess carefully"], fit: "Sometimes cheaper, not always" },
  { provider: "Named-driver family policy", type: "Comprehensive", estimate: "£1,250-£1,900", strengths: ["Parent as named driver", "Shared vehicle option", "Ownership rules matter"], fit: "Best where family car use is genuine" }
];

const quoteFactors = ["Car insurance group", "Annual mileage", "Parking overnight location", "Occupation or student status", "Voluntary excess", "Named drivers", "Telematics willingness", "No-claims history"];

export function InsuranceSupport() {
  const [coverType, setCoverType] = useState("all");
  const [mileage, setMileage] = useState(6000);
  const [telematics, setTelematics] = useState(true);

  const filteredRows = useMemo(() => {
    return insurerRows.filter((row) => {
      if (coverType !== "all" && row.type !== coverType) return false;
      if (!telematics && row.provider.toLowerCase().includes("telematics")) return false;
      return true;
    });
  }, [coverType, telematics]);

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <aside className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
          <Sparkles className="text-brand" />
          <h2 className="mt-4 text-2xl font-black">Quote profile</h2>
          <label className="mt-5 grid gap-2 text-sm font-black text-zinc-700">
            Cover type
            <select value={coverType} onChange={(event) => setCoverType(event.target.value)} className="rounded border border-zinc-300 px-3 py-3 text-black">
              <option value="all">Show all suitable cover</option>
              <option value="Comprehensive">Comprehensive</option>
              <option value="TPFT">Third-party fire and theft</option>
            </select>
          </label>
          <label className="mt-4 grid gap-2 text-sm font-black text-zinc-700">
            Annual mileage: {mileage.toLocaleString("en-GB")} miles
            <input type="range" min="1000" max="18000" step="500" value={mileage} onChange={(event) => setMileage(Number(event.target.value))} className="accent-red-600" />
          </label>
          <label className="mt-4 flex items-center justify-between gap-3 rounded border border-zinc-200 bg-zinc-50 p-4 text-sm font-black">
            Consider telematics
            <input type="checkbox" checked={telematics} onChange={(event) => setTelematics(event.target.checked)} className="accent-red-600" />
          </label>
          <p className="mt-5 text-sm font-semibold leading-6 text-zinc-600">
            Real quotes need insurer, broker, or comparison-partner APIs. This MVP creates the LDA quote-pack structure so learners know what to compare.
          </p>
        </aside>

        <div className="grid gap-5">
          <article className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <BadgePoundSterling className="text-brand" />
              <h2 className="text-2xl font-black">Insurance quote support</h2>
            </div>
            <div className="mt-5 overflow-hidden rounded border border-zinc-200">
              <div className="grid grid-cols-[1.2fr_0.8fr_0.9fr_1.4fr] bg-black px-4 py-3 text-xs font-black uppercase text-white">
                <span>Provider path</span>
                <span>Cover</span>
                <span>Estimate</span>
                <span>Best fit</span>
              </div>
              {filteredRows.map((row) => (
                <div key={row.provider} className="grid gap-3 border-t border-zinc-200 px-4 py-4 text-sm font-bold text-zinc-700 md:grid-cols-[1.2fr_0.8fr_0.9fr_1.4fr]">
                  <div>
                    <div className="font-black text-black">{row.provider}</div>
                    <div className="mt-2 grid gap-1">
                      {row.strengths.map((strength) => <span key={strength} className="text-xs text-zinc-600">{strength}</span>)}
                    </div>
                  </div>
                  <span>{row.type}</span>
                  <span className="font-black text-brand">{row.estimate}</span>
                  <span>{row.fit}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <FileText className="text-brand" />
              <h2 className="text-2xl font-black">Quote readiness pack</h2>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {quoteFactors.map((factor) => (
                <div key={factor} className="flex items-start gap-2 rounded border border-zinc-200 bg-zinc-50 p-3 text-sm font-bold text-zinc-700">
                  <CheckCircle2 className="mt-0.5 shrink-0 text-brand" size={16} />
                  {factor}
                </div>
              ))}
            </div>
          </article>

          <article className="rounded border border-red-200 bg-red-50 p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <ShieldCheck className="text-brand" />
              <h2 className="text-2xl font-black">LDA quote intelligence</h2>
            </div>
            <p className="mt-3 text-sm font-semibold leading-6 text-red-950">
              Future live mode can combine car shortlist data, lesson progress, postcode, mileage, and partner insurer APIs to pre-fill quote forms and flag policies that do not suit new drivers.
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}
