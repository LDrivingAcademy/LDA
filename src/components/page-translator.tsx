"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { customLocaleCookieName, localeCookieName } from "@/lib/i18n/config";
import { googleCodeForLanguage, isRtlLanguage } from "@/lib/languages";

const sourceLanguage = "en";
const ignoredTags = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "IFRAME", "SVG", "CANVAS", "INPUT", "TEXTAREA", "SELECT"]);
const maxBatchSize = 45;
const originalText = new WeakMap<Text, string>();
const originalPlaceholder = new WeakMap<HTMLInputElement | HTMLTextAreaElement, string>();
const memoryTranslationCache = new Map<string, string>();

function getStoredLanguage() {
  if (typeof window === "undefined") {
    return { selected: "en-GB", custom: "" };
  }

  try {
    const cookies = Object.fromEntries(
      document.cookie.split(";").map((part) => {
        const [rawName, ...rawValue] = part.trim().split("=");
        return [rawName, decodeURIComponent(rawValue.join("=") || "")];
      })
    );

    return {
      selected: window.localStorage.getItem("lda-language") || cookies[localeCookieName] || "en-GB",
      custom: window.localStorage.getItem("lda-custom-language") || cookies[customLocaleCookieName] || ""
    };
  } catch {
    return { selected: "en-GB", custom: "" };
  }
}

function shouldSkipElement(element: Element | null) {
  if (!element) {
    return true;
  }

  if (ignoredTags.has(element.tagName)) {
    return true;
  }

  return Boolean(element.closest(".notranslate, [data-no-translate], #google_translate_element"));
}

function getTextNodes(root: ParentNode) {
  const nodes: Text[] = [];
  if (typeof document === "undefined" || typeof NodeFilter === "undefined") {
    return nodes;
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const textNode = node as Text;
      const text = node.textContent || "";
      const original = originalText.get(textNode);
      const trimmed = text.trim();
      const originalTrimmed = original?.trim();

      if (originalTrimmed && originalTrimmed.length > 1) {
        return shouldSkipElement(node.parentElement) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      }

      if (!trimmed || trimmed.length < 2 || !/[A-Za-z]/.test(trimmed)) {
        return NodeFilter.FILTER_REJECT;
      }

      if (shouldSkipElement(node.parentElement)) {
        return NodeFilter.FILTER_REJECT;
      }

      return NodeFilter.FILTER_ACCEPT;
    }
  });

  while (walker.nextNode()) {
    nodes.push(walker.currentNode as Text);
  }

  return nodes;
}

function getPlaceholderElements(root: ParentNode) {
  if (typeof document === "undefined" || !("querySelectorAll" in root)) {
    return [];
  }

  return Array.from(root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input[placeholder], textarea[placeholder]"))
    .filter((element) => !shouldSkipElement(element))
    .filter((element) => {
      const original = originalPlaceholder.get(element) || element.getAttribute("placeholder") || "";
      return original.trim().length > 1 && /[A-Za-z]/.test(original);
    });
}

function restoreEnglish(nodes: Text[]) {
  nodes.forEach((node) => {
    const original = originalText.get(node);
    if (original !== undefined) {
      node.textContent = original;
    }
  });
}

function restoreEnglishPlaceholders(elements: Array<HTMLInputElement | HTMLTextAreaElement>) {
  elements.forEach((element) => {
    const original = originalPlaceholder.get(element);
    if (original !== undefined) {
      element.setAttribute("placeholder", original);
    }
  });
}

function applyWhitespace(original: string, translated: string) {
  const leading = original.match(/^\s*/)?.[0] || "";
  const trailing = original.match(/\s*$/)?.[0] || "";
  return `${leading}${translated.trim()}${trailing}`;
}

function cacheKey(target: string, text: string) {
  return `${target}:${text}`;
}

function readStoredTranslation(target: string, text: string) {
  const key = cacheKey(target, text);
  const memoryValue = memoryTranslationCache.get(key);
  if (memoryValue) {
    return memoryValue;
  }

  try {
    const stored = window.sessionStorage.getItem(`lda-translation-cache:${target}`);
    if (!stored) {
      return null;
    }

    const parsed = JSON.parse(stored) as Record<string, string>;
    const value = parsed[text];
    if (value) {
      memoryTranslationCache.set(key, value);
      return value;
    }
  } catch {
    return null;
  }

  return null;
}

function storeTranslations(target: string, translations: Map<string, string>) {
  try {
    const storageKey = `lda-translation-cache:${target}`;
    const existing = JSON.parse(window.sessionStorage.getItem(storageKey) || "{}") as Record<string, string>;
    const merged = { ...existing };
    translations.forEach((value, text) => {
      merged[text] = value;
      memoryTranslationCache.set(cacheKey(target, text), value);
    });

    const entries = Object.entries(merged).slice(-500);
    window.sessionStorage.setItem(storageKey, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    translations.forEach((value, text) => memoryTranslationCache.set(cacheKey(target, text), value));
  }
}

async function translateBatch(texts: string[], target: string) {
  const translated = new Array<string>(texts.length);
  const missing: Array<{ text: string; index: number }> = [];

  texts.forEach((text, index) => {
    const cached = readStoredTranslation(target, text);
    if (cached) {
      translated[index] = cached;
      return;
    }

    missing.push({ text, index });
  });

  if (missing.length === 0) {
    return translated;
  }

  const response = await fetch("/api/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texts: missing.map((item) => item.text), target })
  });

  if (!response.ok) {
    throw new Error("Translation request failed");
  }

  const payload = (await response.json()) as { translations?: string[] };
  const fresh = Array.isArray(payload.translations) ? payload.translations : [];
  const freshCache = new Map<string, string>();

  missing.forEach((item, index) => {
    const value = fresh[index] || item.text;
    translated[item.index] = value;
    freshCache.set(item.text, value);
  });
  storeTranslations(target, freshCache);

  return translated;
}

export function PageTranslator() {
  const pathname = usePathname();
  const activeLanguage = useRef(sourceLanguage);
  const runId = useRef(0);
  const timer = useRef<number | null>(null);

  const translatePage = useCallback(async () => {
    const currentRun = ++runId.current;
    const { selected, custom } = getStoredLanguage();
    const targetLanguage = googleCodeForLanguage(selected, custom) || sourceLanguage;
    const htmlLanguage = selected === "custom" && custom ? custom : selected;

    try {
      document.documentElement.lang = htmlLanguage;
      document.documentElement.dir = isRtlLanguage(selected, custom) ? "rtl" : "ltr";
      document.documentElement.setAttribute("data-lda-locale", htmlLanguage);
    } catch {
      return;
    }

    if (targetLanguage === sourceLanguage) {
      if (activeLanguage.current === sourceLanguage) {
        return;
      }

      const nodes = getTextNodes(document.body);
      const placeholderElements = getPlaceholderElements(document.body);
      activeLanguage.current = sourceLanguage;
      restoreEnglish(nodes);
      restoreEnglishPlaceholders(placeholderElements);
      window.dispatchEvent(new CustomEvent("lda-i18n-translated", { detail: { language: htmlLanguage, target: targetLanguage } }));
      return;
    }

    const nodes = getTextNodes(document.body);
    const placeholderElements = getPlaceholderElements(document.body);
    nodes.forEach((node) => {
      if (!originalText.has(node)) {
        originalText.set(node, node.textContent || "");
      }
    });
    placeholderElements.forEach((element) => {
      if (!originalPlaceholder.has(element)) {
        originalPlaceholder.set(element, element.getAttribute("placeholder") || "");
      }
    });

    activeLanguage.current = targetLanguage;
    restoreEnglish(nodes);
    restoreEnglishPlaceholders(placeholderElements);

    const textValues = nodes.map((node) => originalText.get(node) || "");
    const placeholderValues = placeholderElements.map((element) => originalPlaceholder.get(element) || "");
    const unique = Array.from(new Set([...textValues, ...placeholderValues].map((text) => text.trim()).filter(Boolean)));
    const translated = new Map<string, string>();

    for (let index = 0; index < unique.length; index += maxBatchSize) {
      if (currentRun !== runId.current || activeLanguage.current !== targetLanguage) {
        return;
      }

      const batch = unique.slice(index, index + maxBatchSize);
      try {
        const translations = await translateBatch(batch, targetLanguage);
        batch.forEach((text, batchIndex) => {
          translated.set(text, translations[batchIndex] || text);
        });
      } catch {
        return;
      }
    }

    if (currentRun !== runId.current || activeLanguage.current !== targetLanguage) {
      return;
    }

    nodes.forEach((node) => {
      const original = originalText.get(node) || "";
      const replacement = translated.get(original.trim());
      if (replacement) {
        node.textContent = applyWhitespace(original, replacement);
      }
    });
    placeholderElements.forEach((element) => {
      const original = originalPlaceholder.get(element) || "";
      const replacement = translated.get(original.trim());
      if (replacement) {
        element.setAttribute("placeholder", replacement.trim());
      }
    });
    window.dispatchEvent(new CustomEvent("lda-i18n-translated", { detail: { language: htmlLanguage, target: targetLanguage } }));
  }, []);

  const scheduleTranslation = useCallback(
    (delay = 40) => {
      if (timer.current) {
        window.clearTimeout(timer.current);
      }

      timer.current = window.setTimeout(() => {
        void translatePage();
      }, delay);
    },
    [translatePage]
  );

  useEffect(() => {
    const onLanguageChange = () => scheduleTranslation(20);
    window.addEventListener("lda-language-change", onLanguageChange);
    window.addEventListener("storage", onLanguageChange);

    const observer = typeof MutationObserver === "undefined" ? null : new MutationObserver(() => {
      const { selected, custom } = getStoredLanguage();
      const targetLanguage = googleCodeForLanguage(selected, custom) || sourceLanguage;
      if (targetLanguage !== sourceLanguage) {
        scheduleTranslation(80);
      }
    });

    observer?.observe(document.body, { childList: true, subtree: true });
    scheduleTranslation(20);

    return () => {
      window.removeEventListener("lda-language-change", onLanguageChange);
      window.removeEventListener("storage", onLanguageChange);
      observer?.disconnect();
      if (timer.current) {
        window.clearTimeout(timer.current);
      }
    };
  }, [scheduleTranslation]);

  useEffect(() => {
    scheduleTranslation(20);
  }, [pathname, scheduleTranslation]);

  return null;
}
