import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Brand } from "@/components/brand";

export function LearnerPageHeader({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <>
      <header className="sticky top-0 z-30 bg-black text-white">
        <div className="flex w-full items-center justify-between gap-5 px-[15px] py-4">
          <Brand />
          <Link href="/dashboard" className="lda-pill lda-pill-sm">
            <ArrowLeft size={17} /> Back to dashboard
          </Link>
        </div>
      </header>
      <section className="bg-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="inline-flex rounded-full border border-red-500/60 bg-red-500/15 px-4 py-2 text-sm font-black uppercase text-red-100">{eyebrow}</div>
          <h1 className="mt-5 max-w-4xl text-5xl font-black tracking-normal">{title}</h1>
          <p className="mt-4 max-w-3xl text-lg font-semibold leading-8 text-zinc-300">{body}</p>
        </div>
      </section>
    </>
  );
}
