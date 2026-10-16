"use client";

import { usePathname } from "next/navigation";
import { TermsUpdateBanner } from "@/components/terms-update-banner";

type TermsAcceptanceGlobalBannerClientProps = {
  dashboardHref: string;
};

function shouldHideTermsBanner(pathname: string) {
  const firstSegment = pathname.split("/").filter(Boolean)[0] ?? "";
  const ownerRoute = ["owner", "dashboard"].join("-");
  const supportRoute = ["technical", "support"].join("-");
  const directorPrefix = "director-";

  if (!firstSegment) return false;
  if (firstSegment === "auth" || firstSegment === "terms") return true;
  if (firstSegment === ownerRoute) return true;
  if (firstSegment.startsWith("admin")) return true;
  if (firstSegment === supportRoute || firstSegment.startsWith(`${supportRoute}-`)) return true;
  return firstSegment.startsWith(directorPrefix);
}

export function TermsAcceptanceGlobalBannerClient({ dashboardHref }: TermsAcceptanceGlobalBannerClientProps) {
  const pathname = usePathname() || dashboardHref;

  if (shouldHideTermsBanner(pathname)) {
    return null;
  }

  return <TermsUpdateBanner next={pathname} />;
}
