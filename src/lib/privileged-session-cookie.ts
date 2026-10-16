import { createHmac, randomBytes, timingSafeEqual } from "crypto";

export const privilegedSessionCookieName = "lda_privileged_session";
export const privilegedSessionMaxAgeSeconds = 60 * 60 * 8;

export type PrivilegedSessionRole = "admin" | "support";

type CookieStore = {
  set(name: string, value: string, options?: Record<string, unknown>): void;
};

function privilegedSessionSecret() {
  return (
    process.env.LDA_PRIVILEGED_SESSION_SECRET?.trim() ||
    process.env.LDA_AUTH_SESSION_SECRET?.trim() ||
    process.env.LDA_ADMIN_ENTRY_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    null
  );
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function signPayload(encodedPayload: string, secret: string) {
  return createHmac("sha256", secret)
    .update(`privileged-session:${encodedPayload}`)
    .digest("base64url");
}

export function createPrivilegedSessionCookieValue(role: PrivilegedSessionRole) {
  const secret = privilegedSessionSecret();
  if (!secret) return null;

  const payload = Buffer.from(
    JSON.stringify({
      role,
      issuedAt: Math.floor(Date.now() / 1000),
      nonce: randomBytes(18).toString("base64url")
    }),
    "utf8"
  ).toString("base64url");

  return `${payload}.${signPayload(payload, secret)}`;
}

export function getValidPrivilegedSessionRole(value: string | undefined) {
  const secret = privilegedSessionSecret();
  if (!secret || !value) return null;

  const [encodedPayload, signature] = value.split(".");
  if (!encodedPayload || !signature || !safeEqual(signature, signPayload(encodedPayload, secret))) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as {
      role?: unknown;
      issuedAt?: unknown;
    };
    const role = parsed.role === "admin" || parsed.role === "support" ? parsed.role : null;
    const issuedAt = typeof parsed.issuedAt === "number" ? parsed.issuedAt : 0;
    const now = Math.floor(Date.now() / 1000);

    if (!role || issuedAt <= 0 || issuedAt > now || now - issuedAt > privilegedSessionMaxAgeSeconds) {
      return null;
    }

    return role;
  } catch {
    return null;
  }
}

export function privilegedSessionCookieOptions() {
  return {
    httpOnly: true,
    maxAge: privilegedSessionMaxAgeSeconds,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production"
  };
}

export function expirePrivilegedSessionCookie(cookieStore: CookieStore) {
  cookieStore.set(privilegedSessionCookieName, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });
}
