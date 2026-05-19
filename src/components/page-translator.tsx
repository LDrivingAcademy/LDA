"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { googleCodeForLanguage, isRtlLanguage } from "@/lib/languages";

type TranslatorWindow = Window & {
  google?: {
    translate?: {
      TranslateElement: new (options: Record<string, unknown>, element: string) => object;
    };
  };
  googleTranslateElementInit?: () => void;
  __ldaGoogleTranslateInitialised?: boolean;
};

const sourceLanguage = "en";
const translatorScriptId = "google-page-translate";
const googleUiSelectors = [
  ".goog-te-banner-frame",
  ".goog-te-balloon-frame",
  ".goog-te-menu-frame",
  ".goog-te-ftab-frame",
  ".goog-tooltip",
  ".goog-tooltip:hover",
  ".VIpgJd-ZVi9od-ORHb-OEVmcd",
  ".VIpgJd-ZVi9od-aZ2wEe-wOHMyf",
  ".VIpgJd-ZVi9od-xl07Ob-OEVmcd",
  ".VIpgJd-yAWNEb-L7lbkb",
  "iframe.skiptranslate"
];

function getStoredLanguage() {
  if (typeof window === "undefined") {
    return { selected: "en-GB", custom: "" };
  }

  return {
    selected: window.localStorage.getItem("lda-language") || "en-GB",
    custom: window.localStorage.getItem("lda-custom-language") || ""
  };
}

function setTranslateCookie(targetLanguage: string) {
  const value = targetLanguage === sourceLanguage ? "" : `/en/${targetLanguage}`;
  const expires = targetLanguage === sourceLanguage ? "Thu, 01 Jan 1970 00:00:00 GMT" : "Fri, 31 Dec 9999 23:59:59 GMT";

  const domains = [
    "",
    window.location.hostname,
    `.${window.location.hostname}`,
    window.location.hostname.split(".").slice(-2).join("."),
    `.${window.location.hostname.split(".").slice(-2).join(".")}`
  ];

  domains.forEach((domain) => {
    const domainPart = domain ? `; domain=${domain}` : "";
    document.cookie = `googtrans=${value}; expires=${expires}; path=/${domainPart}`;
  });
}

function hasTranslatedDom() {
  return document.documentElement.className.includes("translated") || document.body.className.includes("translated");
}

function suppressGoogleTranslateUi() {
  googleUiSelectors.forEach((selector) => {
    document.querySelectorAll<HTMLElement>(selector).forEach((element) => {
      element.style.setProperty("display", "none", "important");
      element.style.setProperty("visibility", "hidden", "important");
      element.style.setProperty("pointer-events", "none", "important");
    });
  });

  document.querySelectorAll<HTMLElement>(".goog-text-highlight").forEach((element) => {
    element.style.setProperty("background", "transparent", "important");
    element.style.setProperty("box-shadow", "none", "important");
  });

  document.body.style.setProperty("top", "0", "important");
}

function getTranslateCombo() {
  return document.querySelector<HTMLSelectElement>(".goog-te-combo");
}

function emitTranslateEvents(combo: HTMLSelectElement) {
  combo.dispatchEvent(new Event("input", { bubbles: true }));
  combo.dispatchEvent(new Event("change", { bubbles: true }));
}

function dispatchTranslateCombo(targetLanguage: string, options: { force?: boolean } = {}) {
  const combo = getTranslateCombo();

  if (!combo) {
    return false;
  }

  const nextValue = targetLanguage === sourceLanguage ? "" : targetLanguage;

  if (options.force) {
    combo.value = "";
    emitTranslateEvents(combo);
  }

  const applyValue = () => {
    combo.value = nextValue;
    emitTranslateEvents(combo);
    suppressGoogleTranslateUi();
  };

  applyValue();

  if (options.force) {
    window.setTimeout(applyValue, 80);
  }

  return true;
}

function verifyAppliedTranslation(targetLanguage: string, attempt = 0) {
  if (targetLanguage === sourceLanguage) {
    return;
  }

  window.setTimeout(() => {
    const { selected, custom } = getStoredLanguage();
    const storedTarget = googleCodeForLanguage(selected, custom) || sourceLanguage;

    if (storedTarget !== targetLanguage || hasTranslatedDom()) {
      suppressGoogleTranslateUi();
      return;
    }

    if (attempt < 4) {
      dispatchTranslateCombo(targetLanguage, { force: true });
      verifyAppliedTranslation(targetLanguage, attempt + 1);
    }
  }, 1200);
}

export function PageTranslator() {
  const pathname = usePathname();
  const ready = useRef(false);
  const lastApplied = useRef("");
  const retryTimer = useRef<number | null>(null);
  const mutationTimer = useRef<number | null>(null);

  const applyLanguage = useCallback((options: { force?: boolean } = {}) => {
    const { selected, custom } = getStoredLanguage();
    const targetLanguage = googleCodeForLanguage(selected, custom) || sourceLanguage;
    const htmlLanguage = selected === "custom" && custom ? custom : selected;
    const force = Boolean(options.force);

    document.documentElement.lang = htmlLanguage;
    document.documentElement.dir = isRtlLanguage(selected, custom) ? "rtl" : "ltr";

    if (retryTimer.current) {
      window.clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }

    if (targetLanguage === sourceLanguage) {
      lastApplied.current = sourceLanguage;
      setTranslateCookie(sourceLanguage);
      dispatchTranslateCombo(sourceLanguage, { force });
      suppressGoogleTranslateUi();
      return;
    }

    if (!targetLanguage || (!force && lastApplied.current === targetLanguage && hasTranslatedDom())) {
      return;
    }

    setTranslateCookie(targetLanguage);

    if (!dispatchTranslateCombo(targetLanguage, { force })) {
      retryTimer.current = window.setTimeout(() => {
        if (dispatchTranslateCombo(targetLanguage, { force: true })) {
          lastApplied.current = targetLanguage;
          suppressGoogleTranslateUi();
          verifyAppliedTranslation(targetLanguage);
        }
      }, ready.current ? 700 : 1400);
      return;
    }

    lastApplied.current = targetLanguage;
    verifyAppliedTranslation(targetLanguage);
  }, []);

  useEffect(() => {
    const translatorWindow = window as TranslatorWindow;

    translatorWindow.googleTranslateElementInit = () => {
      if (!translatorWindow.google?.translate?.TranslateElement) {
        return;
      }

      if (!translatorWindow.__ldaGoogleTranslateInitialised && !getTranslateCombo()) {
        new translatorWindow.google.translate.TranslateElement(
          { pageLanguage: sourceLanguage, autoDisplay: false, multilanguagePage: true },
          "google_translate_element"
        );
        translatorWindow.__ldaGoogleTranslateInitialised = true;
      }

      ready.current = true;
      suppressGoogleTranslateUi();
      window.setTimeout(() => applyLanguage({ force: true }), 400);
    };

    if (translatorWindow.google?.translate?.TranslateElement) {
      translatorWindow.googleTranslateElementInit();
    }

    if (!document.getElementById(translatorScriptId)) {
      const script = document.createElement("script");
      script.id = translatorScriptId;
      script.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
      script.async = true;
      script.onerror = () => {
        ready.current = false;
        window.setTimeout(() => applyLanguage({ force: true }), 1200);
      };
      document.body.appendChild(script);
    } else if (getTranslateCombo()) {
      ready.current = true;
      window.setTimeout(() => applyLanguage({ force: true }), 150);
    }

    const onLanguageChange = () => {
      lastApplied.current = "";
      window.setTimeout(() => applyLanguage({ force: true }), ready.current ? 150 : 500);
    };

    window.addEventListener("lda-language-change", onLanguageChange);
    window.addEventListener("storage", onLanguageChange);
    const observer = new MutationObserver(() => {
      suppressGoogleTranslateUi();

      const { selected, custom } = getStoredLanguage();
      const targetLanguage = googleCodeForLanguage(selected, custom) || sourceLanguage;
      if (targetLanguage === sourceLanguage || (lastApplied.current === targetLanguage && hasTranslatedDom())) {
        return;
      }

      if (mutationTimer.current) {
        window.clearTimeout(mutationTimer.current);
      }

      mutationTimer.current = window.setTimeout(() => {
        applyLanguage({ force: true });
      }, 600);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    suppressGoogleTranslateUi();
    applyLanguage({ force: true });

    return () => {
      window.removeEventListener("lda-language-change", onLanguageChange);
      window.removeEventListener("storage", onLanguageChange);
      observer.disconnect();
      if (retryTimer.current) {
        window.clearTimeout(retryTimer.current);
      }
      if (mutationTimer.current) {
        window.clearTimeout(mutationTimer.current);
      }
    };
  }, [applyLanguage]);

  useEffect(() => {
    window.setTimeout(() => {
      suppressGoogleTranslateUi();
      applyLanguage({ force: true });
    }, 250);
  }, [applyLanguage, pathname]);

  return <div id="google_translate_element" className="notranslate" aria-hidden="true" />;
}
