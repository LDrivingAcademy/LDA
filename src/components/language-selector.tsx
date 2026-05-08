"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Globe2 } from "lucide-react";

const languageOptions = [
  { code: "en-GB", label: "English - United Kingdom" },
  { code: "en-US", label: "English - United States" },
  { code: "en-IN", label: "English - India" },
  { code: "cy-GB", label: "Welsh - United Kingdom" },
  { code: "gd-GB", label: "Scottish Gaelic - United Kingdom" },
  { code: "ga-IE", label: "Irish - Ireland" },
  { code: "fr-FR", label: "French - France" },
  { code: "fr-CA", label: "French - Canada" },
  { code: "es-ES", label: "Spanish - Spain" },
  { code: "es-MX", label: "Spanish - Mexico" },
  { code: "pt-PT", label: "Portuguese - Portugal" },
  { code: "pt-BR", label: "Portuguese - Brazil" },
  { code: "it-IT", label: "Italian - Italy" },
  { code: "de-DE", label: "German - Germany" },
  { code: "nl-NL", label: "Dutch - Netherlands" },
  { code: "pl-PL", label: "Polish - Poland" },
  { code: "ro-RO", label: "Romanian - Romania" },
  { code: "tr-TR", label: "Turkish - Turkey" },
  { code: "ar", label: "Arabic" },
  { code: "ur-PK", label: "Urdu - Pakistan" },
  { code: "hi-IN", label: "Hindi - India" },
  { code: "bn-BD", label: "Bengali - Bangladesh" },
  { code: "pa-IN", label: "Punjabi - India" },
  { code: "zh-CN", label: "Chinese - Simplified" },
  { code: "zh-TW", label: "Chinese - Traditional" },
  { code: "ja-JP", label: "Japanese - Japan" },
  { code: "ko-KR", label: "Korean - Korea" },
  { code: "sw", label: "Swahili" },
  { code: "yo", label: "Yoruba" },
  { code: "custom", label: "Type any language or dialect" }
];

function labelFor(code: string) {
  const match = languageOptions.find((option) => option.code === code);
  if (match) {
    if (match.code === "custom") {
      return "Custom";
    }

    return match.label.split(" - ")[0];
  }

  return code.toUpperCase();
}

export function LanguageSelector() {
  const [selected, setSelected] = useState("en-GB");
  const [customLanguage, setCustomLanguage] = useState("");

  useEffect(() => {
    const stored = window.localStorage.getItem("lda-language");
    setSelected(stored || "en-GB");
    setCustomLanguage(window.localStorage.getItem("lda-custom-language") || "");
  }, []);

  useEffect(() => {
    const activeLanguage = selected === "custom" ? customLanguage : selected;
    if (!activeLanguage) {
      return;
    }

    document.documentElement.lang = activeLanguage;
    window.localStorage.setItem("lda-language", selected);
    if (selected === "custom") {
      window.localStorage.setItem("lda-custom-language", customLanguage);
    }
  }, [customLanguage, selected]);

  const selectedLabel = useMemo(() => labelFor(selected === "custom" && customLanguage ? customLanguage : selected), [customLanguage, selected]);

  return (
    <details className="group relative">
      <summary className="inline-flex cursor-pointer list-none items-center gap-2 text-sm font-black hover:text-zinc-300 [&::-webkit-details-marker]:hidden">
        <Globe2 size={17} /> {selectedLabel} <ChevronDown size={14} />
      </summary>
      <div className="absolute right-0 top-full z-50 mt-3 w-80 rounded border border-zinc-800 bg-zinc-950 p-4 text-white shadow-2xl">
        <label className="block text-xs font-black uppercase text-zinc-400">Choose page language</label>
        <select
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
          className="mt-2 w-full rounded border border-zinc-700 bg-black px-3 py-3 text-sm font-bold text-white"
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
        <p className="mt-3 text-xs leading-5 text-zinc-400">
          Pick the language or dialect the customer wants. Full text translation can be connected to a translation provider when the site goes fully live.
        </p>
      </div>
    </details>
  );
}
