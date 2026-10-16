import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";

export const adminEntryCookieName = "lda_admin_private_entry";

export const adminEntryMaxAgeSeconds = 20 * 60;

export function getAdminEntrySecret() {
  return process.env.LDA_ADMIN_ENTRY_SECRET?.trim() || null;
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function signEntryPayload(encodedPayload: string, secret: string) {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

function sha256Hex(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function readLaunchTokenHashes() {
  return [
    process.env.LDA_DIRECTOR_LAUNCH_HASH,
    process.env.LDA_ADMIN_LAUNCH_TOKEN_HASH,
    process.env.LDA_DIRECTOR_LAUNCH_HASHES,
    process.env.LDA_ADMIN_LAUNCH_TOKEN_HASHES
  ]
    .flatMap((hashes) => String(hashes ?? "").split(","))
    .map((hash) => hash.trim().toLowerCase())
    .filter(Boolean);
}

export function createAdminEntryCookieValue() {
  const secret = getAdminEntrySecret();
  if (!secret) return null;

  const payload = {
    issuedAt: Math.floor(Date.now() / 1000),
    nonce: randomBytes(18).toString("base64url")
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  return `${encodedPayload}.${signEntryPayload(encodedPayload, secret)}`;
}

export function hasValidAdminEntry(value: string | undefined) {
  const secret = getAdminEntrySecret();
  if (!secret || !value) return false;

  const [encodedPayload, signature] = value.split(".");
  if (!encodedPayload || !signature) return false;

  const expectedSignature = signEntryPayload(encodedPayload, secret);
  if (!safeEqual(signature, expectedSignature)) return false;

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as { issuedAt?: unknown };
    const issuedAt = typeof payload.issuedAt === "number" ? payload.issuedAt : 0;
    const now = Math.floor(Date.now() / 1000);
    return issuedAt > 0 && issuedAt <= now && now - issuedAt <= adminEntryMaxAgeSeconds;
  } catch {
    return false;
  }
}

export function hasValidAdminLaunchToken(value: string | null | undefined) {
  const tokenHashes = readLaunchTokenHashes();

  if (tokenHashes.length === 0) {
    return process.env.NODE_ENV !== "production";
  }

  const token = String(value ?? "").trim();
  if (!token) return false;

  const providedTokenHash = sha256Hex(token);
  return tokenHashes.some((tokenHash) => safeEqual(providedTokenHash, tokenHash));
}

export function hasConfiguredAdminLaunchTokenHash() {
  return readLaunchTokenHashes().length > 0;
}

export function adminEntryCookieOptions() {
  return {
    httpOnly: true,
    maxAge: adminEntryMaxAgeSeconds,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production"
  };
}
