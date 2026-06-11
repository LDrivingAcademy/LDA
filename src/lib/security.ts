import { NextResponse } from "next/server";

const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_RATE_LIMIT_BUCKETS = 10_000;
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();
const productionOrigins = new Set([
  "https://ldrivingacademy.co.uk",
  "https://www.ldrivingacademy.co.uk"
]);

const securityHeaders = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "img-src 'self' data: blob: https://images.unsplash.com https://maps.gstatic.com https://maps.googleapis.com https://www.gstatic.com https://translate.google.com https://translate.googleapis.com",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://maps.googleapis.com https://maps.gstatic.com https://js.stripe.com https://translate.google.com https://translate.googleapis.com https://www.gstatic.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://translate.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://checkout.stripe.com https://api.resend.com https://api.openai.com https://maps.googleapis.com https://places.googleapis.com https://api.postcodes.io https://translate.google.com https://translate.googleapis.com https://translate-pa.googleapis.com",
    "frame-src https://js.stripe.com https://checkout.stripe.com https://translate.google.com",
    "worker-src 'self' blob:",
    "form-action 'self'",
    "upgrade-insecure-requests"
  ].join("; "),
  "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(self), payment=(self)",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-DNS-Prefetch-Control": "on",
  "X-Frame-Options": "DENY"
};

export function applySecurityHeaders(response: NextResponse) {
  Object.entries(securityHeaders).forEach(([name, value]) => {
    response.headers.set(name, value);
  });

  return response;
}

export function noStoreHeaders() {
  return {
    "Cache-Control": "no-store, max-age=0"
  };
}

export function jsonNoStore<T>(body: T, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}

export function getClientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export function isRateLimited(request: Request, key: string, limit: number) {
  const bucketKey = `${key}:${getClientIp(request)}`;
  const now = Date.now();
  const existing = rateLimitBuckets.get(bucketKey);

  if (rateLimitBuckets.size > MAX_RATE_LIMIT_BUCKETS) {
    for (const [currentKey, bucket] of rateLimitBuckets) {
      if (bucket.resetAt <= now) {
        rateLimitBuckets.delete(currentKey);
      }
    }
  }

  if (!existing || existing.resetAt <= now) {
    rateLimitBuckets.set(bucketKey, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  existing.count += 1;
  return existing.count > limit;
}

export function rateLimitResponse() {
  return jsonNoStore(
    { error: "Too many requests. Please wait a moment and try again." },
    { status: 429 }
  );
}

export function safeText(value: unknown, fallback = "", maxLength = 160) {
  const text = typeof value === "string" ? value.trim() : fallback;
  return text.slice(0, maxLength);
}

export function safeEmail(value: unknown) {
  const email = safeText(value, "", 254).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

export function safeAmountPence(value: unknown, fallback: number, min: number, max: number) {
  const amount = Number(value ?? fallback);
  if (!Number.isInteger(amount) || amount < min || amount > max) {
    return fallback;
  }

  return amount;
}

export function safeCurrency(value: unknown, fallback = "gbp") {
  const currency = safeText(value, fallback, 3).toLowerCase();
  return /^[a-z]{3}$/.test(currency) ? currency : fallback;
}

export function safeStripeConnectedAccountId(value: unknown) {
  const accountId = safeText(value, "", 64);
  return /^acct_[A-Za-z0-9]{12,}$/.test(accountId) ? accountId : "";
}

export async function readJsonBody<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

function isLocalOrigin(origin: string) {
  try {
    const { hostname, protocol } = new URL(origin);
    return (
      (protocol === "http:" || protocol === "https:") &&
      (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]")
    );
  } catch {
    return false;
  }
}

export function getAppOrigin(request?: Request) {
  const configuredUrl = process.env.APP_WEBSITE_URL?.trim();

  if (configuredUrl) {
    try {
      const configuredOrigin = new URL(
        configuredUrl.startsWith("http") ? configuredUrl : `https://${configuredUrl}`
      ).origin;

      if (productionOrigins.has(configuredOrigin) || isLocalOrigin(configuredOrigin)) {
        return configuredOrigin;
      }
    } catch {
      // Fall through to safe request/local fallbacks.
    }
  }

  if (request) {
    const forwardedHost = request.headers.get("x-forwarded-host") || request.headers.get("host");
    const forwardedProto = request.headers.get("x-forwarded-proto") || "https";

    if (forwardedHost) {
      try {
        const requestOrigin = new URL(`${forwardedProto}://${forwardedHost}`).origin;
        if (productionOrigins.has(requestOrigin) || isLocalOrigin(requestOrigin)) {
          return requestOrigin;
        }
      } catch {
        // Use the canonical production fallback below.
      }
    }
  }

  return "https://ldrivingacademy.co.uk";
}
