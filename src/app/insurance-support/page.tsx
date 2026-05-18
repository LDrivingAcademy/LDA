import Link from "next/link";
import { ArrowLeft, BadgePoundSterling, ShieldCheck } from "lucide-react";
import { Brand } from "@/components/brand";
import { InsuranceSupport } from "@/components/insurance-support";

export default function InsuranceSupportPage() {
  return (
    <main className="min-h-screen bg-white text-black">
      <header className="sticky top-0 z-30 border-b border-zinc-900 bg-black text-white">
        <div className="flex w-full items-center justify-between gap-4 px-[15px] py-4">
          <Brand />
          <Link href="/learner-journey" className="lda-pill lda-pill-sm">
            <ArrowLeft size={16} /> LDA learner journey
          </Link>
        </div>
      </header>
      <section className="bg-black text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_360px] lg:px-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm font-black text-red-100">
              <BadgePoundSterling size={17} /> Insurance quote support
            </div>
            <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-normal sm:text-6xl">Build a clean insurance quote pack before you buy.</h1>
            <p className="mt-5 max-w-3xl text-lg font-semibold leading-8 text-zinc-300">
              Compare cover types, telematics options, risk factors, and partner-ready quote paths for new drivers.
            </p>
          </div>
          <aside className="rounded border border-red-500/30 bg-zinc-950 p-5 shadow-2xl">
            <ShieldCheck className="text-brand" />
            <h2 className="mt-4 text-2xl font-black">Compliance note</h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-zinc-300">
              Live insurance recommendations must use approved broker/insurer relationships and clear disclosure before launch.
            </p>
          </aside>
        </div>
      </section>
      <InsuranceSupport />
    </main>
  );
}
