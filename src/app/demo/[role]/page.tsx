import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BadgePoundSterling,
  BellRing,
  CalendarCheck,
  CarFront,
  CreditCard,
  FileCheck2,
  LayoutDashboard,
  MapPin,
  Navigation,
  ShieldCheck,
  SlidersHorizontal,
  Star
} from "lucide-react";
import {
  adminKpis,
  bookingPipeline,
  demoInstructors,
  instructorJourneyStages,
  learnerSteps
} from "@/lib/marketplace-content";
import { formatMoney } from "@/lib/money";

const roleCopy = {
  learner: {
    eyebrow: "Demo learner",
    title: "Book a lesson like a ride.",
    body: "Search nearby approved instructors, choose preferences, compare price and distance, book a slot, pay, then track the instructor en route.",
    href: "/dashboard"
  },
  instructor: {
    eyebrow: "Demo instructor",
    title: "Manage lesson jobs like a driver.",
    body: "Complete verification, set profile and availability, receive booking notifications, go en route, complete lessons, and monitor payouts.",
    href: "/instructor"
  },
  admin: {
    eyebrow: "Demo admin",
    title: "Run the LDA control room.",
    body: "Review platform KPIs, instructor approvals, learners, bookings, payments, refunds, disputes, payout status, and instructor reviews.",
    href: "/admin"
  }
};

export default async function DemoRolePage({ params }: { params: Promise<{ role: string }> }) {
  const { role } = await params;

  if (!(role in roleCopy)) {
    notFound();
  }

  const copy = roleCopy[role as keyof typeof roleCopy];

  return (
    <main className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-900 bg-black px-4 py-6">
        <section className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/auth/login" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-zinc-300 hover:text-white">
              <ArrowLeft size={16} /> Back to login
            </Link>
            <div className="inline-flex items-center gap-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-black uppercase text-red-100">
              <ShieldCheck size={16} /> {copy.eyebrow}
            </div>
            <h1 className="mt-4 text-4xl font-black tracking-normal sm:text-5xl">{copy.title}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">{copy.body}</p>
          </div>
          <Link href={copy.href} className="lda-pill lda-pill-sm">
            Open live {role} area
          </Link>
        </section>
      </header>

      {role === "learner" ? <LearnerDemo /> : null}
      {role === "instructor" ? <InstructorDemo /> : null}
      {role === "admin" ? <AdminDemo /> : null}
    </main>
  );
}

function LearnerDemo() {
  const selectedInstructor = demoInstructors[0];

  return (
    <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[320px_1fr] lg:px-8">
      <aside className="rounded border border-zinc-800 bg-zinc-950 p-5 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-black uppercase text-brand">
          <SlidersHorizontal size={16} /> Request details
        </div>
        <div className="mt-5 grid gap-4">
          {[
            ["Pickup postcode", "EN5 5XY"],
            ["Distance", "Within 5 miles"],
            ["Transmission", "Automatic preferred"],
            ["Price selector", "GBP30-GBP45 per hour"],
            ["Availability", "Today or tomorrow"]
          ].map(([label, value]) => (
            <div key={label} className="grid gap-1">
              <span className="text-xs font-black uppercase text-zinc-500">{label}</span>
              <div className="rounded border border-zinc-800 bg-black px-3 py-3 text-sm font-bold">{value}</div>
            </div>
          ))}
        </div>
        <div className="mt-5 rounded border border-red-500/30 bg-red-500/10 p-4 text-sm leading-6 text-red-100">
          Before payment: confirm age 17+, valid provisional licence, pickup postcode, lesson time, cancellation window, and full price.
        </div>
      </aside>

      <div className="grid gap-5">
        <section className="rounded border border-zinc-800 bg-zinc-950 p-5 shadow-sm">
          <h2 className="text-2xl font-black">Approved instructors near you</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {learnerSteps.map((step, index) => (
              <div key={step} className="rounded border border-zinc-800 bg-black p-3">
                <div className="text-xs font-black text-brand">Step {index + 1}</div>
                <div className="mt-1 text-xs font-bold leading-5 text-zinc-200">{step}</div>
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-3">
          {demoInstructors.map((instructor) => (
            <article key={instructor.name} className="rounded border border-zinc-800 bg-zinc-950 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="grid h-12 w-12 place-items-center rounded bg-brand text-lg font-black text-white">{instructor.name.slice(0, 1)}</div>
                  <h3 className="mt-4 text-xl font-black">{instructor.name}</h3>
                </div>
                <span className="rounded bg-red-500/10 px-2 py-1 text-xs font-black text-red-100">Verified {instructor.type}</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-400">{instructor.bio}</p>
              <div className="mt-4 grid gap-2 text-sm text-zinc-300">
                <span className="inline-flex items-center gap-2"><Star size={16} className="text-brand" /> {instructor.rating} rating</span>
                <span className="inline-flex items-center gap-2"><MapPin size={16} className="text-brand" /> {instructor.distance} away</span>
                <span className="inline-flex items-center gap-2"><CarFront size={16} className="text-brand" /> {instructor.car}</span>
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-zinc-800 pt-4">
                <div>
                  <div className="text-xs font-bold uppercase text-zinc-500">Price</div>
                  <div className="text-2xl font-black">{formatMoney(instructor.price)}/hr</div>
                </div>
                <button className="lda-pill lda-pill-sm">Choose</button>
              </div>
            </article>
          ))}
        </div>

        <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <div className="rounded border border-zinc-800 bg-zinc-950 p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-black uppercase text-brand">
              <CalendarCheck size={16} /> Selected lesson
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <InfoBox label="Instructor" value={selectedInstructor.name} detail={selectedInstructor.car} />
              <InfoBox label="Time and pickup" value={selectedInstructor.next} detail="Barnet EN5 5XY" />
              <InfoBox label="Full upfront price" value={formatMoney(selectedInstructor.price)} detail="No hidden booking fee" />
            </div>
            <button className="lda-pill lda-pill-sm mt-5">
              <CreditCard size={16} /> Pay with Stripe
            </button>
          </div>
          <div className="rounded border border-zinc-800 bg-zinc-950 p-5 text-white shadow-sm">
            <div className="flex items-center gap-2 text-sm font-black uppercase text-brand">
              <Navigation size={16} /> Live tracking
            </div>
            <p className="mt-3 text-sm leading-6 text-zinc-400">
              When the instructor is en route, the learner sees distance and location updates every second.
            </p>
          </div>
        </section>
      </div>
    </section>
  );
}

function InstructorDemo() {
  return (
    <section className="mx-auto grid max-w-7xl gap-5 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_360px] lg:px-8">
      <div className="grid gap-5">
        <article className="rounded border border-zinc-800 bg-zinc-950 p-5 shadow-sm">
          <FileCheck2 className="text-brand" />
          <h2 className="mt-4 text-2xl font-black">Onboarding and verification</h2>
          <p className="mt-2 max-w-3xl text-zinc-400">
            Upload ADI/PDI evidence, ID, licence, insurance, profile photo, areas covered, hourly price, car details, and availability. You stay hidden from learner search until admin approval.
          </p>
          <Link href="/instructor" className="lda-pill lda-pill-sm mt-5">Open instructor setup</Link>
        </article>
        <div className="grid gap-3 md:grid-cols-3">
          {instructorJourneyStages.map((stage) => (
            <article key={stage.title} className="rounded border border-zinc-800 bg-zinc-950 p-4 shadow-sm">
              <h3 className="font-black">{stage.title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-400">{stage.detail}</p>
            </article>
          ))}
        </div>
      </div>
      <aside className="rounded border border-zinc-800 bg-zinc-950 p-5 text-white shadow-sm">
        <div className="flex items-center gap-2 text-sm font-black uppercase text-brand">
          <BellRing size={16} /> Notifications
        </div>
        <div className="mt-4 grid gap-3">
          {["New paid booking from learner", "Learner pickup postcode confirmed", "Start en route location sharing", "Lesson completed - payout pending"].map((item) => (
            <div key={item} className="rounded border border-zinc-800 bg-black p-3 text-sm font-bold leading-6">{item}</div>
          ))}
        </div>
      </aside>
    </section>
  );
}

function AdminDemo() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {adminKpis.map((kpi) => (
          <article key={kpi.label} className="rounded border border-zinc-800 bg-zinc-950 p-5 shadow-sm">
            <BadgePoundSterling className="text-brand" />
            <div className="mt-4 text-sm font-bold text-zinc-500">{kpi.label}</div>
            <div className="mt-2 text-3xl font-black">{kpi.value}</div>
            <p className="mt-1 text-sm leading-6 text-zinc-400">{kpi.detail}</p>
          </article>
        ))}
      </div>
      <section className="mt-8 rounded border border-zinc-800 bg-zinc-950 p-5 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-black uppercase text-brand">
          <LayoutDashboard size={16} /> Marketplace controls
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          {bookingPipeline.map((step, index) => (
            <div key={step} className="rounded border border-zinc-800 bg-black p-3 text-xs font-black">
              {index + 1}. {step}
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}

function InfoBox({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded border border-zinc-800 bg-black p-4">
      <div className="text-xs font-black uppercase text-zinc-500">{label}</div>
      <div className="mt-2 text-xl font-black">{value}</div>
      <div className="mt-1 text-sm text-zinc-400">{detail}</div>
    </div>
  );
}
