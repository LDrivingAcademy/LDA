import { AlertTriangle, BadgeCheck, CarFront, CreditCard, MapPin, ShieldCheck } from "lucide-react";
import { PageTopBar } from "@/components/page-top-bar";

const safetySections = [
  {
    title: "Verified instructor checks",
    body: "LDA is designed so instructors provide ADI/PDI information and supporting profile details before appearing as approved instructors on the platform.",
    icon: BadgeCheck
  },
  {
    title: "Clear booking records",
    body: "Learners should be able to see the instructor, lesson time, pickup details, price, booking reference, and cancellation position before and after booking.",
    icon: ShieldCheck
  },
  {
    title: "Secure payment flow",
    body: "Payments should be handled through LDA-approved checkout routes. Learners should not be asked to pay by private bank transfer, cash request, or off-platform link for an LDA booking.",
    icon: CreditCard
  },
  {
    title: "Pickup and lesson visibility",
    body: "Where live tracking or lesson-location tools are used, they should support accepted lessons, arrival clarity, and learner confidence while limiting unnecessary location data.",
    icon: MapPin
  },
  {
    title: "Vehicle and instructor responsibility",
    body: "Instructors remain responsible for keeping their vehicle roadworthy, insured, suitable for lessons, and compliant with driving instruction requirements.",
    icon: CarFront
  },
  {
    title: "Report safety concerns",
    body: "Learners and instructors should report unsafe conduct, off-platform payment requests, repeated cancellations, no-shows, vehicle concerns, or any issue that affects lesson safety.",
    icon: AlertTriangle
  }
];

const policyPoints = [
  "Learners must be legally entitled and fit to drive before taking lessons.",
  "Instructors should deliver lessons professionally, safely, and in line with UK road rules and DVSA expectations.",
  "LDA booking records, cancellation evidence, payment references, progress notes, and support requests should stay inside the platform where possible.",
  "Urgent danger, road incidents, medical emergencies, or immediate threats should be handled through emergency services first.",
  "LDA may review accounts, bookings, reports, and support records where safety, fraud, payment misuse, or off-platform behaviour is suspected."
];

export default function SafetyPage() {
  return (
    <main className="min-h-screen bg-white text-black">
      <PageTopBar />

      <section className="bg-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 rounded border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm font-black text-red-100">
            <ShieldCheck size={16} /> LDA safety policy
          </div>
          <h1 className="mt-5 max-w-4xl text-5xl font-black tracking-normal sm:text-6xl">
            Safety before every lesson.
          </h1>
          <p className="mt-5 max-w-3xl text-lg font-semibold leading-8 text-zinc-300">
            LDA is built around clear booking records, verified instructor flows, secure payments, support routes, and practical safeguards for learners and instructors.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {safetySections.map((section) => {
            const Icon = section.icon;
            return (
              <article key={section.title} className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
                <Icon className="text-brand" />
                <h2 className="mt-4 text-xl font-black">{section.title}</h2>
                <p className="mt-3 text-sm font-semibold leading-6 text-zinc-700">{section.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="border-y border-zinc-200 bg-zinc-50">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[360px_1fr] lg:px-8">
          <div>
            <div className="text-sm font-black uppercase text-brand">Safety standards</div>
            <h2 className="mt-3 text-3xl font-black">What LDA expects.</h2>
          </div>
          <div className="grid gap-3">
            {policyPoints.map((point) => (
              <div key={point} className="rounded border border-zinc-200 bg-white p-4 text-sm font-bold leading-6 text-zinc-800 shadow-sm">
                {point}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-black">Need to report something?</h2>
          <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-zinc-700">
            Email LDA with the booking reference, instructor or learner name, screenshots if relevant, and a short explanation of what happened. If there is immediate danger, contact emergency services first.
          </p>
          <a href="mailto:info@ldrivingacademy.co.uk?subject=LDA%20safety%20report" className="lda-pill lda-pill-sm mt-5">
            Report a safety concern
          </a>
        </div>
      </section>
    </main>
  );
}
