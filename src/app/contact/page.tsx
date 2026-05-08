import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  BookOpenCheck,
  CircleHelp,
  Clock3,
  CreditCard,
  FileText,
  Mail,
  MessageSquare,
  ShieldCheck,
  UserRoundCheck,
  UsersRound
} from "lucide-react";
import { Brand } from "@/components/brand";
import { LanguageSelector } from "@/components/language-selector";
import { MainMenu } from "@/components/main-menu";
import { SiteFooter } from "@/components/site-footer";

const supportRoutes = [
  {
    title: "Learner support",
    body: "Bookings, pickup postcode, lesson time, payment confirmation, refunds, and live tracking queries.",
    icon: BookOpenCheck,
    href: "/lesson-now",
    cta: "Book or check lessons"
  },
  {
    title: "Instructor support",
    body: "ADI/PDI onboarding, verification documents, profile setup, calendar availability, bookings, and payouts.",
    icon: BadgeCheck,
    href: "/instructor",
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
      <header className="sticky top-0 z-30 bg-black text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-7">
            <Brand />
            <nav className="hidden items-center gap-7 lg:flex">
              <Link href="/auth/login?role=learner" className="rounded-full px-3 py-2 text-sm font-black text-white hover:ring-2 hover:ring-brand">Learners</Link>
              <Link href="/instructor" className="rounded-full px-3 py-2 text-sm font-black text-white hover:ring-2 hover:ring-brand">Instructors</Link>
              <Link href="/#discover" className="rounded-full px-3 py-2 text-sm font-black text-white hover:ring-2 hover:ring-brand">Services</Link>
              <Link href="/#safety" className="rounded-full px-3 py-2 text-sm font-black text-white hover:ring-2 hover:ring-brand">Safety</Link>
            </nav>
          </div>
          <div className="hidden items-center gap-6 md:flex">
            <LanguageSelector />
            <Link href="/contact" className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-black text-white ring-2 ring-brand">
              <CircleHelp size={17} /> Help
            </Link>
            <Link href="/auth/login?role=learner" className="text-sm font-black hover:text-zinc-300">Log in</Link>
            <Link href="/auth/login?role=learner" className="lda-pill lda-pill-sm">Sign up</Link>
          </div>
          <div className="md:hidden">
            <MainMenu />
          </div>
        </div>
      </header>

      <main className="bg-white text-black">
        <section className="bg-black text-white">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_430px] lg:px-8 lg:py-16">
            <div>
              <Link href="/" className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-black text-zinc-300 hover:text-white hover:ring-2 hover:ring-brand">
                <ArrowLeft size={17} /> Back home
              </Link>
              <div className="mt-10 inline-flex items-center gap-2 rounded-full border border-red-500/60 bg-red-500/15 px-4 py-2 text-sm font-black text-red-100">
                <MessageSquare size={17} /> LDA support
              </div>
              <h1 className="mt-5 max-w-3xl text-5xl font-black tracking-normal sm:text-6xl">
                Help that keeps your lesson moving.
              </h1>
              <p className="mt-5 max-w-2xl text-lg font-semibold leading-8 text-zinc-300">
                Get clear support for learner bookings, instructor onboarding, payments, refunds, verification, and data requests.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="mailto:info@ldrivingacademy.co.uk" className="lda-pill">
                  <Mail size={20} /> Email support
                </a>
                <Link href="/lesson-now" className="lda-pill">
                  <Clock3 size={20} /> Lesson now
                </Link>
              </div>
            </div>

            <aside className="rounded border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded bg-red-500/15 text-brand">
                  <Mail size={24} />
                </div>
                <div>
                  <div className="text-sm font-black uppercase text-zinc-500">Support email</div>
                  <a href="mailto:info@ldrivingacademy.co.uk" className="mt-1 block text-xl font-black text-white hover:text-brand">
                    info@ldrivingacademy.co.uk
                  </a>
                </div>
              </div>
              <div className="mt-6 grid gap-3 text-sm font-semibold leading-6 text-zinc-300">
                <p>For faster support, include your booking reference, account email, instructor name, lesson date/time, and pickup postcode.</p>
                <p>For instructor support, include your ADI/PDI status, verification stage, and payout or booking reference if relevant.</p>
              </div>
              <div className="mt-6 rounded bg-white p-4 text-black">
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

        <section className="bg-zinc-100">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[420px_1fr] lg:px-8">
            <div>
              <h2 className="text-4xl font-black tracking-normal">Send the right details first time.</h2>
              <p className="mt-4 text-lg font-semibold leading-8 text-zinc-700">
                The quickest answers come when support can see exactly which booking, account, or payment you mean.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a href="mailto:info@ldrivingacademy.co.uk?subject=LDA%20support%20request" className="lda-pill">
                  Start email
                </a>
                <Link href="/owner-dashboard" className="lda-pill">
                  Owner dashboard
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
          <div className="grid gap-8 rounded bg-black p-6 text-white sm:p-8 lg:grid-cols-[1fr_420px]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-red-500/60 bg-red-500/15 px-4 py-2 text-sm font-black text-red-100">
                <UsersRound size={17} /> Policies and trust
              </div>
              <h2 className="mt-5 text-4xl font-black tracking-normal">Clear rules before every booking.</h2>
              <p className="mt-4 max-w-2xl text-lg font-semibold leading-8 text-zinc-300">
                LDA keeps learner and instructor journeys anchored around verified instructors, upfront pricing, secure payments, and clear cancellation rules.
              </p>
            </div>
            <div className="grid gap-3">
              {policyLinks.map((link) => (
                <Link key={link.href} href={link.href} className="flex items-center justify-between rounded bg-white px-4 py-4 font-black text-black hover:bg-zinc-200">
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
