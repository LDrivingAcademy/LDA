"use client";

import { useCallback, useEffect, useRef } from "react";
import { googleCodeForLanguage, isRtlLanguage } from "@/lib/languages";

type TranslatorWindow = Window & {
  google?: {
    translate?: {
      TranslateElement: new (options: Record<string, unknown>, element: string) => object;
    };
  };
  googleTranslateElementInit?: () => void;
};

const sourceLanguage = "en";
const translatorScriptId = "google-page-translate";

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
  const ready = useRef(false);
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
    const translatorWindow = window as TranslatorWindow;

    translatorWindow.googleTranslateElementInit = () => {
      if (!translatorWindow.google?.translate?.TranslateElement) {
        return;
      }

      new translatorWindow.google.translate.TranslateElement(
        { pageLanguage: sourceLanguage, autoDisplay: false, multilanguagePage: true },
        "google_translate_element"
      );
      ready.current = true;
      window.setTimeout(applyLanguage, 400);
    };

    if (!document.getElementById(translatorScriptId)) {
      const script = document.createElement("script");
      script.id = translatorScriptId;
      script.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
      script.async = true;
      document.body.appendChild(script);
    }

    const onLanguageChange = () => {
      lastApplied.current = "";
      window.setTimeout(applyLanguage, ready.current ? 150 : 500);
    };

    window.addEventListener("lda-language-change", onLanguageChange);
    window.addEventListener("storage", onLanguageChange);
    applyLanguage();

    return () => {
      window.removeEventListener("lda-language-change", onLanguageChange);
      window.removeEventListener("storage", onLanguageChange);
    };
  }, [applyLanguage]);

  return <div id="google_translate_element" className="notranslate" aria-hidden="true" />;
}
