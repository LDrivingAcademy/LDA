"use client";

import { useEffect } from "react";

type HomeSummaryResponse = {
  account?: {
    dashboardHref?: string;
    role?: string;
  } | null;
};

const instructorLearnerFeatureMessage =
  "You are signed in as an instructor. Sign out of this instructor account to use SmartMatch with a learner account.";

const instructorLearnerAccountHref = `/auth/sign-up?role=learner&next=${encodeURIComponent(
  "/smart-match"
)}&message=${encodeURIComponent(instructorLearnerFeatureMessage)}`;

export function SmartMatchAccountGuard() {
  useEffect(() => {
    let active = true;

    async function checkAccount() {
      try {
        const response = await fetch("/api/account/home-summary", {
          cache: "no-store",
          credentials: "same-origin"
        });

        if (!active || !response.ok) {
          return;
        }

        const result = (await response.json()) as HomeSummaryResponse;

        if (result.account?.role === "instructor") {
          window.location.replace(instructorLearnerAccountHref);
        }
      } catch {
        // Keep SmartMatch available for guests if the account summary check cannot complete.
      }
    }

    void checkAccount();

    return () => {
      active = false;
    };
  }, []);

  return null;
}
