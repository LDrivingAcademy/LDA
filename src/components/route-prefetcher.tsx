"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

function getInternalHref(target: EventTarget | null) {
  const anchor = target instanceof Element ? target.closest<HTMLAnchorElement>("a[href]") : null;

  if (!anchor) {
    return null;
  }

  const rawHref = anchor.getAttribute("href");

  if (!rawHref || rawHref.startsWith("#") || rawHref.startsWith("mailto:") || rawHref.startsWith("tel:")) {
    return null;
  }

  const url = new URL(rawHref, window.location.origin);

  if (url.origin !== window.location.origin) {
    return null;
  }

  return `${url.pathname}${url.search}`;
}

export function RoutePrefetcher() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const prefetched = new Set<string>();

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

    function handleIntent(event: Event) {
      prefetch(getInternalHref(event.target));
    }

    document.addEventListener("pointerover", handleIntent, true);
    document.addEventListener("focusin", handleIntent, true);
    document.addEventListener("touchstart", handleIntent, { capture: true, passive: true });

    const timer = window.setTimeout(() => {
      document.querySelectorAll<HTMLAnchorElement>('a[href^="/"]').forEach((anchor, index) => {
        if (index < 32) {
          prefetch(getInternalHref(anchor));
        }
      });
    }, 600);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("pointerover", handleIntent, true);
      document.removeEventListener("focusin", handleIntent, true);
      document.removeEventListener("touchstart", handleIntent, true);
    };
  }, [pathname, router]);

  return null;
}
