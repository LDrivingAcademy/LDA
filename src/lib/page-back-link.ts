type PageSourceParams = {
  from?: string | string[];
  message?: string | string[];
  section?: string | string[];
  cancel?: string | string[];
  booking?: string | string[];
};

export type PageSourceSearchParams = Promise<PageSourceParams | undefined> | undefined;

type PageBackLinkOptions = {
  allowAdminSource?: boolean;
};

export async function getPageBackLink(searchParams: PageSourceSearchParams, options: PageBackLinkOptions = {}) {
  const params = await searchParams;
  const source = Array.isArray(params?.from) ? params.from[0] : params?.from;
  const fromDashboard = source === "dashboard";
  const fromAdmin = Boolean(options.allowAdminSource && source === "admin");
  const fromPlannedLessons = source === "planned-lessons";
  const fromScheduleLessons = source === "scheduled-lessons";
  const fromSitemap = source === "sitemap";
  const fromLearnerJourney = source === "learner-journey";
  const fromLearnerDashboard = source === "learner-dashboard";
  const fromDrivingLessons = source === "driving-lessons";
  const fromLearnerCalendar = source === "learner-calendar";
  const fromLearnerDashboardRoute = fromLearnerJourney || fromLearnerDashboard;

  return {
    backHref: fromAdmin
      ? "/admin"
      : fromSitemap
        ? "/sitemap"
        : fromScheduleLessons
          ? "/scheduled-lessons"
          : fromPlannedLessons
            ? "/planned-lessons"
            : fromDrivingLessons
              ? "/learner-dashboard?section=driving-lessons&from=learner-dashboard#driving-lessons-booking"
            : fromLearnerDashboardRoute
              ? "/learner-dashboard"
            : fromDashboard
              ? "/dashboard"
              : fromLearnerCalendar
                ? "/learner-calendar?from=dashboard"
              : "/",
    backLabel: fromAdmin
      ? "Back to admin"
      : fromSitemap
        ? "Back to sitemap"
      : fromScheduleLessons
        ? "Back to schedule lessons"
      : fromPlannedLessons
        ? "Back to schedule lessons"
      : fromDrivingLessons
        ? "Back to driving lessons"
      : fromLearnerDashboardRoute
        ? "Back to learner dashboard"
        : fromLearnerCalendar
          ? "Back to learner calendar"
        : fromDashboard
          ? "Back to dashboard"
          : "Back to homepage",
    fromDashboard: fromDashboard || fromLearnerDashboard,
    fromAdmin,
    fromPlannedLessons: fromPlannedLessons || fromScheduleLessons,
    fromLearnerJourney,
    fromLearnerDashboard
  };
}

export function withDashboardSource(href: string, fromDashboard: boolean) {
  if (!fromDashboard) {
    return href;
  }

  return appendPageSource(href, "dashboard");
}

export function withPageSource(href: string, source: string) {
  return appendPageSource(href, source);
}

function appendPageSource(href: string, source: string) {
  const [pathAndQuery, hash] = href.split("#", 2);
  const separator = pathAndQuery.includes("?") ? "&" : "?";
  const sourcedHref = `${pathAndQuery}${separator}from=${encodeURIComponent(source)}`;

  return hash ? `${sourcedHref}#${hash}` : sourcedHref;
}
