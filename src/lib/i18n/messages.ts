import { enGbMessages, type EnGbMessageKey } from "@/lib/i18n/messages/en-GB";

type MessageValues = Record<string, string | number>;

const catalogs = {
  "en-GB": enGbMessages
} as const;

export type LdaMessageKey = EnGbMessageKey;
export type SupportedCatalogLocale = keyof typeof catalogs;

function interpolate(message: string, values?: MessageValues) {
  if (!values) return message;

  return message.replace(/\{([A-Za-z0-9_]+)\}/g, (match, key: string) => {
    const value = values[key];
    return value === undefined || value === null ? match : String(value);
  });
}

export function getEnglishMessage(key: LdaMessageKey, values?: MessageValues) {
  return interpolate(enGbMessages[key] || key, values);
}

export function getMessage(locale: string, key: LdaMessageKey, values?: MessageValues) {
  const catalog = catalogs[locale as SupportedCatalogLocale] || catalogs["en-GB"];
  return interpolate(catalog[key] || enGbMessages[key] || key, values);
}

export function hasMessageKey(key: string): key is LdaMessageKey {
  return Object.prototype.hasOwnProperty.call(enGbMessages, key);
}
