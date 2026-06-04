import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BadgePoundSterling,
  BookOpenCheck,
  CalendarCheck,
  CarFront,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  Route,
  ShieldCheck,
  Sparkles,
  Target,
  Video
} from "lucide-react";
import { Brand } from "@/components/brand";
import { LanguageSelector } from "@/components/language-selector";
import { MainMenu } from "@/components/main-menu";
import { SiteFooter } from "@/components/site-footer";
import { getPageBackLink, type PageSourceSearchParams, withDashboardSource } from "@/lib/page-back-link";

const journeyStages = [
  {
    title: "Account and eligibility",
    detail: "Confirm your verified email, date of birth, provisional licence status, and booking terms before paying for lessons.",
    status: "Required before booking"
  },
  {
    title: "Find your instructor",
    detail: "Use postcode, distance, transmission, price, reviews, support preferences, and SmartMatch to choose the right instructor.",
    status: "Start here"
  },
  {
    title: "Book driving lessons",
    detail: "Choose an available slot, pay securely, get a booking reference, and use live tracking when your instructor is en route.",
    status: "Book and track"
  },
  {
    title: "Theory test",
    detail: "Plan hazard perception, Highway Code revision, practice tests, and your official DVSA theory booking.",
    status: "Prepare early"
  },
  {
    title: "Practical test",
    detail: "Use instructor feedback and mock-test readiness before booking your official practical test.",
    status: "When ready"
  },
  {
    title: "After passing",
    detail: "Get guidance for first car checks, insurance quotes, Pass Plus, night driving, motorway confidence, and refreshers.",
    status: "On the road"
  }
];

const actionSections = [
  {
    id: "theory-test",
    title: "Theory test booking",
    icon: BookOpenCheck,
    description: "Build a theory plan before the practical pressure starts.",
    actions: [
      "Hazard perception video practice",
      "Highway Code revision checklist",
      "Mock theory test targets",
      "Official DVSA booking link placeholder"
    ],
    href: "/theory-test"
  },
  {
    id: "driving-lessons",
    title: "Driving lessons",
    icon: CalendarCheck,
    description: "Book, track, cancel, and review lessons in one place.",
    actions: [
      "Search local approved instructors",
      "Compare price, rating, car, and availability",
      "Pay securely through Stripe Checkout",
      "Use live tracking near lesson time"
    ],
    href: "/dashboard"
  },
  {
    id: "practical-test",
    title: "Practical test booking",
    icon: Target,
    description: "Check readiness, routes, instructor confidence, and official booking links before paying for a test slot.",
    actions: [
      "Mock-ready checklist",
      "Instructor sign-off from lesson notes",
      "Local route and manoeuvre confidence",
      "Official GOV.UK practical test handoff"
    ],
    href: "/practical-test"
  },
  {
    id: "first-car",
    title: "First car guidance",
    icon: CarFront,
    description: "Shortlist sensible first cars using safety, running cost, insurance, and trusted-seller signals.",
    actions: [
      "Licence and pass-date profile",
      "First-car shortlist engine",
      "Trusted dealer and review signals",
      "Viewing and test-drive checklist"
    ],
    href: "/first-car-guidance"
  },
  {
    id: "insurance",
    title: "Insurance quote support",
    icon: BadgePoundSterling,
    description: "Prepare a quote pack and compare policy types, risk factors, and learner-friendly insurer options.",
    actions: [
      "Third-party vs comprehensive guidance",
      "Black-box and telematics options",
      "Quote readiness checklist",
      "Partner API-ready results table"
    ],
    href: "/insurance-support"
  },
  {
    id: "progress",
    title: "Progress and revision",
    icon: ClipboardCheck,
    description: "Keep lesson notes, videos, and skills from being repeated unnecessarily.",
    actions: [
      "Instructor feedback after completed lessons",
      "Editable skills checklist",
      "Revision video links",
      "Next lesson preparation notes"
    ],
    href: "/progress-tracker?from=dashboard"
  }
];

type LearnerJourneyPageProps = {
  searchParams?: PageSourceSearchParams;
};

export default async function LearnerJourneyPage({ searchParams }: LearnerJourneyPageProps) {
  const { backHref, backLabel, fromDashboard } = await getPageBackLink(searchParams);
  const learnerEntryHref = fromDashboard ? "/dashboard" : "/auth/login?role=learner";

  return (
    <>
      <header className="sticky top-0 z-30 bg-black text-white">
        <div className="flex w-full items-center justify-between gap-5 px-[15px] py-4">
          <div className="flex items-center gap-7">
            <Brand />
            <nav className="hidden items-center gap-7 lg:flex">
              <Link href={learnerEntryHref} className="rounded-full border border-red-500/60 bg-red-500/15 px-3 py-2 text-sm font-black text-white ring-2 ring-brand">
                Learner
              </Link>
              <Link href={withDashboardSource("/smart-match", fromDashboard)} className="rounded-full border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm font-black text-white hover:ring-2 hover:ring-brand">
                SmartMatch
              </Link>
              <Link href={withDashboardSource("/support/learner", fromDashboard)} className="rounded-full border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm font-black text-white hover:ring-2 hover:ring-brand">
                Support
              </Link>
            </nav>
          </div>
          <div className="hidden items-center gap-6 md:flex">
            <LanguageSelector />
            <Link href={backHref} className="lda-pill lda-pill-sm">
              <ArrowLeft size={17} /> {backLabel}
            </Link>
          </div>
          <div className="md:hidden">
            <MainMenu />
          </div>
        </div>
      </header>

      <main className="bg-white text-black">
        <section className="bg-black text-white">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_440px] lg:px-8 lg:py-16">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-red-500/60 bg-red-500/15 px-4 py-2 text-sm font-black text-red-100">
                <Route size={17} /> LDA learner journey
              </div>
              <h1 className="mt-5 max-w-4xl text-5xl font-black tracking-normal sm:text-6xl">
                Plan every step from first lesson to driving alone.
              </h1>
              <p className="mt-5 max-w-3xl text-lg font-semibold leading-8 text-zinc-300">
                LDA keeps your lessons, test preparation, feedback, revision, first-car planning, and post-pass support in one structured route.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="#journey-sections" className="lda-pill lda-pill-sm">
                  View journey sections <ArrowRight size={17} />
                </Link>
                <Link href={backHref} className="lda-pill lda-pill-sm">
                  <ArrowLeft size={17} /> Return to booking
                </Link>
              </div>
            </div>

            <aside className="rounded border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
              <Sparkles className="text-brand" size={32} />
              <h2 className="mt-4 text-2xl font-black">LDA progress route</h2>
              <p className="mt-3 text-sm font-semibold leading-6 text-zinc-300">
                Each learner can track what is done, what comes next, and what support is needed before booking the next stage.
              </p>
              <div className="mt-5 grid gap-2 text-sm font-bold text-zinc-200">
                <span className="inline-flex items-center gap-2"><CheckCircle2 size={16} className="text-brand" /> Book lessons</span>
                <span className="inline-flex items-center gap-2"><CheckCircle2 size={16} className="text-brand" /> Prepare theory</span>
                <span className="inline-flex items-center gap-2"><CheckCircle2 size={16} className="text-brand" /> Pass practical</span>
                <span className="inline-flex items-center gap-2"><CheckCircle2 size={16} className="text-brand" /> Get road-ready</span>
              </div>
            </aside>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-4 lg:grid-cols-3">
            {journeyStages.map((stage, index) => (
              <article key={stage.title} className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="grid h-10 w-10 place-items-center rounded bg-red-50 text-sm font-black text-brand">{index + 1}</span>
                  <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black uppercase text-brand">{stage.status}</span>
                </div>
                <h2 className="mt-4 text-xl font-black">{stage.title}</h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-zinc-600">{stage.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="journey-sections" className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-sm font-black uppercase text-brand">Journey sections</div>
              <h2 className="mt-2 text-3xl font-black">Open the area you want to work on.</h2>
            </div>
            <Link href={withDashboardSource("/smart-match", fromDashboard)} className="lda-pill lda-pill-sm">
              Use SmartMatch <ArrowRight size={17} />
            </Link>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {actionSections.map((section) => {
              const Icon = section.icon;

              return (
                <article key={section.id} id={section.id} className="rounded border border-zinc-200 bg-white p-6 shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded bg-red-50 text-brand">
                      <Icon size={24} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black">{section.title}</h3>
                      <p className="mt-2 text-sm font-semibold leading-6 text-zinc-600">{section.description}</p>
                    </div>
                  </div>
                  <div className="mt-5 grid gap-2 text-sm font-bold text-zinc-700 sm:grid-cols-2">
                    {section.actions.map((action) => (
                      <span key={action} className="flex items-start gap-2 rounded border border-zinc-200 bg-zinc-50 p-3">
                        <CheckCircle2 className="mt-0.5 shrink-0 text-brand" size={16} />
                        {action}
                      </span>
                    ))}
                  </div>
                  <Link href={withDashboardSource(section.href, fromDashboard)} className="lda-pill lda-pill-sm mt-5">
                    Open section <ArrowRight size={17} />
                  </Link>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
          <div className="grid gap-5 rounded border border-zinc-200 bg-zinc-50 p-6 shadow-sm lg:grid-cols-3">
            <div>
              <ShieldCheck className="text-brand" />
              <h3 className="mt-3 text-xl font-black">Safety and compliance</h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-zinc-600">
                LDA keeps licence, age, terms, cancellation, and transparent price checks visible before paid booking.
              </p>
            </div>
            <div>
              <Video className="text-brand" />
              <h3 className="mt-3 text-xl font-black">Revision between lessons</h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-zinc-600">
                Use instructor notes and roadworthy videos to prepare before the next lesson instead of repeating paid time.
              </p>
            </div>
            <div>
              <GraduationCap className="text-brand" />
              <h3 className="mt-3 text-xl font-black">Post-pass confidence</h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-zinc-600">
                After passing, learners can plan motorway confidence, night driving, first car checks, insurance, and refreshers.
              </p>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
