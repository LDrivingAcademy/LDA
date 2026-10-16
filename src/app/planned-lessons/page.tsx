import Link from "next/link";
import { ArrowRight, CalendarCheck, Clock3, MapPin, ShieldCheck } from "lucide-react";
import { PageTopBar } from "@/components/page-top-bar";
import { SiteFooter } from "@/components/site-footer";
import { getPageBackLink, type PageSourceSearchParams } from "@/lib/page-back-link";

export const metadata = {
  title: "Planned Driving Lessons | LDA",
  description:
    "Plan future LDA driving lessons, understand the booking route, and open the learner booking workspace for scheduled driving lessons.",
  keywords: [
    "planned driving lessons",
    "schedule driving lessons",
    "book future driving lessons",
    "driving lesson planner",
    "LDA planned lessons"
  ],
  alternates: {
    canonical: "/planned-lessons"
  },
  robots: {
    index: false,
    follow: false,
    nocache: true
  },
  openGraph: {
    title: "Planned Driving Lessons | LDA",
    description:
      "Use LDA to plan future driving lessons with pickup details, instructor availability, secure checkout, learner calendar records, and live tracking.",
    url: "/planned-lessons",
    type: "website"
  }
};

type PlannedLessonsPageProps = {
  searchParams?: PageSourceSearchParams;
};

const plannerSteps = [
  {
    title: "Choose the lesson route",
    body: "Start with planned lessons when you want a future slot, repeat lessons, or a structured weekly learning rhythm.",
    icon: CalendarCheck
  },
  {
    title: "Confirm pickup and preferences",
    body: "Use pickup location, transmission, availability, and support preferences to narrow the instructor search.",
    icon: MapPin
  },
  {
    title: "Book securely",
    body: "LDA keeps provisional licence checks, pricing, Stripe checkout, and booking references attached to the lesson record.",
    icon: ShieldCheck
  },
  {
    title: "Track what is booked",
    body: "Planned lessons appear in booking history and learner calendar, with live tracking when an accepted instructor is en route.",
    icon: Clock3
  }
];

export default async function PlannedLessonsPage({ searchParams }: PlannedLessonsPageProps) {
  const { backHref, backLabel } = await getPageBackLink(searchParams);

  return (
    <>
      <PageTopBar backHref={backHref} backLabel={backLabel} />
      <main className="min-h-screen bg-white text-black">
        <section className="bg-black text-white">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
            <div className="inline-flex items-center gap-2 rounded-full border border-red-500/60 bg-red-500/15 px-4 py-2 text-sm font-black text-red-100">
              <CalendarCheck size={17} /> Planned lessons
            </div>
            <h1 className="mt-5 max-w-4xl text-5xl font-black tracking-normal sm:text-6xl">
              Plan your next driving lessons before you need them.
            </h1>
            <p className="mt-5 max-w-3xl text-lg font-semibold leading-8 text-zinc-300">
              Use planned lessons when you want to compare instructors, choose future slots, keep lesson records tidy, and build a route that fits your week.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="grid gap-5 lg:grid-cols-4">
            {plannerSteps.map((step) => {
              const Icon = step.icon;

              return (
                <article key={step.title} className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
                  <div className="grid h-12 w-12 place-items-center rounded bg-red-50 text-brand">
                    <Icon size={24} />
                  </div>
                  <h2 className="mt-4 text-xl font-black">{step.title}</h2>
                  <p className="mt-2 text-sm font-semibold leading-6 text-zinc-600">{step.body}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
          <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <article className="rounded bg-zinc-100 p-6">
              <h2 className="text-3xl font-black">Open planned lesson booking.</h2>
              <p className="mt-3 max-w-2xl text-base font-semibold leading-7 text-zinc-700">
                This takes learners into the scheduled lessons workspace, where future instructor availability, provisional licence checks, and Stripe checkout live.
              </p>
              <Link href="/scheduled-lessons?from=planned-lessons#scheduled-lessons-booking" className="lda-pill mt-6 w-fit">
                Schedule a lesson <ArrowRight size={18} />
              </Link>
            </article>

            <article className="rounded bg-black p-6 text-white">
              <h2 className="text-3xl font-black">Already booked?</h2>
              <p className="mt-3 text-base font-semibold leading-7 text-zinc-300">
                Use the learner calendar to check upcoming, pending, completed, and cancelled lessons in one place.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href="/learner-calendar?from=planned-lessons" className="lda-pill lda-pill-sm">
                  Open calendar <ArrowRight size={17} />
                </Link>
                <Link href="/lesson-now?from=planned-lessons" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-zinc-600 px-4 py-2 text-sm font-black text-white hover:ring-2 hover:ring-brand">
                  Need one now?
                </Link>
              </div>
            </article>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
