import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Headphones,
  HelpCircle,
  Lock,
  MapPin,
  MessageSquare,
  Search,
  ShieldCheck,
  Star
} from "lucide-react";
import { Brand } from "@/components/brand";
import { LanguageSelector } from "@/components/language-selector";
import { MainMenu } from "@/components/main-menu";
import { SiteFooter } from "@/components/site-footer";
import { getHeaderAccountSummary, type HeaderAccountSummary } from "@/lib/current-account";

export const dynamic = "force-dynamic";

const heroTrustPoints = ["DVSA-approved instructors", "Secure payments", "Flexible scheduling"];

const platformHighlights = [
  {
    title: "DVSA-approved instructors",
    body: "Learn with qualified, verified instructors ready for UK learner journeys.",
    icon: ShieldCheck
  },
  {
    title: "Secure & flexible payments",
    body: "Pay securely online with clear pricing and platform booking records.",
    icon: Lock
  },
  {
    title: "Lessons on your terms",
    body: "Book on-demand or schedule future lessons around your availability.",
    icon: CalendarDays
  },
  {
    title: "Support when you need it",
    body: "Get help with bookings, payments, verification, and account questions.",
    icon: Headphones
  }
];

const matchHighlights = [
  { label: "Best local matches", icon: MapPin },
  { label: "Top-rated instructors", icon: Star },
  { label: "Lessons that fit your schedule", icon: CalendarCheck }
];

export default async function HomePage() {
  const account = await getHeaderAccountSummary();
  const learnerEntryHref =
    account?.role === "learner"
      ? "/learner-dashboard"
      : account?.role === "instructor"
        ? "/auth/sign-up?role=learner&message=You are signed in as an instructor. Sign up for a learner account with a different email to use learner features."
        : "/auth/login?role=learner";
  const instructorEntryHref =
    account?.role === "instructor"
      ? "/instructor-dashboard"
      : account?.role === "learner"
        ? "/auth/sign-up?role=instructor&message=You are signed in as a learner. Sign up for an instructor account with a different email, or request a learner-to-instructor transfer."
        : "/instructor";
  const learnerSignUpHref = account?.role === "learner" ? "/learner-dashboard" : "/auth/sign-up?role=learner";

  return (
    <>
      <header className="sticky top-0 z-30 bg-black text-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-6 px-4 py-4 sm:px-6 lg:px-10">
          <div className="flex min-w-0 items-center gap-9">
            <Brand size="home" />
            <nav className="hidden items-center gap-7 xl:flex">
              <Link href={learnerEntryHref} className="inline-flex items-center gap-1.5 rounded-full px-2 py-2 text-sm font-bold text-white hover:ring-2 hover:ring-brand">
                Learner <ChevronDown size={14} />
              </Link>
              <Link href={instructorEntryHref} className="inline-flex items-center gap-1.5 rounded-full px-2 py-2 text-sm font-bold text-white hover:ring-2 hover:ring-brand">
                Instructor <ChevronDown size={14} />
              </Link>
              <Link href="#services" className="inline-flex items-center gap-1.5 rounded-full px-2 py-2 text-sm font-bold text-white hover:ring-2 hover:ring-brand">
                Services <ChevronDown size={14} />
              </Link>
              <Link href="/safety" className="rounded-full px-2 py-2 text-sm font-bold text-white hover:ring-2 hover:ring-brand">Safety</Link>
              <Link href="/about" className="rounded-full px-2 py-2 text-sm font-bold text-white hover:ring-2 hover:ring-brand">About</Link>
            </nav>
          </div>
          <div className="ml-auto hidden items-center justify-end gap-7 xl:flex">
            <LanguageSelector />
            <Link href="/contact" className="inline-flex items-center gap-2 rounded-full px-3 py-2 whitespace-nowrap text-sm font-bold text-white hover:ring-2 hover:ring-brand">
              <HelpCircle size={18} /> Help
            </Link>
            {account ? (
              <>
                <HeaderAccountBlock account={account} />
                <MainMenu account={account} />
              </>
            ) : (
              <>
                <Link href="/auth/login?role=learner" className="rounded-full px-3 py-2 whitespace-nowrap text-sm font-bold text-white hover:ring-2 hover:ring-brand">Log in</Link>
                <Link href="/auth/sign-up?role=learner" className="rounded-full border border-red-500/60 bg-red-600 px-4 py-2 whitespace-nowrap text-sm font-black text-white hover:ring-2 hover:ring-red-300">Sign up</Link>
              </>
            )}
          </div>
          <div className="flex items-center gap-3 xl:hidden">
            {account ? (
              <HeaderAccountBlock account={account} compact />
            ) : (
              <Link href="/auth/sign-up?role=learner" className="rounded-full bg-brand px-3 py-2 whitespace-nowrap text-sm font-black text-white hover:ring-2 hover:ring-red-300">Sign up</Link>
            )}
            <MainMenu account={account} />
          </div>
        </div>
      </header>

      <main className="bg-white text-black">
        <section className="bg-white">
          <div className="mx-auto grid max-w-[1500px] items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-10 lg:py-14">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-4 py-2 text-xs font-black uppercase tracking-normal text-zinc-800 shadow-sm ring-1 ring-zinc-200">
                <ShieldCheck size={16} /> Trusted by learners across the UK
              </div>
              <h1 className="mt-8 max-w-3xl text-5xl font-black leading-[1.05] tracking-normal text-black sm:text-6xl lg:text-7xl">
                Book driving lessons with <span className="text-brand">LDA.</span>
              </h1>
              <p className="mt-7 max-w-xl text-xl font-semibold leading-8 text-zinc-700">
                Find expert instructors, book lessons that fit your schedule, and learn with confidence.
              </p>
              <div className="mt-9 grid gap-4 sm:grid-cols-2">
                <Link href={learnerEntryHref} className="inline-flex min-h-16 items-center justify-center gap-4 rounded bg-brand px-6 py-4 text-base font-black text-white shadow-lg shadow-red-600/20 transition hover:bg-red-700 hover:ring-2 hover:ring-red-300">
                  <Search size={23} /> Find instructors <ArrowRight size={22} />
                </Link>
                <Link href="/lesson-now" className="inline-flex min-h-16 items-center justify-center gap-4 rounded border border-zinc-400 bg-white px-6 py-4 text-base font-black text-black transition hover:border-brand hover:ring-2 hover:ring-brand/50">
                  <CalendarCheck size={23} /> Book on-demand
                </Link>
              </div>
              <div className="mt-10 flex flex-wrap gap-x-8 gap-y-4 text-sm font-bold text-zinc-800">
                {heroTrustPoints.map((point) => (
                  <div key={point} className="inline-flex items-center gap-2">
                    <CheckCircle2 size={21} className="text-brand" /> {point}
                  </div>
                ))}
              </div>
            </div>

            <section className="relative overflow-hidden rounded bg-black text-white shadow-2xl ring-1 ring-zinc-200">
              <div className="relative min-h-[540px] p-5 sm:p-7 lg:min-h-[610px]">
                <img
                  src="/learner-instructor.jpg"
                  alt="Learner driver behind the wheel with an instructor in the passenger seat"
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                <div className="absolute inset-x-5 bottom-5 overflow-hidden rounded bg-black/72 p-5 shadow-2xl backdrop-blur-md ring-1 ring-white/10 sm:inset-x-7 sm:bottom-7 sm:grid sm:grid-cols-[1fr_260px] sm:gap-6 sm:p-7">
                  <div>
                    <Link href="/smart-match" className="inline-flex rounded-full bg-brand px-5 py-2 text-xs font-black uppercase text-white shadow-lg shadow-red-600/25 hover:bg-red-700">
                      LDA SmartMatch
                    </Link>
                    <h2 className="mt-5 text-3xl font-black leading-tight text-white">
                      Matched for you.<br />Built for success.
                    </h2>
                    <p className="mt-4 max-w-xl text-sm font-semibold leading-6 text-zinc-200">
                      SmartMatch compares distance, price, availability, instructor profile, and learner preferences to help you find the right fit.
                    </p>
                  </div>
                  <div className="mt-6 grid gap-4 border-white/20 sm:mt-0 sm:border-l sm:pl-6">
                    {matchHighlights.map((item) => {
                      const Icon = item.icon;
                      return (
                        <div key={item.label} className="flex items-center gap-4 text-sm font-black text-white">
                          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-brand">
                            <Icon size={21} />
                          </span>
                          {item.label}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </section>

        <section id="services" className="bg-white px-4 pb-10 sm:px-6 lg:px-10">
          <div className="mx-auto grid max-w-[1500px] overflow-hidden rounded border border-zinc-200 bg-white shadow-sm md:grid-cols-2 xl:grid-cols-4">
            {platformHighlights.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="grid gap-4 border-b border-zinc-200 p-6 md:border-r xl:border-b-0">
                  <div className="grid h-14 w-14 place-items-center rounded bg-red-50 text-brand ring-1 ring-red-100">
                    <Icon size={29} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-black">{item.title}</h3>
                    <p className="mt-2 text-sm font-semibold leading-6 text-zinc-600">{item.body}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="bg-white px-4 pb-16 sm:px-6 lg:px-10">
          <div className="mx-auto flex max-w-[1500px] flex-col items-center gap-3 text-center text-sm font-bold text-zinc-700">
            <div className="text-base font-black text-zinc-800">Trusted by learners across the UK</div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <span>Excellent</span>
              <span className="inline-flex gap-1 text-white">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span key={star} className="grid h-6 w-6 place-items-center rounded-sm bg-emerald-500 text-xs font-black">★</span>
                ))}
              </span>
              <span>4.8 out of 5</span>
              <span className="inline-flex items-center gap-1 text-emerald-600"><Star size={17} fill="currentColor" /> Trustpilot</span>
            </div>
          </div>
        </section>

        <Link href="/contact" className="fixed bottom-6 right-6 z-30 hidden items-center gap-4 rounded-full bg-white px-5 py-3 text-base font-bold text-black shadow-2xl ring-1 ring-zinc-200 transition hover:ring-brand md:inline-flex">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-brand text-white shadow-lg shadow-red-600/20">
            <MessageSquare size={22} />
          </span>
          Need help?
        </Link>
      </main>
      <SiteFooter />
    </>
  );
}

function HeaderAccountBlock({ account, compact = false }: { account: HeaderAccountSummary; compact?: boolean }) {
  return (
    <div className={`flex min-w-0 flex-col items-center text-center leading-tight ${compact ? "max-w-[128px]" : "max-w-[190px]"}`}>
      <div className="max-w-full truncate text-sm font-black text-white">{account.name}</div>
      <Link href={account.dashboardHref} className="mt-1 inline-flex max-w-full items-center justify-center truncate rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1 text-xs font-black uppercase text-red-100 transition hover:border-red-500/80 hover:text-white hover:ring-2 hover:ring-brand">
        {account.subscriptionLabel}
      </Link>
    </div>
  );
}
