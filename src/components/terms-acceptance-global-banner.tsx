"use client";

import { useEffect, useState } from "react";
import { TermsAcceptanceGlobalBannerClient } from "@/components/terms-acceptance-global-banner-client";

type TermsStatusResponse = {
  dashboardHref?: string;
  needsTermsAcceptance?: boolean;
};

export function TermsAcceptanceGlobalBanner() {
  const [dashboardHref, setDashboardHref] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    fetch("/api/account/terms-status", {
      cache: "no-store",
      credentials: "same-origin"
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: TermsStatusResponse | null) => {
        if (!active || !data?.needsTermsAcceptance) {
          return;
        }

        setDashboardHref(data.dashboardHref || "/dashboard");
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  if (!dashboardHref) {
    return null;
  }

  return <TermsAcceptanceGlobalBannerClient dashboardHref={dashboardHref} />;
}
