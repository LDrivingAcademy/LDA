import Link from "next/link";
import {
  CalendarCheck,
  CarFront,
  CheckCircle2,
  ClipboardCheck,
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

type CardVisualType = "car" | "calendar" | "match" | "instructor" | "tracking" | "social" | "progress";

const suggestionCards: {
  title: string;
  body: string;
  href: string;
  image: CardVisualType;
  cta: string;
}[] = [
  {
    title: "Lesson",
    body: "Find a verified local instructor, choose manual or automatic, and book your next slot.",
    href: "/auth/login?role=learner",
    image: "car",
    cta: "Details"
  },
  {
    title: "Reserve",
    body: "Plan ahead with visible availability, upfront price, pickup postcode, and cancellation terms.",
    href: "/auth/login?role=learner",
    image: "calendar",
    cta: "Details"
  },
  {
    title: "Smart Match",
    body: "Use LDA SmartMatch to adapt instructor choice around support needs, reviews, skills, price, and availability.",
    href: "/smart-match",
    image: "match",
    cta: "Details"
  },
  {
    title: "Instructor",
    body: "Apply as an ADI/PDI, upload verification, set availability, and manage paid bookings.",
    href: "/instructor",
    image: "instructor",
    cta: "Details"
  },
  {
    title: "Live Tracking",
    body: "Preview how learners see distance, ETA, and instructor arrival once a lesson is accepted.",
    href: "/tracking",
    image: "tracking",
    cta: "Open tracking"
  },
  {
    title: "Progress Tracker",
    body: "Instructors can send lesson feedback, update completed skills, and share videos before the next lesson.",
    href: "/progress-tracker",
    image: "progress",
    cta: "Open tracker"
  },
  {
    title: "Subscribe & Socials",
    body: "Follow LDA, subscribe for learner tips, deals, free trials, and platform updates.",
    href: "/social",
    image: "social",
    cta: "Subscribe"
  }
];

const safetyItems = [
  "ADI/PDI verification before instructors appear in search",
  "Learners confirm age 17+ and provisional licence before booking",
  "Full lesson price shown before checkout",
  "Secure payment and booking records for every lesson"
];

export default async function HomePage() {
  const account = await getHeaderAccountSummary();

  return (
    <>
      <header className="sticky top-0 z-30 bg-black text-white">
        <div className="mx-auto flex max-w-[1800px] items-center justify-between gap-5 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-7">
            <Brand size="home" />
            <nav className="hidden items-center gap-7 xl:flex">
              <Link href="/auth/login?role=learner" className="rounded-full px-3 py-2 text-sm font-black text-white hover:ring-2 hover:ring-brand">Learner</Link>
              <Link href="/instructor" className="rounded-full px-3 py-2 text-sm font-black text-white hover:ring-2 hover:ring-brand">Instructor</Link>
              <Link href="#discover" className="rounded-full px-3 py-2 text-sm font-black text-white hover:ring-2 hover:ring-brand">Services</Link>
              <Link href="#safety" className="rounded-full px-3 py-2 text-sm font-black text-white hover:ring-2 hover:ring-brand">Safety</Link>
              <Link href="/about" className="rounded-full px-3 py-2 text-sm font-black text-white hover:ring-2 hover:ring-brand">
                About
              </Link>
            </nav>
          </div>
          <div className="hidden items-center gap-6 xl:flex">
            <LanguageSelector />
            <Link href="/contact" className="inline-flex items-center gap-2 rounded-full px-3 py-2 whitespace-nowrap text-sm font-black text-white hover:ring-2 hover:ring-brand">
              <HelpCircle size={17} /> Help
            </Link>
            {account ? (
              <>
                <Link href={account.dashboardHref} className="rounded-full px-3 py-2 whitespace-nowrap text-sm font-black text-white hover:ring-2 hover:ring-brand">
                  {account.name}
                </Link>
                <Link href={account.subscriptionHref} className="lda-pill lda-pill-sm whitespace-nowrap">
                  {account.subscriptionLabel}
                </Link>
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
                <Link href={account.dashboardHref} className="hidden rounded-full px-3 py-2 whitespace-nowrap text-sm font-black text-white hover:ring-2 hover:ring-brand sm:inline-flex">
                  {account.name}
                </Link>
                <Link href={account.subscriptionHref} className="lda-pill lda-pill-sm whitespace-nowrap">
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
            <div className="flex flex-col py-2 lg:pb-10 lg:pt-8">
              <h1 className="max-w-xl text-5xl font-black tracking-normal sm:text-6xl">
                Learn to drive with LDA
              </h1>
              <p className="mt-5 max-w-lg text-lg leading-8 text-zinc-700">
                Book verified local driving instructors, compare upfront prices, choose a lesson time, and pay online in a few clear steps.
              </p>
              <div className="mt-auto hidden pt-8 lg:block">
                <OnDemandLessonCard />
              </div>
            </div>

            <section className="overflow-hidden rounded bg-white text-white shadow-sm lg:mt-8 lg:h-[calc(100%-2.5rem)] lg:self-stretch">
              <div className="relative flex h-full min-h-[430px] flex-col justify-end p-7 sm:p-10 lg:min-h-0">
                <img
                  src="/learner-instructor.jpg"
                  alt="Learner driver behind the wheel with an instructor in the passenger seat"
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <Link href="/smart-match" className="lda-pill lda-pill-sm absolute left-7 top-7 z-20 pointer-events-auto sm:left-auto sm:right-8">
                  LDA Smart Match
                </Link>
                <div className="relative z-10 pt-24">
                  <h2 className="max-w-4xl text-4xl font-black tracking-normal text-white drop-shadow-lg sm:text-5xl">
                    LDA finds the best local instructor for you.
                  </h2>
                  <p className="mt-4 max-w-4xl text-base font-bold leading-7 text-white drop-shadow">
                    Smart Match compares distance, instructor rating, price, car, transmission, availability, verification status, teaching strengths, and support preferences.
                  </p>
                  <div className="mt-6 rounded bg-white/95 p-4 text-black shadow-2xl backdrop-blur sm:max-w-2xl">
                    <div className="text-xs font-black uppercase text-zinc-500">LDA top tips to pass</div>
                    <div className="mt-1 text-xl font-black">Refresh your road skills before lesson day.</div>
                    <div className="mt-1 text-sm font-bold text-zinc-600">Highway Code updates, hazard practice, and skill-fade videos.</div>
                    <Link href="/roadworthy" className="lda-pill lda-pill-sm mt-4">
                      Open tips directory
                    </Link>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </section>

        <section className="bg-white px-4 pb-8 sm:px-6 lg:hidden">
          <OnDemandLessonCard className="mx-auto max-w-7xl md:grid-cols-[1fr_auto] md:items-center" />
        </section>

        <section id="discover" className="bg-white">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
            <h2 className="text-4xl font-black tracking-normal sm:text-5xl">Discover what you can do with LDA</h2>
            <div className="mt-9 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {suggestionCards.map((card) => {
                const stretchTitle = card.title === "Progress Tracker" || card.title === "Subscribe & Socials";
                return (
                <Link key={card.title} href={card.href} className={`group grid min-h-[210px] grid-cols-[1fr_150px] overflow-hidden rounded bg-zinc-100 p-6 text-black hover:bg-zinc-200 ${card.title === "Subscribe & Socials" ? "md:col-span-2 xl:col-span-3" : ""}`}>
                  {stretchTitle ? <h3 className="col-span-2 text-2xl font-black">{card.title}</h3> : null}
                  <div className="flex flex-col items-start">
                    {!stretchTitle ? <h3 className="text-2xl font-black">{card.title}</h3> : null}
                    <p className="mt-4 max-w-xs text-base leading-7 text-zinc-800">{card.body}</p>
                    <span className="lda-pill lda-pill-sm mt-auto">
                      {card.cta}
                    </span>
                  </div>
                  <CardVisual type={card.image} />
                </Link>
              );})}
            </div>
          </div>
        </section>

        <section id="safety" className="bg-white">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_1fr] lg:px-8 lg:py-14">
            <div>
              <h2 className="text-4xl font-black tracking-normal">Safety and trust before every lesson</h2>
              <p className="mt-4 max-w-xl text-lg leading-8 text-zinc-700">
                LDA is structured around verified instructors, transparent pricing, secure payments, and clear booking records.
              </p>
            </div>
            <div className="grid gap-3">
              {safetyItems.map((item) => (
                <div key={item} className="flex items-start gap-4 rounded bg-zinc-100 p-4">
                  <CheckCircle2 className="mt-0.5 shrink-0 text-brand" />
                  <span className="font-bold leading-7 text-zinc-900">{item}</span>
                </div>
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

function OnDemandLessonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`grid gap-4 rounded border border-zinc-200 bg-zinc-50 p-5 shadow-sm ${className}`}>
      <div>
        <div className="inline-flex items-center gap-2 text-sm font-black uppercase text-brand">
          <Clock3 size={17} /> On-demand lesson
        </div>
        <h2 className="mt-2 text-2xl font-black tracking-normal">Need an on-demand lesson?</h2>
        <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-zinc-700">
          Enter pickup details, verify your provisional licence, pay securely, then receive a booking reference and tracking link.
        </p>
      </div>
      <div className="grid w-full gap-3 justify-self-start sm:w-80">
        <Link href="/lesson-now" className="lda-pill w-full">
          On-demand lesson
        </Link>
        <Link href="/auth/sign-up?role=learner" className="lda-pill w-full">
          Book future lessons
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
    social: <Share2 size={68} />,
    progress: <ClipboardCheck size={68} />
  }[type];

  return (
    <div className="relative grid place-items-center text-black">
      <div className="grid h-24 w-24 place-items-center rounded bg-white text-brand shadow-sm transition group-hover:scale-105">
        {visual}
      </div>
    </div>
  );
}
