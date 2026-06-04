"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Globe2 } from "lucide-react";
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

function dispatchLanguageChange(selected: string, customLanguage: string) {
  try {
    window.dispatchEvent(new CustomEvent("lda-language-change", { detail: { selected, customLanguage, force: true } }));
  } catch {
    // Page translation is an enhancement; do not crash navigation if dispatch fails.
  }
}

export function LanguageSelector() {
  const [selected, setSelected] = useState("en-GB");
  const [customLanguage, setCustomLanguage] = useState("");
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

    const activeLanguage = selected === "custom" ? customLanguage : selected;
    if (!activeLanguage) {
      return;
    }

    document.documentElement.lang = activeLanguage;
    document.documentElement.dir = isRtlLanguage(selected, customLanguage) ? "rtl" : "ltr";
    writeLocalStorage("lda-language", selected);
    if (selected === "custom") {
      writeLocalStorage("lda-custom-language", customLanguage);
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

  const selectedLabel = useMemo(
    () => labelForLanguage(selected === "custom" && customLanguage ? customLanguage : selected),
    [customLanguage, selected]
  );

  const handleSelection = (value: string) => {
    setSelected(value);
    writeLocalStorage("lda-language", value);

    if (value !== "custom") {
      setCustomLanguage("");
      removeLocalStorage("lda-custom-language");
      document.documentElement.lang = value;
      document.documentElement.dir = isRtlLanguage(value, "") ? "rtl" : "ltr";
      dispatchLanguageChange(value, "");
      setOpen(false);
    }
  };

  const translateHint =
    selected === "custom" && !googleCodeForLanguage(selected, customLanguage)
      ? "Enter a language code too, for example ar-EG, es-419, cy, fr, or ur, so the page translator can apply it."
      : "The visible page text changes after selection. Your choice is saved for the next visit.";

  return (
    <div ref={containerRef} className="notranslate relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-black hover:text-zinc-300 hover:ring-2 hover:ring-brand"
      >
        <Globe2 size={17} /> {selectedLabel} <ChevronDown className={open ? "rotate-180 transition" : "transition"} size={14} />
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-50 mt-3 w-80 rounded border border-zinc-800 bg-zinc-950 p-4 text-white shadow-2xl">
          <label className="block text-xs font-black uppercase text-zinc-400">Choose page language</label>
          <select
            value={selected}
            onChange={(event) => handleSelection(event.target.value)}
            className="mt-3 w-full rounded border border-zinc-700 bg-black px-3 py-3 text-sm font-bold text-white"
          >
            {languageOptions.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
          {selected === "custom" ? (
            <input
              value={customLanguage}
              onChange={(event) => setCustomLanguage(event.target.value)}
              placeholder="Example: Cockney English, ar-EG, es-419"
              className="mt-3 w-full rounded border border-zinc-700 bg-black px-3 py-3 text-sm font-bold text-white"
            />
          ) : null}
          <p className="mt-3 text-xs leading-5 text-zinc-400">{translateHint}</p>
        </div>
      ) : null}
    </div>
  );
}
