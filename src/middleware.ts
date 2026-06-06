import { NextResponse, type NextRequest } from "next/server";

type RateLimitRule = {
  limit: number;
  windowMs: number;
};

const rateLimitRules: Array<{ pattern: RegExp; rule: RateLimitRule }> = [
  { pattern: /^\/owner-admin-gateway\//, rule: { limit: 6, windowMs: 10 * 60 * 1000 } },
  { pattern: /^\/admin(?:\/|$)/, rule: { limit: 80, windowMs: 10 * 60 * 1000 } },
  { pattern: /^\/auth\/(?:login|sign-up|forgot-password|reset-password)(?:\/|$)/, rule: { limit: 30, windowMs: 10 * 60 * 1000 } },
  { pattern: /^\/api\/security\/report(?:\/|$)/, rule: { limit: 40, windowMs: 60 * 1000 } }
];

const buckets = new Map<string, { count: number; resetAt: number }>();

function getClientKey(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const userAgent = request.headers.get("user-agent")?.slice(0, 80) ?? "unknown-agent";

  return `${forwardedFor || realIp || "unknown-ip"}:${userAgent}`;
}

function getRule(pathname: string) {
  return rateLimitRules.find(({ pattern }) => pattern.test(pathname))?.rule;
}

function pruneExpiredBuckets(now: number) {
  if (buckets.size < 500) {
    return;
  }

  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

export function middleware(request: NextRequest) {
  const rule = getRule(request.nextUrl.pathname);

  if (!rule) {
    return NextResponse.next();
  }

  const now = Date.now();
  pruneExpiredBuckets(now);

  const key = `${request.nextUrl.pathname}:${getClientKey(request)}`;
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + rule.windowMs });
    return NextResponse.next();
  }

  if (bucket.count >= rule.limit) {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));

    return new NextResponse("Too many requests. Please wait and try again.", {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "X-RateLimit-Limit": String(rule.limit),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.ceil(bucket.resetAt / 1000))
      }
    });
  }

  bucket.count += 1;

  const response = NextResponse.next();
  response.headers.set("X-RateLimit-Limit", String(rule.limit));
  response.headers.set("X-RateLimit-Remaining", String(Math.max(0, rule.limit - bucket.count)));
  response.headers.set("X-RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/owner-admin-gateway/:path*", "/auth/:path*", "/api/security/report/:path*"]
};
