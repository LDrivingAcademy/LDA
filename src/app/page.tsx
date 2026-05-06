import Link from "next/link";
import {
  ArrowRight,
  BadgePoundSterling,
  BellRing,
  CalendarCheck,
  CarFront,
  CheckCircle2,
  FileCheck2,
  LayoutDashboard,
  MapPin,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  UsersRound,
  type LucideIcon
} from "lucide-react";
import { Brand } from "@/components/brand";
import { LiveLessonMap } from "@/components/live-lesson-map";
import { MainMenu } from "@/components/main-menu";
import { SiteFooter } from "@/components/site-footer";
import {
  adminKpis,
  complianceLinks,
  demoInstructors,
  instructorSteps,
  learnerSteps
} from "@/lib/marketplace-content";
import { formatMoney } from "@/lib/money";

const rideSteps = [
  "Enter pickup",
  "Set preferences",
  "Choose instructor",
  "Pick time",
  "Pay",
  "Track arrival"
];

const trustItems = [
  ["Verified before visible", "ADI/PDI approval is required before instructors appear in learner search."],
  ["No hidden fees", "Learners see the full lesson price and cancellation terms before payment."],
  ["GPS only when needed", "Location sharing starts only for an accepted lesson when the instructor goes en route."]
];

const productCards: { icon: LucideIcon; title: string; detail: string }[] = [
  {
    icon: CalendarCheck,
    title: "Learner app",
    detail: "Search by postcode, compare instructors, confirm licence eligibility, book lessons, pay online, view bookings, and review instructors."
  },
  {
    icon: FileCheck2,
    title: "Instructor app",
    detail: "Submit verification, set profile and availability, manage bookings, start tracking, and monitor payouts."
  },
  {
    icon: BadgePoundSterling,
    title: "Admin dashboard",
    detail: "Approve instructors, manage refunds, disputes, promo codes, commission, payout status, and KPIs."
  }
];

export default function HomePage() {
  const featuredInstructor = demoInstructors[0];

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-zinc-800 bg-black text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Brand />
          <nav className="hidden items-center gap-1 md:flex">
            <Link href="#book" className="rounded px-3 py-2 text-sm font-semibold text-zinc-300 hover:bg-zinc-900 hover:text-white">Book</Link>
            <Link href="#tracking" className="rounded px-3 py-2 text-sm font-semibold text-zinc-300 hover:bg-zinc-900 hover:text-white">Track</Link>
            <Link href="/instructor" className="rounded px-3 py-2 text-sm font-semibold text-zinc-300 hover:bg-zinc-900 hover:text-white">Drive with LDA</Link>
            <Link href="/privacy" className="rounded px-3 py-2 text-sm font-semibold text-zinc-300 hover:bg-zinc-900 hover:text-white">Compliance</Link>
          </nav>
          <MainMenu />
        </div>
      </header>

      <main className="bg-black text-white">
        <section id="book" className="border-b border-zinc-900 bg-black">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_460px] lg:px-8 lg:py-12">
            <div className="flex min-h-[560px] flex-col justify-between">
              <div>
                <div className="mb-5 inline-flex items-center gap-2 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm font-black text-red-100">
                  <ShieldCheck size={16} /> Verified UK driving lessons
                </div>
                <h1 className="max-w-4xl text-5xl font-black tracking-normal sm:text-7xl">
                  Book a local instructor in a few taps.
                </h1>
                <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-300">
                  LDrivingAcademy gives learners an Uber-style lesson journey: enter pickup, compare approved instructors, choose price and time, pay securely, then track the instructor on the way.
                </p>
                <div className="mt-8 grid gap-3 sm:grid-cols-3">
                  <Link href="/auth/login?role=learner" className="group rounded border border-red-500 bg-brand p-5 text-white shadow-xl hover:bg-brand-strong">
                    <UsersRound className="mb-4" />
                    <div className="flex items-center justify-between gap-2 text-xl font-black">
                      Learner <ArrowRight className="transition group-hover:translate-x-1" />
                    </div>
                    <p className="mt-2 text-sm leading-6 text-red-50">Search, book, pay, track.</p>
                  </Link>
                  <Link href="/instructor" className="group rounded border border-zinc-800 bg-zinc-950 p-5 text-white hover:border-red-500">
                    <CarFront className="mb-4 text-brand" />
                    <div className="flex items-center justify-between gap-2 text-xl font-black">
                      Instructor <ArrowRight className="transition group-hover:translate-x-1" />
                    </div>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">Verify, accept jobs, earn.</p>
                  </Link>
                  <Link href="/auth/login?role=admin&next=/admin" className="group rounded border border-zinc-800 bg-zinc-950 p-5 text-white hover:border-red-500">
                    <LayoutDashboard className="mb-4 text-brand" />
                    <div className="flex items-center justify-between gap-2 text-xl font-black">
                      Admin <ArrowRight className="transition group-hover:translate-x-1" />
                    </div>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">Approvals, revenue, KPIs.</p>
                  </Link>
                </div>
              </div>

              <div className="mt-10 grid gap-3 sm:grid-cols-3">
                {trustItems.map(([title, detail]) => (
                  <article key={title} className="rounded border border-zinc-800 bg-zinc-950 p-4">
                    <CheckCircle2 className="mb-3 text-brand" size={20} />
                    <h2 className="font-black">{title}</h2>
                    <p className="mt-1 text-sm leading-6 text-zinc-400">{detail}</p>
                  </article>
                ))}
              </div>
            </div>

            <section className="rounded border border-zinc-800 bg-zinc-950 p-4 shadow-2xl">
              <div className="rounded border border-zinc-800 bg-black p-4">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-black uppercase text-brand">Lesson request</div>
                    <h2 className="mt-1 text-2xl font-black">Where are you learning?</h2>
                  </div>
                  <SlidersHorizontal className="text-brand" />
                </div>
                <div className="grid gap-3">
                  <div className="rounded border border-zinc-800 bg-zinc-950 p-4">
                    <div className="flex items-center gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded bg-brand"><MapPin size={18} /></span>
                      <div>
                        <div className="text-xs font-black uppercase text-zinc-500">Pickup</div>
                        <div className="font-black">Barnet EN5 5XY</div>
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <DarkSelect label="Transmission" value="Automatic preferred" />
                    <DarkSelect label="Price selector" value="GBP30-GBP45/hr" />
                    <DarkSelect label="Availability" value="Today or tomorrow" />
                    <DarkSelect label="Licence check" value="Age 17+ confirmed" />
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-3">
                {rideSteps.map((step, index) => (
                  <div key={step} className="flex items-center gap-3 rounded border border-zinc-800 bg-black p-3">
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded text-xs font-black ${index < 3 ? "bg-brand text-white" : "bg-zinc-900 text-zinc-400"}`}>{index + 1}</span>
                    <span className={index < 3 ? "font-black text-white" : "font-bold text-zinc-400"}>{step}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded border border-red-500/40 bg-red-500/10 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-black uppercase text-red-200">Best nearby match</div>
                    <h3 className="mt-1 text-xl font-black">{featuredInstructor.name}</h3>
                    <p className="mt-1 text-sm text-zinc-300">{featuredInstructor.car}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-red-100">Full price</div>
                    <div className="text-2xl font-black">{formatMoney(featuredInstructor.price)}</div>
                  </div>
                </div>
                <Link href="/auth/login?role=learner" className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded bg-brand px-4 py-3 text-sm font-black text-white hover:bg-brand-strong">
                  Continue to booking <ArrowRight size={16} />
                </Link>
              </div>
            </section>
          </div>
        </section>

        <section className="border-b border-zinc-900 bg-black">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[320px_1fr] lg:px-8">
            <div>
              <div className="text-sm font-black uppercase text-brand">Learner flow</div>
              <h2 className="mt-2 text-3xl font-black tracking-normal">From login to lesson complete.</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-400">The learner flow is arranged like a ride-booking web app, but adapted for UK lesson compliance and instructor verification.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {learnerSteps.map((step, index) => (
                <article key={step} className="rounded border border-zinc-800 bg-zinc-950 p-4">
                  <div className="grid h-9 w-9 place-items-center rounded bg-brand text-sm font-black">{index + 1}</div>
                  <p className="mt-4 text-sm font-black leading-6">{step}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-zinc-900 bg-black">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
            <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <div className="text-sm font-black uppercase text-brand">Nearby instructors</div>
                <h2 className="mt-2 text-3xl font-black tracking-normal">Compare price, rating, car, distance, and next slot.</h2>
              </div>
              <Link href="/auth/login?role=learner" className="inline-flex items-center justify-center gap-2 rounded bg-brand px-4 py-3 text-sm font-black text-white hover:bg-brand-strong">
                Find an instructor <ArrowRight size={16} />
              </Link>
            </div>
            <div className="grid gap-4 xl:grid-cols-3">
              {demoInstructors.map((instructor) => (
                <article key={instructor.name} className="rounded border border-zinc-800 bg-zinc-950 p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="grid h-12 w-12 place-items-center rounded bg-brand text-lg font-black text-white">{instructor.name.slice(0, 1)}</div>
                      <h3 className="mt-4 text-xl font-black">{instructor.name}</h3>
                    </div>
                    <span className="rounded bg-red-500/10 px-2 py-1 text-xs font-black text-red-100">Verified {instructor.type}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">{instructor.bio}</p>
                  <div className="mt-4 grid gap-2 text-sm text-zinc-300">
                    <span className="inline-flex items-center gap-2"><Star size={16} className="text-brand" /> {instructor.rating} instructor rating</span>
                    <span className="inline-flex items-center gap-2"><MapPin size={16} className="text-brand" /> {instructor.distance} away</span>
                    <span className="inline-flex items-center gap-2"><CarFront size={16} className="text-brand" /> {instructor.car}</span>
                    <span className="inline-flex items-center gap-2"><CalendarCheck size={16} className="text-brand" /> {instructor.next}</span>
                  </div>
                  <div className="mt-5 flex items-center justify-between border-t border-zinc-800 pt-4">
                    <div>
                      <div className="text-xs font-bold uppercase text-zinc-500">Price</div>
                      <div className="text-2xl font-black">{formatMoney(instructor.price)}/hr</div>
                    </div>
                    <Link href="/auth/login?role=learner" className="rounded bg-brand px-3 py-2 text-sm font-bold text-white hover:bg-brand-strong">Select</Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <LiveLessonMap />

        <section className="border-y border-zinc-900 bg-black py-12 text-white">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[1fr_1fr] lg:px-8">
            <div>
              <div className="text-sm font-black uppercase text-brand">Instructor flow</div>
              <h2 className="mt-2 text-3xl font-black tracking-normal">A separate driver-style path before login.</h2>
              <p className="mt-3 max-w-xl text-base leading-7 text-zinc-400">Instructors start with verification, then profile, availability, bookings, en-route tracking, earnings, and payout status.</p>
              <Link href="/instructor" className="mt-6 inline-flex items-center gap-2 rounded bg-brand px-5 py-3 text-sm font-black text-white hover:bg-brand-strong">
                Start instructor onboarding <ArrowRight size={16} />
              </Link>
            </div>
            <div className="grid gap-3">
              {instructorSteps.map((step, index) => (
                <div key={step} className="flex items-center gap-3 rounded border border-zinc-800 bg-zinc-950 p-4">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded bg-brand text-xs font-black text-white">{index + 1}</span>
                  <span className="font-semibold text-zinc-100">{step}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-zinc-900 bg-black">
          <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[320px_1fr] lg:px-8">
            <div>
              <div className="inline-flex items-center gap-2 rounded bg-red-500/10 px-3 py-2 text-sm font-black text-red-100">
                <BellRing size={16} /> Admin analytics
              </div>
              <h2 className="mt-4 text-3xl font-black tracking-normal">Owner dashboard stays separate.</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-400">KPIs focus on instructors, learners, bookings, revenue, payouts, cancellations, and instructor reviews.</p>
              <Link href="/auth/login?role=admin&next=/admin" className="mt-5 inline-flex items-center gap-2 rounded bg-brand px-4 py-3 text-sm font-black text-white hover:bg-brand-strong">
                Open admin login <ArrowRight size={16} />
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {adminKpis.map((kpi) => (
                <article key={kpi.label} className="rounded border border-zinc-800 bg-zinc-950 p-4">
                  <div className="text-sm font-bold text-zinc-500">{kpi.label}</div>
                  <div className="mt-2 text-3xl font-black">{kpi.value}</div>
                  <p className="mt-1 text-sm leading-6 text-zinc-400">{kpi.detail}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-black">
          <div className="mx-auto grid max-w-7xl gap-6 px-4 py-12 sm:px-6 lg:grid-cols-3 lg:px-8">
            {productCards.map(({ icon: Icon, title, detail }) => (
              <section key={title} className="rounded border border-zinc-800 bg-zinc-950 p-5 shadow-sm">
                <Icon className="mb-4 text-brand" />
                <h3 className="text-xl font-black">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-400">{detail}</p>
              </section>
            ))}
          </div>
        </section>

        <section className="border-t border-zinc-900 bg-black">
          <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[320px_1fr] lg:px-8">
            <div>
              <div className="inline-flex items-center gap-2 rounded bg-red-500/10 px-3 py-2 text-sm font-black text-red-100">
                <ShieldCheck size={16} /> Compliance first
              </div>
              <h2 className="mt-4 text-3xl font-black tracking-normal">Policies before real customers.</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-400">Privacy, terms, cancellation, cookies, and data requests stay visible before live payments scale.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {complianceLinks.map((link) => (
                <Link key={link.href} href={link.href} className="rounded border border-zinc-800 bg-zinc-950 p-4 font-black text-white hover:border-red-500">
                  {link.label} <ArrowRight className="mt-3 text-brand" size={18} />
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

function DarkSelect({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-zinc-800 bg-black px-3 py-3">
      <div className="text-xs font-bold uppercase text-zinc-500">{label}</div>
      <div className="mt-1 font-black text-white">{value}</div>
    </div>
  );
}
