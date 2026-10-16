"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { cookieConsentUpdatedEvent, readBrowserCookieChoice, type CookieChoice } from "@/lib/cookie-consent";

function readAnalyticsConsent() {
  return Boolean(readBrowserCookieChoice()?.analytics);
}

function getOrCreateId(key: string) {
  try {
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;
    const next = crypto.randomUUID();
    window.localStorage.setItem(key, next);
    return next;
  } catch {
    return crypto.randomUUID();
  }
}

function getSessionId() {
  try {
    const now = Date.now();
    const raw = window.sessionStorage.getItem("lda-analytics-session");
    if (raw) {
      const parsed = JSON.parse(raw) as { id?: string; expiresAt?: number };
      if (parsed.id && parsed.expiresAt && parsed.expiresAt > now) {
        window.sessionStorage.setItem("lda-analytics-session", JSON.stringify({ id: parsed.id, expiresAt: now + 30 * 60 * 1000 }));
        return parsed.id;
      }
    }

    const id = crypto.randomUUID();
    window.sessionStorage.setItem("lda-analytics-session", JSON.stringify({ id, expiresAt: now + 30 * 60 * 1000 }));
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

function isPrivatePath(path: string) {
  const segments = path.split("/").filter(Boolean);
  const firstSegment = segments[0] ?? "";
  const ownerRoute = ["owner", "dashboard"].join("-");
  const supportRoute = ["technical", "support"].join("-");
  const directorPrefix = "director-";

  if (!firstSegment) return false;
  if (firstSegment === ownerRoute) return true;
  if (firstSegment.startsWith("admin")) return true;
  if (firstSegment === supportRoute || firstSegment.startsWith(`${supportRoute}-`)) return true;
  return firstSegment.startsWith(directorPrefix);
}

function getSection(path: string) {
  const firstSegment = path.split("/").filter(Boolean)[0];
  return firstSegment || "home";
}

function getElementLabel(element: Element) {
  const labelled = element.getAttribute("data-analytics-label") || element.getAttribute("aria-label") || element.getAttribute("title");
  if (labelled) return labelled.trim().slice(0, 160);
  return (element.textContent || element.getAttribute("name") || element.id || element.tagName).replace(/\s+/g, " ").trim().slice(0, 160);
}

const pageviewStorageKey = "lda-analytics-pageviews";

function readSentPageviews() {
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(pageviewStorageKey) || "[]") as unknown;
    if (!Array.isArray(parsed)) {
      return new Set<string>();
    }

    return new Set(parsed.filter((value): value is string => typeof value === "string"));
  } catch {
    return new Set<string>();
  }
}

function rememberPageview(key: string, sentPageviews: Set<string>) {
  try {
    const next = Array.from(sentPageviews).slice(-80);
    window.sessionStorage.setItem(pageviewStorageKey, JSON.stringify(next));
  } catch {
    // Analytics should never affect the main website experience.
  }
}

function sendAnalyticsEvent(payload: Record<string, unknown>) {
  const body = JSON.stringify({
    ...payload,
    visitorId: getOrCreateId("lda-analytics-visitor"),
    sessionId: getSessionId(),
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight
  });

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    navigator.sendBeacon("/api/analytics/track", blob);
    return;
  }

  fetch("/api/analytics/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true
  }).catch(() => undefined);
}

export function SiteAnalyticsTracker() {
  const pathname = usePathname();
  const hasConsentRef = useRef(false);
  const pageStartedAtRef = useRef(Date.now());
  const currentPathRef = useRef(pathname || "/");
  const sentPageviewsRef = useRef<Set<string> | null>(null);
  const lastClickRef = useRef({ key: "", at: 0 });
  const lastEngagementRef = useRef({ key: "", durationMs: 0 });

  function sendPageview(path: string, referrer: string) {
    const key = `${getSessionId()}:${path}`;
    const sentPageviews = sentPageviewsRef.current || readSentPageviews();
    sentPageviewsRef.current = sentPageviews;

    if (sentPageviews.has(key)) {
      return;
    }

    sentPageviews.add(key);
    rememberPageview(key, sentPageviews);

    sendAnalyticsEvent({
      eventType: "pageview",
      path,
      section: getSection(path),
      title: document.title,
      referrer
    });
  }

  useEffect(() => {
    hasConsentRef.current = readAnalyticsConsent();

    function handleConsentUpdated(event: Event) {
      const detail = (event as CustomEvent<CookieChoice>).detail;
      const hadConsent = hasConsentRef.current;
      hasConsentRef.current = Boolean(detail?.analytics);

      if (!hadConsent && hasConsentRef.current && !isPrivatePath(currentPathRef.current)) {
        pageStartedAtRef.current = Date.now();
        sendPageview(currentPathRef.current, document.referrer);
      }
    }

    window.addEventListener(cookieConsentUpdatedEvent, handleConsentUpdated);
    return () => window.removeEventListener(cookieConsentUpdatedEvent, handleConsentUpdated);
  }, []);

  useEffect(() => {
    const path = pathname || "/";
    currentPathRef.current = path;
    pageStartedAtRef.current = Date.now();

    if (!hasConsentRef.current || isPrivatePath(path)) {
      return;
    }

    sendPageview(path, document.referrer);
  }, [pathname]);

  useEffect(() => {
    function sendEngagement() {
      if (!hasConsentRef.current || isPrivatePath(currentPathRef.current)) return;
      const durationMs = Date.now() - pageStartedAtRef.current;
      if (durationMs < 10000) return;
      const lastEngagement = lastEngagementRef.current;
      if (lastEngagement.key === currentPathRef.current && durationMs - lastEngagement.durationMs < 10000) {
        return;
      }
      lastEngagementRef.current = { key: currentPathRef.current, durationMs };

      sendAnalyticsEvent({
        eventType: "engagement",
        path: currentPathRef.current,
        section: getSection(currentPathRef.current),
        title: document.title,
        durationMs
      });
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        sendEngagement();
      }
    }

    function handleClick(event: MouseEvent) {
      if (!hasConsentRef.current || isPrivatePath(currentPathRef.current)) return;
      const target = event.target instanceof Element ? event.target.closest("a,button,[role='button'],input[type='submit']") : null;
      if (!target) return;
      const anchor = target instanceof HTMLAnchorElement ? target : target.closest("a");
      const targetLabel = getElementLabel(target);
      const targetHref = anchor?.getAttribute("href") || "";
      const clickKey = `${currentPathRef.current}|${targetLabel}|${targetHref}`;
      const now = Date.now();

      if (lastClickRef.current.key === clickKey && now - lastClickRef.current.at < 2000) {
        return;
      }

      lastClickRef.current = { key: clickKey, at: now };

      sendAnalyticsEvent({
        eventType: "click",
        path: currentPathRef.current,
        section: getSection(currentPathRef.current),
        title: document.title,
        targetLabel,
        targetType: target.tagName.toLowerCase(),
        targetHref
      });
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("click", handleClick, { capture: true });
    window.addEventListener("pagehide", sendEngagement);

    return () => {
      sendEngagement();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("click", handleClick, { capture: true });
      window.removeEventListener("pagehide", sendEngagement);
    };
  }, []);

  return null;
}
