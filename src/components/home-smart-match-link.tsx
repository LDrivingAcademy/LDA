"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type HomeAccountSummary = {
  role?: "learner" | "instructor" | "admin";
};

type HomeSummaryResponse = {
  account?: HomeAccountSummary | null;
};

const instructorLearnerFeatureMessage =
  "You are signed in as an instructor. Sign out of this instructor account to use SmartMatch with a learner account.";

const instructorSmartMatchHref = `/auth/sign-up?role=learner&next=${encodeURIComponent(
  "/smart-match?from=home"
)}&message=${encodeURIComponent(instructorLearnerFeatureMessage)}`;

export function HomeSmartMatchLink() {
  const [account, setAccount] = useState<HomeAccountSummary | null | undefined>(undefined);

  useEffect(() => {
    let active = true;

    fetch("/api/account/home-summary", {
      cache: "no-store",
      credentials: "same-origin"
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: HomeSummaryResponse | null) => {
        if (active) setAccount(data?.account ?? null);
      })
      .catch(() => {
        if (active) setAccount(null);
      });

    return () => {
      active = false;
    };
  }, []);

  const href = account?.role === "instructor" ? instructorSmartMatchHref : "/smart-match?from=home-hero";

  if (account === undefined) {
    return (
      <span className="inline-flex rounded-full bg-brand px-4 py-2 text-[11px] font-black uppercase text-white shadow-lg shadow-red-600/25 xl:px-5 xl:text-xs" aria-hidden="true">
        LDA SmartMatch
      </span>
    );
  }

  return (
    <Link href={href} className="inline-flex rounded-full bg-brand px-4 py-2 text-[11px] font-black uppercase text-white shadow-lg shadow-red-600/25 hover:bg-red-700 xl:px-5 xl:text-xs">
      LDA SmartMatch
    </Link>
  );
}
