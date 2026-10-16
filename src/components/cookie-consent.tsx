"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, Settings2, X } from "lucide-react";
import {
  acceptAllCookieChoice,
  cookieConsentUpdatedEvent,
  cookieSettingsOpenEvent,
  essentialOnlyCookieChoice,
  persistBrowserCookieChoice,
  readBrowserCookieChoice,
  type CookieChoice
} from "@/lib/cookie-consent";

type OptionalCookieKey = "marketing" | "analytics";
type CookiePanelMode = "notice" | "settings";

const secondaryButtonClass =
  "inline-flex h-9 min-w-[5.75rem] flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-full border border-zinc-300 bg-white px-2 text-[11px] font-black text-black transition hover:border-red-500 hover:text-brand focus:outline-none focus:ring-2 focus:ring-red-200 sm:h-10 sm:flex-none sm:gap-2 sm:px-4 sm:text-sm";

const primaryButtonClass =
  "inline-flex h-9 min-w-[5.75rem] flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-full border border-red-400 bg-red-600 px-2 text-[11px] font-black text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)] transition hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-200 sm:h-10 sm:flex-none sm:gap-2 sm:px-4 sm:text-sm";

const cookieOptions: Array<{
  key: "necessary" | OptionalCookieKey;
  label: string;
  description: string;
  locked?: boolean;
}> = [
  {
    key: "necessary",
    label: "Essential",
    description:
      "Essential cookies keep LDA working, including secure login, account sessions, booking flows, payments, cookie choices, fraud prevention, and site security.",
    locked: true
  },
  {
    key: "marketing",
    label: "Targeted advertising",
    description:
      "Targeted advertising cookies may help LDA measure campaigns, understand referrals, personalise offers, and avoid showing the same promotion too often."
  },
  {
    key: "analytics",
    label: "Analytics",
    description:
      "Analytics cookies help LDA understand visits, actions, popular pages, and areas that need improvement. They only run when analytics consent is accepted."
  }
];

function getConsentId() {
  const key = "lda-cookie-consent-id";

  try {
    const existing = window.localStorage.getItem(key);
    if (existing) {
      return existing;
    }

    const id = crypto.randomUUID();
    window.localStorage.setItem(key, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

function recordConsent(nextChoice: CookieChoice) {
  const body = JSON.stringify({
    consentId: getConsentId(),
    choice: nextChoice,
    path: window.location.pathname,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight
  });

  fetch("/api/cookie-consent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true
  }).catch(() => undefined);
}

function optionIsEnabled(choice: CookieChoice, key: "necessary" | OptionalCookieKey) {
  return key === "necessary" ? true : choice[key];
}

export function cookieConsentAllowedOnPath(pathname: string | null | undefined) {
  const path = pathname || "/";
  const firstSegment = path.split("/").filter(Boolean)[0]?.toLowerCase() ?? "";
  const ownerRoute = ["owner", "dashboard"].join("-");
  const supportRoute = ["technical", "support"].join("-");
  const directorPrefix = "director-";

  if (!firstSegment) return true;
  if (firstSegment === ownerRoute) return false;
  if (firstSegment.startsWith("admin")) return false;
  if (firstSegment === supportRoute || firstSegment.startsWith(`${supportRoute}-`)) return false;
  return !firstSegment.startsWith(directorPrefix);
}

export function CookieConsent() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<CookiePanelMode>("notice");
  const [activeOption, setActiveOption] = useState<"necessary" | OptionalCookieKey>("necessary");
  const [choice, setChoice] = useState<CookieChoice>(essentialOnlyCookieChoice);

  const activeCookieOption = useMemo(
    () => cookieOptions.find((option) => option.key === activeOption) ?? cookieOptions[0],
    [activeOption]
  );

  useEffect(() => {
    if (!cookieConsentAllowedOnPath(pathname)) {
      setVisible(false);
      return;
    }

    const stored = readBrowserCookieChoice();

    if (stored) {
      persistBrowserCookieChoice(stored);
      setChoice(stored);
      setVisible(false);
    } else {
      setVisible(true);
    }

    function openCookieSettings() {
      setChoice(readBrowserCookieChoice() ?? essentialOnlyCookieChoice);
      setActiveOption("necessary");
      setMode("settings");
      setVisible(true);
    }

    window.addEventListener(cookieSettingsOpenEvent, openCookieSettings);
    return () => window.removeEventListener(cookieSettingsOpenEvent, openCookieSettings);
  }, [pathname]);

  function publishConsent(nextChoice: CookieChoice) {
    try {
      window.dispatchEvent(new CustomEvent(cookieConsentUpdatedEvent, { detail: nextChoice }));
    } catch {
      // Event dispatch is an enhancement for integrations listening on the page.
    }
  }

  function saveCookieChoice(nextChoice: CookieChoice) {
    persistBrowserCookieChoice(nextChoice);
    publishConsent(nextChoice);
    recordConsent(nextChoice);
    setChoice(nextChoice);
    setVisible(false);
  }

  function toggleOptionalChoice(key: OptionalCookieKey) {
    setChoice((current) => ({ ...current, [key]: !current[key], necessary: true, preferences: false }));
    setActiveOption(key);
  }

  if (!visible || !cookieConsentAllowedOnPath(pathname)) {
    return null;
  }

  return (
    <section
      className="fixed inset-x-0 bottom-0 z-[80] px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-white sm:px-5 sm:pb-5 lg:px-8 lg:pb-6"
      role="dialog"
      aria-modal="false"
      aria-labelledby="lda-cookie-title"
    >
      <div className="mx-auto max-h-[calc(100dvh-5.5rem)] w-full max-w-[1120px] overflow-y-auto overscroll-contain rounded border border-zinc-800 bg-black p-3 shadow-2xl sm:max-h-[calc(100dvh-3rem)] sm:p-5 lg:max-w-[1180px] lg:p-6 2xl:max-w-[1320px]">
        {mode === "notice" ? (
          <div className="grid gap-2.5 sm:gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end xl:gap-6">
            <div>
              <div className="hidden text-xs font-black uppercase text-red-200 sm:block">Cookie privacy</div>
              <h2 id="lda-cookie-title" className="text-lg font-black leading-tight sm:mt-1 sm:text-3xl">
                We use cookies
              </h2>
              <p className="mt-1 max-w-4xl text-[11px] font-semibold leading-4 text-zinc-300 sm:mt-3 sm:text-sm sm:leading-6">
                Essential cookies keep LDA secure and working. Optional analytics and advertising cookies help us improve the website, measure campaigns,
                and tailor offers. Change your choice at any time in Cookie Settings. Read our{" "}
                <Link href="/cookies" className="font-black text-white underline">
                  Cookie Policy
                </Link>
                .
              </p>
            </div>

            <div className="flex flex-nowrap gap-1.5 sm:flex-wrap sm:gap-3 lg:min-w-[360px] lg:justify-end">
              <button type="button" aria-label="Cookie Settings" className={secondaryButtonClass} onClick={() => setMode("settings")}>
                <span className="sm:hidden">Settings</span>
                <span className="hidden sm:inline">Cookie Settings</span>
                <Settings2 size={14} />
              </button>
              <button type="button" className={secondaryButtonClass} onClick={() => saveCookieChoice(essentialOnlyCookieChoice)}>
                Reject All <X size={14} />
              </button>
              <button type="button" className={primaryButtonClass} onClick={() => saveCookieChoice(acceptAllCookieChoice)}>
                Accept All <Check size={14} />
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-2.5 sm:gap-4 lg:grid-cols-[minmax(15rem,0.8fr)_1.2fr] xl:gap-6">
            <div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setMode("notice")} className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-zinc-700 text-white sm:hidden" aria-label="Back to cookie notice">
                  <ChevronLeft size={17} />
                </button>
                <h2 id="lda-cookie-title" className="text-lg font-black leading-tight sm:text-3xl">
                  Cookie settings
                </h2>
              </div>
              <div className="mt-2 grid gap-1.5 sm:mt-5 sm:gap-2">
                {cookieOptions.map((option) => {
                  const checked = optionIsEnabled(choice, option.key);
                  const selected = activeOption === option.key;

                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => {
                        setActiveOption(option.key);
                        if (option.key !== "necessary") {
                          toggleOptionalChoice(option.key);
                        }
                      }}
                      className={`flex min-h-11 items-center gap-2.5 rounded border px-2.5 py-2 text-left text-sm font-black transition sm:gap-3 sm:px-3 sm:py-3 sm:text-base ${
                        selected ? "border-red-500 bg-zinc-900 text-white" : "border-zinc-800 bg-zinc-950 text-zinc-100 hover:border-red-500"
                      }`}
                    >
                      <span
                        className={`grid h-5 w-5 shrink-0 place-items-center rounded border sm:h-6 sm:w-6 ${
                          checked ? "border-white bg-white text-black" : "border-zinc-500 bg-transparent text-transparent"
                        }`}
                        aria-hidden="true"
                      >
                        <Check size={15} strokeWidth={4} />
                      </span>
                      <span>{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid content-between gap-2.5 sm:gap-5">
              <div className="rounded border border-zinc-800 bg-zinc-950 p-2.5 sm:p-4 lg:min-h-[150px]">
                <div className="text-xs font-black uppercase text-red-200 sm:text-sm">{activeCookieOption.label}</div>
                <p className="mt-1.5 text-[11px] font-semibold leading-4 text-zinc-300 sm:mt-3 sm:text-sm sm:leading-6">{activeCookieOption.description}</p>
                {activeCookieOption.locked ? (
                  <p className="mt-1.5 text-[10px] font-black uppercase text-zinc-500 sm:mt-3 sm:text-xs">Always active</p>
                ) : null}
              </div>

              <div className="flex flex-nowrap gap-1.5 sm:flex-wrap sm:gap-3 lg:justify-end">
                <button type="button" className={secondaryButtonClass} onClick={() => setMode("notice")}>
                  Hide <ChevronLeft size={14} />
                </button>
                <button type="button" className={secondaryButtonClass} onClick={() => saveCookieChoice(essentialOnlyCookieChoice)}>
                  Reject All <X size={14} />
                </button>
                <button type="button" className={primaryButtonClass} aria-label="Confirm cookie selection" onClick={() => saveCookieChoice(choice)}>
                  <span className="sm:hidden">Confirm</span>
                  <span className="hidden sm:inline">Confirm selection</span>
                  <Check size={14} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
