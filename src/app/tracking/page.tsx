import Link from "next/link";
import { ArrowLeft, RadioTower } from "lucide-react";
import { Brand } from "@/components/brand";
import { LiveLessonMap } from "@/components/live-lesson-map";
import { MainMenu } from "@/components/main-menu";

export default function TrackingPage() {
  return (
    <>
      <header className="sticky top-0 z-30 bg-black text-white">
        <div className="flex w-full items-center justify-between gap-5 px-[15px] py-4">
          <Brand />
          <div className="hidden items-center gap-6 md:flex">
            <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-black text-white hover:ring-2 hover:ring-brand">
              <ArrowLeft size={17} /> Back to dashboard
            </Link>
            <Link href="/" className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-black text-white hover:ring-2 hover:ring-brand">
              <ArrowLeft size={17} /> Home
            </Link>
          </div>
          <div className="md:hidden">
            <MainMenu />
          </div>
        </div>
      </header>
      <main className="min-h-screen bg-white text-black">
        <section className="bg-black text-white">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-red-500/60 bg-red-500/15 px-4 py-2 text-sm font-black text-red-100">
              <RadioTower size={17} /> Live tracking demo
            </div>
            <h1 className="mt-5 max-w-3xl text-5xl font-black tracking-normal">Track your instructor after booking.</h1>
            <p className="mt-4 max-w-2xl text-lg font-semibold leading-8 text-zinc-300">
              This shows the learner view for an instructor travelling to pickup. Live production tracking should only start for accepted bookings near lesson time.
            </p>
            <Link href="/dashboard" className="lda-pill lda-pill-sm mt-6">
              <ArrowLeft size={17} /> Back to previous page
            </Link>
          </div>
        </section>
        <LiveLessonMap />
      </main>
    </>
  );
}
