import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  BookOpenCheck,
  CarFront,
  Clock3,
  CreditCard,
  FileText,
  Mail,
  MessageSquare,
  ShieldCheck,
  UserRoundCheck,
  UsersRound
} from "lucide-react";
import { PageTopBar } from "@/components/page-top-bar";
import { SiteFooter } from "@/components/site-footer";
import { VehicleAiAssistant } from "@/components/vehicle-ai-assistant";

const supportRoutes = [
  {
    title: "Learner support",
    body: "Bookings, pickup postcode, lesson time, payment confirmation, refunds, and live tracking queries.",
    icon: BookOpenCheck,
    href: "/support/learner",
    cta: "Learner help"
  },
  {
    title: "Instructor support",
    body: "ADI/PDI onboarding, verification documents, profile setup, calendar availability, bookings, and payouts.",
    icon: BadgeCheck,
    href: "/support/instructor",
    cta: "Instructor help"
  },
  {
    title: "Account and data",
    body: "Login issues, privacy questions, account deletion requests, marketing preferences, and data access.",
    icon: ShieldCheck,
    href: "/data-requests",
    cta: "Data requests"
  }
];

const helpTopics = [
  { icon: Clock3, title: "Lesson changes", body: "Use your booking reference, instructor name, lesson date, and pickup postcode." },
  { icon: CreditCard, title: "Payments", body: "Include your payment email and confirmation number. Stripe handles card data securely." },
  { icon: UserRoundCheck, title: "Verification", body: "Instructors should include account email, ADI/PDI status, and relevant document reference." },
  { icon: FileText, title: "Policies", body: "Cancellation, refund, privacy, cookie, and terms pages are available before booking." }
];

const policyLinks = [
  { href: "/cancellation-policy", label: "Cancellation policy" },
  { href: "/privacy", label: "Privacy policy" },
  { href: "/terms", label: "Terms" },
  { href: "/cookies", label: "Cookies" }
];

export default function ContactPage() {
  return (
    <>
      <PageTopBar />

      <main className="bg-white text-black">
        <section className="bg-white text-black">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_430px] lg:px-8 lg:py-16">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-black text-brand">
                <MessageSquare size={17} /> LDA support
              </div>
              <h1 className="mt-5 max-w-3xl text-5xl font-black tracking-normal sm:text-6xl">
                Help that keeps your lesson moving.
              </h1>
              <p className="mt-5 max-w-2xl text-lg font-semibold leading-8 text-zinc-600">
                Get clear support for learner bookings, instructor onboarding, payments, refunds, verification, and data requests.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="mailto:info@ldrivingacademy.co.uk" className="lda-pill">
                  <Mail size={20} /> Email support
                </a>
              </div>
            </div>

            <aside className="rounded border border-zinc-200 bg-white p-6 shadow-2xl">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded bg-red-500/15 text-brand">
                  <Mail size={24} />
                </div>
                <div>
                  <div className="text-sm font-black uppercase text-zinc-500">Support email</div>
                  <a href="mailto:info@ldrivingacademy.co.uk" className="mt-1 block text-xl font-black text-black hover:text-brand">
                    info@ldrivingacademy.co.uk
                  </a>
                </div>
              </div>
              <div className="mt-6 grid gap-3 text-sm font-semibold leading-6 text-zinc-600">
                <p>For faster support, include your booking reference, account email, instructor name, lesson date/time, and pickup postcode.</p>
                <p>For instructor support, include your ADI/PDI status, verification stage, and payout or booking reference if relevant.</p>
              </div>
              <div className="mt-6 rounded bg-zinc-100 p-4 text-black">
                <div className="text-xs font-black uppercase text-zinc-500">Response target</div>
                <div className="mt-1 text-2xl font-black">1 business day</div>
                <p className="mt-2 text-sm font-semibold leading-6 text-zinc-700">
                  Emergency lesson-day issues should include the word urgent in the email subject.
                </p>
              </div>
            </aside>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-black tracking-normal">What do you need help with?</h2>
          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {supportRoutes.map((route) => {
              const Icon = route.icon;
              return (
                <Link key={route.title} href={route.href} className="group flex min-h-[260px] flex-col rounded bg-zinc-100 p-6 text-black hover:bg-zinc-200">
                  <div className="grid h-14 w-14 place-items-center rounded bg-white text-brand shadow-sm">
                    <Icon size={28} />
                  </div>
                  <h3 className="mt-6 text-2xl font-black">{route.title}</h3>
                  <p className="mt-4 leading-7 text-zinc-700">{route.body}</p>
                  <span className="lda-pill lda-pill-sm mt-auto self-start">{route.cta}</span>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="bg-black px-4 py-12 text-white sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm font-black text-red-100">
                <CarFront size={17} /> LDA Adaptive AI
              </div>
              <h2 className="mt-5 text-4xl font-black tracking-normal sm:text-5xl">
                One place to ask about the driving journey.
              </h2>
              <p className="mt-5 max-w-2xl text-lg font-semibold leading-8 text-zinc-300">
                Learners and instructors can ask about vehicles, lesson plans, Smart Match, first cars, insurance preparation, message summaries, compliance, timing, support needs, and safety-critical defects.
              </p>
              <div className="mt-6 grid gap-3 text-sm font-bold text-zinc-300 sm:grid-cols-2">
                <span className="rounded border border-zinc-800 bg-zinc-950 p-3">Smart Match coaching</span>
                <span className="rounded border border-zinc-800 bg-zinc-950 p-3">First-car and insurance prep</span>
                <span className="rounded border border-zinc-800 bg-zinc-950 p-3">Traffic-aware lesson planning</span>
                <span className="rounded border border-zinc-800 bg-zinc-950 p-3">Messages and compliance support</span>
              </div>
            </div>
            <VehicleAiAssistant variant="inline" />
          </div>
        </section>

        <section className="bg-zinc-100">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[420px_1fr] lg:px-8">
            <div>
              <h2 className="text-4xl font-black tracking-normal">Send the right details first time.</h2>
              <p className="mt-4 text-lg font-semibold leading-8 text-zinc-700">
                The quickest answers come when support can see exactly which booking, account, or payment you mean.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/cancellation-policy" className="lda-pill">
                  View policies
                </Link>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {helpTopics.map((topic) => {
                const Icon = topic.icon;
                return (
                  <article key={topic.title} className="rounded bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="grid h-11 w-11 place-items-center rounded bg-red-500/10 text-brand">
                        <Icon size={23} />
                      </div>
                      <h3 className="text-xl font-black">{topic.title}</h3>
                    </div>
                    <p className="mt-4 leading-7 text-zinc-700">{topic.body}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-8 rounded bg-white p-6 text-black shadow-2xl ring-1 ring-zinc-200 sm:p-8 lg:grid-cols-[1fr_420px]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-black text-brand">
                <UsersRound size={17} /> Policies and trust
              </div>
              <h2 className="mt-5 text-4xl font-black tracking-normal">Clear rules before every booking.</h2>
              <p className="mt-4 max-w-2xl text-lg font-semibold leading-8 text-zinc-700">
                LDA keeps learner and instructor journeys anchored around verified instructors, upfront pricing, secure payments, and clear cancellation rules.
              </p>
            </div>
            <div className="grid gap-3">
              {policyLinks.map((link) => (
                <Link key={link.href} href={link.href} className="flex items-center justify-between rounded bg-white px-4 py-4 font-black text-black hover:bg-zinc-100">
                  {link.label}
                  <ArrowLeft className="rotate-180 text-brand" size={18} />
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
