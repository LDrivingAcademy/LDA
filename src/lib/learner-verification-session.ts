import { createHmac, timingSafeEqual } from "crypto";

export const learnerVerificationCookieName = "lda_learner_verified";

type LearnerVerificationPayload = {
  userId: string;
  issuedAt: number;
  expiresAt: number;
};

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function getSigningSecret() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET ?? null;
}

function signPayload(encodedPayload: string, secret: string) {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function isLearnerVerificationPayload(value: unknown): value is LearnerVerificationPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<LearnerVerificationPayload>;

  return typeof payload.userId === "string" && typeof payload.issuedAt === "number" && typeof payload.expiresAt === "number";
}

export function createLearnerVerificationToken(userId: string, maxAgeSeconds = 60 * 60 * 24) {
  const secret = getSigningSecret();
  if (!secret) return null;

  const now = Math.floor(Date.now() / 1000);
  const payload: LearnerVerificationPayload = {
    userId,
    issuedAt: now,
    expiresAt: now + maxAgeSeconds
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signPayload(encodedPayload, secret);

  return `${encodedPayload}.${signature}`;
}

export function readLearnerVerificationToken(token: string | undefined, userId: string) {
  const secret = getSigningSecret();
  if (!secret || !token) return null;

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  const expectedSignature = signPayload(encodedPayload, secret);
  if (!safeEqual(signature, expectedSignature)) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as unknown;
    if (!isLearnerVerificationPayload(payload)) return null;
    if (payload.userId !== userId || payload.expiresAt <= Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}
