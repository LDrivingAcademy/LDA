"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Globe2, Search } from "lucide-react";
import { customLocaleCookieName, localeCookieName } from "@/lib/i18n/config";
import { getEnglishMessage } from "@/lib/i18n/messages";
import { googleCodeForLanguage, isRtlLanguage, labelForLanguage, languageOptions } from "@/lib/languages";

function readLocalStorage(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocalStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Language selection can still apply to the current page view.
  }
}

function removeLocalStorage(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Storage removal is best effort only.
  }
}

function writeLanguageCookie(name: string, value: string) {
  try {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=31536000; Path=/; SameSite=Lax${secure}`;
  } catch {
    // Cookies allow server-side language handling, but local language switching still works without them.
  }
}

function clearLanguageCookie(name: string) {
  try {
    document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
  } catch {
    // Best effort only.
  }
}

function dispatchLanguageChange(selected: string, customLanguage: string) {
  try {
    window.dispatchEvent(new CustomEvent("lda-language-change", { detail: { selected, customLanguage, force: true } }));
  } catch {
    // Page translation is an enhancement; do not crash navigation if dispatch fails.
  }
}

function languageMatchesSearch(option: { code: string; label: string }, search: string) {
  const query = search.trim().toLowerCase();
  if (!query) return true;
  return option.label.toLowerCase().includes(query) || option.code.toLowerCase().includes(query);
}

function activeLanguageValue(selected: string, customLanguage: string) {
  return selected === "custom" && customLanguage ? customLanguage : selected;
}

export function LanguageSelector({ menuBounded = false }: { menuBounded?: boolean }) {
  const [selected, setSelected] = useState("en-GB");
  const [customLanguage, setCustomLanguage] = useState("");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [loaded, setLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = readLocalStorage("lda-language");
    setSelected(stored || "en-GB");
    setCustomLanguage(readLocalStorage("lda-custom-language") || "");
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) {
      return;
    }

    const activeLanguage = activeLanguageValue(selected, customLanguage);
    if (!activeLanguage) {
      return;
    }

    document.documentElement.lang = activeLanguage;
    document.documentElement.dir = isRtlLanguage(selected, customLanguage) ? "rtl" : "ltr";
    writeLocalStorage("lda-language", selected);
    writeLanguageCookie(localeCookieName, selected);
    if (selected === "custom") {
      writeLocalStorage("lda-custom-language", customLanguage);
      writeLanguageCookie(customLocaleCookieName, customLanguage);
    } else {
      clearLanguageCookie(customLocaleCookieName);
    }
    dispatchLanguageChange(selected, customLanguage);
  }, [customLanguage, loaded, selected]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setSearch("");
      return;
    }

    const frame = window.requestAnimationFrame(() => searchInputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  const selectedLabel = useMemo(
    () => labelForLanguage(activeLanguageValue(selected, customLanguage)),
    [customLanguage, selected]
  );

  const filteredLanguages = useMemo(
    () => languageOptions.filter((option) => languageMatchesSearch(option, search)),
    [search]
  );

  const handleSelection = (value: string) => {
    setSelected(value);
    writeLocalStorage("lda-language", value);

    if (value !== "custom") {
      setCustomLanguage("");
      removeLocalStorage("lda-custom-language");
      clearLanguageCookie(customLocaleCookieName);
      document.documentElement.lang = value;
      document.documentElement.dir = isRtlLanguage(value, "") ? "rtl" : "ltr";
      document.documentElement.setAttribute("data-lda-locale", value);
      writeLanguageCookie(localeCookieName, value);
      dispatchLanguageChange(value, "");
      setOpen(false);
    }
  };

  const translateHint =
    selected === "custom" && !googleCodeForLanguage(selected, customLanguage)
      ? getEnglishMessage("language.selector.customHint")
      : getEnglishMessage("language.selector.savedHint");

  return (
    <div
      ref={containerRef}
      className={`notranslate relative min-w-0 ${menuBounded ? "w-full max-w-full" : "w-auto max-w-[calc(100vw-2rem)]"}`}
      data-language-selector={menuBounded ? "menu" : "inline"}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls="lda-language-listbox"
        onClick={() => setOpen((current) => !current)}
        className={`${menuBounded ? "w-full justify-between" : "inline-flex"} min-w-0 items-center gap-2 rounded-full px-3 py-2 text-sm font-black hover:text-zinc-300 hover:ring-2 hover:ring-brand`}
      >
        <span className="inline-flex min-w-0 items-center gap-2">
          <Globe2 size={17} className="shrink-0" />
          <span className="truncate">{selectedLabel}</span>
        </span>
        <ChevronDown className={`${open ? "rotate-180" : ""} shrink-0 transition`} size={14} />
      </button>
      {open ? (
        <div
          className={`${menuBounded ? "relative mt-3" : "absolute top-full mt-3"} z-50 rounded border border-zinc-800 bg-zinc-950 p-4 text-white shadow-2xl ${
            menuBounded ? "left-0 right-0 w-full max-w-full" : "right-0 w-[min(20rem,calc(100vw-2rem))]"
          }`}
        >
          <label className="block text-xs font-black uppercase text-zinc-400">{getEnglishMessage("language.selector.label")}</label>
          <div className="mt-3 flex min-w-0 items-center gap-2 rounded border border-zinc-700 bg-black px-3 py-2 focus-within:border-red-500">
            <Search size={15} className="shrink-0 text-zinc-500" />
            <input
              ref={searchInputRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={getEnglishMessage("language.selector.searchPlaceholder")}
              className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none placeholder:text-zinc-500"
              aria-label={getEnglishMessage("language.selector.searchPlaceholder")}
            />
          </div>
          <div
            id="lda-language-listbox"
            role="listbox"
            aria-label={getEnglishMessage("language.selector.label")}
            className="mt-3 max-h-48 min-w-0 overflow-y-auto overflow-x-hidden rounded border border-zinc-800 bg-black sm:max-h-64"
          >
            {filteredLanguages.map((option) => {
              const isActive = option.code === selected;

              return (
                <button
                  key={option.code}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onClick={() => handleSelection(option.code)}
                  className={`flex w-full min-w-0 items-center justify-between gap-3 px-3 py-3 text-left text-sm font-bold leading-5 transition ${
                    isActive ? "bg-red-600 text-white" : "text-zinc-100 hover:bg-zinc-900"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate">{option.label}</span>
                    <span className={`block text-xs ${isActive ? "text-red-100" : "text-zinc-500"}`}>{option.code}</span>
                  </span>
                  {isActive ? <Check size={16} className="shrink-0" aria-hidden="true" /> : null}
                </button>
              );
            })}
            {!filteredLanguages.length ? (
              <div className="px-3 py-4 text-sm font-bold text-zinc-400">{getEnglishMessage("language.selector.noResults")}</div>
            ) : null}
          </div>
          {selected === "custom" ? (
            <input
              value={customLanguage}
              onChange={(event) => setCustomLanguage(event.target.value)}
              placeholder={getEnglishMessage("language.selector.customPlaceholder")}
              className="mt-3 w-full rounded border border-zinc-700 bg-black px-3 py-3 text-sm font-bold text-white"
            />
          ) : null}
          <p className="mt-3 hidden text-xs leading-5 text-zinc-400 sm:block">{translateHint}</p>
        </div>
      ) : null}
    </div>
  );
}
