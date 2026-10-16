export type LanguageOption = {
  code: string;
  label: string;
  googleCode?: string;
  rtl?: boolean;
};

export const languageOptions: LanguageOption[] = [
  { code: "en-GB", label: "English - United Kingdom", googleCode: "en" },
  { code: "en-US", label: "English - United States", googleCode: "en" },
  { code: "en-IN", label: "English - India", googleCode: "en" },
  { code: "cy-GB", label: "Welsh - United Kingdom", googleCode: "cy" },
  { code: "gd-GB", label: "Scottish Gaelic - United Kingdom", googleCode: "gd" },
  { code: "ga-IE", label: "Irish - Ireland", googleCode: "ga" },
  { code: "fr-FR", label: "French - France", googleCode: "fr" },
  { code: "fr-CA", label: "French - Canada", googleCode: "fr" },
  { code: "es-ES", label: "Spanish - Spain", googleCode: "es" },
  { code: "es-MX", label: "Spanish - Mexico", googleCode: "es" },
  { code: "pt-PT", label: "Portuguese - Portugal", googleCode: "pt" },
  { code: "pt-BR", label: "Portuguese - Brazil", googleCode: "pt" },
  { code: "it-IT", label: "Italian - Italy", googleCode: "it" },
  { code: "de-DE", label: "German - Germany", googleCode: "de" },
  { code: "nl-NL", label: "Dutch - Netherlands", googleCode: "nl" },
  { code: "pl-PL", label: "Polish - Poland", googleCode: "pl" },
  { code: "ro-RO", label: "Romanian - Romania", googleCode: "ro" },
  { code: "tr-TR", label: "Turkish - Turkey", googleCode: "tr" },
  { code: "ar", label: "Arabic", googleCode: "ar", rtl: true },
  { code: "ur-PK", label: "Urdu - Pakistan", googleCode: "ur", rtl: true },
  { code: "hi-IN", label: "Hindi - India", googleCode: "hi" },
  { code: "bn-BD", label: "Bengali - Bangladesh", googleCode: "bn" },
  { code: "pa-IN", label: "Punjabi - India", googleCode: "pa" },
  { code: "zh-CN", label: "Chinese - Simplified", googleCode: "zh-CN" },
  { code: "zh-TW", label: "Chinese - Traditional", googleCode: "zh-TW" },
  { code: "ja-JP", label: "Japanese - Japan", googleCode: "ja" },
  { code: "ko-KR", label: "Korean - Korea", googleCode: "ko" },
  { code: "sw", label: "Swahili", googleCode: "sw" },
  { code: "yo", label: "Yoruba", googleCode: "yo" },
  { code: "custom", label: "Type any language or dialect" }
];

export function findLanguage(code: string) {
  return languageOptions.find((option) => option.code === code);
}

export function labelForLanguage(code: string) {
  const match = findLanguage(code);
  if (match) {
    return match.code === "custom" ? "Custom" : match.label.split(" - ")[0];
  }

  return code.toUpperCase();
}

export function googleCodeForLanguage(selected: string, customLanguage = "") {
  if (selected === "custom") {
    const codeMatch = customLanguage.match(/\b[a-z]{2,3}(?:-[A-Za-z]{2})?\b/);
    return codeMatch ? codeMatch[0] : "";
  }

  return findLanguage(selected)?.googleCode || "";
}

export function isRtlLanguage(selected: string, customLanguage = "") {
  if (selected === "custom") {
    const normalised = customLanguage.toLowerCase();
    return /\b(ar|arabic|ur|urdu|he|hebrew|fa|farsi|persian)\b/.test(normalised);
  }

  return Boolean(findLanguage(selected)?.rtl);
}
