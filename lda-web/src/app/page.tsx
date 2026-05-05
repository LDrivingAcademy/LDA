import Link from "next/link";
import { ArrowRight, BadgePoundSterling, CalendarCheck, FileCheck2, ShieldCheck } from "lucide-react";
import { InstructorCard } from "@/components/instructor-card";
import { SiteHeader } from "@/components/site-header";
import { Panel, StatCard, buttonClass, secondaryButtonClass } from "@/components/ui";
import { instructors, kpis } from "@/lib/demo-data";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_420px] lg:px-8">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex rounded bg-white px-3 py-2 text-sm font-bold text-brand">LDA / L Driving Academy</div>
            <h1 className="text-4xl font-black tracking-normal text-foreground sm:text-6xl">Click. Learn. Drive.</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-muted">A UK learner-driver marketplace for finding verified instructors, comparing availability, seeing the full lesson price, booking online, and paying securely.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/learner/search" className={buttonClass}>Find an instructor <ArrowRight size={16} aria-hidden="true" /></Link>
              <Link href="/instructor/onboarding" className={secondaryButtonClass}>Become an instructor</Link>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[["Verified ADI/PDI", "Admin approval before search visibility"], ["Transparent prices", "Full lesson total before checkout"], ["Secure payments", "Stripe handles card data and payouts"]].map(([title, detail]) => (
                <div key={title} className="rounded border border-border bg-white p-4">
                  <div className="font-black">{title}</div>
                  <div className="mt-1 text-sm leading-5 text-muted">{detail}</div>
                </div>
              ))}
            </div>
          </div>
          <Panel className="self-start">
            <div className="mb-4 flex items-center justify-between">
              <div><div className="text-sm font-bold text-muted">Featured search</div><div className="text-xl font-black">Barnet launch area</div></div>
              <ShieldCheck className="text-brand" aria-hidden="true" />
            </div>
            <div className="space-y-3">{instructors.map((instructor) => <InstructorCard key={instructor.id} instructor={instructor} />)}</div>
          </Panel>
        </section>
        <section className="border-y border-border bg-white">
          <div className="mx-auto grid max-w-7xl gap-4 px-4 py-8 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">{kpis.map((kpi) => <StatCard key={kpi.label} {...kpi} />)}</div>
        </section>
        <section className="mx-auto grid max-w-7xl gap-6 px-4 py-12 sm:px-6 lg:grid-cols-3 lg:px-8">
          <Panel><CalendarCheck className="mb-4 text-brand" aria-hidden="true" /><h2 className="text-xl font-black">For learners</h2><p className="mt-2 text-sm leading-6 text-muted">Search by postcode, compare instructors, confirm licence eligibility, book lessons, pay online, view bookings, and leave verified reviews.</p></Panel>
          <Panel><FileCheck2 className="mb-4 text-brand" aria-hidden="true" /><h2 className="text-xl font-black">For instructors</h2><p className="mt-2 text-sm leading-6 text-muted">Submit ADI/PDI verification, set profile and availability, manage bookings, and track payouts after admin approval.</p></Panel>
          <Panel><BadgePoundSterling className="mb-4 text-brand" aria-hidden="true" /><h2 className="text-xl font-black">For admins</h2><p className="mt-2 text-sm leading-6 text-muted">Approve instructors, manage bookings, refunds, disputes, promo codes, commission, payout status, and live marketplace KPIs.</p></Panel>
        </section>
      </main>
    </>
  );
}
