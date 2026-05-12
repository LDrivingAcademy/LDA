import Link from "next/link";
import { ArrowLeft, BookOpenCheck, CheckCircle2, ClipboardCheck, Video } from "lucide-react";
import { Brand } from "@/components/brand";
import { LanguageSelector } from "@/components/language-selector";
import { MainMenu } from "@/components/main-menu";
import { ProgressFeedbackForm } from "@/components/progress-feedback-form";
import { SiteFooter } from "@/components/site-footer";

const benefits = [
  "Keep a shared record of completed lesson topics",
  "Send learner tips immediately after a completed lesson",
  "Share videos or search links before the next booking",
  "Avoid paying lesson time to re-cover the same topic"
];

export default function ProgressTrackerPage() {
  return (
    <>
      <header className="sticky top-0 z-30 bg-black text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-7">
            <Brand />
            <nav className="hidden items-center gap-7 lg:flex">
              <Link href="/auth/login?role=learner" className="rounded-full px-3 py-2 text-sm font-black text-white hover:ring-2 hover:ring-brand">Learner</Link>
              <Link href="/instructor" className="rounded-full px-3 py-2 text-sm font-black text-white hover:ring-2 hover:ring-brand">Instructor</Link>
              <Link href="/#discover" className="rounded-full px-3 py-2 text-sm font-black text-white ring-2 ring-brand">Services</Link>
              <Link href="/about" className="rounded-full px-3 py-2 text-sm font-black text-white hover:ring-2 hover:ring-brand">About</Link>
            </nav>
          </div>
          <div className="hidden items-center gap-6 md:flex">
            <LanguageSelector />
            <Link href="/" className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-black text-white hover:ring-2 hover:ring-brand">
              <ArrowLeft size={17} /> Home
            </Link>
          </div>
          <div className="md:hidden">
            <MainMenu />
          </div>
        </div>
      </header>

      <main className="bg-white text-black">
        <section className="bg-black text-white">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_520px] lg:px-8 lg:py-16">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-red-500/60 bg-red-500/15 px-4 py-2 text-sm font-black text-red-100">
                <ClipboardCheck size={17} /> LDA progress tracker
              </div>
              <h1 className="mt-5 max-w-3xl text-5xl font-black tracking-normal sm:text-6xl">
                Keep every learner moving forward.
              </h1>
              <p className="mt-5 max-w-2xl text-lg font-semibold leading-8 text-zinc-300">
                Instructors can record what was covered, send learner feedback, and add tips or videos before the next lesson.
              </p>
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                {benefits.map((benefit) => (
                  <div key={benefit} className="flex items-start gap-3 rounded bg-zinc-950 p-4 text-sm font-bold leading-6 text-zinc-200">
                    <CheckCircle2 className="mt-0.5 shrink-0 text-brand" size={18} />
                    {benefit}
                  </div>
                ))}
              </div>
            </div>

            <aside className="rounded bg-white p-6 text-black shadow-2xl">
              <div className="grid h-14 w-14 place-items-center rounded bg-red-50 text-brand">
                <Video size={30} />
              </div>
              <h2 className="mt-5 text-3xl font-black tracking-normal">Learner preparation notes.</h2>
              <p className="mt-3 leading-7 text-zinc-700">
                Use video links for clutch control, observations, roundabouts, parking, or hazard perception so students arrive ready and lesson time stays practical.
              </p>
              <Link href="/roadworthy" className="lda-pill lda-pill-sm mt-5">
                <BookOpenCheck size={17} /> Tips directory
              </Link>
            </aside>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <ProgressFeedbackForm />
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
