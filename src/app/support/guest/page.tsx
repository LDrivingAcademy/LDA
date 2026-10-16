import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, CalendarCheck, CarFront, CircleHelp, CreditCard, Mail, MapPin, ShieldCheck } from "lucide-react";
import { PageTopBar } from "@/components/page-top-bar";
import { SiteFooter } from "@/components/site-footer";
import { SupportAssistant } from "@/components/support-assistant";

export const metadata: Metadata = {
  title: "Guest Support | L Driving Academy",
  description: "Public L Driving Academy support for guests with frequently asked questions and email support.",
  robots: {
    index: true,
    follow: true
  }
};

const supportEmail = "info@ldrivingacademy.com";
const supportMailto = `mailto:${supportEmail}?subject=${encodeURIComponent("Guest support request")}`;

const guestFaqs = [
  {
    icon: CalendarCheck,
    question: "How do I book a driving lesson?",
    answer: "Use SmartMatch or create a learner account. Once your learner account is verified, you can choose an instructor, lesson time, pickup details, and continue through secure checkout."
  },
  {
    icon: CarFront,
    question: "Can I look for instructors before signing up?",
    answer: "Yes. SmartMatch lets you preview instructor fit by area, transmission, availability, price, and learner needs before creating an account."
  },
  {
    icon: CreditCard,
    question: "How do payments work?",
    answer: "LDA uses secure online payment routes. Never send card details by email and do not pay privately outside the LDA platform."
  },
  {
    icon: MapPin,
    question: "Can I choose my pickup location?",
    answer: "Learners add pickup details during booking. Keep the postcode and pickup notes accurate so the instructor can confirm travel time and arrival details."
  },
  {
    icon: ShieldCheck,
    question: "Why do learner accounts need licence checks?",
    answer: "Learners need to verify their email, date of birth, and provisional driving licence before opening the learner account for paid lessons."
  },
  {
    icon: CircleHelp,
    question: "What if my question is not listed?",
    answer: "Use the email support button and include what you are trying to do, the page you are on, and any booking or payment reference if you already have one."
  }
];

const quickLinks = [
  { href: "/smart-match?from=guest-support", label: "Try SmartMatch" },
  { href: "/auth/sign-up?role=learner&from=guest-support", label: "Create learner account" },
  { href: "/instructor?from=guest-support", label: "Become an instructor" },
  { href: "/cancellation-policy?from=guest-support", label: "Cancellation policy" }
];

const guestSupportSteps = [
  "Check the public FAQs before creating an account",
  "Use SmartMatch or learner sign-up for booking routes",
  "Email LDA support if the answer is not listed"
];

export default function GuestSupportPage() {
  return (
    <>
      <PageTopBar backHref="/" backLabel="Back to homepage" />

      <main className="bg-white text-black">
        <section className="bg-black text-white">
          <div className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 lg:px-10 lg:py-14">
            <div className="max-w-4xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-red-500/60 bg-red-500/15 px-4 py-2 text-sm font-black text-red-100">
                <CircleHelp size={17} /> Guest support
              </div>
              <h1 className="mt-5 max-w-4xl text-4xl font-black leading-tight tracking-normal sm:text-6xl">
                Get support before you sign in.
              </h1>
              <p className="mt-5 max-w-2xl text-lg font-semibold leading-8 text-zinc-300">
                Find clear public answers for booking, payments, SmartMatch, learner setup, instructor applications, and what to do next.
              </p>
              <div className="mt-7 grid gap-3 sm:grid-cols-3">
                {guestSupportSteps.map((step, index) => (
                  <div key={step} className="rounded border border-zinc-800 bg-zinc-950 p-4">
                    <div className="text-xs font-black uppercase text-red-200">Step {index + 1}</div>
                    <p className="mt-2 text-sm font-bold leading-6 text-zinc-300">{step}</p>
                  </div>
                ))}
              </div>
              <a href={supportMailto} className="lda-pill mt-8">
                <Mail size={20} /> Email LDA support
              </a>
            </div>
          </div>
        </section>

        <section id="guest-support-assistant" className="scroll-mt-24 border-b border-zinc-200 bg-white">
          <div className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 lg:px-10 lg:py-12">
            <div className="mb-6">
              <div className="text-sm font-black uppercase text-brand">Get support before you sign in</div>
              <h2 className="mt-1 text-3xl font-black tracking-normal sm:text-4xl">Chat with LDA support</h2>
            </div>
            <SupportAssistant audience="guest" />
          </div>
        </section>

        <section className="mx-auto max-w-[1500px] px-4 py-12 sm:px-6 lg:px-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-sm font-black uppercase text-brand">Public help</div>
              <h2 className="text-4xl font-black tracking-normal">Frequently asked questions</h2>
              <p className="mt-3 max-w-2xl text-lg font-semibold leading-8 text-zinc-700">
                These are the public questions guests usually need before choosing a learner or instructor route.
              </p>
            </div>
            <a href={supportMailto} className="lda-pill lda-pill-sm self-start sm:self-auto">
              Email now
            </a>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {guestFaqs.map((faq) => {
              const Icon = faq.icon;
              return (
                <article key={faq.question} className="rounded border border-zinc-200 bg-white p-6 shadow-sm">
                  <div className="grid h-12 w-12 place-items-center rounded bg-white text-brand shadow-sm">
                    <Icon size={25} />
                  </div>
                  <h3 className="mt-5 text-2xl font-black">{faq.question}</h3>
                  <p className="mt-4 leading-7 text-zinc-700">{faq.answer}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="bg-zinc-100">
          <div className="mx-auto max-w-[1500px] px-4 py-12 sm:px-6 lg:px-10">
            <div className="text-sm font-black uppercase text-brand">Next steps</div>
            <h2 className="mt-2 text-4xl font-black tracking-normal">Useful public links</h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {quickLinks.map((link) => (
                <Link key={link.href} href={link.href} className="flex items-center justify-between rounded border border-zinc-200 bg-white px-4 py-4 font-black text-black shadow-sm transition hover:border-red-300 hover:bg-zinc-50">
                  {link.label}
                  <ArrowRight className="text-brand" size={18} />
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
