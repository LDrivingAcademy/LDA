"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { googleCodeForLanguage, isRtlLanguage } from "@/lib/languages";

const sourceLanguage = "en";
const ignoredTags = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "IFRAME", "SVG", "CANVAS", "INPUT", "TEXTAREA", "SELECT", "OPTION"]);
const maxBatchSize = 45;
const originalText = new WeakMap<Text, string>();

function getStoredLanguage() {
  if (typeof window === "undefined") {
    return { selected: "en-GB", custom: "" };
  }

  try {
    return {
      selected: window.localStorage.getItem("lda-language") || "en-GB",
      custom: window.localStorage.getItem("lda-custom-language") || ""
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

function restoreEnglish(nodes: Text[]) {
  nodes.forEach((node) => {
    const original = originalText.get(node);
    if (original !== undefined) {
      node.textContent = original;
    }
  });
}

function applyWhitespace(original: string, translated: string) {
  const leading = original.match(/^\s*/)?.[0] || "";
  const trailing = original.match(/\s*$/)?.[0] || "";
  return `${leading}${translated.trim()}${trailing}`;
}

async function translateBatch(texts: string[], target: string) {
  const response = await fetch("/api/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texts, target })
  });

  if (!response.ok) {
    throw new Error("Translation request failed");
  }

  const payload = (await response.json()) as { translations?: string[] };
  return Array.isArray(payload.translations) ? payload.translations : [];
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
    } catch {
      return;
    }

    const nodes = getTextNodes(document.body);
    nodes.forEach((node) => {
      if (!originalText.has(node)) {
        originalText.set(node, node.textContent || "");
      }
    });

    if (targetLanguage === sourceLanguage) {
      activeLanguage.current = sourceLanguage;
      restoreEnglish(nodes);
      return;
    }

    activeLanguage.current = targetLanguage;
    restoreEnglish(nodes);

    const unique = Array.from(new Set(nodes.map((node) => originalText.get(node) || "").map((text) => text.trim()).filter(Boolean)));
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
  }, []);

  const scheduleTranslation = useCallback(
    (delay = 80) => {
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
        scheduleTranslation(180);
      }
    });

    observer?.observe(document.body, { childList: true, subtree: true });
    scheduleTranslation(120);

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
    scheduleTranslation(100);
  }, [pathname, scheduleTranslation]);

  return null;
}
