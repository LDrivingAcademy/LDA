import Link from "next/link";
import {
  ArrowRight,
  BadgePoundSterling,
  CalendarCheck,
  CarFront,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock3,
  Globe2,
  HelpCircle,
  MapPin,
  Navigation,
  Sparkles,
  Square,
  Star,
  UsersRound
} from "lucide-react";
import { Brand } from "@/components/brand";
import { LiveLessonMap } from "@/components/live-lesson-map";
import { MainMenu } from "@/components/main-menu";
import { SiteFooter } from "@/components/site-footer";
import { adminKpis, complianceLinks, demoInstructors } from "@/lib/marketplace-content";
import { formatMoney } from "@/lib/money";

type CardVisualType = "car" | "calendar" | "match" | "instructor" | "track" | "admin";

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
  },
  {
    title: "Track",
    body: "When your instructor is en route, see ETA and distance to your pickup postcode.",
    href: "#tracking",
    image: "track"
  },
  {
    title: "Admin",
    body: "Review instructors, learners, bookings, payments, refunds, disputes, and platform KPIs.",
    href: "/auth/login?role=admin&next=/admin",
    image: "admin"
  }
];

const safetyItems = [
  "ADI/PDI verification before instructors appear in search",
  "Learners confirm age 17+ and provisional licence before booking",
  "Full lesson price shown before checkout",
  "Live location only for accepted lessons when instructor starts en route"
];

export default function HomePage() {
  const featuredInstructor = demoInstructors[0];

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
            <span className="inline-flex items-center gap-2 text-sm font-black"><Globe2 size={17} /> EN</span>
            <Link href="/contact" className="inline-flex items-center gap-2 text-sm font-black hover:text-zinc-300">
              <HelpCircle size={17} /> Help
            </Link>
            <Link href="/auth/login?role=learner" className="text-sm font-black hover:text-zinc-300">Log in</Link>
            <Link href="/auth/login?role=learner" className="rounded-full bg-white px-5 py-3 text-sm font-black text-black hover:bg-zinc-200">Sign up</Link>
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
                Book verified local driving instructors, compare upfront prices, choose a lesson time, pay online, and track your instructor when they are on the way.
              </p>

              <section className="mt-8 max-w-[560px]">
                <button className="inline-flex items-center gap-3 rounded-full bg-zinc-100 px-5 py-4 text-base font-black text-black">
                  <Clock3 size={22} /> Lesson now <ChevronDown size={20} />
                </button>

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
                  <Link href="/auth/login?role=learner" className="rounded bg-black px-7 py-4 text-base font-black text-white hover:bg-zinc-800">
                    See lesson prices
                  </Link>
                  <Link href="/instructor" className="rounded bg-brand px-7 py-4 text-base font-black text-white hover:bg-brand-strong">
                    Become an instructor
                  </Link>
                </div>
              </section>
            </div>

            <section className="overflow-hidden rounded bg-black text-white">
              <div className="relative min-h-[430px] p-7 sm:p-10">
                <div className="absolute right-8 top-8 rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-black text-red-100">
                  LDA Smart Match
                </div>
                <div className="relative z-10 max-w-sm">
                  <img src="/lda-logo.jpg" alt="LDA Driving Academy" className="h-24 w-56 rounded object-contain" />
                  <h2 className="mt-8 text-4xl font-black tracking-normal">
                    LDA finds the best local instructor for you.
                  </h2>
                  <p className="mt-4 text-sm leading-6 text-zinc-300">
                    Smart Match compares distance, instructor rating, price, car, transmission, availability, and admin approval status.
                  </p>
                </div>
                <div className="absolute bottom-8 left-8 right-8 rounded bg-white p-4 text-black shadow-2xl sm:left-auto sm:w-80">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs font-black uppercase text-zinc-500">Best nearby match</div>
                      <div className="mt-1 text-xl font-black">{featuredInstructor.name}</div>
                      <div className="mt-1 text-sm font-bold text-zinc-600">{featuredInstructor.car}</div>
                    </div>
                    <div className="rounded-full bg-red-500/10 px-3 py-2 text-sm font-black text-brand">
                      {formatMoney(featuredInstructor.price)}/hr
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 text-sm font-bold text-zinc-700">
                    <span className="inline-flex items-center gap-2"><Star size={16} className="text-brand" /> {featuredInstructor.rating} rating</span>
                    <span className="inline-flex items-center gap-2"><MapPin size={16} className="text-brand" /> {featuredInstructor.distance} from pickup</span>
                    <span className="inline-flex items-center gap-2"><CalendarCheck size={16} className="text-brand" /> {featuredInstructor.next}</span>
                  </div>
                </div>
                <div className="absolute right-8 top-24 h-52 w-52 rounded-full border border-red-500/20" />
                <div className="absolute right-20 top-44 h-72 w-72 rounded-full border border-white/10" />
                <div className="absolute bottom-28 right-28 h-3 w-24 rotate-[-28deg] rounded-full bg-brand" />
                <div className="absolute bottom-40 right-16 h-3 w-16 rotate-[-28deg] rounded-full bg-white" />
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
                    <span className="mt-auto inline-flex rounded-full bg-white px-5 py-3 text-sm font-black text-black group-hover:bg-black group-hover:text-white">
                      Details
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
                LDA is structured around UK learner-driver compliance, verified instructors, transparent pricing, and consent-led live tracking.
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

        <LiveLessonMap />

        <section className="bg-white">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[320px_1fr] lg:px-8">
            <div>
              <h2 className="text-4xl font-black tracking-normal">Admin analytics</h2>
              <p className="mt-4 text-base leading-7 text-zinc-700">
                A separate owner login tracks the marketplace numbers that matter for an online driving school.
              </p>
              <Link href="/auth/login?role=admin&next=/admin" className="mt-6 inline-flex items-center gap-2 rounded bg-black px-5 py-3 text-sm font-black text-white hover:bg-zinc-800">
                Open admin login <ArrowRight size={16} />
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {adminKpis.map((kpi) => (
                <article key={kpi.label} className="rounded bg-zinc-100 p-5">
                  <div className="text-sm font-bold text-zinc-600">{kpi.label}</div>
                  <div className="mt-2 text-3xl font-black">{kpi.value}</div>
                  <p className="mt-2 text-sm leading-6 text-zinc-700">{kpi.detail}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[320px_1fr] lg:px-8">
            <div>
              <h2 className="text-4xl font-black tracking-normal">Compliance</h2>
              <p className="mt-4 text-base leading-7 text-zinc-700">
                Policies stay visible before real payments scale. Solicitor-reviewed wording should replace placeholder text before launch.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {complianceLinks.map((link) => (
                <Link key={link.href} href={link.href} className="rounded bg-zinc-100 p-5 font-black text-black hover:bg-zinc-200">
                  {link.label} <ArrowRight className="mt-4 text-brand" size={18} />
                </Link>
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
    track: <Navigation size={68} />,
    admin: <BadgePoundSterling size={68} />
  }[type];

  return (
    <div className="relative grid place-items-center text-black">
      <div className="absolute h-24 w-24 rounded-full bg-white" />
      <div className="absolute h-16 w-32 rotate-[-18deg] rounded-full bg-red-500/10" />
      <div className="relative z-10 text-brand">{visual}</div>
    </div>
  );
}
