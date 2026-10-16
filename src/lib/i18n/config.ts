import { googleCodeForLanguage, isRtlLanguage, labelForLanguage } from "@/lib/languages";

export const defaultLocale = "en-GB";
export const localeCookieName = "lda_locale";
export const customLocaleCookieName = "lda_custom_locale";

const localePattern = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$/;

function parseCookies(cookieHeader: string | null) {
  return (cookieHeader || "").split(";").reduce<Record<string, string>>((cookies, part) => {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (!rawName) return cookies;

    try {
      cookies[rawName] = decodeURIComponent(rawValue.join("=") || "");
    } catch {
      cookies[rawName] = rawValue.join("=") || "";
    }

    return cookies;
  }, {});
}

export function normaliseLocale(value: string | null | undefined) {
  const candidate = (value || "").trim();
  if (!candidate || candidate === "custom") return defaultLocale;
  if (!localePattern.test(candidate)) return defaultLocale;

  const [language, region] = candidate.split("-");
  return region ? `${language.toLowerCase()}-${region.toUpperCase()}` : language.toLowerCase();
}

export function getLocaleFromRequest(request: Request) {
  const cookies = parseCookies(request.headers.get("cookie"));
  const selected = cookies[localeCookieName];
  const custom = cookies[customLocaleCookieName];

  if (selected === "custom" && custom) {
    return normaliseLocale(custom);
  }

  if (selected) {
    return normaliseLocale(selected);
  }

  const acceptedLanguage = request.headers.get("accept-language") || "";
  const preferred = acceptedLanguage
    .split(",")
    .map((part) => part.trim().split(";")[0])
    .find(Boolean);

  return normaliseLocale(preferred || defaultLocale);
}

export function describeLocale(locale: string) {
  const normalised = normaliseLocale(locale);
  const googleCode = googleCodeForLanguage(normalised, "") || normalised.split("-")[0] || "en";
  const direction = isRtlLanguage(normalised, "") ? "rtl" : "ltr";

  return {
    locale: normalised,
    label: labelForLanguage(normalised),
    googleCode,
    direction
  };
}
