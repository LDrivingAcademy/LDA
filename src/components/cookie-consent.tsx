"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type CookieChoice = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  preferences: boolean;
};

const defaultChoice: CookieChoice = {
  necessary: true,
  analytics: false,
  marketing: false,
  preferences: false
};

const cookieOptions: Array<{ key: keyof Omit<CookieChoice, "necessary">; label: string }> = [
  { key: "analytics", label: "Analytics cookies" },
  { key: "marketing", label: "Marketing cookies" },
  { key: "preferences", label: "Preference cookies" }
];

function readStoredConsent() {
  try {
    return window.localStorage.getItem("lda-cookie-consent");
  } catch {
    return null;
  }
}

function writeStoredConsent(nextChoice: CookieChoice) {
  try {
    window.localStorage.setItem("lda-cookie-consent", JSON.stringify(nextChoice));
  } catch {
    // Consent still applies for this page view even if storage is unavailable.
  }
}

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [choice, setChoice] = useState<CookieChoice>(defaultChoice);

  useEffect(() => {
    const stored = readStoredConsent();
    setVisible(!stored);
  }, []);

  function saveCookieChoice(nextChoice: CookieChoice) {
    writeStoredConsent(nextChoice);
    try {
      window.dispatchEvent(new CustomEvent("lda-cookie-consent-updated", { detail: nextChoice }));
    } catch {
      // Event dispatch is an enhancement for integrations listening on the page.
    }
    setVisible(false);
  }

  if (!visible) {
    return null;
  }

  return (
    <section className="fixed inset-x-0 bottom-0 z-[80] border-t border-zinc-800 bg-black px-4 py-4 text-white shadow-2xl">
      <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <div className="text-sm font-black uppercase text-red-200">Cookie privacy</div>
          <h2 className="mt-1 text-2xl font-black">Choose how LDA uses cookies.</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-300">
            Necessary cookies keep the site working. Analytics, marketing, and preference cookies are optional until connected to live tools.
            Read the <Link href="/cookies" className="font-black text-white underline">cookie policy</Link>.
          </p>

          {choosing ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {cookieOptions.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-3 rounded border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm font-bold">
                  <input
                    type="checkbox"
                    checked={choice[key]}
                    onChange={(event) => setChoice((current) => ({ ...current, [key]: event.target.checked }))}
                  />
                  {label}
                </label>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-3">
          <button type="button" className="lda-pill lda-pill-sm" onClick={() => saveCookieChoice({ necessary: true, analytics: true, marketing: true, preferences: true })}>
            Accept all
          </button>
          <button type="button" className="lda-pill lda-pill-sm" onClick={() => saveCookieChoice(defaultChoice)}>
            Reject
          </button>
          {choosing ? (
            <button type="button" className="lda-pill lda-pill-sm" onClick={() => saveCookieChoice(choice)}>
              Save choices
            </button>
          ) : (
            <button type="button" className="lda-pill lda-pill-sm" onClick={() => setChoosing(true)}>
              Choose
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
