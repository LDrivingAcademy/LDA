import type { ReactNode } from "react";
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
import { formatMoney } from "@/lib/money";

const instructors = [
  { name: "Amelia Khan", type: "ADI", price: 4200, transmission: "automatic", areas: "Barnet, Finchley, Edgware", rating: "4.9", next: "Today 16:30", bio: "Patient instructor focused on nervous learners, test route confidence, and calm city driving." },
  { name: "Marcus Reed", type: "ADI", price: 3900, transmission: "manual", areas: "Hendon, Golders Green, Brent Cross", rating: "4.8", next: "Thu 10:00", bio: "Manual specialist with structured lesson plans, motorway confidence sessions, and mock tests." },
  { name: "Priya Shah", type: "PDI", price: 3600, transmission: "manual", areas: "Harrow, Wembley, Kenton", rating: "4.7", next: "Fri 13:00", bio: "Structured lessons for first-time drivers, mock test prep, and weekly progress notes." }
];

const stats = [
  ["Verified instructors", "19", "ADI/PDI approved before search visibility"],
  ["Bookings", "312", "Tracked from request to completed lesson"],
  ["Gross lesson value", "£12.8k", "Full price shown before checkout"],
  ["Platform controls", "100%", "Admin approval, refunds, disputes, payouts"]
];

function Panel({ children }: { children: ReactNode }) {
  return <section className="rounded border border-border bg-card p-5 shadow-sm">{children}</section>;
}

function SectionHeader({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <div className="mx-auto mb-8 max-w-3xl text-center">
      <div className="text-sm font-black uppercase tracking-normal text-brand">{eyebrow}</div>
      <h2 className="mt-2 text-3xl font-black tracking-normal text-foreground sm:text-4xl">{title}</h2>
      <p className="mt-3 text-base leading-7 text-muted">{body}</p>
    </div>
  );
}

export default function HomePage() {
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-zinc-800 bg-ink text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Brand />
          <nav className="hidden items-center gap-1 md:flex">
            <Link href="#search" className="rounded px-3 py-2 text-sm font-semibold text-zinc-300 hover:bg-zinc-900 hover:text-white">Find an instructor</Link>
            <Link href="#tracking" className="rounded px-3 py-2 text-sm font-semibold text-zinc-300 hover:bg-zinc-900 hover:text-white">Live tracking</Link>
            <Link href="#instructors" className="rounded px-3 py-2 text-sm font-semibold text-zinc-300 hover:bg-zinc-900 hover:text-white">Become an instructor</Link>
            <Link href="#admin" className="rounded px-3 py-2 text-sm font-semibold text-zinc-300 hover:bg-zinc-900 hover:text-white">Admin</Link>
          </nav>
          <Link href="#search" className="inline-flex items-center gap-2 rounded bg-brand px-3 py-2 text-sm font-bold text-white hover:bg-brand-strong"><ShieldCheck size={16} /> Start <ArrowRight size={16} /></Link>
        </div>
      </header>
      <main className="bg-background">
        <section className="bg-ink text-white">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_460px] lg:px-8 lg:py-16">
            <div className="max-w-3xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-bold text-red-100">
                <ShieldCheck size={16} /> Verified UK driving instructors
              </div>
              <h1 className="text-4xl font-black tracking-normal sm:text-6xl">Book trusted driving lessons without the back-and-forth.</h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-300">LDA connects learner drivers with verified ADI/PDI instructors, clear availability, upfront pricing, secure checkout, and admin-controlled marketplace operations.</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="#search" className="inline-flex items-center justify-center gap-2 rounded bg-brand px-5 py-3 text-sm font-bold text-white hover:bg-brand-strong">Find an instructor <ArrowRight size={16} /></Link>
                <Link href="#instructors" className="inline-flex items-center justify-center gap-2 rounded border border-zinc-700 bg-white px-5 py-3 text-sm font-bold text-ink hover:bg-zinc-100">Become an instructor</Link>
              </div>
              <div className="mt-10 grid gap-3 sm:grid-cols-3">
                {[["No hidden fees", "See the complete lesson price first"], ["Verified before listing", "Instructor approval controlled by admin"], ["Built for payouts", "Stripe Connect ready for commissions"]].map(([title, detail]) => (
                  <div key={title} className="rounded border border-zinc-800 bg-zinc-950 p-4">
                    <CheckCircle2 className="mb-3 text-brand" size={20} />
                    <div className="font-black">{title}</div>
                    <div className="mt-1 text-sm leading-5 text-zinc-400">{detail}</div>
                  </div>
                ))}
              </div>
            </div>
            <section id="search" className="rounded border border-zinc-800 bg-white p-5 text-foreground shadow-2xl">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold uppercase text-brand">Learner search</div>
                  <div className="text-2xl font-black">Find lessons near you</div>
                </div>
                <SlidersHorizontal className="text-brand" />
              </div>
              <div className="grid gap-3">
                <label className="block">
                  <span className="text-sm font-bold text-muted">Postcode or town</span>
                  <div className="mt-1 flex items-center gap-2 rounded border border-border bg-background px-3 py-3">
                    <MapPin size={18} className="text-brand" />
                    <span className="font-semibold text-foreground">EN5 5XY</span>
                  </div>
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-bold text-muted">Transmission</span>
                    <div className="mt-1 rounded border border-border bg-background px-3 py-3 font-semibold">Manual or automatic</div>
                  </label>
                  <label className="block">
                    <span className="text-sm font-bold text-muted">Availability</span>
                    <div className="mt-1 rounded border border-border bg-background px-3 py-3 font-semibold">This week</div>
                  </label>
                </div>
                <Link href="#results" className="mt-2 inline-flex items-center justify-center gap-2 rounded bg-brand px-4 py-3 text-sm font-black text-white hover:bg-brand-strong">Search approved instructors <ArrowRight size={16} /></Link>
              </div>
            </section>
          </div>
        </section>

        <section className="border-y border-border bg-white">
          <div className="mx-auto grid max-w-7xl gap-4 px-4 py-6 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
            {stats.map(([label, value, detail]) => (
              <div key={label} className="rounded border border-border bg-card p-4">
                <div className="text-sm font-semibold text-muted">{label}</div>
                <div className="mt-2 text-3xl font-black text-foreground">{value}</div>
                <div className="mt-1 text-sm leading-5 text-muted">{detail}</div>
              </div>
            ))}
          </div>
        </section>

        <section id="results" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <SectionHeader
            eyebrow="Marketplace"
            title="Compare instructors before you book"
            body="Learners can review rating, price, areas covered, car type, next availability, and verification status before paying."
          />
          <div className="grid gap-4 lg:grid-cols-3">
            {instructors.map((instructor) => (
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
                  <span className="inline-flex items-center gap-2"><MapPin size={16} className="text-brand" /> {instructor.areas}</span>
                  <span className="inline-flex items-center gap-2"><CarFront size={16} className="text-brand" /> <span className="capitalize">{instructor.transmission}</span></span>
                  <span className="inline-flex items-center gap-2"><Clock3 size={16} className="text-brand" /> Next slot: {instructor.next}</span>
                </div>
                <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                  <div>
                    <div className="text-xs font-bold uppercase text-muted">Upfront price</div>
                    <div className="text-2xl font-black">{formatMoney(instructor.price)}/hr</div>
                  </div>
                  <Link href="#booking" className="rounded bg-ink px-3 py-2 text-sm font-bold text-white hover:bg-brand">Book</Link>
                </div>
              </article>
            ))}
          </div>
        </section>

        <LiveLessonMap />

        <section id="booking" className="bg-ink py-12 text-white">
          <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-[1fr_1fr] lg:px-8">
            <div>
              <div className="text-sm font-black uppercase text-red-200">Booking flow</div>
              <h2 className="mt-2 text-3xl font-black tracking-normal">Full price before payment. Verified instructors before visibility.</h2>
              <p className="mt-3 max-w-xl text-base leading-7 text-zinc-300">The product structure is ready for postcode search, licence confirmation, lesson slot booking, Stripe checkout, instructor payouts, reviews, and admin approval.</p>
            </div>
            <div className="grid gap-3">
              {["Learner confirms age 17+ and provisional licence", "Instructor must be approved as ADI/PDI", "Lesson total shown before Stripe checkout", "Admin can manage refunds, disputes, and commission"].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded border border-zinc-800 bg-zinc-950 p-4">
                  <CheckCircle2 className="shrink-0 text-brand" size={20} />
                  <span className="font-semibold text-zinc-100">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="instructors" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <SectionHeader
            eyebrow="Operations"
            title="Separate areas for learners, instructors, and admin"
            body="The homepage now presents the actual marketplace roles clearly, with trust, booking, verification, and payment controls up front."
          />
          <div className="grid gap-6 lg:grid-cols-3">
            <Panel><CalendarCheck className="mb-4 text-brand" /><h3 className="text-xl font-black">Learner app</h3><p className="mt-2 text-sm leading-6 text-muted">Search by postcode, compare instructors, confirm licence eligibility, book lessons, pay online, view bookings, and leave verified reviews.</p></Panel>
            <Panel><FileCheck2 className="mb-4 text-brand" /><h3 className="text-xl font-black">Instructor app</h3><p className="mt-2 text-sm leading-6 text-muted">Submit ADI/PDI verification, set profile and availability, manage bookings, and track payouts after admin approval.</p></Panel>
            <Panel><BadgePoundSterling className="mb-4 text-brand" /><h3 className="text-xl font-black">Admin dashboard</h3><p className="mt-2 text-sm leading-6 text-muted">Approve instructors, manage bookings, refunds, disputes, promo codes, commission, payout status, and live marketplace KPIs.</p></Panel>
          </div>
        </section>

        <section id="admin" className="border-t border-border bg-white">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
            <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
              <div>
                <div className="inline-flex items-center gap-2 rounded bg-red-50 px-3 py-2 text-sm font-black text-brand"><UsersRound size={16} /> Admin control</div>
                <h2 className="mt-4 text-3xl font-black tracking-normal">Marketplace KPIs at a glance</h2>
                <p className="mt-3 text-base leading-7 text-muted">Built for approval queues, booking oversight, Stripe Connect payout tracking, refunds, disputes, and commission control.</p>
              </div>
              <div className="overflow-hidden rounded border border-border bg-card shadow-sm">
                {[
                  ["Instructor approvals", "7 pending", "Review ADI/PDI number, licence, insurance, and ID"],
                  ["Cancellations", "4 this week", "Apply policy and decide refund outcome"],
                  ["Platform commission", "12%", "Editable by admin before real payments go live"],
                  ["Average rating", "4.8", "Track review quality and learner satisfaction"]
                ].map(([label, value, detail]) => (
                  <div key={label} className="grid gap-2 border-b border-border p-4 last:border-b-0 sm:grid-cols-[180px_120px_1fr]">
                    <div className="font-black">{label}</div>
                    <div className="font-black text-brand">{value}</div>
                    <div className="text-sm leading-6 text-muted">{detail}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
