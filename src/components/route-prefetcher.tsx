"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getInternalHref, getInternalHrefFromTarget, rememberInternalNavigation } from "@/components/navigation-history";

const alwaysWarmRoutes = [
  "/",
  "/dashboard"
];

const routeWarmGroups: Record<string, string[]> = {
  "/": [
    "/learner-dashboard",
    "/learner-dashboard?section=driving-lessons&from=home",
    "/smart-match",
    "/planned-lessons",
    "/scheduled-lessons",
    "/lesson-now",
    "/support",
    "/support/guest",
    "/tracking",
    "/about",
    "/contact"
  ],
  "/dashboard": ["/learner-dashboard", "/instructor-dashboard", "/account", "/booking-history", "/notification-hub"],
  "/learner-dashboard": [
    "/learner-dashboard?section=driving-lessons&from=learner-dashboard",
    "/learner-dashboard?section=driving-lessons&from=home",
    "/smart-match",
    "/tracking",
    "/booking-history",
    "/learner-calendar",
    "/scheduled-lessons",
    "/theory-test",
    "/progress-tracker",
    "/practical-test",
    "/rate-instructor",
    "/learner-journey",
    "/account"
  ],
  "/learner-journey": [
    "/learner-dashboard",
    "/learner-dashboard?section=driving-lessons&from=learner-dashboard",
    "/theory-test",
    "/progress-tracker",
    "/practical-test",
    "/booking-history",
    "/learner-calendar"
  ],
  "/instructor-dashboard": [
    "/instructor-calendar",
    "/pupil-management",
    "/instructor-finance",
    "/instructor-verification",
    "/instructor-vehicle-compliance",
    "/account"
  ],
  "/account": [
    "/account/personal-info",
    "/account/change-password",
    "/account/recovery-phone",
    "/account/provisional-licence",
    "/account/instructor-transfer",
    "/learner-dashboard",
    "/instructor-dashboard"
  ],
  "/theory-test": ["/learner-dashboard", "/progress-tracker", "/practical-test", "/booking-history"],
  "/lesson-now": ["/lesson-now/confirmed", "/tracking", "/planned-lessons", "/contact"],
  "/planned-lessons": ["/scheduled-lessons?from=planned-lessons", "/lesson-now", "/learner-calendar"],
  "/scheduled-lessons": ["/learner-dashboard?section=driving-lessons&from=scheduled-lessons", "/planned-lessons", "/learner-calendar"]
};

function getWarmGroupsForPathname(pathname: string) {
  const exactGroup = routeWarmGroups[pathname] ?? [];

  if (pathname.startsWith("/account")) {
    return [...exactGroup, ...routeWarmGroups["/account"]];
  }

  if (pathname.startsWith("/learner-dashboard") || pathname.startsWith("/learner-journey")) {
    return [...exactGroup, ...routeWarmGroups["/learner-dashboard"], ...routeWarmGroups["/learner-journey"]];
  }

  if (pathname.startsWith("/instructor-dashboard")) {
    return [...exactGroup, ...routeWarmGroups["/instructor-dashboard"]];
  }

  if (pathname.startsWith("/theory-test")) {
    return [...exactGroup, ...routeWarmGroups["/theory-test"]];
  }

  if (pathname.startsWith("/lesson-now")) {
    return [...exactGroup, ...routeWarmGroups["/lesson-now"]];
  }

  if (pathname.startsWith("/planned-lessons")) {
    return [...exactGroup, ...routeWarmGroups["/planned-lessons"]];
  }

  if (pathname.startsWith("/scheduled-lessons")) {
    return [...exactGroup, ...routeWarmGroups["/scheduled-lessons"]];
  }

  return exactGroup;
}

function shouldKeepBackgroundWarmingLight() {
  const connection = (navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
  }).connection;

  if (!connection) {
    return false;
  }

  return Boolean(connection.saveData) || /(^|-)2g$/.test(connection.effectiveType || "");
}

export function RoutePrefetcher() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const prefetched = new Set<string>();
    const observedAnchors = new Set<HTMLAnchorElement>();
    const timeoutIds: ReturnType<typeof setTimeout>[] = [];
    let observer: IntersectionObserver | null = null;

    function prefetch(href: string | null) {
      if (!href || href === pathname || prefetched.has(href)) {
        return;
      }

      prefetched.add(href);

      try {
        router.prefetch(href);
      } catch {
        // Prefetch is an enhancement only; navigation still works normally.
      }
    }

    function observeAnchor(anchor: HTMLAnchorElement) {
      if (!observer || observedAnchors.has(anchor) || !getInternalHref(anchor.getAttribute("href"))) {
        return;
      }

      observedAnchors.add(anchor);
      observer.observe(anchor);
    }

    function observeAnchors(root: ParentNode = document) {
      if (!observer) {
        return;
      }

      root.querySelectorAll<HTMLAnchorElement>("a[href]").forEach(observeAnchor);
    }

    function handleIntent(event: Event) {
      prefetch(getInternalHrefFromTarget(event.target));
    }

    function handleNavigation(event: Event) {
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (anchor?.dataset.ldaBackLink === "true") {
        return;
      }

      rememberInternalNavigation(getInternalHrefFromTarget(event.target));
    }

    function warmLikelyRoutes() {
      const warmRoutes = Array.from(new Set([...alwaysWarmRoutes, ...getWarmGroupsForPathname(pathname)]));
      const keepLight = shouldKeepBackgroundWarmingLight();
      const immediateLimit = keepLight ? 1 : 2;
      const secondWaveLimit = keepLight ? 0 : 3;
      const stagedLimit = keepLight ? 0 : 4;
      const immediateRoutes = warmRoutes.slice(0, immediateLimit);
      const secondWaveRoutes = warmRoutes.slice(immediateLimit, immediateLimit + secondWaveLimit);
      const stagedRoutes = warmRoutes.slice(immediateLimit + secondWaveLimit, immediateLimit + secondWaveLimit + stagedLimit);

      immediateRoutes.forEach(prefetch);
      secondWaveRoutes.forEach((href, index) => {
        timeoutIds.push(globalThis.setTimeout(() => prefetch(href), 650 * (index + 1)));
      });
      stagedRoutes.forEach((href, index) => {
        timeoutIds.push(globalThis.setTimeout(() => prefetch(href), 2500 + 900 * index));
      });
    }

    const idleId =
      typeof window.requestIdleCallback === "function"
        ? window.requestIdleCallback(warmLikelyRoutes, { timeout: 2500 })
        : globalThis.setTimeout(warmLikelyRoutes, 900);

    if (typeof window.IntersectionObserver === "function") {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              prefetch(getInternalHrefFromTarget(entry.target));
              observer?.unobserve(entry.target);
            }
          }
        },
        { rootMargin: "180px" }
      );
    }

    observeAnchors();

    document.addEventListener("pointerover", handleIntent, true);
    document.addEventListener("pointerdown", handleIntent, true);
    document.addEventListener("click", handleNavigation, true);
    document.addEventListener("focusin", handleIntent, true);
    document.addEventListener("touchstart", handleIntent, { capture: true, passive: true });

    return () => {
      if (typeof window.cancelIdleCallback === "function" && typeof idleId === "number") {
        window.cancelIdleCallback(idleId);
      } else {
        globalThis.clearTimeout(idleId);
      }

      if (observer) {
        observedAnchors.forEach((anchor) => observer.unobserve(anchor));
        observer.disconnect();
      }

      timeoutIds.forEach((timeoutId) => globalThis.clearTimeout(timeoutId));

      document.removeEventListener("pointerover", handleIntent, true);
      document.removeEventListener("pointerdown", handleIntent, true);
      document.removeEventListener("click", handleNavigation, true);
      document.removeEventListener("focusin", handleIntent, true);
      document.removeEventListener("touchstart", handleIntent, true);
    };
  }, [pathname, router]);

  return null;
}
