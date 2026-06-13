import { createHmac, timingSafeEqual } from "crypto";
import type { InstructorPackageId } from "@/lib/instructor-packages";
import type { LearnerPackageId } from "@/lib/learner-packages";
import { getStripeSecretKey } from "@/lib/stripe-env";

export const subscriptionSessionCookieName = "lda_subscription_session";

export type SubscriptionSessionRole = "instructor" | "learner";

export type SubscriptionSessionPayload =
  | {
      userId: string;
      role: "instructor";
      packageId: InstructorPackageId;
      status?: string | null;
      subscriptionId?: string | null;
      customerId?: string | null;
      periodEnd?: string | null;
      issuedAt: number;
      expiresAt: number;
    }
  | {
      userId: string;
      role: "learner";
      packageId: LearnerPackageId;
      status?: string | null;
      subscriptionId?: string | null;
      customerId?: string | null;
      periodEnd?: string | null;
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
  return getStripeSecretKey().value ?? process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET ?? null;
}

function signPayload(encodedPayload: string, secret: string) {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function isInstructorPackageId(value: unknown): value is InstructorPackageId {
  return value === "instructor" || value === "instructor-plus" || value === "instructor-pro";
}

function isLearnerPackageId(value: unknown): value is LearnerPackageId {
  return value === "learner" || value === "learner-plus" || value === "learner-pro";
}

function isSubscriptionSessionPayload(value: unknown): value is SubscriptionSessionPayload {
  if (!value || typeof value !== "object") return false;

  const payload = value as Partial<SubscriptionSessionPayload>;
  const hasBaseShape =
    typeof payload.userId === "string" &&
    (payload.role === "instructor" || payload.role === "learner") &&
    typeof payload.issuedAt === "number" &&
    typeof payload.expiresAt === "number";

  if (!hasBaseShape) return false;

  return payload.role === "instructor" ? isInstructorPackageId(payload.packageId) : isLearnerPackageId(payload.packageId);
}

export function getSubscriptionSessionMaxAge(periodEnd?: string | null) {
  const fallbackSeconds = 60 * 60 * 24 * 31;
  if (!periodEnd) return fallbackSeconds;

  const secondsUntilPeriodEnd = Math.floor((new Date(periodEnd).getTime() - Date.now()) / 1000);
  return secondsUntilPeriodEnd > 0 ? Math.min(secondsUntilPeriodEnd, fallbackSeconds) : fallbackSeconds;
}

export function createSubscriptionSessionToken(payload: Omit<SubscriptionSessionPayload, "issuedAt" | "expiresAt">, maxAgeSeconds = getSubscriptionSessionMaxAge(payload.periodEnd)) {
  const secret = getSigningSecret();
  if (!secret) return null;

  const now = Math.floor(Date.now() / 1000);
  const fullPayload: SubscriptionSessionPayload = {
    ...payload,
    issuedAt: now,
    expiresAt: now + maxAgeSeconds
  } as SubscriptionSessionPayload;
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const signature = signPayload(encodedPayload, secret);

  return `${encodedPayload}.${signature}`;
}

export function readSubscriptionSessionToken(token: string | undefined, userId: string, role: SubscriptionSessionRole) {
  const secret = getSigningSecret();
  if (!secret || !token) return null;

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  const expectedSignature = signPayload(encodedPayload, secret);
  if (!safeEqual(signature, expectedSignature)) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as unknown;
    if (!isSubscriptionSessionPayload(payload)) return null;
    if (payload.userId !== userId || payload.role !== role || payload.expiresAt <= Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}
