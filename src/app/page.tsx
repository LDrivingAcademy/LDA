import Link from "next/link";
import {
  CalendarCheck,
  CarFront,
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
import { getHeaderAccountSummary, type HeaderAccountSummary } from "@/lib/current-account";

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
    title: "Become an instructor",
    body: "Apply as an ADI/PDI, upload verification, set availability, manage bookings, and build repeat learner demand.",
    href: "/instructor",
    image: "instructor",
    cta: "Apply now"
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
              <Link href="/safety" className="rounded-full px-2.5 py-2 text-sm font-black text-white hover:ring-2 hover:ring-brand">Safety</Link>
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
                <HeaderAccountBlock account={account} />
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
              <HeaderAccountBlock account={account} compact />
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
              <h1 className="max-w-xl text-5xl font-black tracking-normal sm:text-6xl">
                Book driving lessons with LDA.
              </h1>
              <p className="mt-5 max-w-lg text-lg font-black leading-8 text-zinc-800">
                Find instructors. Book lessons. Pay securely.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href={learnerEntryHref} className="lda-pill">
                  Find instructors
                </Link>
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
                  LDA SmartMatch
                </Link>
                <div className="relative z-10 pt-24">
                  <h2 className="max-w-4xl text-4xl font-black tracking-normal text-white drop-shadow-lg sm:text-5xl">
                    Book with the confidence of a live platform.
                  </h2>
                  <p className="mt-4 max-w-2xl text-base font-bold leading-7 text-white drop-shadow">
                    SmartMatch compares distance, price, availability, instructor profile, and learner preferences.
                  </p>
                </div>
              </div>
            </section>
          </div>
        </section>

        <section className="bg-white px-4 pb-8 sm:px-6 lg:hidden">
          <OnDemandLessonCard className="mx-auto max-w-7xl md:grid-cols-[1fr_auto] md:items-center" futureLessonsHref={learnerSignUpHref} />
        </section>

        <section id="discover" className="bg-white">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <h2 className="text-4xl font-black tracking-normal sm:text-5xl">Everything learners and instructors need to move.</h2>
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
      </main>
      <FeedbackButton />
      <SiteFooter />
    </>
  );
}

function HeaderAccountBlock({ account, compact = false }: { account: HeaderAccountSummary; compact?: boolean }) {
  return (
    <div className={`min-w-0 text-right leading-tight ${compact ? "max-w-[128px]" : "max-w-[190px]"}`}>
      <div className="truncate text-sm font-black text-white">{account.name}</div>
      <Link href={account.dashboardHref} className="mt-1 inline-flex max-w-full items-center justify-center truncate rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1 text-xs font-black uppercase text-red-100 transition hover:border-red-500/80 hover:text-white hover:ring-2 hover:ring-brand">
        {account.subscriptionLabel}
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
