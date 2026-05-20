import { NextResponse } from "next/server";

const targetPattern = /^[a-z]{2,3}(?:-[A-Za-z]{2})?$/;
const cache = new Map<string, string>();

async function translateText(text: string, target: string) {
  const key = `${target}:${text}`;
  const cached = cache.get(key);

  if (cached) {
    return cached;
  }

  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", "en");
  url.searchParams.set("tl", target);
  url.searchParams.set("dt", "t");
  url.searchParams.set("q", text);

  const response = await fetch(url, { cache: "force-cache" });
  if (!response.ok) {
    throw new Error("Google translation failed");
  }

  const data = (await response.json()) as unknown;
  const translation = Array.isArray(data) && Array.isArray(data[0])
    ? data[0].map((part) => (Array.isArray(part) && typeof part[0] === "string" ? part[0] : "")).join("")
    : text;

  cache.set(key, translation || text);
  return translation || text;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { texts?: unknown; target?: unknown };
    const target = typeof body.target === "string" ? body.target : "";

    if (!targetPattern.test(target)) {
      return NextResponse.json({ translations: [] }, { status: 400 });
    }

    const texts = Array.isArray(body.texts)
      ? body.texts
          .filter((text): text is string => typeof text === "string")
          .map((text) => text.trim())
          .filter(Boolean)
          .slice(0, 50)
      : [];

    const translations = await Promise.all(texts.map((text) => translateText(text.slice(0, 900), target)));
    return NextResponse.json({ translations });
  } catch {
    return NextResponse.json({ translations: [] }, { status: 502 });
  }
}
