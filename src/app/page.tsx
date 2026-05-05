import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, BadgePoundSterling, CalendarCheck, FileCheck2, ShieldCheck, Star } from "lucide-react";
import { Brand } from "@/components/brand";
import { formatMoney } from "@/lib/money";

const instructors = [
  { name: "Amelia Khan", type: "ADI", price: 4200, transmission: "automatic", areas: "Barnet, Finchley, Edgware", rating: "4.9", bio: "Patient instructor focused on nervous learners, test route confidence, and calm city driving." },
  { name: "Marcus Reed", type: "ADI", price: 3900, transmission: "manual", areas: "Hendon, Golders Green, Brent Cross", rating: "4.8", bio: "Manual specialist with structured lesson plans, motorway confidence sessions, and mock tests." }
];

const stats = [
  ["Total users", "154", "126 learners, 28 instructors"],
  ["Active instructors", "19", "Approved and searchable"],
  ["Bookings", "312", "Last 30 days"],
  ["Gross lesson value", "£12,840", "Paid bookings"]
];

function Panel({ children }: { children: ReactNode }) {
  return <section className="rounded border border-border bg-card p-5">{children}</section>;
}

export default function HomePage() {
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border bg-background/92 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Brand />
          <nav className="hidden items-center gap-1 md:flex">
            <Link href="#search" className="rounded px-3 py-2 text-sm font-semibold text-muted hover:bg-white">Find an instructor</Link>
            <Link href="#instructors" className="rounded px-3 py-2 text-sm font-semibold text-muted hover:bg-white">Become an instructor</Link>
            <Link href="#admin" className="rounded px-3 py-2 text-sm font-semibold text-muted hover:bg-white">Admin</Link>
          </nav>
          <Link href="#search" className="inline-flex items-center gap-2 rounded bg-brand px-3 py-2 text-sm font-bold text-white hover:bg-brand-strong"><ShieldCheck size={16} /> Start <ArrowRight size={16} /></Link>
        </div>
      </header>
      <main>
        <section className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_420px] lg:px-8">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex rounded bg-white px-3 py-2 text-sm font-bold text-brand">LDA / L Driving Academy</div>
            <h1 className="text-4xl font-black tracking-normal text-foreground sm:text-6xl">Click. Learn. Drive.</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-muted">A UK learner-driver marketplace for finding verified instructors, comparing availability, seeing the full lesson price, booking online, and paying securely.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="#search" className="inline-flex items-center justify-center gap-2 rounded bg-brand px-4 py-2 text-sm font-bold text-white hover:bg-brand-strong">Find an instructor <ArrowRight size={16} /></Link>
              <Link href="#instructors" className="inline-flex items-center justify-center gap-2 rounded border border-border bg-white px-4 py-2 text-sm font-bold text-foreground hover:bg-background">Become an instructor</Link>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[["Verified ADI/PDI", "Admin approval before search visibility"], ["Transparent prices", "Full lesson total before checkout"], ["Secure payments", "Stripe handles card data and payouts"]].map(([title, detail]) => (
                <div key={title} className="rounded border border-border bg-white p-4"><div className="font-black">{title}</div><div className="mt-1 text-sm leading-5 text-muted">{detail}</div></div>
              ))}
            </div>
          </div>
          <Panel>
            <div className="mb-4 flex items-center justify-between"><div><div className="text-sm font-bold text-muted">Featured search</div><div className="text-xl font-black">Barnet launch area</div></div><ShieldCheck className="text-brand" /></div>
            <div id="search" className="space-y-3">
              {instructors.map((instructor) => (
                <article key={instructor.name} className="rounded border border-border bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-black">{instructor.name}</h2><span className="rounded bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-800">Verified {instructor.type}</span></div>
                  <p className="mt-2 text-sm leading-6 text-muted">{instructor.bio}</p>
                  <div className="mt-3 flex flex-wrap gap-3 text-sm text-muted"><span className="inline-flex items-center gap-1"><Star size={16} /> {instructor.rating}</span><span>{instructor.areas}</span><span className="capitalize">{instructor.transmission}</span></div>
                  <div className="mt-3 text-2xl font-black">{formatMoney(instructor.price)}/hr</div>
                </article>
              ))}
            </div>
          </Panel>
        </section>
        <section className="border-y border-border bg-white"><div className="mx-auto grid max-w-7xl gap-4 px-4 py-8 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">{stats.map(([label, value, detail]) => <div key={label} className="rounded border border-border bg-card p-4"><div className="text-sm font-semibold text-muted">{label}</div><div className="mt-2 text-2xl font-black">{value}</div><div className="mt-1 text-sm text-muted">{detail}</div></div>)}</div></section>
        <section id="admin" className="mx-auto grid max-w-7xl gap-6 px-4 py-12 sm:px-6 lg:grid-cols-3 lg:px-8">
          <Panel><CalendarCheck className="mb-4 text-brand" /><h2 className="text-xl font-black">For learners</h2><p className="mt-2 text-sm leading-6 text-muted">Search by postcode, compare instructors, confirm licence eligibility, book lessons, pay online, view bookings, and leave verified reviews.</p></Panel>
          <Panel><FileCheck2 className="mb-4 text-brand" /><h2 className="text-xl font-black">For instructors</h2><p className="mt-2 text-sm leading-6 text-muted">Submit ADI/PDI verification, set profile and availability, manage bookings, and track payouts after admin approval.</p></Panel>
          <Panel><BadgePoundSterling className="mb-4 text-brand" /><h2 className="text-xl font-black">For admins</h2><p className="mt-2 text-sm leading-6 text-muted">Approve instructors, manage bookings, refunds, disputes, promo codes, commission, payout status, and live marketplace KPIs.</p></Panel>
        </section>
      </main>
    </>
  );
}
