"use client";

import Link from "next/link";
import { ArrowRight, CalendarCheck, Search } from "lucide-react";
import { useEffect, useState } from "react";
import type { HeaderAccountSummary } from "@/lib/current-account";

type HomeSummaryResponse = {
  account?: HeaderAccountSummary | null;
};

const guestFindInstructorsHref = `/auth/login?role=learner&next=${encodeURIComponent("/learner-dashboard?section=driving-lessons&from=home#driving-lessons-booking")}`;

function useHomeAccount() {
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

  return account;
}

export function HomeHeroActions() {
  const account = useHomeAccount();
  const isLoadingAccount = account === undefined;
  const learnerSignUpMessage = "You are signed in as an instructor. Sign up for a learner account with a different email to use learner features.";
  const learnerEntryHref =
    account?.role === "admin"
      ? "/learner-dashboard"
      : account?.role === "learner"
        ? "/learner-dashboard"
        : account?.role === "instructor"
          ? `/auth/sign-up?role=learner&message=${encodeURIComponent(learnerSignUpMessage)}`
          : "/auth/login?role=learner";
  const learnerFindInstructorsHref =
    account?.role === "admin" || account?.role === "learner"
      ? "/learner-dashboard?section=driving-lessons&from=home#driving-lessons-booking"
      : account?.role === "instructor"
        ? learnerEntryHref
        : guestFindInstructorsHref;
  const bookOnDemandHref =
    account?.role === "instructor"
      ? `/auth/sign-up?role=learner&message=${encodeURIComponent(learnerSignUpMessage)}`
      : "/lesson-now";

  if (isLoadingAccount) {
    return (
      <div className="mt-8 grid gap-3 sm:mt-9 sm:grid-cols-2 sm:gap-4" aria-hidden="true">
        <div className="min-h-16 rounded-full bg-zinc-100 ring-1 ring-zinc-200" />
        <div className="min-h-16 rounded-full bg-zinc-100 ring-1 ring-zinc-200" />
      </div>
    );
  }

  return (
    <div className="mt-8 grid min-w-0 gap-3 sm:mt-9 sm:grid-cols-2 sm:gap-4">
      <Link href={learnerFindInstructorsHref} className="lda-home-primary-cta inline-flex min-h-14 min-w-0 items-center justify-center gap-3 rounded-full bg-brand px-5 py-4 text-center text-sm font-black leading-tight text-white shadow-lg shadow-red-600/20 transition hover:bg-red-700 hover:ring-2 hover:ring-red-300 sm:min-h-16 sm:gap-4 sm:px-6 sm:text-base">
        <Search className="shrink-0" size={23} /> <span className="min-w-0 truncate">Find instructors</span> <ArrowRight className="shrink-0" size={22} />
      </Link>
      <Link href={bookOnDemandHref} className="inline-flex min-h-14 min-w-0 items-center justify-center gap-3 rounded-full border border-zinc-400 bg-white px-5 py-4 text-center text-sm font-black leading-tight text-black transition hover:border-brand hover:ring-2 hover:ring-brand/50 sm:min-h-16 sm:gap-4 sm:px-6 sm:text-base">
        <CalendarCheck className="shrink-0" size={23} /> <span className="min-w-0 truncate">Book on-demand</span>
      </Link>
    </div>
  );
}
