import { cookies } from "next/headers";

export const HANDOFF_COOKIE_NAME = "lda_auth_handoff";
export const HANDOFF_TTL_SECONDS = 15 * 60;

export function createHandoffSecret() {
  return `${crypto.randomUUID()}-${crypto.randomUUID()}`;
}

export async function hashHandoffSecret(secret: string) {
  const bytes = new TextEncoder().encode(secret);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function setHandoffCookie(id: string, secret: string) {
  const cookieStore = await cookies();
  cookieStore.set(HANDOFF_COOKIE_NAME, `${id}.${secret}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: HANDOFF_TTL_SECONDS
  });
}

export function parseHandoffCookie(value?: string) {
  if (!value) {
    return null;
  }

  const [id, ...secretParts] = value.split(".");
  const secret = secretParts.join(".");

  if (!id || !secret) {
    return null;
  }

  return { id, secret };
}
