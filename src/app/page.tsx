import Link from "next/link";
import {
  CalendarCheck,
  CarFront,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock3,
  HelpCircle,
  Mail,
  Navigation,
  Share2,
  Sparkles,
  Square,
  UsersRound
} from "lucide-react";
import { Brand } from "@/components/brand";
import { LanguageSelector } from "@/components/language-selector";
import { LiveLessonMap } from "@/components/live-lesson-map";
import { MainMenu } from "@/components/main-menu";
import { SiteFooter } from "@/components/site-footer";

type CardVisualType = "car" | "calendar" | "match" | "instructor";

const suggestionCards: {
  title: string;
  body: string;
  href: string;
  image: CardVisualType;
}[] = [
  {
    title: "Lesson",
    body: "Find a verified local instructor, choose manual or automatic, and book your next slot.",
    href: "/auth/login?role=learner",
    image: "car"
  },
  {
    title: "Reserve",
    body: "Plan ahead with visible availability, upfront price, pickup postcode, and cancellation terms.",
    href: "/auth/login?role=learner",
    image: "calendar"
  },
  {
    title: "Smart Match",
    body: "Let LDA match you with instructors based on distance, rating, price, car, and next slot.",
    href: "/auth/login?role=learner",
    image: "match"
  },
  {
    title: "Instructor",
    body: "Apply as an ADI/PDI, upload verification, set availability, and manage paid bookings.",
    href: "/instructor",
    image: "instructor"
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
              <Link href="/auth/login?role=learner" className="text-sm font-black text-white hover:text-zinc-300">Learners</Link>
              <Link href="/instructor" className="text-sm font-black text-white hover:text-zinc-300">Instructors</Link>
              <Link href="#discover" className="text-sm font-black text-white hover:text-zinc-300">Services</Link>
              <Link href="#safety" className="text-sm font-black text-white hover:text-zinc-300">Safety</Link>
              <Link href="/contact" className="inline-flex items-center gap-1 text-sm font-black text-white hover:text-zinc-300">
                About <ChevronDown size={15} />
              </Link>
            </nav>
          </div>
          <div className="hidden items-center gap-6 md:flex">
            <LanguageSelector />
            <Link href="/contact" className="inline-flex items-center gap-2 text-sm font-black hover:text-zinc-300">
              <HelpCircle size={17} /> Help
            </Link>
            <Link href="/auth/login?role=learner" className="text-sm font-black hover:text-zinc-300">Log in</Link>
            <Link href="/auth/login?role=learner" className="lda-pill lda-pill-sm">Sign up</Link>
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
                        <div className="mt-1 text-xl font-black">Automatic or manual</div>
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

            <section className="overflow-hidden rounded bg-white text-white shadow-sm">
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
                      Details
                    </span>
                  </div>
                  <CardVisual type={card.image} />
                </Link>
              ))}
            </div>
            <div className="mt-8 grid gap-5 rounded bg-zinc-100 p-6 md:grid-cols-[1fr_420px] md:items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded bg-white px-3 py-2 text-sm font-black text-brand">
                  <Share2 size={16} /> LDA socials and offers
                </div>
                <h3 className="mt-4 text-3xl font-black tracking-normal">Subscribe for deals, free trials, and learner tips.</h3>
                <p className="mt-3 max-w-2xl text-base leading-7 text-zinc-700">
                  Join the LDA email feed, then continue to our social media links page where each profile is clickable.
                </p>
              </div>
              <form action="/social" method="get" className="rounded bg-white p-4 shadow-sm">
                <input type="hidden" name="subscribed" value="1" />
                <label className="block text-sm font-black text-zinc-700" htmlFor="social-email">
                  Email address
                </label>
                <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                  <input
                    id="social-email"
                    name="email"
                    type="email"
                    required
                    placeholder="you@example.com"
                    className="min-h-12 flex-1 rounded border border-zinc-300 px-4 text-sm font-bold text-black"
                  />
                  <button className="lda-pill lda-pill-sm" type="submit">
                    <Mail size={16} /> Subscribe
                  </button>
                </div>
                <p className="mt-3 text-xs leading-5 text-zinc-500">
                  TODO: Connect this to Resend/Supabase newsletter consent storage before sending live marketing emails.
                </p>
              </form>
            </div>
          </div>
        </section>

        <LiveLessonMap />

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
    instructor: <UsersRound size={68} />
  }[type];

  return (
    <div className="relative grid place-items-center text-black">
      <div className="absolute h-24 w-24 rounded-full bg-white" />
      <div className="absolute h-16 w-32 rotate-[-18deg] rounded-full bg-red-500/10" />
      <div className="relative z-10 text-brand">{visual}</div>
    </div>
  );
}
