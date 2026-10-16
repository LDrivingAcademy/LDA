import { isRateLimited, jsonNoStore, rateLimitResponse, readJsonBody } from "@/lib/security";

const targetPattern = /^[a-z]{2,3}(?:-[A-Za-z]{2})?$/;
const cache = new Map<string, string>();
const protectedTerms = [
  "LDA SmartMatch",
  "SmartMatch",
  "LDA",
  "DVSA",
  "ADI",
  "PDI",
  "Pass Plus",
  "Stripe",
  "Google Maps"
];

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function protectBrandTerms(text: string) {
  const replacements: Array<{ token: string; value: string }> = [];
  let protectedText = text;

  protectedTerms.forEach((term, index) => {
    const token = `ZZZLDATERM${index}ZZZ`;
    const pattern = new RegExp(escapeRegExp(term), "g");
    if (pattern.test(protectedText)) {
      protectedText = protectedText.replace(pattern, token);
      replacements.push({ token, value: term });
    }
  });

  return { protectedText, replacements };
}

function restoreBrandTerms(text: string, replacements: Array<{ token: string; value: string }>) {
  return replacements.reduce((current, replacement) => current.replaceAll(replacement.token, replacement.value), text);
}

async function translateText(text: string, target: string) {
  const key = `${target}:${text}`;
  const cached = cache.get(key);

  if (cached) {
    return cached;
  }

  const { protectedText, replacements } = protectBrandTerms(text);
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", "en");
  url.searchParams.set("tl", target);
  url.searchParams.set("dt", "t");
  url.searchParams.set("q", protectedText);

  const response = await fetch(url, { cache: "force-cache" });
  if (!response.ok) {
    throw new Error("Google translation failed");
  }

  const data = (await response.json()) as unknown;
  const rawTranslation = Array.isArray(data) && Array.isArray(data[0])
    ? data[0].map((part) => (Array.isArray(part) && typeof part[0] === "string" ? part[0] : "")).join("")
    : text;
  const translation = restoreBrandTerms(rawTranslation, replacements);

  cache.set(key, translation || text);
  return translation || text;
}

export async function POST(request: Request) {
  if (isRateLimited(request, "translate", 60)) {
    return rateLimitResponse();
  }

  try {
    const body = await readJsonBody<{ texts?: unknown; target?: unknown }>(request);
    if (!body) {
      return jsonNoStore({ translations: [] }, { status: 400 });
    }

    const target = typeof body.target === "string" ? body.target : "";

    if (!targetPattern.test(target)) {
      return jsonNoStore({ translations: [] }, { status: 400 });
    }

    const texts = Array.isArray(body.texts)
      ? body.texts
          .filter((text): text is string => typeof text === "string")
          .map((text) => text.trim())
          .filter(Boolean)
          .slice(0, 50)
      : [];

    const translations = await Promise.all(texts.map((text) => translateText(text.slice(0, 900), target)));
    return jsonNoStore({ translations });
  } catch {
    return jsonNoStore({ translations: [] }, { status: 502 });
  }
}
