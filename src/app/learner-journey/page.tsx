import Link from "next/link";
import {
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
import { DynamicBackLink } from "@/components/dynamic-back-link";
import { LearnerBookingDashboard } from "@/components/learner-booking-dashboard";
import { MainMenu } from "@/components/main-menu";
import { SiteFooter } from "@/components/site-footer";
import { getHeaderAccountSummary } from "@/lib/current-account";
import { getPageBackLink, type PageSourceSearchParams, withPageSource } from "@/lib/page-back-link";

export const metadata = {
  title: "Learner Journey | L Driving Academy",
  description:
    "Plan your learner-driver route with L Driving Academy: theory test preparation, driving lessons, progress tracking, practical test readiness, first car guidance, and insurance support.",
  keywords: [
    "book driving lessons",
    "learner driving lessons",
    "driving lessons near me",
    "driving lesson booking",
    "learner driver dashboard",
    "LDA learner dashboard"
  ],
  alternates: {
    canonical: "/learner-journey"
  },
  robots: {
    index: false,
    follow: false,
    nocache: true
  },
  openGraph: {
    title: "Learner Journey | L Driving Academy",
    description:
      "Use L Driving Academy to book driving lessons, prepare for tests, track progress, and plan the full learner journey.",
    url: "/learner-journey",
    type: "website"
  }
};

const journeyStages = [
  {
    title: "Theory test booking",
    detail: "Plan hazard perception, Highway Code revision, practice tests, and your official DVSA theory booking.",
    status: "Prepare early"
  },
  {
    title: "Driving lessons",
    detail: "Search approved instructors, compare availability, book a slot, pay securely, and use live tracking when your instructor is en route.",
    status: "Book and track"
  },
  {
    title: "Progress and revision",
    detail: "Use instructor feedback, completed lesson notes, skills checklists, and revision videos to prepare for the next stage.",
    status: "Keep improving"
  },
  {
    title: "Practical test booking",
    detail: "Use instructor feedback and mock-test readiness before booking your official practical test.",
    status: "When ready"
  },
  {
    title: "First car guidance",
    detail: "Shortlist sensible first cars using safety, running costs, trusted-seller checks, and test-drive guidance.",
    status: "After passing"
  },
  {
    title: "Insurance quote support",
    detail: "Prepare quote details, compare cover types, and understand learner-friendly insurance options.",
    status: "Before driving alone"
  }
];

const actionSections = [
  {
    id: "theory-test",
    title: "Theory test booking",
    icon: BookOpenCheck,
    description: "Build a theory plan before practical-test preparation becomes urgent.",
    actions: [
      "Hazard perception video practice",
      "Highway Code revision checklist",
      "Mock theory test targets",
      "Official DVSA booking handoff"
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
      "Pay securely through LDA checkout",
      "Use live tracking near lesson time"
    ],
    href: "/learner-dashboard?section=driving-lessons#driving-lessons-booking"
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
    href: "/progress-tracker"
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
  }
];

type LearnerJourneyPageProps = {
  searchParams?: PageSourceSearchParams;
};

export default async function LearnerJourneyPage({ searchParams }: LearnerJourneyPageProps) {
  const params = await searchParams;
  const account = await getHeaderAccountSummary();
  const { backHref, backLabel } = await getPageBackLink(Promise.resolve(params));
  const requestedSection = Array.isArray(params?.section) ? params.section[0] : params?.section;
  const showDrivingLessonsPreview = requestedSection === "driving-lessons";

  if (showDrivingLessonsPreview) {
    return (
      <>
        <header className="lda-universal-topbar sticky top-0 z-30 bg-black text-white">
          <div className="lda-universal-topbar-inner flex w-full items-center justify-between gap-5 px-[15px]">
            <div className="flex items-center gap-7">
              <Brand />
            </div>
            <div className="hidden items-center gap-6 md:flex">
              <DynamicBackLink
                fallbackHref={backHref}
                fallbackLabel={backLabel}
                iconSize={17}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-black text-white hover:text-zinc-200"
              />
            </div>
            <div className="md:hidden">
              <MainMenu account={account} />
            </div>
          </div>
        </header>

        <main className="bg-white text-black">
          <section id="driving-lessons-booking" className="bg-black text-white">
            <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
              <div className="inline-flex items-center gap-2 rounded-full border border-red-500/60 bg-red-500/15 px-4 py-2 text-sm font-black text-red-100">
                <CalendarCheck size={17} /> Driving lessons preview
              </div>
              <h1 className="mt-5 max-w-4xl text-5xl font-black tracking-normal sm:text-6xl">
                Find and book your instructor.
              </h1>
              <p className="mt-5 max-w-3xl text-lg font-semibold leading-8 text-zinc-300">
                Preview the learner booking section with the nearby instructor map, search filters, approved instructor cards, pickup details, and checkout flow.
              </p>
            </div>
          </section>

          <div className="pt-8">
            <LearnerBookingDashboard bookingMode="quick" allowDemoInstructors />
          </div>
        </main>
        <SiteFooter />
      </>
    );
  }

  return (
    <>
      <header className="lda-universal-topbar sticky top-0 z-30 bg-black text-white">
        <div className="lda-universal-topbar-inner flex w-full items-center justify-between gap-5 px-[15px]">
          <div className="flex items-center gap-7">
            <Brand />
          </div>
          <div className="hidden items-center gap-6 md:flex">
            <DynamicBackLink
              fallbackHref={backHref}
              fallbackLabel={backLabel}
              iconSize={17}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-black text-white hover:text-zinc-200"
            />
          </div>
          <div className="md:hidden">
            <MainMenu account={account} />
          </div>
        </div>
      </header>

      <main className="bg-white text-black">
        <section className="bg-black text-white">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-red-500/60 bg-red-500/15 px-4 py-2 text-sm font-black text-red-100">
                <Route size={17} /> LDA learner journey
              </div>
              <h1 className="mt-5 max-w-4xl text-5xl font-black tracking-normal sm:text-6xl">
                Plan every step from first lesson to driving alone.
              </h1>
              <p className="mt-5 max-w-3xl text-lg font-semibold leading-8 text-zinc-300">
                LDA keeps your lessons, test preparation, feedback, revision, first car planning, and post-pass support in one place.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-4 lg:grid-cols-3">
            {journeyStages.map((stage, index) => (
              <article key={stage.title} className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="inline-flex min-h-10 items-center justify-center rounded bg-red-50 px-4 py-2 text-sm font-black text-brand">
                    Step {index + 1}
                  </span>
                  <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black uppercase text-brand">{stage.status}</span>
                </div>
                <h2 className="mt-4 text-xl font-black">{stage.title}</h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-zinc-600">{stage.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="journey-sections" className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
          <div className="mb-6">
            <div>
              <div className="text-sm font-black uppercase text-brand">Journey sections</div>
              <h2 className="mt-2 text-3xl font-black">Open the area you want to work on.</h2>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {actionSections.map((section) => {
              const Icon = section.icon;

              return (
                <article key={section.id} id={section.id} className="flex h-full flex-col rounded border border-zinc-200 bg-white p-6 shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded bg-red-50 text-brand">
                      <Icon size={24} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black">{section.title}</h3>
                      <p className="mt-2 text-sm font-semibold leading-6 text-zinc-600">{section.description}</p>
                    </div>
                  </div>
                  <div className="mt-5 grid flex-1 content-start gap-2 text-sm font-bold text-zinc-700 sm:grid-cols-2">
                    {section.actions.map((action) => (
                      <span key={action} className="flex items-start gap-2 rounded border border-zinc-200 bg-zinc-50 p-3">
                        <CheckCircle2 className="mt-0.5 shrink-0 text-brand" size={16} />
                        {action}
                      </span>
                    ))}
                  </div>
                  <div className="mt-auto pt-5">
                    <Link href={withPageSource(section.href, "learner-dashboard")} className="lda-pill lda-pill-sm">
                      Open section <ArrowRight size={17} />
                    </Link>
                  </div>
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
