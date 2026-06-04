import Link from "next/link";
import { ArrowLeft, BookOpenCheck, CalendarCheck, CircleHelp, Clock3, CreditCard, ListChecks, MapPin, ShieldCheck } from "lucide-react";
import { Brand } from "@/components/brand";
import { LanguageSelector } from "@/components/language-selector";
import { LearnerSupportAssistant } from "@/components/learner-support-assistant";
import { MainMenu } from "@/components/main-menu";
import { SiteFooter } from "@/components/site-footer";
import { getPageBackLink, type PageSourceSearchParams } from "@/lib/page-back-link";

const learnerActions = [
  { title: "Book lessons", body: "Find instructors, compare prices, and continue to the normal learner booking flow.", href: "/auth/login?role=learner", cta: "Start booking", icon: CalendarCheck },
  { title: "Manage bookings", body: "View upcoming, completed, cancelled, and rescheduled lessons from your learner dashboard.", href: "/dashboard", cta: "Open dashboard", icon: ListChecks },
  { title: "Payment help", body: "Check confirmation references, failed payments, refunds, and duplicate charge questions.", href: "/cancellation-policy", cta: "Payment policy", icon: CreditCard },
  { title: "Report off-platform request", body: "Tell LDA if an instructor asks you to pay by cash, bank transfer, private link, or book outside your LDA dashboard.", href: "mailto:info@ldrivingacademy.co.uk?subject=Report%20off-platform%20booking%20request", cta: "Report request", icon: ShieldCheck }
];

const supportTopics = [
  { icon: Clock3, title: "Reschedule or cancel", body: "Use your dashboard first. If the lesson is soon, contact support with your booking reference." },
  { icon: MapPin, title: "Pickup postcode", body: "Keep pickup details accurate so instructors can confirm travel time and arrival tracking." },
  { icon: CreditCard, title: "Payment confirmation", body: "Never send card numbers or pay privately. Share only the payment email, amount, and LDA confirmation number." },
  { icon: CircleHelp, title: "Urgent issues", body: "If the lesson is today, your instructor is late, or payment is stuck, use the assistant and mark it urgent." }
];

type LearnerSupportPageProps = {
  searchParams?: PageSourceSearchParams;
};

export default async function LearnerSupportPage({ searchParams }: LearnerSupportPageProps) {
  const { backHref, backLabel } = await getPageBackLink(searchParams);

  return (
    <>
      <header className="sticky top-0 z-30 bg-black text-white">
        <div className="flex w-full items-center justify-between gap-5 px-[15px] py-4">
          <div className="flex items-center gap-7">
            <Brand />
            <nav className="hidden items-center gap-7 lg:flex">
              <Link href="/auth/login?role=learner" className="rounded-full px-3 py-2 text-sm font-black text-white ring-2 ring-brand">Learner</Link>
              <Link href="/instructor" className="rounded-full px-3 py-2 text-sm font-black text-white hover:ring-2 hover:ring-brand">Instructor</Link>
              <Link href="/#discover" className="rounded-full px-3 py-2 text-sm font-black text-white hover:ring-2 hover:ring-brand">Services</Link>
              <Link href="/about" className="rounded-full px-3 py-2 text-sm font-black text-white hover:ring-2 hover:ring-brand">About</Link>
            </nav>
          </div>
          <div className="hidden items-center gap-6 md:flex">
            <LanguageSelector />
            <Link href={backHref} className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-black text-white hover:ring-2 hover:ring-brand">
              <ArrowLeft size={17} /> {backLabel}
            </Link>
          </div>
          <div className="md:hidden">
            <MainMenu />
          </div>
        </div>
      </header>

      <main className="bg-white text-black">
        <section className="bg-black text-white">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_520px] lg:px-8 lg:py-16">
            <div>
              <Link href={backHref} className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-black text-zinc-300 hover:text-white hover:ring-2 hover:ring-brand">
                <ArrowLeft size={17} /> {backLabel}
              </Link>
              <div className="mt-10 inline-flex items-center gap-2 rounded-full border border-red-500/60 bg-red-500/15 px-4 py-2 text-sm font-black text-red-100">
                <BookOpenCheck size={17} /> Learner support
              </div>
              <h1 className="mt-5 max-w-3xl text-5xl font-black tracking-normal sm:text-6xl">
                Book, manage, and fix lesson issues faster.
              </h1>
              <p className="mt-5 max-w-2xl text-lg font-semibold leading-8 text-zinc-300">
                Use this page to reach bookings, manage your lessons, get payment help, or ask the LDA assistant what to do next.
              </p>
            </div>
            <LearnerSupportAssistant />
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-black tracking-normal">Learner actions</h2>
          <div className="mt-8 grid gap-5 lg:grid-cols-4">
            {learnerActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link key={action.title} href={action.href} className="group flex min-h-[250px] flex-col rounded bg-zinc-100 p-6 hover:bg-zinc-200">
                  <div className="grid h-14 w-14 place-items-center rounded bg-white text-brand shadow-sm">
                    <Icon size={28} />
                  </div>
                  <h3 className="mt-6 text-2xl font-black">{action.title}</h3>
                  <p className="mt-4 leading-7 text-zinc-700">{action.body}</p>
                  <span className="lda-pill lda-pill-sm mt-auto self-start">{action.cta}</span>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="bg-zinc-100">
          <div className="mx-auto grid max-w-7xl gap-4 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
            {supportTopics.map((topic) => {
              const Icon = topic.icon;
              return (
                <article key={topic.title} className="rounded bg-white p-5 shadow-sm">
                  <div className="grid h-11 w-11 place-items-center rounded bg-red-500/10 text-brand">
                    <Icon size={23} />
                  </div>
                  <h3 className="mt-4 text-xl font-black">{topic.title}</h3>
                  <p className="mt-3 leading-7 text-zinc-700">{topic.body}</p>
                </article>
              );
            })}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
