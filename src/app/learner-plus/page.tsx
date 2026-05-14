import Link from "next/link";
import { ArrowLeft, CheckCircle2, PlusCircle } from "lucide-react";
import { Brand } from "@/components/brand";

const plusFeatures = [
  "Premium LDA SmartMatch weighting for support needs, lesson goals, and preferred teaching style",
  "Priority learner support for booking or payment issues",
  "Extra progress tracker insights and revision recommendations",
  "Early access to lesson bundles, free-trial offers, and partner discounts"
];

export default function LearnerPlusPage() {
  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between gap-4">
          <Brand />
          <Link href="/learner-dashboard" className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-bold text-zinc-300 hover:text-white hover:ring-2 hover:ring-brand">
            <ArrowLeft size={16} /> Back to learner dashboard
          </Link>
        </div>

        <section className="mt-10 rounded border border-zinc-800 bg-zinc-950 p-6">
          <div className="inline-flex items-center gap-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-black text-red-100">
            <PlusCircle size={16} /> Learner Plus
          </div>
          <h1 className="mt-5 text-4xl font-black tracking-normal sm:text-5xl">Upgrade your LDA learner account.</h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-zinc-300">
            Learner Plus is the premium layer for learners who want more guidance, smarter matching, deeper progress tools, and priority support. Stripe pricing can be connected when the final monthly or one-off package is confirmed.
          </p>
          <div className="mt-7 grid gap-3">
            {plusFeatures.map((feature) => (
              <div key={feature} className="flex items-start gap-3 rounded border border-zinc-800 bg-black p-4">
                <CheckCircle2 className="mt-0.5 shrink-0 text-brand" />
                <span className="font-bold leading-7 text-zinc-200">{feature}</span>
              </div>
            ))}
          </div>
          <button className="lda-pill mt-7" type="button">
            Upgrade checkout coming next
          </button>
        </section>
      </div>
    </main>
  );
}
