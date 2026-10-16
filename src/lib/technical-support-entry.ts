import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";

export const technicalSupportEntryCookieName = "lda_technical_support_entry";
export const technicalSupportEntryMaxAgeSeconds = 20 * 60;

function getTechnicalSupportEntrySecret() {
  return (
    process.env.LDA_TECHNICAL_SUPPORT_ENTRY_SECRET?.trim() ||
    process.env.LDA_ADMIN_ENTRY_SECRET?.trim() ||
    null
  );
}

function signPayload(encodedPayload: string, secret: string) {
  return createHmac("sha256", secret)
    .update(`technical-support:${encodedPayload}`)
    .digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function sha256Hex(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function readLaunchTokenHashes() {
  return [
    process.env.LDA_TECHNICAL_SUPPORT_LAUNCH_HASH,
    process.env.LDA_TECHNICAL_SUPPORT_LAUNCH_TOKEN_HASH,
    process.env.LDA_TECHNICAL_SUPPORT_LAUNCH_HASHES,
    process.env.LDA_TECHNICAL_SUPPORT_LAUNCH_TOKEN_HASHES
  ]
    .flatMap((hashes) => String(hashes ?? "").split(","))
    .map((hash) => hash.trim().toLowerCase())
    .filter(Boolean);
}

export function createTechnicalSupportEntryCookieValue() {
  const secret = getTechnicalSupportEntrySecret();
  if (!secret) return null;

  const payload = Buffer.from(
    JSON.stringify({
      issuedAt: Math.floor(Date.now() / 1000),
      nonce: randomBytes(18).toString("base64url")
    }),
    "utf8"
  ).toString("base64url");

  return `${payload}.${signPayload(payload, secret)}`;
}

export function hasValidTechnicalSupportEntry(value: string | undefined) {
  const secret = getTechnicalSupportEntrySecret();
  if (!secret || !value) return false;

  const [payload, signature] = value.split(".");
  if (!payload || !signature || !safeEqual(signature, signPayload(payload, secret))) {
    return false;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      issuedAt?: unknown;
    };
    const issuedAt = typeof parsed.issuedAt === "number" ? parsed.issuedAt : 0;
    const now = Math.floor(Date.now() / 1000);
    return issuedAt > 0 && issuedAt <= now && now - issuedAt <= technicalSupportEntryMaxAgeSeconds;
  } catch {
    return false;
  }
}

export function hasValidTechnicalSupportLaunchToken(value: string | null | undefined) {
  const tokenHashes = readLaunchTokenHashes();

  if (tokenHashes.length === 0) {
    return process.env.NODE_ENV !== "production";
  }

  const token = String(value ?? "").trim();
  if (!token) return false;

  const providedTokenHash = sha256Hex(token);
  return tokenHashes.some((tokenHash) => safeEqual(providedTokenHash, tokenHash));
}

export function hasConfiguredTechnicalSupportLaunchTokenHash() {
  return readLaunchTokenHashes().length > 0;
}

export function technicalSupportEntryCookieOptions() {
  return {
    httpOnly: true,
    maxAge: technicalSupportEntryMaxAgeSeconds,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production"
  };
}
