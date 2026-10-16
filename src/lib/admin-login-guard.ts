import { createHmac, timingSafeEqual } from "crypto";
import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";

export const adminLoginGuardCookieName = "lda_admin_login_guard";

const failureWindowSeconds = 15 * 60;
const lockoutSeconds = 30 * 60;
const defaultMaxFailuresBeforeLockout = 5;
const setupGraceMaxFailuresFallback = 15;

type AdminLoginGuardPayload = {
  failures: number;
  firstFailureAt: number;
  lastFailureAt: number;
  subjectTag?: string;
  lockedUntil?: number;
};

type MutableCookieStore = Awaited<ReturnType<typeof import("next/headers").cookies>>;

function getSigningSecret() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? null;
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(encodedPayload: string, secret: string) {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function normalizeSubject(value?: string | null) {
  return String(value ?? "").trim().toLowerCase();
}

function isSetupGraceSubject(value?: string | null) {
  const setupGraceEmail = normalizeSubject(process.env.LDA_ADMIN_SETUP_GRACE_EMAIL);
  return Boolean(setupGraceEmail) && normalizeSubject(value) === setupGraceEmail;
}

function getSetupGraceMaxFailures() {
  const parsed = Number.parseInt(String(process.env.LDA_ADMIN_SETUP_GRACE_MAX_FAILURES ?? ""), 10);
  return Number.isFinite(parsed) && parsed > defaultMaxFailuresBeforeLockout ? parsed : setupGraceMaxFailuresFallback;
}

function getMaxFailuresBeforeLockout(subject?: string | null) {
  return isSetupGraceSubject(subject) ? getSetupGraceMaxFailures() : defaultMaxFailuresBeforeLockout;
}

function getSubjectTag(subject?: string | null) {
  const secret = getSigningSecret();
  const normalized = normalizeSubject(subject);
  if (!secret || !normalized) return undefined;

  return signPayload(`admin-login:${normalized}`, secret).slice(0, 32);
}

function isAdminLoginGuardPayload(value: unknown): value is AdminLoginGuardPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<AdminLoginGuardPayload>;

  return (
    typeof payload.failures === "number" &&
    typeof payload.firstFailureAt === "number" &&
    typeof payload.lastFailureAt === "number" &&
    (typeof payload.subjectTag === "string" || typeof payload.subjectTag === "undefined") &&
    (typeof payload.lockedUntil === "number" || typeof payload.lockedUntil === "undefined")
  );
}

function serializeGuard(payload: AdminLoginGuardPayload) {
  const secret = getSigningSecret();
  if (!secret) return null;

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  return `${encodedPayload}.${signPayload(encodedPayload, secret)}`;
}

export function readAdminLoginGuard(cookieStore: ReadonlyRequestCookies | MutableCookieStore) {
  const secret = getSigningSecret();
  const token = cookieStore.get(adminLoginGuardCookieName)?.value;
  if (!secret || !token) return null;

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  const expectedSignature = signPayload(encodedPayload, secret);
  if (!safeEqual(signature, expectedSignature)) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as unknown;
    return isAdminLoginGuardPayload(payload) ? payload : null;
  } catch {
    return null;
  }
}

export function getAdminLoginLockout(cookieStore: ReadonlyRequestCookies | MutableCookieStore, subject?: string | null) {
  const payload = readAdminLoginGuard(cookieStore);
  const now = Math.floor(Date.now() / 1000);
  const subjectTag = getSubjectTag(subject);

  if (subjectTag && payload?.subjectTag && payload.subjectTag !== subjectTag) {
    return null;
  }

  if (subjectTag && !payload?.subjectTag && isSetupGraceSubject(subject)) {
    return null;
  }

  if (!payload?.lockedUntil || payload.lockedUntil <= now) {
    return null;
  }

  return {
    lockedUntil: payload.lockedUntil,
    secondsRemaining: payload.lockedUntil - now
  };
}

export function recordAdminLoginFailure(cookieStore: MutableCookieStore, subject?: string | null) {
  const now = Math.floor(Date.now() / 1000);
  const existing = readAdminLoginGuard(cookieStore);
  const subjectTag = getSubjectTag(subject);
  const sameSubject = subjectTag ? existing?.subjectTag === subjectTag : !existing?.subjectTag;
  const insideFailureWindow = existing && sameSubject && now - existing.firstFailureAt <= failureWindowSeconds;
  const failures = insideFailureWindow ? existing.failures + 1 : 1;
  const maxFailuresBeforeLockout = getMaxFailuresBeforeLockout(subject);
  const payload: AdminLoginGuardPayload = {
    failures,
    firstFailureAt: insideFailureWindow ? existing.firstFailureAt : now,
    lastFailureAt: now,
    subjectTag,
    lockedUntil: failures >= maxFailuresBeforeLockout ? now + lockoutSeconds : insideFailureWindow ? existing?.lockedUntil : undefined
  };
  const token = serializeGuard(payload);

  if (!token) return payload;

  cookieStore.set(adminLoginGuardCookieName, token, {
    httpOnly: true,
    maxAge: lockoutSeconds,
    path: "/",
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production"
  });

  return payload;
}

export function clearAdminLoginGuard(cookieStore: MutableCookieStore) {
  cookieStore.delete(adminLoginGuardCookieName);
}

export function adminLockoutMessage(secondsRemaining: number) {
  const minutes = Math.max(1, Math.ceil(secondsRemaining / 60));
  return `Admin access is temporarily locked after repeated failed attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}
