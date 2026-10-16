import Link from "next/link";
import {
  CalendarCheck,
  CalendarDays,
  CarFront,
  CheckCircle2,
  Headphones,
  HelpCircle,
  Lock,
  MapPin,
  RadioTower,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  UsersRound
} from "lucide-react";
import { Brand } from "@/components/brand";
import { HomeAccountControls } from "@/components/home-account-controls";
import { HomepageAiAssistant } from "@/components/homepage-ai-assistant";
import { HomeHeroActions } from "@/components/home-hero-actions";
import { HomeSmartMatchLink } from "@/components/home-smart-match-link";
import { HomeSuggestionGrid } from "@/components/home-suggestion-grid";
import { LanguageSelector } from "@/components/language-selector";
import { SiteFooter } from "@/components/site-footer";
import type { HeaderAccountSummary } from "@/lib/current-account";

export const revalidate = 300;

export const metadata = {
  title: "Book Driving Lessons Near You | LDA",
  description:
    "L Driving Academy helps learners find verified instructors, schedule or book on demand lessons, manage secure payments and track lesson progress in one place.",
  keywords: [
    "driving lessons near me",
    "book driving lessons near me",
    "driving instructors near me",
    "book a driving lesson",
    "on-demand driving lesson",
    "need a driving lesson right now",
    "become a driving instructor",
    "L Driving Academy",
    "LDA"
  ],
  alternates: {
    canonical: "/"
  },
  openGraph: {
    title: "Book Driving Lessons Near You | LDA",
    description:
      "Find verified driving instructors, book lessons securely, request on-demand lessons, and manage your learner journey with LDA.",
    url: "/",
    type: "website"
  }
};

type CardVisualType = "car" | "calendar" | "match" | "instructor" | "tracking" | "support" | "social";
type HomepageAccountRole = "admin" | "instructor" | "learner" | "visitor";

type SuggestionCard = {
  title: string;
  body: string;
  href: string;
  image: CardVisualType;
  cta: string;
  disabled?: boolean;
  note?: string;
};

const heroTrustPoints = ["DVSA-approved instructors", "Secure payments", "Flexible scheduling"];
const guestFindInstructorsHref = `/auth/login?role=learner&next=${encodeURIComponent("/learner-dashboard?section=driving-lessons&from=home#driving-lessons-booking")}`;
const guestScheduleLessonHref = `/auth/login?role=learner&next=${encodeURIComponent("/scheduled-lessons?from=home#scheduled-lessons-booking")}`;

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

const roleSuggestionCards: Record<HomepageAccountRole, SuggestionCard[]> = {
  visitor: [
    {
      title: "Find instructors",
      body: "Log in or create a learner account before opening verified instructor search, availability, pricing, and booking tools.",
      href: guestFindInstructorsHref,
      image: "car",
      cta: "Find instructors"
    },
    {
      title: "Schedule lessons",
      body: "Create or sign in to a learner account before opening scheduled lesson booking, calendar records, and checkout tools.",
      href: guestScheduleLessonHref,
      image: "calendar",
      cta: "Schedule Lesson"
    },
    {
      title: "Smart Match",
      body: "Try a public SmartMatch preview using learner goals, confidence, transmission, learning preferences, price, and availability.",
      href: "/smart-match",
      image: "match",
      cta: "Try SmartMatch"
    },
    {
      title: "Become an instructor",
      body: "Create an LDA instructor account, verify your email, and start the instructor application with your ADI details and documents.",
      href: "/instructor?from=home",
      image: "instructor",
      cta: "Become LDA instructor"
    },
      {
        title: "Get support",
        body: "Get public help with booking routes, payments, cancellation questions, pickup details, and what to do next.",
        href: "/support/guest?from=home",
        image: "support",
        cta: "Get support"
      },
    {
      title: "Subscribe & socials",
      body: "Join LDA for driving tips, platform updates, exclusive offers, promo codes, and launch news.",
      href: "/social",
      image: "social",
      cta: "Get tips and offers"
    }
  ],
  learner: [
    {
      title: "Find instructors",
      body: "Open your learner dashboard to compare verified instructors, availability, pricing, distance, reviews, and lesson fit.",
      href: "/learner-dashboard?section=driving-lessons&from=home#driving-lessons-booking",
      image: "car",
      cta: "Find instructors"
    },
    {
      title: "Schedule lessons",
      body: "Open scheduled lesson booking to choose future dates, select available instructor slots, confirm pickup details, and keep scheduled bookings in one place.",
      href: "/scheduled-lessons?from=home#scheduled-lessons-booking",
      image: "calendar",
      cta: "Schedule lessons"
    },
    {
      title: "Smart Match",
      body: "Run SmartMatch with your learner goals, confidence, learning preferences, price, transmission, and availability preferences.",
      href: "/smart-match?from=home",
      image: "match",
      cta: "Open SmartMatch"
    },
    {
      title: "Become an instructor",
      body: "Apply to move your learner account into the instructor pathway once you have passed and have the right evidence for LDA review.",
      href: "/account/instructor-transfer?from=home",
      image: "instructor",
      cta: "Apply now"
    },
    {
      title: "Learner support",
      body: "Get help with bookings, payments, cancellations, pickup details, instructor questions, and what to do next.",
      href: "/support/learner?from=home",
      image: "support",
      cta: "Open support"
    },
    {
      title: "Subscribe & socials",
      body: "Join LDA for driving tips, platform updates, exclusive offers, promo codes, and launch news.",
      href: "/social",
      image: "social",
      cta: "Get tips and offers"
    }
  ],
  instructor: [
    {
      title: "Find instructors",
      body: "Instructor accounts do not search for instructors. Use your instructor dashboard to manage availability, bookings, and learner demand instead.",
      href: "/instructor-dashboard",
      image: "car",
      cta: "Instructor account",
      disabled: true,
      note: "Learner search is available from a learner account."
    },
    {
      title: "Scheduled lessons",
      body: "Open your instructor diary to manage bookings, pickup details, availability, learner records, and working-day planning.",
      href: "/instructor-calendar?from=home",
      image: "calendar",
      cta: "Open diary"
    },
    {
      title: "Smart Match",
      body: "SmartMatch is a learner search tool. Your instructor account is matched to learners through your approved profile, availability, and live work status.",
      href: "/instructor-dashboard",
      image: "match",
      cta: "Already instructor",
      disabled: true,
      note: "Manage matching from your instructor dashboard and diary."
    },
    {
      title: "Become an instructor",
      body: "You are already signed in as an instructor. Open your instructor dashboard to manage your profile and verification.",
      href: "/instructor-dashboard",
      image: "instructor",
      cta: "Already an instructor",
      disabled: true,
      note: "This account is already approved for instructor tools."
    },
    {
      title: "Instructor support",
      body: "Get help with instructor verification, bookings, learner issues, compliance, payouts, account access, and working-day support.",
      href: "/support/instructor?from=home",
      image: "support",
      cta: "Open support"
    },
    {
      title: "Social media",
      body: "Follow LDA on official social channels for platform updates, instructor news, safety content, and launch announcements.",
      href: "/social?from=home",
      image: "social",
      cta: "Follow LDA"
    }
  ],
  admin: [
    {
      title: "Find instructors",
      body: "Preview the learner instructor-search experience from the protected admin preview controls.",
      href: "/dashboard?adminPreview=learner",
      image: "car",
      cta: "Preview learner"
    },
    {
      title: "Schedule lessons",
      body: "Preview learner scheduled lessons, future booking dates, pickup details, booking records, and dashboard scheduling controls.",
      href: "/planned-lessons?from=home",
      image: "calendar",
      cta: "Preview lessons"
    },
    {
      title: "Smart Match",
      body: "Run SmartMatch as an admin preview without changing account type.",
      href: "/smart-match?from=admin",
      image: "match",
      cta: "Open SmartMatch"
    },
    {
      title: "Become an instructor",
      body: "Preview instructor onboarding, verification, availability, finance, and learner route tools.",
      href: "/dashboard?adminPreview=instructor",
      image: "instructor",
      cta: "Preview instructor"
    },
    {
      title: "Live tracking",
      body: "Preview learner tracking or instructor pickup routing from the admin preview dashboard.",
      href: "/dashboard?adminPreview=instructor#instructor-live-tracking",
      image: "tracking",
      cta: "Preview tracking"
    },
    {
      title: "Subscribe & socials",
      body: "Open the public social and subscription page exactly as users see it.",
      href: "/social",
      image: "social",
      cta: "View social"
    }
  ]
};

const pendingInstructorSuggestionCards: SuggestionCard[] = [
  {
    title: "Find instructors",
    body: "Learner instructor search is available from a learner account. This instructor application is not learner-facing while it is in review.",
    href: "/instructor-verification?from=home",
    image: "car",
    cta: "Application in review",
    disabled: true,
    note: "Your instructor profile is hidden from learner search until LDA approval."
  },
  {
    title: "Schedule lessons",
    body: "Calendar, availability, bookings, and learner diary tools unlock after LDA approves your instructor application.",
    href: "/instructor-verification?from=home",
    image: "calendar",
    cta: "Locked in review",
    disabled: true,
    note: "Approval is required before bookings can be accepted."
  },
  {
    title: "Smart Match",
    body: "SmartMatch can only include instructors who have completed verification and are approved for learner-facing availability.",
    href: "/instructor-verification?from=home",
    image: "match",
    cta: "Hidden until approved",
    disabled: true,
    note: "Pending instructors do not appear in matching."
  },
  {
    title: "Become an instructor",
    body: "Your instructor application is linked to this signed-in account. Check the status and upload any missing documents from your verification page.",
    href: "/instructor-verification?from=home",
    image: "instructor",
    cta: "Check status"
  },
  {
    title: "Live tracking",
    body: "Learner route and live tracking tools unlock after your account is approved and you have a confirmed lesson.",
    href: "/instructor-verification?from=home",
    image: "tracking",
    cta: "Locked in review",
    disabled: true,
    note: "Live tracking requires an approved instructor account and a confirmed booking."
  },
  {
    title: "Social media",
    body: "Follow LDA on official social channels for platform updates, instructor news, safety content, and launch announcements.",
    href: "/social?from=home",
    image: "social",
    cta: "Follow LDA"
  }
];

export default function HomePage() {
  const learnerEntryHref = "/auth/login?role=learner";
  const instructorEntryHref = "/instructor";

  return (
    <>
      <header className="lda-universal-topbar sticky top-0 z-30 bg-black text-white">
        <div className="lda-universal-topbar-inner mx-auto flex w-full max-w-[1500px] items-center justify-between gap-3 px-3 sm:gap-6 sm:px-6 lg:px-10">
          <div className="flex min-w-0 items-center gap-9">
            <Brand size="home" />
            <nav className="hidden items-center gap-7 xl:flex">
              <Link href={learnerEntryHref} className="rounded-full px-2 py-2 text-sm font-bold text-white hover:ring-2 hover:ring-brand">
                Learner
              </Link>
              <Link href={instructorEntryHref} className="rounded-full px-2 py-2 text-sm font-bold text-white hover:ring-2 hover:ring-brand">
                Instructor
              </Link>
              <Link href="#services" className="rounded-full px-2 py-2 text-sm font-bold text-white hover:ring-2 hover:ring-brand">
                Services
              </Link>
              <Link href="/safety" className="rounded-full px-2 py-2 text-sm font-bold text-white hover:ring-2 hover:ring-brand">Safety</Link>
              <Link href="/about" className="rounded-full px-2 py-2 text-sm font-bold text-white hover:ring-2 hover:ring-brand">About</Link>
            </nav>
          </div>
          <div className="ml-auto hidden items-center justify-end gap-7 xl:flex">
            <LanguageSelector />
            <Link href="/support?from=help" className="inline-flex items-center gap-2 rounded-full px-3 py-2 whitespace-nowrap text-sm font-bold text-white hover:ring-2 hover:ring-brand">
              <HelpCircle size={18} /> Help
            </Link>
            <HomeAccountControls />
          </div>
          <div className="ml-auto flex min-w-0 shrink-0 items-center gap-2 sm:gap-3 xl:hidden">
            <HomeAccountControls compact />
          </div>
        </div>
      </header>

      <main className="bg-white pb-24 text-black sm:pb-0">
        <section className="bg-white">
          <div className="mx-auto grid max-w-[1500px] items-center gap-10 px-4 py-8 sm:px-6 sm:py-10 lg:px-10 xl:grid-cols-[0.95fr_1.05fr] xl:py-14">
            <div className="max-w-2xl">
              <div className="inline-flex max-w-full items-center gap-2 rounded-full bg-zinc-100 px-4 py-2 text-xs font-black uppercase tracking-normal text-zinc-800 shadow-sm ring-1 ring-zinc-200">
                <ShieldCheck className="shrink-0" size={16} /> <span className="min-w-0 truncate">LDA learner driver platform</span>
              </div>
              <h1 className="mt-7 max-w-3xl text-5xl font-black leading-[1.05] tracking-normal text-black sm:mt-8 sm:text-6xl xl:text-7xl">
                Book driving lessons with <span className="text-brand">L</span>DA.
              </h1>
              <p className="mt-6 max-w-xl text-lg font-semibold leading-8 text-zinc-700 sm:mt-7 sm:text-xl">
                L Driving Academy helps learners find verified instructors, schedule or book on demand lessons, manage secure payments and track lesson progress in one place.
              </p>
              <HomeHeroActions />
              <div className="mt-10 flex flex-wrap gap-x-8 gap-y-4 text-sm font-bold text-zinc-800">
                {heroTrustPoints.map((point) => (
                  <div key={point} className="inline-flex items-center gap-2">
                    <CheckCircle2 size={21} className="text-brand" /> {point}
                  </div>
                ))}
              </div>
            </div>

            <section className="relative overflow-hidden rounded bg-black text-white shadow-2xl ring-1 ring-zinc-200">
              <div className="relative min-h-[540px] p-5 sm:p-7 xl:min-h-[610px]">
                <img
                  src="/learner-instructor.jpg"
                  alt="Learner driver behind the wheel with an instructor in the passenger seat"
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                <div className="absolute inset-x-5 bottom-5 overflow-hidden rounded bg-black/72 p-5 shadow-2xl backdrop-blur-md ring-1 ring-white/10 sm:inset-x-7 sm:bottom-7 sm:grid sm:grid-cols-[1fr_220px] sm:gap-5 sm:p-5 md:left-8 md:right-auto md:w-[min(66%,540px)] md:grid-cols-[1fr_180px] md:gap-4 xl:inset-x-7 xl:w-auto xl:grid-cols-[1fr_260px] xl:gap-6 xl:p-7">
                  <div>
                    <HomeSmartMatchLink />
                    <h2 className="mt-4 text-2xl font-black leading-tight text-white xl:mt-5 xl:text-3xl">
                      Matched for you.<br />Built for success.
                    </h2>
                    <p className="mt-3 max-w-xl text-xs font-semibold leading-5 text-zinc-200 xl:mt-4 xl:text-sm xl:leading-6">
                      SmartMatch compares distance, price, availability, instructor profile, and learner preferences to help you find the right fit.
                    </p>
                  </div>
                  <div className="mt-5 grid gap-3 border-white/20 sm:mt-0 sm:border-l sm:pl-4 xl:gap-4 xl:pl-6">
                    {matchHighlights.map((item) => {
                      const Icon = item.icon;
                      return (
                        <div key={item.label} className="flex items-center gap-3 text-xs font-black text-white xl:gap-4 xl:text-sm">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-brand xl:h-11 xl:w-11">
                            <Icon size={19} />
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

        <section className="bg-white px-4 pb-14 sm:px-6 lg:px-10">
          <div className="mx-auto max-w-[1500px]">
            <HomeSuggestionGrid />
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
      </main>
      <SiteFooter />
      <HomepageAiAssistant />
    </>
  );
}

function SuggestionCardLink({ card }: { card: SuggestionCard }) {
  const content = (
    <>
      <div className="flex flex-col items-start">
        <h3 className="text-2xl font-black">{card.title}</h3>
        <p className="mt-4 max-w-xs text-base leading-7 text-zinc-800">{card.body}</p>
        {card.note ? (
          <p className="mt-4 rounded bg-white px-3 py-2 text-sm font-bold leading-6 text-zinc-600 ring-1 ring-zinc-200">{card.note}</p>
        ) : null}
        <span className={`mt-auto inline-flex items-center rounded-full px-4 py-2 text-sm font-black ${card.disabled ? "bg-zinc-300 text-zinc-700" : "bg-brand text-white"}`}>
          {card.cta}
        </span>
      </div>
      <CardVisual type={card.image} />
    </>
  );

  const className = `group grid min-h-[220px] gap-5 overflow-hidden rounded bg-zinc-100 p-5 text-black sm:grid-cols-[1fr_150px] sm:p-6 ${
    card.disabled ? "cursor-not-allowed opacity-80" : "cursor-pointer hover:bg-zinc-200"
  }`;

  if (card.disabled) {
    return (
      <article aria-disabled="true" className={className}>
        {content}
      </article>
    );
  }

  return (
    <Link href={card.href} className={className}>
      {content}
    </Link>
  );
}

function HeaderAccountBlock({ account, compact = false }: { account: HeaderAccountSummary; compact?: boolean }) {
  const accountPillHref = account.subscriptionHref;

  return (
    <div className={`flex min-w-0 flex-col items-center text-center leading-tight ${compact ? "max-w-[128px]" : "max-w-[190px]"}`}>
      <div className="max-w-full truncate text-sm font-black text-white">{account.name}</div>
      {account.role === "admin" ? (
        <Link href="/admin-preview" className="mt-1 inline-flex max-w-full items-center justify-center truncate rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1 text-xs font-black uppercase text-red-100 transition hover:border-red-500/80 hover:text-white hover:ring-2 hover:ring-brand">
          Admin
        </Link>
      ) : (
        <Link href={accountPillHref} className="mt-1 inline-flex max-w-full items-center justify-center truncate rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1 text-xs font-black uppercase text-red-100 transition hover:border-red-500/80 hover:text-white hover:ring-2 hover:ring-brand">
          {account.subscriptionLabel}
        </Link>
      )}
      {account.upgradeHref && account.upgradeLabel ? (
        <Link href={account.upgradeHref} className="mt-1 inline-flex max-w-full items-center justify-center truncate rounded-full border border-red-500/40 bg-transparent px-3 py-1 text-[11px] font-black uppercase text-red-100 transition hover:border-red-500/80 hover:text-white hover:ring-2 hover:ring-brand">
          {account.upgradeLabel}
        </Link>
      ) : null}
    </div>
  );
}

function CardVisual({ type }: { type: CardVisualType }) {
  const visual = {
    car: <CarFront size={68} />,
    calendar: <CalendarCheck size={68} />,
    match: <Sparkles size={68} />,
    instructor: <UsersRound size={68} />,
    tracking: <RadioTower size={68} />,
    support: <Headphones size={68} />,
    social: <Share2 size={68} />
  }[type];

  return (
    <div className="relative grid place-items-start text-black sm:place-items-center">
      <div className="grid h-20 w-20 place-items-center rounded bg-white text-brand shadow-sm transition group-hover:scale-105 sm:h-24 sm:w-24">
        {visual}
      </div>
    </div>
  );
}

