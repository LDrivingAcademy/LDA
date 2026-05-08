"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { googleCodeForLanguage, isRtlLanguage } from "@/lib/languages";

declare global {
  interface Window {
    google?: {
      translate?: {
        TranslateElement: new (
          options: { pageLanguage: string; autoDisplay: boolean; multilanguagePage: boolean },
          element: string
        ) => void;
      };
    };
    googleTranslateElementInit?: () => void;
  }
}

const sourceLanguage = "en";

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

  document.cookie = `googtrans=${value}; expires=${expires}; path=/`;
  document.cookie = `googtrans=${value}; expires=${expires}; path=/; domain=${window.location.hostname}`;
}

export function PageTranslator() {
  const [ready, setReady] = useState(false);
  const lastApplied = useRef("");

  const applyLanguage = useCallback(() => {
    const { selected, custom } = getStoredLanguage();
    const targetLanguage = googleCodeForLanguage(selected, custom) || sourceLanguage;
    const htmlLanguage = selected === "custom" && custom ? custom : selected;

    document.documentElement.lang = htmlLanguage;
    document.documentElement.dir = isRtlLanguage(selected, custom) ? "rtl" : "ltr";

    if (!targetLanguage || lastApplied.current === targetLanguage) {
      return;
    }

    lastApplied.current = targetLanguage;
    setTranslateCookie(targetLanguage);

    const combo = document.querySelector<HTMLSelectElement>(".goog-te-combo");
    if (!combo) {
      return;
    }

    combo.value = targetLanguage === sourceLanguage ? "" : targetLanguage;
    combo.dispatchEvent(new Event("change", { bubbles: true }));
  }, []);

  useEffect(() => {
    window.googleTranslateElementInit = () => {
      if (!window.google?.translate?.TranslateElement) {
        return;
      }

      new window.google.translate.TranslateElement(
        { pageLanguage: sourceLanguage, autoDisplay: false, multilanguagePage: true },
        "google_translate_element"
      );
      setReady(true);
      window.setTimeout(applyLanguage, 400);
    };

    const onLanguageChange = () => {
      lastApplied.current = "";
      window.setTimeout(applyLanguage, ready ? 150 : 500);
    };

    window.addEventListener("lda-language-change", onLanguageChange);
    window.addEventListener("storage", onLanguageChange);
    applyLanguage();

    return () => {
      window.removeEventListener("lda-language-change", onLanguageChange);
      window.removeEventListener("storage", onLanguageChange);
    };
  }, [applyLanguage, ready]);

  useEffect(() => {
    if (ready) {
      applyLanguage();
    }
  }, [applyLanguage, ready]);

  return (
    <>
      <div id="google_translate_element" className="notranslate" aria-hidden="true" />
      <Script
        id="google-page-translate"
        src="https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"
        strategy="afterInteractive"
      />
    </>
  );
}
