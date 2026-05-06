import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  CalendarCheck,
  CarFront,
  CheckCircle2,
  CreditCard,
  LayoutDashboard,
  MapPin,
  Route,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  UsersRound
} from "lucide-react";
import { Brand } from "@/components/brand";
import { LiveLessonMap } from "@/components/live-lesson-map";
import { MainMenu } from "@/components/main-menu";
import { SiteFooter } from "@/components/site-footer";
import { adminKpis, bookingPipeline, complianceLinks, demoInstructors, instructorJourneyStages, learnerJourneyStages } from "@/lib/marketplace-content";
import { formatMoney } from "@/lib/money";

const roles = [
  {
    title: "Learner",
    href: "/auth/login?role=learner",
    icon: UsersRound,
    tone: "bg-brand text-white border-red-500/40",
    detail: "Set pickup, compare local approved instructors, book, pay, track, and review the instructor."
  },
  {
    title: "Instructor",
    href: "/instructor",
    icon: CarFront,
    tone: "bg-white text-ink border-zinc-700",
    detail: "Verify ADI/PDI status, publish availability, accept lesson jobs, and track payouts."
  },
  {
    title: "Admin",
    href: "/auth/login?role=admin&next=/admin",
    icon: LayoutDashboard,
    tone: "bg-zinc-950 text-white border-zinc-700",
    detail: "Separate control room for approvals, users, bookings, revenue, payouts, refunds, and disputes."
  }
];

const trustItems = [
  ["Admin-approved instructors", "ADI/PDI verification required before search visibility."],
  ["Full price before checkout", "No hidden booking fees before Stripe payment."],
  ["Privacy by design", "Only collect what is needed for booking, safety, payment, support, and legal duties."]
];

export default function HomePage() {
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-zinc-800 bg-ink text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Brand />
          <nav className="hidden items-center gap-1 md:flex">
            <Link href="#learner-flow" className="rounded px-3 py-2 text-sm font-semibold text-zinc-300 hover:bg-zinc-900 hover:text-white">Learners</Link>
            <Link href="/instructor" className="rounded px-3 py-2 text-sm font-semibold text-zinc-300 hover:bg-zinc-900 hover:text-white">Instructors</Link>
            <Link href="#tracking" className="rounded px-3 py-2 text-sm font-semibold text-zinc-300 hover:bg-zinc-900 hover:text-white">Live tracking</Link>
            <Link href="/privacy" className="rounded px-3 py-2 text-sm font-semibold text-zinc-300 hover:bg-zinc-900 hover:text-white">Compliance</Link>
          </nav>
          <MainMenu />
        </div>
      </header>

      <main className="bg-background">
        <section className="bg-ink text-white">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_440px] lg:px-8 lg:py-14">
            <div>
              <div className="inline-flex items-center gap-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-bold text-red-100">
                <ShieldCheck size={16} /> UK learner-driver marketplace
              </div>
              <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-normal sm:text-6xl">Click. Learn. Drive.</h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-300">
                One professional web app for learners, instructors, and admin. Learners book like an Uber-style journey; instructors manage lesson jobs; admin controls the online driving school.
              </p>
              <div className="mt-8 grid gap-3 xl:grid-cols-3">
                {roles.map((role) => {
                  const Icon = role.icon;
                  return (
                    <Link key={role.title} href={role.href} className={`group rounded border p-5 shadow-xl ${role.tone}`}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-2xl font-black">{role.title}</div>
                        <Icon className="transition group-hover:translate-x-1" />
                      </div>
                      <p className="mt-3 text-sm leading-6 opacity-80">{role.detail}</p>
                    </Link>
                  );
                })}
              </div>
            </div>

            <section className="rounded border border-zinc-800 bg-white p-5 text-foreground shadow-2xl">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold uppercase text-brand">Learner preview</div>
                  <div className="text-2xl font-black">Find a nearby instructor</div>
                </div>
                <SlidersHorizontal className="text-brand" />
              </div>
              <div className="grid gap-3">
                {["Pickup: EN5 5XY", "Transmission: Automatic", "Price: GBP30-GBP45/hr", "Availability: This week"].map((item) => (
                  <div key={item} className="rounded border border-border bg-background px-3 py-3 text-sm font-black">{item}</div>
                ))}
                <Link href="/auth/login?role=learner" className="mt-2 inline-flex items-center justify-center gap-2 rounded bg-brand px-4 py-3 text-sm font-black text-white hover:bg-brand-strong">
                  Start learner journey <ArrowRight size={16} />
                </Link>
              </div>
            </section>
          </div>
        </section>

        <section className="border-y border-border bg-white">
          <div className="mx-auto grid max-w-7xl gap-4 px-4 py-6 sm:grid-cols-3 sm:px-6 lg:px-8">
            {trustItems.map(([title, detail]) => (
              <div key={title} className="rounded border border-border bg-card p-4">
                <CheckCircle2 className="mb-3 text-brand" size={20} />
                <div className="font-black">{title}</div>
                <div className="mt-1 text-sm leading-6 text-muted">{detail}</div>
              </div>
            ))}
          </div>
        </section>

        <section id="learner-flow" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[360px_1fr]">
            <div>
              <div className="text-sm font-black uppercase text-brand">Learner journey</div>
              <h2 className="mt-2 text-3xl font-black tracking-normal">Uber-style lesson booking stages</h2>
              <p className="mt-3 text-base leading-7 text-muted">After login, learners move through preference selection, local instructor comparison, booking, Stripe payment, confirmation, tracking, and instructor review.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {learnerJourneyStages.map((stage, index) => (
                <article key={stage.title} className="rounded border border-border bg-white p-4 shadow-sm">
                  <div className="text-xs font-black text-brand">Stage {index + 1}</div>
                  <h3 className="mt-2 font-black">{stage.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted">{stage.detail}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="mt-8 grid gap-4 xl:grid-cols-3">
            {demoInstructors.map((instructor) => (
              <article key={instructor.name} className="rounded border border-border bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="grid h-12 w-12 place-items-center rounded bg-ink text-lg font-black text-white">{instructor.name.slice(0, 1)}</div>
                    <h3 className="mt-4 text-xl font-black">{instructor.name}</h3>
                  </div>
                  <span className="rounded bg-red-50 px-2 py-1 text-xs font-black text-brand">Verified {instructor.type}</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted">{instructor.bio}</p>
                <div className="mt-4 grid gap-2 text-sm text-muted">
                  <span className="inline-flex items-center gap-2"><Star size={16} className="text-brand" /> {instructor.rating} instructor rating</span>
                  <span className="inline-flex items-center gap-2"><MapPin size={16} className="text-brand" /> {instructor.distance} away</span>
                  <span className="inline-flex items-center gap-2"><CarFront size={16} className="text-brand" /> {instructor.car}</span>
                </div>
                <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                  <div>
                    <div className="text-xs font-bold uppercase text-muted">Price</div>
                    <div className="text-2xl font-black">{formatMoney(instructor.price)}/hr</div>
                  </div>
                  <Link href="/auth/login?role=learner" className="rounded bg-ink px-3 py-2 text-sm font-bold text-white hover:bg-brand">Select</Link>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="bg-ink py-12 text-white">
          <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-[360px_1fr] lg:px-8">
            <div>
              <div className="text-sm font-black uppercase text-red-200">Instructor journey</div>
              <h2 className="mt-2 text-3xl font-black tracking-normal">Driver-style sign-in and job management</h2>
              <Link href="/instructor" className="mt-6 inline-flex items-center gap-2 rounded bg-white px-5 py-3 text-sm font-black text-ink hover:bg-zinc-100">
                Open instructor route <ArrowRight size={16} />
              </Link>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {instructorJourneyStages.map((stage) => (
                <div key={stage.title} className="rounded border border-zinc-800 bg-zinc-950 p-4">
                  <div className="font-black">{stage.title}</div>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">{stage.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <LiveLessonMap />

        <section className="border-y border-border bg-white">
          <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[320px_1fr] lg:px-8">
            <div>
              <div className="inline-flex items-center gap-2 rounded bg-red-50 px-3 py-2 text-sm font-black text-brand"><BellRing size={16} /> Admin analytics</div>
              <h2 className="mt-4 text-3xl font-black tracking-normal">Separate school-owner dashboard</h2>
              <p className="mt-3 text-sm leading-6 text-muted">KPIs focus on instructors and business performance. Learners can review instructors; there are no student reviews.</p>
              <Link href="/auth/login?role=admin&next=/admin" className="mt-5 inline-flex items-center gap-2 rounded bg-ink px-4 py-3 text-sm font-black text-white hover:bg-brand">
                Open admin login <ArrowRight size={16} />
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {adminKpis.map((kpi) => (
                <article key={kpi.label} className="rounded border border-border bg-card p-4">
                  <div className="text-sm font-bold text-muted">{kpi.label}</div>
                  <div className="mt-2 text-3xl font-black">{kpi.value}</div>
                  <p className="mt-1 text-sm leading-6 text-muted">{kpi.detail}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <div className="rounded border border-border bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-black uppercase text-brand"><CreditCard size={16} /> Booking pipeline</div>
              <div className="mt-4 grid gap-2 sm:grid-cols-4">
                {bookingPipeline.map((step, index) => <div key={step} className="rounded border border-border bg-background p-3 text-xs font-black">{index + 1}. {step}</div>)}
              </div>
            </div>
            <div className="rounded border border-border bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-black uppercase text-brand"><Route size={16} /> Compliance routes</div>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {complianceLinks.map((link) => <Link key={link.href} href={link.href} className="rounded border border-border bg-background p-3 text-sm font-black hover:border-brand">{link.label}</Link>)}
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
