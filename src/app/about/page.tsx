import Link from "next/link";
import {
  BadgeCheck,
  CreditCard,
  MapPin,
  ShieldCheck,
  Sparkles,
  UsersRound
} from "lucide-react";
import { PageTopBar } from "@/components/page-top-bar";
import { SiteFooter } from "@/components/site-footer";

const marketplaceCards = [
  {
    title: "For learners",
    body: "Compare verified local instructors by price, availability, reviews, car, and lesson type before booking.",
    icon: UsersRound,
    href: "/auth/login?role=learner",
    cta: "Learner login"
  },
  {
    title: "For instructors",
    body: "Apply as an ADI/PDI, upload verification, set availability, manage bookings, and track payout status.",
    icon: BadgeCheck,
    href: "/instructor",
    cta: "Instructor area"
  },
  {
    title: "For trust",
    body: "The marketplace is structured around verification, upfront pricing, secure payments, and clear records.",
    icon: ShieldCheck,
    href: "/privacy",
    cta: "Read privacy"
  }
];

const standards = [
  { icon: BadgeCheck, title: "Instructor approval", body: "Paid instructors should be approved before appearing in local search." },
  { icon: CreditCard, title: "Transparent price", body: "Learners see the full lesson price before checkout, with no hidden booking fee." },
  { icon: MapPin, title: "Local matching", body: "Smart Match is designed around distance, areas covered, transmission, price, and availability." },
  { icon: ShieldCheck, title: "Privacy by design", body: "Learner data collection should stay focused on booking, support, payment, and safety needs." }
];

export default function AboutPage() {
  return (
    <>
      <PageTopBar />

      <main className="bg-white text-black">
        <section className="bg-black text-white">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_430px] lg:px-8 lg:py-16">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-red-500/60 bg-red-500/15 px-4 py-2 text-sm font-black text-red-100">
                <Sparkles size={17} /> About LDA
              </div>
              <h1 className="mt-5 max-w-3xl text-5xl font-black tracking-normal sm:text-6xl">
                A cleaner way to find verified driving instructors.
              </h1>
              <p className="mt-5 max-w-2xl text-lg font-semibold leading-8 text-zinc-300">
                L Driving Academy is being built as a UK learner-driver marketplace where learners can compare local instructors and instructors can manage bookings with confidence.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/auth/login?role=learner" className="lda-pill">
                  Learner login
                </Link>
                <Link href="/instructor" className="lda-pill">
                  Instructor area
                </Link>
              </div>
            </div>

            <aside className="rounded border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
              <div className="text-sm font-black uppercase text-zinc-500">Mission</div>
              <div className="mt-2 text-3xl font-black text-white">Click. Learn. Drive.</div>
              <p className="mt-5 text-sm font-semibold leading-7 text-zinc-300">
                The goal is a professional booking journey where trust, clear pricing, and instructor verification sit at the centre of every lesson.
              </p>
              <div className="mt-6 rounded bg-white p-4 text-black">
                <div className="text-xs font-black uppercase text-zinc-500">Marketplace model</div>
                <div className="mt-1 text-2xl font-black">Learners + verified instructors</div>
                <p className="mt-2 text-sm font-semibold leading-6 text-zinc-700">
                  Admin controls, payments, support, refunds, and verification are built into the platform structure.
                </p>
              </div>
            </aside>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-black tracking-normal">What LDA is built for</h2>
          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {marketplaceCards.map((card) => {
              const Icon = card.icon;
              return (
                <Link key={card.title} href={card.href} className="group flex min-h-[260px] flex-col rounded bg-zinc-100 p-6 text-black hover:bg-zinc-200">
                  <div className="grid h-14 w-14 place-items-center rounded bg-white text-brand shadow-sm">
                    <Icon size={28} />
                  </div>
                  <h3 className="mt-6 text-2xl font-black">{card.title}</h3>
                  <p className="mt-4 leading-7 text-zinc-700">{card.body}</p>
                  <span className="lda-pill lda-pill-sm mt-auto self-start">{card.cta}</span>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="bg-zinc-100">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[420px_1fr] lg:px-8">
            <div>
              <h2 className="text-4xl font-black tracking-normal">The standards behind the product.</h2>
              <p className="mt-4 text-lg font-semibold leading-8 text-zinc-700">
                The site is structured around simple choices, clear next steps, and marketplace controls that an online driving school needs.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/privacy" className="lda-pill">
                  Privacy policy
                </Link>
                <Link href="/contact" className="lda-pill">
                  Contact support
                </Link>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {standards.map((item) => {
                const Icon = item.icon;
                return (
                  <article key={item.title} className="rounded bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="grid h-11 w-11 place-items-center rounded bg-red-500/10 text-brand">
                        <Icon size={23} />
                      </div>
                      <h3 className="text-xl font-black">{item.title}</h3>
                    </div>
                    <p className="mt-4 leading-7 text-zinc-700">{item.body}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
