"use client";

import { useEffect, useState } from "react";
import { getEnglishMessage } from "@/lib/i18n/messages";

const ignoredSelectors = [
  "script",
  "style",
  "svg",
  "canvas",
  "iframe",
  ".notranslate",
  "[data-no-translate]",
  "[data-i18n-qa-badge]"
].join(",");

function isVisible(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const styles = window.getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 && styles.visibility !== "hidden" && styles.display !== "none";
}

function canScroll(element: HTMLElement) {
  const styles = window.getComputedStyle(element);
  return /(auto|scroll)/.test(`${styles.overflow}${styles.overflowX}${styles.overflowY}`);
}

function hasTextOverflow(element: HTMLElement) {
  if (!element.textContent?.trim()) return false;
  if (element.matches(ignoredSelectors) || element.closest(ignoredSelectors)) return false;
  if (!isVisible(element) || canScroll(element)) return false;

  return element.scrollWidth > element.clientWidth + 2 || element.scrollHeight > element.clientHeight + 2;
}

export function I18nQaMode() {
  const [active, setActive] = useState(false);
  const [overflowCount, setOverflowCount] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const enabled = params.get("i18nQa") === "1" || window.localStorage.getItem("lda-i18n-qa") === "1";
    setActive(enabled);
  }, []);

  useEffect(() => {
    if (!active) {
      document.documentElement.removeAttribute("data-i18n-qa");
      return;
    }

    let frame = 0;
    document.documentElement.setAttribute("data-i18n-qa", "on");

    const runChecks = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const candidates = Array.from(document.querySelectorAll<HTMLElement>("body *"));
        let count = 0;

        candidates.forEach((element) => {
          const overflowing = hasTextOverflow(element);
          if (overflowing) count += 1;
          element.toggleAttribute("data-i18n-overflow", overflowing);
        });

        setOverflowCount(count);
        window.dispatchEvent(new CustomEvent("lda-i18n-qa-complete", { detail: { overflowCount: count } }));
      });
    };

    const observer = new MutationObserver(runChecks);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    window.addEventListener("resize", runChecks);
    window.addEventListener("lda-language-change", runChecks);
    window.addEventListener("lda-i18n-translated", runChecks);
    runChecks();

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", runChecks);
      window.removeEventListener("lda-language-change", runChecks);
      window.removeEventListener("lda-i18n-translated", runChecks);
      document.documentElement.removeAttribute("data-i18n-qa");
      document.querySelectorAll("[data-i18n-overflow]").forEach((element) => element.removeAttribute("data-i18n-overflow"));
    };
  }, [active]);

  if (!active) return null;

  const message = overflowCount
    ? getEnglishMessage("i18n.qa.overflow", { count: overflowCount })
    : getEnglishMessage("i18n.qa.clean");

  return (
    <div
      data-i18n-qa-badge
      className="notranslate fixed bottom-4 left-4 z-[9999] rounded-full border border-red-500 bg-black px-4 py-2 text-xs font-black uppercase text-white shadow-2xl"
    >
      {getEnglishMessage("i18n.qa.badge")}: {message}
    </div>
  );
}
