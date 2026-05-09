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
    title: "Data and privacy",
    body: "Request account deletion, data access, correction, or privacy support before launch policies are solicitor-reviewed.",
    icon: ShieldCheck,
    href: "/data-requests",
    cta: "Data request"
  }
];

const contactTopics = [
  { icon: Clock3, title: "Lesson changes", body: "Use your booking reference, instructor name, lesson date, and pickup postcode." },
  { icon: CreditCard, title: "Payments", body: "Include your payment email and confirmation number. Stripe handles card data securely." },
  { icon: UserRoundCheck, title: "Instructor verification", body: "Include ADI/PDI number, document type, and the email used for onboarding." },
  { icon: FileText, title: "Policies", body: "Cancellation, refund, privacy, cookie, and terms pages are available before booking." }
];

const policyLinks = [
  { label: "Terms", href: "/terms" },
  { label: "Privacy", href: "/privacy" },
  { label: "Cancellation", href: "/cancellation-policy" },
  { label: "Cookies", href: "/cookies" },
  { label: "Data requests", href: "/data-requests" }
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
              <Link href="/about" className="rounded-full px-3 py-2 text-sm font-black text-white hover:ring-2 hover:ring-brand">About</Link>
            </nav>
          </div>
          <div className="hidden items-center gap-6 md:flex">
            <LanguageSelector />
            <Link href="/contact" className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-black text-white ring-2 ring-brand">
              <CircleHelp size={17} /> Help
            </Link>
            <Link href="/auth/login?role=learner" className="lda-pill lda-pill-sm">Sign up</Link>
          </div>
          <div className="md:hidden">
            <MainMenu />
          </div>
        </div>
      </header>

      <main className="bg-white text-black">
        <section className="bg-black text-white">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_420px] lg:px-8 lg:py-16">
            <div>
              <Link href="/" className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-black text-zinc-300 hover:text-white hover:ring-2 hover:ring-brand">
                <ArrowLeft size={17} /> Back to homepage
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
                <Link href="/auth/login?role=learner" className="lda-pill">
                  Book a lesson
                </Link>
              </div>
            </div>

            <aside className="rounded bg-white p-6 text-black shadow-2xl">
              <div className="text-sm font-black uppercase text-zinc-500">Support inbox</div>
              <h2 className="mt-2 text-3xl font-black tracking-normal">info@ldrivingacademy.co.uk</h2>
              <div className="mt-5 grid gap-3 text-sm font-bold leading-6 text-zinc-700">
                <p>For faster support, include your booking reference, account email, instructor name, lesson date/time, and pickup postcode.</p>
                <p>Do not send full payment card numbers, driving licence images, or sensitive documents by normal email unless LDA gives you a secure upload route.</p>
                <p className="rounded bg-red-50 p-3 text-brand">
                  Emergency lesson-day issues should include the word urgent in the email subject.
                </p>
              </div>
            </aside>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-black tracking-normal">Choose the right support route</h2>
          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {supportRoutes.map((route) => {
              const Icon = route.icon;
              return (
                <Link key={route.title} href={route.href} className="group flex min-h-[260px] flex-col rounded bg-zinc-100 p-6 hover:bg-zinc-200">
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
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
            <h2 className="text-4xl font-black tracking-normal">What to include</h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {contactTopics.map((topic) => {
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
