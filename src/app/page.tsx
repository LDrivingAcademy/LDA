import Link from "next/link";
import {
  CalendarCheck,
  CarFront,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  Clock3,
  HelpCircle,
  Navigation,
  RadioTower,
  Share2,
  Sparkles,
  Square,
  UsersRound
} from "lucide-react";
import { Brand } from "@/components/brand";
import { LanguageSelector } from "@/components/language-selector";
import { MainMenu } from "@/components/main-menu";
import { SiteFooter } from "@/components/site-footer";

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
    body: "Let LDA match you with instructors based on distance, rating, price, car, and next slot.",
    href: "/auth/login?role=learner",
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
    title: "Live tracking",
    body: "Preview how learners see distance, ETA, and instructor arrival once a lesson is accepted.",
    href: "/tracking",
    image: "tracking",
    cta: "Open tracking"
  },
  {
    title: "Progress tracker",
    body: "Instructors can send lesson feedback, update completed skills, and share videos before the next lesson.",
    href: "/progress-tracker",
    image: "progress",
    cta: "Open tracker"
  },
  {
    title: "Subscribe & socials",
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

export default function HomePage() {
  return (
    <>
      <header className="sticky top-0 z-30 bg-black text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-7">
            <Brand />
            <nav className="hidden items-center gap-7 lg:flex">
              <Link href="/auth/login?role=learner" className="rounded-full px-3 py-2 text-sm font-black text-white hover:ring-2 hover:ring-brand">Learners</Link>
              <Link href="/instructor" className="rounded-full px-3 py-2 text-sm font-black text-white hover:ring-2 hover:ring-brand">Instructors</Link>
              <Link href="#discover" className="rounded-full px-3 py-2 text-sm font-black text-white hover:ring-2 hover:ring-brand">Services</Link>
              <Link href="#safety" className="rounded-full px-3 py-2 text-sm font-black text-white hover:ring-2 hover:ring-brand">Safety</Link>
              <Link href="/about" className="rounded-full px-3 py-2 text-sm font-black text-white hover:ring-2 hover:ring-brand">
                About
              </Link>
            </nav>
          </div>
          <div className="hidden items-center gap-6 md:flex">
            <LanguageSelector />
            <Link href="/contact" className="inline-flex items-center gap-2 whitespace-nowrap text-sm font-black hover:text-zinc-300">
              <HelpCircle size={17} /> Help
            </Link>
            <Link href="/auth/login?role=learner" className="whitespace-nowrap text-sm font-black hover:text-zinc-300">Log in</Link>
            <Link href="/auth/login?role=learner" className="lda-pill lda-pill-sm whitespace-nowrap">Sign up</Link>
          </div>
          <div className="md:hidden">
            <MainMenu />
          </div>
        </div>
      </header>

      <main className="bg-white text-black">
        <section className="bg-white">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-7 sm:px-6 lg:grid-cols-[560px_1fr] lg:px-8 lg:py-10">
            <div className="py-2 lg:py-8">
              <h1 className="max-w-xl text-5xl font-black tracking-normal sm:text-6xl">
                Learn to drive with LDA
              </h1>
              <p className="mt-5 max-w-lg text-lg leading-8 text-zinc-700">
                Book verified local driving instructors, compare upfront prices, choose a lesson time, and pay online in a few clear steps.
              </p>

              <section className="mt-8 max-w-[560px]">
                <Link href="/lesson-now" className="lda-pill">
                  <Clock3 size={22} /> Lesson now
                </Link>

                <div className="mt-7 grid gap-3">
                  <div className="relative rounded bg-zinc-100 px-5 py-5">
                    <div className="absolute left-7 top-1/2 h-20 w-px bg-black" />
                    <div className="flex items-center gap-5">
                      <Circle className="relative z-10 fill-black text-black" size={18} />
                      <div>
                        <div className="text-sm font-bold text-zinc-500">Pickup location</div>
                        <div className="mt-1 text-xl font-black">Enter your postcode</div>
                      </div>
                      <Navigation className="ml-auto text-black" size={24} />
                    </div>
                  </div>

                  <div className="rounded bg-zinc-100 px-5 py-5">
                    <div className="flex items-center gap-5">
                      <Square className="fill-black text-black" size={18} />
                      <div>
                        <div className="text-sm font-bold text-zinc-500">Lesson preference</div>
                        <div className="mt-1 text-xl font-black">Automatic or Manual</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Link href="/auth/login?role=learner" className="lda-pill">
                    See lesson prices
                  </Link>
                  <Link href="/instructor" className="lda-pill">
                    Become an instructor
                  </Link>
                </div>
              </section>
            </div>

            <section className="overflow-hidden rounded bg-white text-white shadow-sm lg:mt-8">
              <div className="relative flex min-h-[430px] flex-col justify-end p-7 sm:p-10">
                <img
                  src="https://images.pexels.com/photos/4895404/pexels-photo-4895404.jpeg?auto=compress&cs=tinysrgb&w=1400"
                  alt="Learner driver behind the wheel with an instructor in the passenger seat"
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="lda-pill lda-pill-sm absolute left-7 top-7 sm:left-auto sm:right-8">
                  LDA Smart Match
                </div>
                <div className="relative z-10 pt-24">
                  <h2 className="max-w-4xl text-4xl font-black tracking-normal text-white drop-shadow-lg sm:text-5xl">
                    LDA finds the best local instructor for you.
                  </h2>
                  <p className="mt-4 max-w-4xl text-base font-bold leading-7 text-white drop-shadow">
                    Smart Match compares distance, instructor rating, price, car, transmission, availability, and verification status across local approved instructors.
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

        <section id="discover" className="bg-white">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
            <h2 className="text-4xl font-black tracking-normal sm:text-5xl">Discover what you can do with LDA</h2>
            <div className="mt-9 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {suggestionCards.map((card) => (
                <Link key={card.title} href={card.href} className="group grid min-h-[210px] grid-cols-[1fr_150px] overflow-hidden rounded bg-zinc-100 p-6 text-black hover:bg-zinc-200">
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
      <SiteFooter />
    </>
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
