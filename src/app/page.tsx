import Link from "next/link";
import {
  CalendarCheck,
  CarFront,
  CheckCircle2,
  Clock3,
  HelpCircle,
  RadioTower,
  Share2,
  Sparkles,
  UsersRound
} from "lucide-react";
import { Brand } from "@/components/brand";
import { FeedbackButton } from "@/components/feedback-button";
import { LanguageSelector } from "@/components/language-selector";
import { MainMenu } from "@/components/main-menu";
import { SiteFooter } from "@/components/site-footer";
import { getHeaderAccountSummary } from "@/lib/current-account";

export const dynamic = "force-dynamic";

type CardVisualType = "car" | "calendar" | "match" | "instructor" | "tracking" | "social";

const suggestionCards: {
  title: string;
  body: string;
  href: string;
  image: CardVisualType;
  cta: string;
}[] = [
  {
    title: "Find instructors",
    body: "Compare verified local instructors by price, car, transmission, distance, teaching style, and availability.",
    href: "/auth/login?role=learner",
    image: "car",
    cta: "Find instructors"
  },
  {
    title: "Plan lessons",
    body: "Reserve clear time slots with upfront price, pickup postcode, booking reference, and cancellation terms.",
    href: "/auth/login?role=learner",
    image: "calendar",
    cta: "Plan a lesson"
  },
  {
    title: "Smart Match",
    body: "Let LDA match around confidence, support needs, reviews, skills, price, location, and real availability.",
    href: "/smart-match",
    image: "match",
    cta: "View SmartMatch"
  },
  {
    title: "Innovation OS",
    body: "See how LDA is becoming the one-stop platform for matching, booking, progress, safety, payments, and instructor growth.",
    href: "/innovation",
    image: "match",
    cta: "Explore LDA OS"
  },
  {
    title: "Instructor business",
    body: "Apply as an ADI/PDI, upload verification, set availability, manage bookings, and build repeat learner demand.",
    href: "/instructor",
    image: "instructor",
    cta: "Build with LDA"
  },
  {
    title: "Live tracking",
    body: "Preview learner confidence tools for distance, ETA, instructor arrival, pickup visibility, and accepted lessons.",
    href: "/tracking",
    image: "tracking",
    cta: "Track lesson"
  },
  {
    title: "Subscribe & socials",
    body: "Follow LDA for learner tips, instructor updates, platform releases, deals, and launch news.",
    href: "/social",
    image: "social",
    cta: "Follow LDA"
  }
];

const trustSignals = [
  "ADI/PDI verified instructor flow",
  "Secure online payment records",
  "Protected lesson references",
  "Progress saved after lessons",
  "Cancellation evidence trail",
  "Learner and instructor support paths"
];

const dashboardStandards = [
  {
    title: "Learner command centre",
    body: "Upcoming lesson, pickup details, instructor status, progress notes, recommended videos, booking history, and support in one place.",
    icon: RadioTower
  },
  {
    title: "Instructor operating system",
    body: "Calendar, free slots, booked lessons, being-booked holds, unavailable time, learner progress, cancellation actions, and payout visibility.",
    icon: CalendarCheck
  },
  {
    title: "Protected marketplace layer",
    body: "Booking evidence, secure checkout, off-platform request warnings, progress ownership, support escalation, and platform trust signals.",
    icon: CheckCircle2
  }
];

export default async function HomePage() {
  const account = await getHeaderAccountSummary();
  const learnerEntryHref =
    account?.role === "learner"
      ? "/learner-dashboard"
      : account?.role === "instructor"
        ? "/auth/sign-up?role=learner&message=You are signed in as an instructor. Sign up for a learner account with a different email to use learner features."
        : "/auth/login?role=learner";
  const instructorEntryHref =
    account?.role === "instructor"
      ? "/instructor-dashboard"
      : account?.role === "learner"
        ? "/auth/sign-up?role=instructor&message=You are signed in as a learner. Sign up for an instructor account with a different email, or request a learner-to-instructor transfer."
        : "/instructor";
  const learnerSignUpHref = account?.role === "learner" ? "/learner-dashboard" : "/auth/sign-up?role=learner";

  return (
    <>
      <header className="sticky top-0 z-30 bg-black text-white">
        <div className="flex w-full items-center justify-between gap-8 px-[15px] py-4">
          <div className="flex min-w-0 items-center gap-5">
            <Brand size="home" />
            <nav className="hidden items-center gap-4 xl:flex">
              <Link href={learnerEntryHref} className="rounded-full px-2.5 py-2 text-sm font-black text-white hover:ring-2 hover:ring-brand">Learner</Link>
              <Link href={instructorEntryHref} className="rounded-full px-2.5 py-2 text-sm font-black text-white hover:ring-2 hover:ring-brand">Instructor</Link>
              <Link href="#discover" className="rounded-full px-2.5 py-2 text-sm font-black text-white hover:ring-2 hover:ring-brand">Services</Link>
              <Link href="/innovation" className="rounded-full px-2.5 py-2 text-sm font-black text-white hover:ring-2 hover:ring-brand">Innovation</Link>
              <Link href="#safety" className="rounded-full px-2.5 py-2 text-sm font-black text-white hover:ring-2 hover:ring-brand">Safety</Link>
              <Link href="/about" className="rounded-full px-2.5 py-2 text-sm font-black text-white hover:ring-2 hover:ring-brand">
                About
              </Link>
            </nav>
          </div>
          <div className="ml-auto hidden items-center justify-end gap-7 xl:flex">
            <LanguageSelector />
            <Link href="/contact" className="inline-flex items-center gap-2 rounded-full px-3 py-2 whitespace-nowrap text-sm font-black text-white hover:ring-2 hover:ring-brand">
              <HelpCircle size={17} /> Help
            </Link>
            {account ? (
              <>
                <div className="flex items-center gap-1">
                  <Link href={account.dashboardHref} className="rounded-full border border-red-500/60 bg-transparent px-2.5 py-1.5 whitespace-nowrap text-sm font-black text-white hover:ring-2 hover:ring-brand">
                    {account.name}
                  </Link>
                  <Link href={account.subscriptionHref} className="rounded-full border border-red-500/60 bg-transparent px-2.5 py-1.5 whitespace-nowrap text-sm font-black uppercase text-white hover:ring-2 hover:ring-brand">
                    {account.subscriptionLabel}
                  </Link>
                </div>
                <MainMenu account={account} />
              </>
            ) : (
              <>
                <Link href="/auth/login?role=learner" className="rounded-full px-3 py-2 whitespace-nowrap text-sm font-black text-white hover:ring-2 hover:ring-brand">Log in</Link>
                <Link href="/auth/sign-up?role=learner" className="rounded-full bg-brand px-3 py-2 whitespace-nowrap text-sm font-black text-white hover:ring-2 hover:ring-red-300">Sign up</Link>
              </>
            )}
          </div>
          <div className="flex items-center gap-3 xl:hidden">
            {account ? (
              <>
                <div className="hidden items-center gap-2 sm:flex">
                  <Link href={account.dashboardHref} className="rounded-full border border-red-500/60 bg-transparent px-3 py-1.5 whitespace-nowrap text-sm font-black text-white hover:ring-2 hover:ring-brand">
                    {account.name}
                  </Link>
                  <Link href={account.subscriptionHref} className="rounded-full border border-red-500/60 bg-transparent px-3 py-1.5 whitespace-nowrap text-sm font-black uppercase text-white hover:ring-2 hover:ring-brand">
                    {account.subscriptionLabel}
                  </Link>
                </div>
                <Link href={account.subscriptionHref} className="rounded-full border border-red-500/60 bg-transparent px-3 py-1.5 whitespace-nowrap text-sm font-black uppercase text-white hover:ring-2 hover:ring-brand sm:hidden">
                  {account.subscriptionLabel}
                </Link>
              </>
            ) : (
              <>
                <Link href="/auth/login?role=learner" className="hidden rounded-full px-3 py-2 whitespace-nowrap text-sm font-black text-white hover:ring-2 hover:ring-brand sm:inline-flex">Log in</Link>
                <Link href="/auth/sign-up?role=learner" className="rounded-full bg-brand px-3 py-2 whitespace-nowrap text-sm font-black text-white hover:ring-2 hover:ring-red-300">Sign up</Link>
              </>
            )}
            <MainMenu account={account} />
          </div>
        </div>
      </header>

      <main className="bg-white text-black">
        <section className="bg-white">
          <div className="mx-auto grid max-w-7xl items-stretch gap-8 px-4 pb-0 pt-7 sm:px-6 lg:grid-cols-[560px_1fr] lg:px-8 lg:pb-0 lg:pt-10">
            <div className="flex flex-col py-2 lg:pt-8">
              <div className="mb-4 inline-flex w-fit items-center gap-2 rounded border border-red-500/30 bg-red-50 px-3 py-2 text-sm font-black text-brand">
                <Sparkles size={16} /> Intelligent Lesson OS
              </div>
              <h1 className="max-w-xl text-5xl font-black tracking-normal sm:text-6xl">
                LDA is the one-stop driving platform.
              </h1>
              <p className="mt-5 max-w-lg text-lg leading-8 text-zinc-700">
                Find instructors, book lessons, pay securely, track arrival, store progress, and run an instructor business in one calm, high-tech marketplace.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href={learnerEntryHref} className="lda-pill">
                  Find instructors
                </Link>
                <Link href={instructorEntryHref} className="lda-pill bg-black text-white hover:bg-zinc-800">
                  Build as instructor
                </Link>
                <Link href="/innovation" className="lda-pill bg-white text-black ring-1 ring-zinc-300 hover:bg-zinc-100">
                  Explore LDA OS
                </Link>
              </div>
              <div className="mt-7 grid grid-cols-2 gap-3 text-sm font-black text-zinc-800 sm:grid-cols-3">
                <div className="rounded border border-zinc-200 bg-zinc-50 p-3">Verified instructors</div>
                <div className="rounded border border-zinc-200 bg-zinc-50 p-3">Secure checkout</div>
                <div className="rounded border border-zinc-200 bg-zinc-50 p-3">Live lesson tools</div>
              </div>
              <div className="mt-auto hidden pt-8 lg:block">
                <OnDemandLessonCard futureLessonsHref={learnerSignUpHref} />
              </div>
            </div>

            <section className="overflow-hidden rounded bg-white text-white shadow-sm lg:h-full lg:self-stretch">
              <div className="relative flex h-full min-h-[520px] flex-col justify-end p-5 sm:p-8 lg:min-h-0">
                <img
                  src="/learner-instructor.jpg"
                  alt="Learner driver behind the wheel with an instructor in the passenger seat"
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/5" />
                <Link href="/smart-match" className="lda-pill lda-pill-sm absolute left-5 top-5 z-20 pointer-events-auto sm:left-auto sm:right-8 sm:top-8">
                  LDA SmartMatch 94%
                </Link>
                <div className="relative z-10 grid gap-4 pt-24 lg:grid-cols-[1fr_260px] lg:items-end">
                  <div>
                    <h2 className="max-w-4xl text-4xl font-black tracking-normal text-white drop-shadow-lg sm:text-5xl">
                      Book with the confidence of a live platform.
                    </h2>
                    <p className="mt-4 max-w-3xl text-base font-bold leading-7 text-white drop-shadow">
                      Smart Match compares distance, rating, price, car, transmission, availability, verification status, teaching strengths, and support preferences.
                    </p>
                  </div>
                  <LiveLessonPanel />
                </div>
              </div>
            </section>
          </div>
        </section>

        <section className="bg-white px-4 pb-8 sm:px-6 lg:hidden">
          <OnDemandLessonCard className="mx-auto max-w-7xl md:grid-cols-[1fr_auto] md:items-center" futureLessonsHref={learnerSignUpHref} />
        </section>

        <section className="border-y border-zinc-200 bg-black text-white">
          <div className="mx-auto grid max-w-7xl gap-3 px-4 py-5 sm:px-6 md:grid-cols-3 lg:px-8">
            <div className="text-sm font-black uppercase text-red-200">Marketplace status: live clarity</div>
            <div className="text-sm font-black uppercase text-zinc-200">Payment record: protected</div>
            <div className="text-sm font-black uppercase text-zinc-200">Progress tracker: saved after lessons</div>
          </div>
        </section>

        <section id="discover" className="bg-white">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <div className="text-sm font-black uppercase text-brand">One marketplace, both sides</div>
              <h2 className="mt-3 text-4xl font-black tracking-normal sm:text-5xl">Everything learners and instructors need to move.</h2>
            </div>
            <div className="mt-9 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {suggestionCards.map((card) => (
                <Link key={card.title} href={card.href.startsWith("/auth/login?role=learner") ? learnerEntryHref : card.href === "/instructor" ? instructorEntryHref : card.href} className="group grid min-h-[220px] gap-5 overflow-hidden rounded bg-zinc-100 p-5 text-black hover:bg-zinc-200 sm:grid-cols-[1fr_150px] sm:p-6">
                  <div className="flex flex-col items-start">
                    <h3 className="text-2xl font-black">{card.title}</h3>
                    <p className="mt-4 max-w-xs text-base leading-7 text-zinc-800">{card.body}</p>
                    <span className="lda-pill lda-pill-sm mt-auto">
                      {card.cta}
                    </span>
                  </div>
                  <CardVisual type={card.image} />
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section id="safety" className="bg-white">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8 lg:py-14">
            <div>
              <div className="text-sm font-black uppercase text-brand">Trust signals</div>
              <h2 className="mt-3 text-4xl font-black tracking-normal">Safety and proof before every lesson.</h2>
              <p className="mt-4 max-w-xl text-lg leading-8 text-zinc-700">
                LDA is structured around verified instructors, transparent pricing, protected records, secure payments, and clear support paths.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {trustSignals.map((item) => (
                <div key={item} className="flex items-start gap-4 rounded bg-zinc-100 p-4">
                  <CheckCircle2 className="mt-0.5 shrink-0 text-brand" />
                  <span className="font-bold leading-7 text-zinc-900">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-zinc-200 bg-zinc-50">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <div className="text-sm font-black uppercase text-brand">Dashboard standard</div>
              <h2 className="mt-3 text-4xl font-black tracking-normal">The dashboards should feel like the product people rely on daily.</h2>
              <p className="mt-4 text-lg leading-8 text-zinc-700">
                Public pages win attention. Dashboards win loyalty. LDA should make each signed-in workflow feel fast, obvious, protected, and useful.
              </p>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {dashboardStandards.map((standard) => {
                const Icon = standard.icon;
                return (
                  <article key={standard.title} className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
                    <Icon className="text-brand" />
                    <h3 className="mt-4 text-xl font-black">{standard.title}</h3>
                    <p className="mt-3 text-sm font-semibold leading-6 text-zinc-700">{standard.body}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      </main>
      <FeedbackButton />
      <SiteFooter />
    </>
  );
}

function LiveLessonPanel() {
  return (
    <div className="rounded border border-white/20 bg-white/95 p-4 text-black shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase text-zinc-500">Next lesson</div>
          <div className="mt-1 text-xl font-black">Today, 16:30</div>
        </div>
        <span className="rounded bg-green-100 px-2.5 py-1 text-xs font-black text-green-800">Protected</span>
      </div>
      <div className="mt-4 grid gap-2 text-sm font-bold text-zinc-700">
        <div className="flex items-center justify-between gap-4 rounded bg-zinc-100 p-3">
          <span>Instructor ETA</span>
          <strong className="text-black">8 min</strong>
        </div>
        <div className="flex items-center justify-between gap-4 rounded bg-zinc-100 p-3">
          <span>SmartMatch</span>
          <strong className="text-black">94%</strong>
        </div>
        <div className="flex items-center justify-between gap-4 rounded bg-zinc-100 p-3">
          <span>Progress</span>
          <strong className="text-black">68%</strong>
        </div>
      </div>
      <Link href="/tracking" className="lda-pill lda-pill-sm mt-4 w-full">
        Open live tracking
      </Link>
    </div>
  );
}

function OnDemandLessonCard({ className = "", futureLessonsHref = "/auth/sign-up?role=learner" }: { className?: string; futureLessonsHref?: string }) {
  return (
    <div className={`grid gap-4 rounded border border-zinc-200 bg-zinc-50 p-5 shadow-sm ${className}`}>
      <div>
        <div className="inline-flex items-center gap-2 text-sm font-black uppercase text-brand">
          <Clock3 size={17} /> On-demand lesson
        </div>
        <h2 className="mt-2 text-2xl font-black tracking-normal">Need a lesson soon?</h2>
        <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-zinc-700">
          Enter pickup details, verify your provisional licence, pay securely, then receive a booking reference and tracking link.
        </p>
      </div>
      <div className="grid w-full gap-3 justify-self-start sm:w-80">
        <Link href="/lesson-now" className="lda-pill w-full">
          Book on-demand
        </Link>
        <Link href={futureLessonsHref} className="lda-pill w-full bg-black text-white hover:bg-zinc-800">
          Schedule future lesson
        </Link>
      </div>
    </div>
  );
}

function CardVisual({ type }: { type: CardVisualType }) {
  const visual = {
    car: <CarFront size={68} />,
    calendar: <CalendarCheck size={68} />,
    match: <Sparkles size={68} />,
    instructor: <UsersRound size={68} />,
    tracking: <RadioTower size={68} />,
    social: <Share2 size={68} />
  }[type];

  return (
    <div className="relative grid place-items-start text-black sm:place-items-center">
      <div className="grid h-20 w-20 place-items-center rounded bg-white text-brand shadow-sm transition group-hover:scale-105 sm:h-24 sm:w-24">
        {visual}
      </div>
    </div>
  );
}
