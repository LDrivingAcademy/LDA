import Link from "next/link";
import {
  ArrowRight,
  BadgePoundSterling,
  CalendarCheck,
  CarFront,
  CheckCircle2,
  Clock3,
  FileCheck2,
  MapPin,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  UsersRound
} from "lucide-react";
import { Brand } from "@/components/brand";
import { LiveLessonMap } from "@/components/live-lesson-map";
import { SiteFooter } from "@/components/site-footer";
import { complianceLinks, demoInstructors, instructorSteps, learnerSteps } from "@/lib/marketplace-content";
import { formatMoney } from "@/lib/money";

const trustItems = [
  ["Admin-approved instructors", "Paid instructors must be verified as ADI/PDI before appearing in learner search."],
  ["Full price before checkout", "Learners see lesson price, platform handling, cancellation terms, and pickup details before payment."],
  ["Privacy by design", "Collect only the information needed for account, booking, payment, support, safety, and legal obligations."]
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
          <Link href="/auth/login?role=learner" className="inline-flex items-center gap-2 rounded bg-brand px-3 py-2 text-sm font-bold text-white hover:bg-brand-strong">
            Learner login <ArrowRight size={16} />
          </Link>
        </div>
      </header>

      <main className="bg-background">
        <section className="bg-ink text-white">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_480px] lg:px-8 lg:py-14">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-bold text-red-100">
                <ShieldCheck size={16} /> UK learner-driver marketplace
              </div>
              <h1 className="max-w-4xl text-4xl font-black tracking-normal sm:text-6xl">Choose your path, then book or manage lessons with confidence.</h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-300">
                LDA connects learners with approved local instructors, transparent hourly pricing, secure payments, verification controls, and clear cancellation/privacy terms.
              </p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <Link href="/auth/login?role=learner" className="group rounded border border-red-500/40 bg-brand p-5 text-white shadow-xl hover:bg-brand-strong">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-2xl font-black">I am a learner</div>
                    <ArrowRight className="transition group-hover:translate-x-1" />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-red-50">Sign up, confirm licence eligibility, search approved instructors, compare price and distance, then book.</p>
                </Link>
                <Link href="/instructor" className="group rounded border border-zinc-700 bg-white p-5 text-ink shadow-xl hover:bg-zinc-100">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-2xl font-black">I am an instructor</div>
                    <ArrowRight className="transition group-hover:translate-x-1" />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-zinc-600">Start onboarding before login: ADI/PDI details, documents, profile, pricing, areas, and availability.</p>
                </Link>
              </div>
            </div>

            <section className="rounded border border-zinc-800 bg-white p-5 text-foreground shadow-2xl">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold uppercase text-brand">Learner preview</div>
                  <div className="text-2xl font-black">Search local instructors</div>
                </div>
                <SlidersHorizontal className="text-brand" />
              </div>
              <div className="grid gap-3">
                <label className="block">
                  <span className="text-sm font-bold text-muted">Pickup postcode or town</span>
                  <div className="mt-1 flex items-center gap-2 rounded border border-border bg-background px-3 py-3">
                    <MapPin size={18} className="text-brand" />
                    <span className="font-semibold text-foreground">EN5 5XY</span>
                  </div>
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded border border-border bg-background px-3 py-3">
                    <div className="text-xs font-bold uppercase text-muted">Transmission</div>
                    <div className="mt-1 font-black">Manual / automatic</div>
                  </div>
                  <div className="rounded border border-border bg-background px-3 py-3">
                    <div className="text-xs font-bold uppercase text-muted">Max price</div>
                    <div className="mt-1 font-black">£45/hr</div>
                  </div>
                </div>
                <Link href="/auth/login?role=learner" className="mt-2 inline-flex items-center justify-center gap-2 rounded bg-brand px-4 py-3 text-sm font-black text-white hover:bg-brand-strong">
                  Continue as learner <ArrowRight size={16} />
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
              <h2 className="mt-2 text-3xl font-black tracking-normal">A professional step-by-step booking flow</h2>
              <p className="mt-3 text-base leading-7 text-muted">After login, learners should land on local instructors first, then narrow by distance, transmission, price, rating, and availability.</p>
              <div className="mt-5 grid gap-2">
                {learnerSteps.map((step, index) => (
                  <div key={step} className="flex items-center gap-3 rounded border border-border bg-white p-3">
                    <span className="grid h-7 w-7 place-items-center rounded bg-ink text-xs font-black text-white">{index + 1}</span>
                    <span className="text-sm font-bold">{step}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4">
              <div className="grid gap-3 rounded border border-border bg-white p-4 shadow-sm lg:grid-cols-4">
                {["EN5 5XY", "Automatic", "£30-£45/hr", "This week"].map((filter) => (
                  <div key={filter} className="rounded border border-border bg-background px-3 py-3 text-sm font-black">{filter}</div>
                ))}
              </div>
              <div className="grid gap-4 xl:grid-cols-3">
                {demoInstructors.map((instructor) => (
                  <article key={instructor.name} className="rounded border border-border bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="grid h-12 w-12 place-items-center rounded bg-ink text-lg font-black text-white">{instructor.name.slice(0, 1)}</div>
                        <h3 className="mt-4 text-xl font-black">{instructor.name}</h3>
                      </div>
                      <span className="rounded bg-red-50 px-2 py-1 text-xs font-black text-brand">Verified {instructor.type}</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted">{instructor.bio}</p>
                    <div className="mt-4 grid gap-2 text-sm text-muted">
                      <span className="inline-flex items-center gap-2"><Star size={16} className="text-brand" /> {instructor.rating} rating</span>
                      <span className="inline-flex items-center gap-2"><MapPin size={16} className="text-brand" /> {instructor.distance} away</span>
                      <span className="inline-flex items-center gap-2"><CarFront size={16} className="text-brand" /> {instructor.car}</span>
                      <span className="inline-flex items-center gap-2"><Clock3 size={16} className="text-brand" /> {instructor.next}</span>
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
            </div>
          </div>
        </section>

        <LiveLessonMap />

        <section className="bg-ink py-12 text-white">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[1fr_1fr] lg:px-8">
            <div>
              <div className="text-sm font-black uppercase text-red-200">Instructor onboarding</div>
              <h2 className="mt-2 text-3xl font-black tracking-normal">A separate instructor option before login</h2>
              <p className="mt-3 max-w-xl text-base leading-7 text-zinc-300">Instructors need a dedicated route so they are not dropped into the learner booking journey. Their path is verification-first, then profile, availability, and payout setup.</p>
              <Link href="/instructor" className="mt-6 inline-flex items-center gap-2 rounded bg-white px-5 py-3 text-sm font-black text-ink hover:bg-zinc-100">
                Open instructor onboarding <ArrowRight size={16} />
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

        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-3">
            <section className="rounded border border-border bg-card p-5 shadow-sm">
              <CalendarCheck className="mb-4 text-brand" />
              <h3 className="text-xl font-black">Learner app</h3>
              <p className="mt-2 text-sm leading-6 text-muted">Search by postcode, compare instructors, confirm licence eligibility, book lessons, pay online, view bookings, and leave verified reviews.</p>
            </section>
            <section className="rounded border border-border bg-card p-5 shadow-sm">
              <FileCheck2 className="mb-4 text-brand" />
              <h3 className="text-xl font-black">Instructor app</h3>
              <p className="mt-2 text-sm leading-6 text-muted">Submit ADI/PDI verification, set profile and availability, manage bookings, and track payouts after admin approval.</p>
            </section>
            <section className="rounded border border-border bg-card p-5 shadow-sm">
              <BadgePoundSterling className="mb-4 text-brand" />
              <h3 className="text-xl font-black">Admin dashboard</h3>
              <p className="mt-2 text-sm leading-6 text-muted">Approve instructors, manage bookings, refunds, disputes, promo codes, commission, payout status, and live marketplace KPIs.</p>
            </section>
          </div>
        </section>

        <section className="border-t border-border bg-white">
          <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[320px_1fr] lg:px-8">
            <div>
              <div className="inline-flex items-center gap-2 rounded bg-red-50 px-3 py-2 text-sm font-black text-brand"><UsersRound size={16} /> Compliance first</div>
              <h2 className="mt-4 text-3xl font-black tracking-normal">Clear policies before real customers</h2>
              <p className="mt-3 text-sm leading-6 text-muted">These pages are now part of the product, with solicitor-review TODOs for final wording.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {complianceLinks.map((link) => (
                <Link key={link.href} href={link.href} className="rounded border border-border bg-card p-4 font-black hover:border-brand">
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
