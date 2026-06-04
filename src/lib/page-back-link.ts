type PageSourceParams = {
  from?: string | string[];
};

export type PageSourceSearchParams = Promise<PageSourceParams | undefined> | undefined;

export async function getPageBackLink(searchParams: PageSourceSearchParams) {
  const params = await searchParams;
  const source = Array.isArray(params?.from) ? params.from[0] : params?.from;
  const fromDashboard = source === "dashboard";

  return {
    backHref: fromDashboard ? "/dashboard" : "/",
    backLabel: fromDashboard ? "Back to dashboard" : "Back to home page",
    fromDashboard
  };
}

export function withDashboardSource(href: string, fromDashboard: boolean) {
  if (!fromDashboard) {
    return href;
  }

  return `${href}${href.includes("?") ? "&" : "?"}from=dashboard`;
}
