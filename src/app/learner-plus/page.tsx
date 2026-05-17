import Link from "next/link";
import { CheckCircle2, PlusCircle, Sparkles } from "lucide-react";
import { PageTopBar } from "@/components/page-top-bar";

const packages = [
  {
    name: "Learner",
    price: "Free",
    label: "Core access",
    features: [
      "Search approved local instructors",
      "Book and pay securely through LDA",
      "Booking history and cancellation tools",
      "Instructor ratings and written reviews"
    ]
  },
  {
    name: "Learner Plus",
    price: "Coming soon",
    label: "Most popular",
    highlighted: true,
    features: [
      "Premium LDA SmartMatch weighting",
      "Priority learner support for booking issues",
      "Deeper progress tracker recommendations",
      "Early access to lesson bundles and launch offers"
    ]
  },
  {
    name: "Learner Pro",
    price: "Coming soon",
    label: "Full support",
    features: [
      "Advanced theory and hazard practice plans",
      "Practical test readiness checklist",
      "First-car and insurance quote support",
      "Personalised revision and confidence coaching"
    ]
  }
];

export default function LearnerPlusPage() {
  return (
    <main className="min-h-screen bg-white text-black">
      <PageTopBar backHref="/learner-dashboard" backLabel="Back to learner dashboard" />
      <div className="mx-auto max-w-5xl px-4 py-8">
        <section className="rounded border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="inline-flex items-center gap-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-black text-brand">
            <PlusCircle size={16} /> Learner Plus
          </div>
          <h1 className="mt-5 text-4xl font-black tracking-normal sm:text-5xl">Choose your LDA learner package.</h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-zinc-700">
            These packages are ready for the subscription logic to be connected. For now they show the access levels and perks we can switch on as each paid feature goes live.
          </p>
          <div className="mt-7 grid gap-4 lg:grid-cols-3">
            {packages.map((learnerPackage) => (
              <article key={learnerPackage.name} className={`rounded border p-5 ${learnerPackage.highlighted ? "border-brand bg-red-500/10" : "border-zinc-200 bg-white"}`}>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-2xl font-black">{learnerPackage.name}</h2>
                  <span className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-black uppercase text-brand">
                    {learnerPackage.label}
                  </span>
                </div>
                <p className="mt-3 text-lg font-black text-brand">{learnerPackage.price}</p>
                <div className="mt-5 grid gap-3">
                  {learnerPackage.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-3 text-sm font-bold leading-6 text-zinc-800">
                      {learnerPackage.highlighted ? <Sparkles className="mt-0.5 shrink-0 text-brand" size={18} /> : <CheckCircle2 className="mt-0.5 shrink-0 text-brand" size={18} />}
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
                <button className="lda-pill lda-pill-sm mt-6 w-full" type="button">
                  Select {learnerPackage.name}
                </button>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
