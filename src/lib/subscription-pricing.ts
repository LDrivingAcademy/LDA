import type { BillingInterval as InstructorBillingInterval } from "@/lib/instructor-packages";
import type { BillingInterval as LearnerBillingInterval } from "@/lib/learner-packages";

type BillingInterval = InstructorBillingInterval | LearnerBillingInterval;

export type SubscriptionPricingContext = {
  countryCode: string;
  currencyCode: string;
  locale: string;
  conversionRate: number;
};

const ukCountryCodes = new Set(["GB", "UK", "GG", "IM", "JE"]);

const euroCountryCodes = new Set([
  "AD",
  "AT",
  "BE",
  "CY",
  "DE",
  "EE",
  "ES",
  "FI",
  "FR",
  "GR",
  "HR",
  "IE",
  "IT",
  "LT",
  "LU",
  "LV",
  "MC",
  "MT",
  "NL",
  "PT",
  "SI",
  "SK",
  "SM",
  "VA",
]);

const countryCurrencyCodes: Record<string, string> = {
  AU: "AUD",
  BR: "BRL",
  CA: "CAD",
  CH: "CHF",
  CN: "CNY",
  CZ: "CZK",
  DK: "DKK",
  HK: "HKD",
  HU: "HUF",
  IN: "INR",
  JP: "JPY",
  MX: "MXN",
  NO: "NOK",
  NZ: "NZD",
  PL: "PLN",
  RO: "RON",
  SE: "SEK",
  SG: "SGD",
  TR: "TRY",
  US: "USD",
  ZA: "ZAR",
};

const gbpExchangeRates: Record<string, number> = {
  GBP: 1,
  EUR: 11.54 / 9.99,
  USD: 1.27,
  AUD: 1.92,
  BRL: 6.82,
  CAD: 1.72,
  CHF: 1.13,
  CNY: 9.2,
  CZK: 28.68,
  DKK: 8.62,
  HKD: 9.95,
  HUF: 452.55,
  INR: 106.05,
  JPY: 190.7,
  MXN: 23.42,
  NOK: 13.58,
  NZD: 2.09,
  PLN: 4.94,
  RON: 5.75,
  SEK: 13.19,
  SGD: 1.72,
  TRY: 41.78,
  ZAR: 23.11,
};

function normalizeCountryCode(countryCode?: string | null) {
  const normalized = countryCode?.trim().toUpperCase();
  if (!normalized || normalized.length < 2) return "GB";
  return normalized === "UK" ? "GB" : normalized.slice(0, 2);
}

function getCountryCurrencyCode(countryCode: string) {
  if (ukCountryCodes.has(countryCode)) return "GBP";
  if (euroCountryCodes.has(countryCode)) return "EUR";
  return countryCurrencyCodes[countryCode] ?? "GBP";
}

function getCountryFromAcceptLanguage(acceptLanguage?: string | null) {
  const firstLocale = acceptLanguage?.split(",")[0]?.trim();
  const countryMatch = firstLocale?.match(/-([A-Za-z]{2})\b/);
  return countryMatch?.[1];
}

function getLocale(acceptLanguage: string | null, countryCode: string) {
  const firstLocale = acceptLanguage?.split(",")[0]?.trim();
  if (firstLocale && /^[A-Za-z]{2,3}(-[A-Za-z]{2})?$/.test(firstLocale)) {
    return firstLocale.includes("-") ? firstLocale : `${firstLocale}-${countryCode}`;
  }

  return countryCode === "GB" ? "en-GB" : `en-${countryCode}`;
}

export function getSubscriptionPricingContext(headersList: Pick<Headers, "get">): SubscriptionPricingContext {
  const acceptLanguage = headersList.get("accept-language");
  const countryCode = normalizeCountryCode(
    headersList.get("x-vercel-ip-country") ??
      headersList.get("cf-ipcountry") ??
      headersList.get("cloudfront-viewer-country") ??
      headersList.get("x-country-code") ??
      getCountryFromAcceptLanguage(acceptLanguage),
  );
  const currencyCode = getCountryCurrencyCode(countryCode);

  return {
    countryCode,
    currencyCode,
    locale: getLocale(acceptLanguage, countryCode),
    conversionRate: gbpExchangeRates[currencyCode] ?? 1,
  };
}

export function formatSubscriptionAmount(gbpPence: number, pricingContext: SubscriptionPricingContext) {
  if (gbpPence <= 0) {
    return "Free";
  }

  const convertedAmount = (gbpPence / 100) * pricingContext.conversionRate;

  return new Intl.NumberFormat(pricingContext.locale, {
    style: "currency",
    currency: pricingContext.currencyCode,
  }).format(convertedAmount);
}

export function formatSubscriptionPrice(
  gbpPence: number,
  pricingContext: SubscriptionPricingContext,
  billingInterval: BillingInterval,
) {
  const amount = formatSubscriptionAmount(gbpPence, pricingContext);
  if (amount === "Free") return amount;

  return billingInterval === "yearly" ? `${amount} per year` : `${amount} per month`;
}

export function formatSubscriptionStartingPrice(gbpPence: number, pricingContext: SubscriptionPricingContext) {
  const amount = formatSubscriptionAmount(gbpPence, pricingContext);
  return amount === "Free" ? amount : `From ${amount}/month`;
}
