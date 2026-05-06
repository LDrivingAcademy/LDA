import Link from "next/link";
import { ArrowLeft, ArrowRight, BadgeCheck, CalendarDays, CarFront, FileUp, MapPinned, ShieldCheck, WalletCards } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { instructorJourneyStages, instructorSteps } from "@/lib/marketplace-content";

const onboardingBlocks = [
  { title: "Verification", detail: "ADI/PDI status, badge number, ID, driving licence, insurance, and supporting evidence.", icon: FileUp },
  { title: "Profile", detail: "Bio, photo, car, transmission, covered areas, base postcode, hourly price, and auto-accept preference.", icon: CarFront },
  { title: "Availability", detail: "Publish lesson slots, block unavailable time, manage accepted bookings, and update learner notes.", icon: CalendarDays },
  { title: "Payouts", detail: "Stripe Connect account, gross lesson value, platform commission, net earnings, and payout status.", icon: WalletCards }
];

export default function InstructorPage() {
  return (
    <>
      <main className="min-h-screen bg-background">
        <section className="bg-ink px-4 py-8 text-white sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-zinc-300 hover:text-white"><ArrowLeft size={16} /> Back to homepage</Link>
            <div className="grid gap-8 py-10 lg:grid-cols-[1fr_460px]">
              <div>
                <div className="inline-flex items-center gap-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-black text-red-100"><ShieldCheck size={16} /> Instructor onboarding</div>
                <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-normal sm:text-6xl">Join LDA as a verified driving instructor.</h1>
                <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-300">Instructors have a separate route from learners. Submit verification, set your profile and pricing, publish availability, then wait for admin approval before appearing in search.</p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link href="/auth/login?role=instructor" className="inline-flex items-center gap-2 rounded bg-brand px-5 py-3 text-sm font-black text-white hover:bg-brand-strong">Start instructor sign up <ArrowRight size={16} /></Link>
                  <Link href="/terms" className="inline-flex items-center gap-2 rounded border border-zinc-700 bg-white px-5 py-3 text-sm font-black text-ink hover:bg-zinc-100">Read instructor terms</Link>
                </div>
              </div>
              <div className="rounded border border-zinc-800 bg-white p-5 text-foreground shadow-2xl">
                <div className="text-sm font-black uppercase text-brand">Approval checklist</div>
                <div className="mt-4 grid gap-3">{instructorSteps.map((step, index) => <div key={step} className="flex gap-3 rounded border border-border bg-background p-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded bg-ink text-xs font-black text-white">{index + 1}</span><span className="text-sm font-bold leading-6">{step}</span></div>)}</div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="mb-8"><div className="text-sm font-black uppercase text-brand">Driver-style journey</div><h2 className="mt-2 text-3xl font-black">From sign-in to accepted lesson</h2></div>
          <div className="mb-10 grid gap-3 md:grid-cols-3">{instructorJourneyStages.map((stage, index) => <article key={stage.title} className="rounded border border-border bg-white p-4 shadow-sm"><div className="text-xs font-black text-brand">Stage {index + 1}</div><h3 className="mt-2 font-black">{stage.title}</h3><p className="mt-2 text-sm leading-6 text-muted">{stage.detail}</p></article>)}</div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {onboardingBlocks.map((block) => {
              const Icon = block.icon;
              return <article key={block.title} className="rounded border border-border bg-white p-5 shadow-sm"><Icon className="text-brand" /><h2 className="mt-4 text-xl font-black">{block.title}</h2><p className="mt-2 text-sm leading-6 text-muted">{block.detail}</p></article>;
            })}
          </div>
        </section>

        <section className="border-y border-border bg-white">
          <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[360px_1fr] lg:px-8">
            <div><div className="inline-flex items-center gap-2 rounded bg-red-50 px-3 py-2 text-sm font-black text-brand"><BadgeCheck size={16} /> Search visibility</div><h2 className="mt-4 text-3xl font-black">No approval, no listing.</h2><p className="mt-3 text-sm leading-6 text-muted">Admin must approve an instructor before they appear in postcode search or receive bookings.</p></div>
            <div className="grid gap-3 sm:grid-cols-3">{["Verification pending", "Approved profile", "Live availability"].map((item) => <div key={item} className="rounded border border-border bg-card p-4"><MapPinned className="mb-3 text-brand" size={20} /><div className="font-black">{item}</div></div>)}</div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
