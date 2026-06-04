import Link from "next/link";
import { ArrowLeft, CalendarCheck, CheckCircle2, RadioTower, ShieldCheck, Sparkles, UsersRound, WalletCards } from "lucide-react";

const learnerModules = [
  "SmartMatch profile that understands confidence, support needs, price, transmission, distance, availability, and instructor strengths.",
  "Protected lesson record for booking reference, payment status, cancellation decisions, live tracking, progress notes, revision focus, and lesson history.",
  "Pass pathway from first lesson to theory, practical, first car, insurance support, confidence milestones, and future instructor-transfer eligibility."
];

const instructorModules = [
  "Instructor business OS with verification, profile, availability, checkout holds, confirmed lessons, unavailable time, learner progress, and cancellation handling.",
  "Clientele builder that turns first bookings into repeat learners through progress records, learner history, reminders, reviews, ranking signals, and retention tools.",
  "Self-employed support layer for payout visibility, dispute evidence, tax-friendly records, demand signals, cancellation quality, and priority support."
];

const operatingLayers = [
  "Find: compare verified instructors, price, distance, car, transmission, teaching style, reviews, and availability.",
  "Book: choose slots, protect payment evidence, confirm pickup, and keep every booking reference inside LDA.",
  "Learn: track lesson notes, weak skills, next focus, recommended videos, progress updates, and pass readiness.",
  "Run: give instructors a calendar, availability controls, client records, payout visibility, retention signals, and support evidence.",
  "Protect: detect off-platform requests, preserve cancellation evidence, reduce leakage, and keep learner-instructor trust accountable."
];

const moatModules = [
  {
    title: "One-stop lesson command centre",
    body: "Learners should not need scattered texts, cash payments, random notes, and unclear arrangements. The useful record lives inside LDA.",
    icon: ShieldCheck
  },
  {
    title: "High-precision matching",
    body: "LDA should feel more intelligent than a traditional driving school because it adapts to goals, nerves, budget, area, vehicle, instructor strengths, and real availability.",
    icon: Sparkles
  },
  {
    title: "Live lesson confidence",
    body: "Arrival tracking, pickup visibility, lesson references, notifications, and protected support make learners feel safer and more in control.",
    icon: RadioTower
  },
  {
    title: "Instructor growth engine",
    body: "Instructors should need LDA because it gives them demand, structure, reputation, progress tooling, payout records, and visibility they cannot easily recreate alone.",
    icon: WalletCards
  },
  {
    title: "Career ladder",
    body: "Learners can become confident drivers, then request a route into instructing when eligible, creating a long-term marketplace relationship.",
    icon: UsersRound
  },
  {
    title: "Marketplace protection",
    body: "Off-platform payment requests are detectable through support language and future behaviour signals, while protected bookings are tagged for admin and payment evidence.",
    icon: CheckCircle2
  }
];

const deliveryPhases = [
  "Phase 1: Make protected LDA bookings, support escalation, progress records, and calendar controls feel essential.",
  "Phase 2: Add in-app messaging with off-platform phrase warnings, booking-safe templates, and learner report shortcuts.",
  "Phase 3: Add instructor growth intelligence: retention, conversion, ranking health, demand heatmaps, cancellation quality, and repeat-booking prompts.",
  "Phase 4: Build mobile-first learner and instructor apps around live lessons, notifications, payments, progress, documents, and availability.",
  "Phase 5: Launch advanced AI support for lesson planning, weak-skill detection, instructor recommendations, owner risk monitoring, and marketplace forecasting."
];

export default function InnovationPage() {
  return (
    <main className="min-h-screen bg-white text-black">
      <section className="bg-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-black text-zinc-300 hover:text-white">
            <ArrowLeft size={17} /> Back to LDA
          </Link>
          <div className="mt-10 max-w-5xl">
            <div className="inline-flex items-center gap-2 rounded border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm font-black text-red-100">
              <Sparkles size={16} /> LDA Intelligent Lesson OS
            </div>
            <h1 className="mt-5 text-5xl font-black tracking-normal sm:text-6xl lg:text-7xl">
              The one-stop driving platform learners and instructors should not want to live without.
            </h1>
            <p className="mt-5 max-w-4xl text-lg font-semibold leading-8 text-zinc-300">
              LDA is being built as a high-performance operating system for learning to drive and running a driving-instructor business: matching, booking, payment, progress, safety, live tracking, support, ranking, retention, and marketplace protection in one place.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/auth/sign-up?role=learner" className="lda-pill">
                Start as a learner
              </Link>
              <Link href="/instructor" className="lda-pill bg-white text-black hover:bg-zinc-200">
                Build as an instructor
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-zinc-200 bg-zinc-50">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="text-sm font-black uppercase text-brand">The LDA stack</div>
            <h2 className="mt-3 text-4xl font-black tracking-normal">Find. Book. Learn. Run. Protect.</h2>
            <p className="mt-4 text-lg leading-8 text-zinc-700">
              The goal is not to copy a driving school. The goal is to build the connected system around everything that happens before, during, and after every lesson.
            </p>
          </div>
          <div className="mt-8 grid gap-3 lg:grid-cols-5">
            {operatingLayers.map((layer) => (
              <div key={layer} className="rounded border border-zinc-200 bg-white p-4 text-sm font-black leading-6 shadow-sm">
                {layer}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:px-8">
        <article className="rounded border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-black uppercase text-brand">
            <UsersRound size={17} /> Learner side
          </div>
          <h2 className="mt-3 text-3xl font-black">A complete learning journey.</h2>
          <div className="mt-5 grid gap-3">
            {learnerModules.map((item) => (
              <div key={item} className="rounded border border-zinc-200 bg-zinc-50 p-4 text-sm font-bold leading-6 text-zinc-800">{item}</div>
            ))}
          </div>
        </article>

        <article className="rounded border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-black uppercase text-brand">
            <CalendarCheck size={17} /> Instructor side
          </div>
          <h2 className="mt-3 text-3xl font-black">A business system for instructors.</h2>
          <div className="mt-5 grid gap-3">
            {instructorModules.map((item) => (
              <div key={item} className="rounded border border-zinc-200 bg-zinc-50 p-4 text-sm font-bold leading-6 text-zinc-800">{item}</div>
            ))}
          </div>
        </article>
      </section>

      <section className="border-y border-zinc-200 bg-zinc-50">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="text-sm font-black uppercase text-brand">Why LDA can outpace traditional driving schools</div>
            <h2 className="mt-3 text-4xl font-black tracking-normal">Build the system around daily usefulness.</h2>
            <p className="mt-4 text-lg leading-8 text-zinc-700">
              RED, AA and traditional schools are known brands. LDA has to win by being faster, smarter, more transparent, more useful after every lesson, and more valuable to instructors building their own clientele.
            </p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {moatModules.map((module) => {
              const Icon = module.icon;
              return (
                <article key={module.title} className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
                  <Icon className="text-brand" />
                  <h3 className="mt-4 text-xl font-black">{module.title}</h3>
                  <p className="mt-3 text-sm font-semibold leading-6 text-zinc-700">{module.body}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[360px_1fr]">
          <div>
            <div className="text-sm font-black uppercase text-brand">Build standard</div>
            <h2 className="mt-3 text-3xl font-black">Professional, defensible, and hard to copy.</h2>
            <p className="mt-4 text-sm font-semibold leading-6 text-zinc-700">
              Every feature should either increase learner trust, reduce instructor admin, improve lesson outcomes, protect platform revenue, or make LDA data more useful over time.
            </p>
          </div>
          <div className="grid gap-3">
            {deliveryPhases.map((phase) => (
              <div key={phase} className="rounded border border-zinc-200 bg-white p-4 text-sm font-black leading-6 shadow-sm">{phase}</div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
