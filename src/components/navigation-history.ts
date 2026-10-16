"use client";

const previousInternalUrlKey = "lda-previous-internal-url";
const internalUrlStackKey = "lda-internal-url-stack-v2";
const maxInternalUrlStackLength = 16;

function isPrivilegedInternalPath(pathname: string) {
  const firstSegment = pathname.split("/").filter(Boolean)[0] ?? "";
  const ownerRoute = ["owner", "dashboard"].join("-");
  const supportRoute = ["technical", "support"].join("-");
  const directorPrefix = "director-";

  if (!firstSegment) return false;
  if (firstSegment === ownerRoute) return true;
  if (firstSegment.startsWith("admin")) return true;
  if (firstSegment === supportRoute || firstSegment.startsWith(`${supportRoute}-`)) return true;
  return firstSegment.startsWith(directorPrefix);
}

export function getCurrentInternalUrl() {
  return `${window.location.pathname}${window.location.search}`;
}

export function getInternalHref(rawHref: string | null) {
  if (!rawHref || rawHref.startsWith("#") || rawHref.startsWith("mailto:") || rawHref.startsWith("tel:")) {
    return null;
  }

  const url = new URL(rawHref, window.location.origin);

  if (url.origin !== window.location.origin) {
    return null;
  }

  if (isPrivilegedInternalPath(url.pathname)) {
    return null;
  }

  return `${url.pathname}${url.search}`;
}

export function getInternalHrefFromTarget(target: EventTarget | null) {
  const anchor = target instanceof Element ? target.closest<HTMLAnchorElement>("a[href]") : null;
  return getInternalHref(anchor?.getAttribute("href") ?? null);
}

function readInternalUrlStack() {
  try {
    const rawStack = window.sessionStorage.getItem(internalUrlStackKey);
    const parsed = rawStack ? JSON.parse(rawStack) : [];

    if (Array.isArray(parsed)) {
      return parsed.filter((href): href is string => typeof href === "string" && href.startsWith("/") && !href.startsWith("//"));
    }
  } catch {
    // Navigation history is an enhancement; normal links still work.
  }

  return [];
}

function writeInternalUrlStack(stack: string[]) {
  try {
    const cleanStack = stack
      .filter((href, index, values) => href.startsWith("/") && !href.startsWith("//") && values.indexOf(href) === index)
      .slice(-maxInternalUrlStackLength);

    window.sessionStorage.setItem(internalUrlStackKey, JSON.stringify(cleanStack));
    const latestPrevious = cleanStack.at(-1);

    if (latestPrevious) {
      window.sessionStorage.setItem(previousInternalUrlKey, latestPrevious);
    } else {
      window.sessionStorage.removeItem(previousInternalUrlKey);
    }
  } catch {
    // Navigation history is an enhancement; normal links still work.
  }
}

export function rememberInternalNavigation(nextHref: string | null) {
  if (!nextHref) {
    return;
  }

  const currentHref = getCurrentInternalUrl();

  if (nextHref === currentHref) {
    return;
  }

  try {
    const stack = readInternalUrlStack().filter((href) => href !== currentHref);
    const existingTargetIndex = stack.lastIndexOf(nextHref);

    if (existingTargetIndex >= 0) {
      writeInternalUrlStack(stack.slice(0, existingTargetIndex));
      return;
    }

    writeInternalUrlStack([...stack, currentHref]);
  } catch {
    // Navigation history is an enhancement; normal links still work.
  }
}

export function readPreviousInternalUrl() {
  try {
    const currentHref = getCurrentInternalUrl();
    const stack = readInternalUrlStack().filter((href) => href !== currentHref);
    const previousHref = stack.at(-1) ?? window.sessionStorage.getItem(previousInternalUrlKey);

    if (!previousHref || previousHref === currentHref || !previousHref.startsWith("/") || previousHref.startsWith("//")) {
      return null;
    }

    return previousHref;
  } catch {
    return null;
  }
}

export function consumeBackNavigation(targetHref: string | null) {
  if (!targetHref) {
    return;
  }

  try {
    const currentHref = getCurrentInternalUrl();
    const stack = readInternalUrlStack().filter((href) => href !== currentHref);
    const targetIndex = stack.lastIndexOf(targetHref);

    if (targetIndex >= 0) {
      writeInternalUrlStack(stack.slice(0, targetIndex));
      return;
    }

    writeInternalUrlStack(stack);
  } catch {
    // Navigation history is an enhancement; normal links still work.
  }
}

export function getSourceBackHref(source: string | null) {
  const sources: Record<string, string> = {
    home: "/",
    homepage: "/",
    sitemap: "/sitemap",
    dashboard: "/dashboard",
    "learner-dashboard": "/learner-dashboard",
    "learner-journey": "/learner-dashboard",
    "learner-calendar": "/learner-calendar?from=dashboard",
    "driving-lessons": "/learner-dashboard?section=driving-lessons&from=learner-dashboard",
    "planned-lessons": "/planned-lessons",
    "scheduled-lessons": "/scheduled-lessons",
    instructor: "/instructor"
  };

  return source ? sources[source] ?? null : null;
}

export function getBackLabelForHref(href: string, fallbackLabel: string) {
  const pathname = href.split("?")[0] || "/";
  const useLearnerDashboardLabel = fallbackLabel === "Back to learner dashboard";

  if (useLearnerDashboardLabel && (pathname === "/dashboard" || pathname === "/learner-dashboard" || pathname === "/learner-journey")) {
    return fallbackLabel;
  }

  const labels: Record<string, string> = {
    "/": "Back to homepage",
    "/about": "Back to about",
    "/accessibility": "Back to accessibility",
    "/auth/login": "Back to learner login",
    "/dashboard": "Back to dashboard",
    "/learner-dashboard": "Back to learner dashboard",
    "/planned-lessons": "Back to schedule lessons",
    "/scheduled-lessons": "Back to schedule lessons",
    "/instructor-dashboard": "Back to instructor dashboard",
    "/instructor": "Back to instructor",
    "/learner-journey": "Back to learner journey",
    "/lesson-now": "Back to lesson now",
    "/theory-test": "Back to theory test",
    "/practical-test": "Back to practical test",
    "/progress-tracker": "Back to progress tracker",
    "/booking-history": "Back to dashboard",
    "/notification-hub": "Back to notifications",
    "/account": "Back to account",
    "/smart-match": "Back to Smart Match",
    "/roadworthy": "Back to tips directory",
    "/contact": "Back to help",
    "/support": "Back to support",
    "/social": "Back to subscribe and socials",
    "/tracking": "Back to live tracking",
    "/sitemap": "Back to sitemap",
    "/terms": "Back to terms of use",
    "/cookies": "Back to cookie policy",
    "/privacy": "Back to privacy policy",
    "/cancellation-policy": "Back to cancellation policy",
    "/data-requests": "Back to data requests",
    "/learner-plus": "Back to learner packages",
    "/instructor-plus": "Back to instructor packages"
  };

  if (labels[pathname]) {
    return labels[pathname];
  }

  return fallbackLabel;
}
