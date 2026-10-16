"use client";

import Link from "next/link";
import { CalendarCheck, CarFront, Headphones, RadioTower, Share2, Sparkles, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import { LearnerInstructorApplyTile } from "@/components/learner-instructor-apply-tile";
import type { HeaderAccountSummary } from "@/lib/current-account";

type CardVisualType = "car" | "calendar" | "match" | "instructor" | "tracking" | "support" | "social";
type HomepageAccountRole = Exclude<HeaderAccountSummary["role"], "admin" | "support"> | "visitor";

type SuggestionCard = {
  title: string;
  body: string;
  href: string;
  image: CardVisualType;
  cta: string;
  disabled?: boolean;
  note?: string;
};

type HomeSummaryResponse = {
  account?: HeaderAccountSummary | null;
};

const guestFindInstructorsHref = `/auth/login?role=learner&next=${encodeURIComponent("/learner-dashboard?section=driving-lessons&from=home#driving-lessons-booking")}`;
const guestScheduleLessonHref = `/auth/login?role=learner&next=${encodeURIComponent("/scheduled-lessons?from=home#scheduled-lessons-booking")}`;

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

export function HomeSuggestionGrid() {
  const [account, setAccount] = useState<HeaderAccountSummary | null | undefined>(undefined);

  useEffect(() => {
    let active = true;

    fetch("/api/account/home-summary", {
      cache: "no-store",
      credentials: "same-origin"
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: HomeSummaryResponse | null) => {
        if (active) {
          setAccount(data?.account ?? null);
        }
      })
      .catch(() => {
        if (active) {
          setAccount(null);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const isLoadingAccount = account === undefined;
  const homepageRole: HomepageAccountRole = account?.role === "admin" || account?.role === "support" ? "visitor" : account?.role ?? "visitor";
  const isPendingInstructor = account?.role === "instructor" && account.subscriptionLabel === "In progress";
  const cards =
    (account?.role === "admin" || account?.role === "support") && account.homeSuggestionCards?.length
      ? account.homeSuggestionCards
      : isPendingInstructor
        ? pendingInstructorSuggestionCards
        : roleSuggestionCards[homepageRole];

  if (isLoadingAccount) {
    return (
      <>
        <div className="max-w-3xl">
          <div className="h-12 max-w-2xl rounded bg-zinc-100" aria-hidden="true" />
        </div>
        <div className="mt-9 grid gap-5 md:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <div key={item} className="min-h-[220px] rounded bg-zinc-100 ring-1 ring-zinc-200" />
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="max-w-3xl">
        <h2 className="text-4xl font-black tracking-normal sm:text-5xl">
          {homepageRole === "visitor"
            ? "Preview how LDA works before you sign in."
            : homepageRole === "learner"
              ? "Your learner tools, ready from the homepage."
              : homepageRole === "instructor"
                ? "Your instructor tools, ready from the homepage."
                : "Your account tools, ready from the homepage."}
        </h2>
      </div>
      <div className="mt-9 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          homepageRole === "learner" && card.title === "Become an instructor" ? (
            <LearnerInstructorApplyTile key={`${homepageRole}-${card.title}`} />
          ) : (
            <SuggestionCardLink key={`${homepageRole}-${card.title}`} card={card} />
          )
        ))}
      </div>
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
