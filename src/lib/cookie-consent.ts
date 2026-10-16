export type CookieChoice = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  preferences: false;
};

export const cookieConsentStorageKey = "lda-cookie-consent";
export const cookieConsentCookieName = "lda_cookie_consent";
export const cookieConsentUpdatedEvent = "lda-cookie-consent-updated";
export const cookieSettingsOpenEvent = "lda-cookie-settings-open";

const analyticsStorageKeys = [
  "lda-analytics-visitor",
  "lda-analytics-session",
  "lda-analytics-pageviews"
];

export const essentialOnlyCookieChoice: CookieChoice = {
  necessary: true,
  analytics: false,
  marketing: false,
  preferences: false
};

export const acceptAllCookieChoice: CookieChoice = {
  necessary: true,
  analytics: true,
  marketing: true,
  preferences: false
};

export function normaliseCookieChoice(value: unknown): CookieChoice | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const parsed = value as Partial<CookieChoice>;
  return {
    necessary: true,
    analytics: Boolean(parsed.analytics),
    marketing: Boolean(parsed.marketing),
    preferences: false
  };
}

export function parseStoredCookieChoice(value: string | null): CookieChoice | null {
  if (!value) {
    return null;
  }

  try {
    return normaliseCookieChoice(JSON.parse(value));
  } catch {
    return null;
  }
}

export function serialiseConsentCookie(choice: CookieChoice) {
  return `v1.a${choice.analytics ? "1" : "0"}.m${choice.marketing ? "1" : "0"}`;
}

export function parseConsentCookie(value: string | null | undefined): CookieChoice | null {
  if (!value) {
    return null;
  }

  const match = /^v1\.a([01])\.m([01])$/.exec(decodeURIComponent(value));
  if (!match) {
    return null;
  }

  return {
    necessary: true,
    analytics: match[1] === "1",
    marketing: match[2] === "1",
    preferences: false
  };
}

export function readConsentFromCookieHeader(cookieHeader: string | null) {
  if (!cookieHeader) {
    return null;
  }

  const value = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieConsentCookieName}=`))
    ?.slice(cookieConsentCookieName.length + 1);

  return parseConsentCookie(value);
}

export function readBrowserCookieChoice() {
  try {
    const stored = parseStoredCookieChoice(window.localStorage.getItem(cookieConsentStorageKey));
    if (stored) {
      return stored;
    }
  } catch {
    // The consent cookie remains available if local storage is restricted.
  }

  try {
    return readConsentFromCookieHeader(document.cookie);
  } catch {
    return null;
  }
}

function clearAnalyticsIdentifiers() {
  for (const key of analyticsStorageKeys) {
    try {
      window.localStorage.removeItem(key);
      window.sessionStorage.removeItem(key);
    } catch {
      // Optional storage cleanup must not interrupt the website.
    }
  }
}

export function persistBrowserCookieChoice(choice: CookieChoice) {
  try {
    window.localStorage.setItem(cookieConsentStorageKey, JSON.stringify(choice));
  } catch {
    // The cookie still preserves the choice if local storage is unavailable.
  }

  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${cookieConsentCookieName}=${serialiseConsentCookie(choice)}; Max-Age=15552000; Path=/; SameSite=Lax${secure}`;

  if (!choice.analytics) {
    clearAnalyticsIdentifiers();
  }
}
