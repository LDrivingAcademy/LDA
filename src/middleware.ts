import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import {
  getValidPrivilegedSessionRoleForMiddleware,
  hasValidPrivilegedEntryForMiddleware
} from "@/lib/privileged-entry-middleware";

const trustedOrigins = new Set([
  "https://ldrivingacademy.co.uk",
  "https://www.ldrivingacademy.co.uk",
  "http://localhost:3000",
  "http://127.0.0.1:3000"
]);
const writeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const adminEntryCookieName = "lda_admin_private_entry";
const technicalSupportEntryCookieName = "lda_technical_support_entry";
const privilegedSessionCookieName = "lda_privileged_session";
const adminEntryMaxAgeSeconds = 20 * 60;
const technicalSupportEntryMaxAgeSeconds = 20 * 60;
const suspiciousUserAgentPattern =
  /\b(sqlmap|nikto|acunetix|nessus|nmap|masscan|wpscan|dirbuster|gobuster|ffuf|zgrab)\b/i;
const scannerPathPattern =
  /^(?:\/\.env(?:\.|$|\/)|\/\.git(?:\/|$)|\/wp-login\.php$|\/wp-admin(?:\/|$)|\/phpmyadmin(?:\/|$)|\/server-status$|\/config\.(?:json|php)$)/i;
const crossOriginWriteBypassPaths = new Set([
  "/api/webhooks/stripe",
  "/api/cron/site-health",
  "/api/cron/account-deletions"
]);
const privatePrefixes = [
  "/account",
  "/admin",
  "/admin-access",
  "/admin-mfa",
  "/admin-preview",
  "/after-lesson-revision",
  "/auth",
  "/booking-history",
  "/dashboard",
  "/director-master-key-lda-admin-9f4e7c2b6a",
  "/technical-support-private-entry-cf6d99a438285f152bf5d2425b0b5a50",
  "/instructor-calendar",
  "/instructor-dashboard",
  "/instructor-finance",
  "/instructor-performance",
  "/instructor-setup",
  "/instructor-vehicle-compliance",
  "/instructor-verification",
  "/learner-calendar",
  "/learner-dashboard",
  "/lesson-now/confirmed",
  "/notification-hub",
  "/owner-dashboard",
  "/progress-tracker",
  "/pupil-management",
  "/rate-instructor",
  "/scheduled-lessons",
  "/tracking",
  "/technical-support",
  "/technical-support-access",
  "/technical-support-mfa",
  "/support/instructor"
];

const publicPreviewNoIndexPrefixes = [
  "/learner-journey",
  "/planned-lessons"
];
const publicCrossOriginImagePaths = new Set([
  "/apple-icon.png",
  "/favicon-48x48.png",
  "/icon.png",
  "/lda-canonical-logo.png",
  "/lda-email-logo-v1.jpg",
  "/lda-official-icon-32.png",
  "/lda-official-icon-192.png",
  "/lda-official-icon-512.png",
  "/lda-search-icon-source.png",
  "/lda-search-preview.png",
  "/lda-tab-icon-16.png",
  "/lda-tab-icon-32.png",
  "/lda-tab-icon-48.png",
  "/lda-tab-icon-64.png",
  "/site.webmanifest"
]);

function isTrustedOrigin(origin: string, request: NextRequest) {
  if (trustedOrigins.has(origin) || origin === request.nextUrl.origin) {
    return true;
  }

  try {
    const url = new URL(origin);
    return (
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      (url.hostname.endsWith(".vercel.app") && url.hostname === request.nextUrl.hostname)
    );
  } catch {
    return false;
  }
}

function isCrossSiteWrite(request: NextRequest) {
  if (!writeMethods.has(request.method) || crossOriginWriteBypassPaths.has(request.nextUrl.pathname)) {
    return false;
  }

  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");

  if (origin && !isTrustedOrigin(origin, request)) {
    return true;
  }

  return fetchSite === "cross-site";
}

function isScannerRequest(request: NextRequest) {
  const userAgent = request.headers.get("user-agent") ?? "";

  return suspiciousUserAgentPattern.test(userAgent) || scannerPathPattern.test(request.nextUrl.pathname);
}

function requiresAdminEntry(pathname: string) {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/admin-mfa" ||
    pathname === "/admin-preview" ||
    pathname === "/owner-dashboard"
  );
}

function requiresTechnicalSupportEntry(pathname: string) {
  return (
    pathname === "/technical-support" ||
    pathname.startsWith("/technical-support/") ||
    pathname === "/technical-support-mfa"
  );
}

function isAdminEntryGatePath(pathname: string) {
  return pathname === "/admin-access" || pathname.startsWith("/admin-access/");
}

function isTechnicalSupportEntryGatePath(pathname: string) {
  return pathname === "/technical-support-access";
}

function publicFallbackUrl(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url;
}

function shouldNoIndex(pathname: string) {
  return (
    pathname.startsWith("/api/") ||
    privatePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)) ||
    publicPreviewNoIndexPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  );
}

function applyRuntimeSecurityHeaders(response: NextResponse, request: NextRequest) {
  response.headers.set("Origin-Agent-Cluster", "?1");
  response.headers.set(
    "Cross-Origin-Resource-Policy",
    publicCrossOriginImagePaths.has(request.nextUrl.pathname) ? "cross-origin" : "same-site"
  );
  if (publicCrossOriginImagePaths.has(request.nextUrl.pathname)) {
    response.headers.set("Access-Control-Allow-Origin", "*");
  }
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Permitted-Cross-Domain-Policies", "none");

  if (shouldNoIndex(request.nextUrl.pathname)) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
  }

  return response;
}

function queuePrivilegedRouteAudit(
  event: NextFetchEvent,
  request: NextRequest,
  metadata: Record<string, unknown>
) {
  const internalSecret =
    process.env.LDA_INTERNAL_AUDIT_SECRET?.trim() ||
    process.env.LDA_ADMIN_ENTRY_SECRET?.trim();

  if (!internalSecret) return;

  const auditUrl = new URL("/api/security/privileged-access-audit", request.url);
  event.waitUntil(
    fetch(auditUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-lda-internal-audit": internalSecret,
        "user-agent": request.headers.get("user-agent") ?? "",
        "x-forwarded-for": request.headers.get("x-forwarded-for") ?? "",
        "x-real-ip": request.headers.get("x-real-ip") ?? ""
      },
      body: JSON.stringify({
        action: "auth.privileged_route.blocked",
        path: request.nextUrl.pathname,
        method: request.method,
        metadata
      })
    }).catch(() => undefined)
  );
}

export async function middleware(request: NextRequest, event: NextFetchEvent) {
  if (request.headers.has("x-middleware-subrequest")) {
    return applyRuntimeSecurityHeaders(NextResponse.json({ error: "Request blocked." }, { status: 403 }), request);
  }

  if (isScannerRequest(request)) {
    return applyRuntimeSecurityHeaders(NextResponse.json({ error: "Request blocked." }, { status: 403 }), request);
  }

  const hasValidAdminEntry = await hasValidPrivilegedEntryForMiddleware({
    role: "admin",
    value: request.cookies.get(adminEntryCookieName)?.value,
    maxAgeSeconds: adminEntryMaxAgeSeconds
  });
  const hasValidTechnicalSupportEntry = await hasValidPrivilegedEntryForMiddleware({
    role: "support",
    value: request.cookies.get(technicalSupportEntryCookieName)?.value,
    maxAgeSeconds: technicalSupportEntryMaxAgeSeconds
  });
  const privilegedSessionRole = await getValidPrivilegedSessionRoleForMiddleware(
    request.cookies.get(privilegedSessionCookieName)?.value
  );
  const hasAdminSessionCookie = privilegedSessionRole === "admin";
  const hasTechnicalSupportSessionCookie = privilegedSessionRole === "admin" || privilegedSessionRole === "support";

  if (isAdminEntryGatePath(request.nextUrl.pathname) && !hasValidAdminEntry) {
    queuePrivilegedRouteAudit(event, request, { surface: "admin_login", reason: "missing_entry_cookie" });
    return applyRuntimeSecurityHeaders(NextResponse.redirect(publicFallbackUrl(request)), request);
  }

  if (isTechnicalSupportEntryGatePath(request.nextUrl.pathname) && !hasValidAdminEntry && !hasValidTechnicalSupportEntry) {
    queuePrivilegedRouteAudit(event, request, { surface: "support_login", reason: "missing_entry_cookie" });
    return applyRuntimeSecurityHeaders(NextResponse.redirect(publicFallbackUrl(request)), request);
  }

  if (requiresAdminEntry(request.nextUrl.pathname) && !hasValidAdminEntry && !hasAdminSessionCookie) {
    queuePrivilegedRouteAudit(event, request, { surface: "admin_workspace", reason: "missing_privileged_session" });
    return applyRuntimeSecurityHeaders(NextResponse.redirect(publicFallbackUrl(request)), request);
  }

  if (
    requiresTechnicalSupportEntry(request.nextUrl.pathname) &&
    !hasValidAdminEntry &&
    !hasValidTechnicalSupportEntry &&
    !hasTechnicalSupportSessionCookie
  ) {
    queuePrivilegedRouteAudit(event, request, { surface: "support_workspace", reason: "missing_privileged_session" });
    return applyRuntimeSecurityHeaders(
      NextResponse.redirect(publicFallbackUrl(request)),
      request
    );
  }

  if (isCrossSiteWrite(request)) {
    return applyRuntimeSecurityHeaders(
      NextResponse.json({ error: "Cross-site write requests are not allowed." }, { status: 403 }),
      request
    );
  }

  if (request.method === "POST" && request.nextUrl.pathname === "/technical-support-access") {
    const url = request.nextUrl.clone();
    url.pathname = "/api/auth/technical-support-sign-in";
    url.search = "";
    url.hash = "";
    return applyRuntimeSecurityHeaders(NextResponse.rewrite(url), request);
  }

  return applyRuntimeSecurityHeaders(NextResponse.next(), request);
}

export const config = {
  matcher: [
    "/api/:path*",
    "/account",
    "/account/:path*",
    "/admin",
    "/admin/:path*",
    "/admin-access",
    "/admin-access/:path*",
    "/admin-mfa",
    "/admin-preview",
    "/after-lesson-revision",
    "/auth",
    "/auth/:path*",
    "/booking-history",
    "/dashboard",
    "/director-master-key-lda-admin-9f4e7c2b6a",
    "/director-master-key-lda-admin-9f4e7c2b6a/:path*",
    "/technical-support-private-entry-cf6d99a438285f152bf5d2425b0b5a50",
    "/instructor-calendar",
    "/instructor-dashboard",
    "/instructor-finance",
    "/instructor-finance/:path*",
    "/instructor-performance",
    "/instructor-setup",
    "/instructor-setup/:path*",
    "/instructor-vehicle-compliance",
    "/instructor-verification",
    "/learner-calendar",
    "/learner-dashboard",
    "/learner-journey",
    "/learner-journey/:path*",
    "/lesson-now/confirmed",
    "/notification-hub",
    "/owner-dashboard",
    "/planned-lessons",
    "/planned-lessons/:path*",
    "/progress-tracker",
    "/pupil-management",
    "/rate-instructor",
    "/scheduled-lessons",
    "/support/instructor",
    "/support/instructor/:path*",
    "/technical-support",
    "/technical-support/:path*",
    "/technical-support-access",
    "/technical-support-mfa",
    "/tracking",
    "/.env",
    "/.env/:path*",
    "/.git",
    "/.git/:path*",
    "/wp-login.php",
    "/wp-admin",
    "/wp-admin/:path*",
    "/phpmyadmin",
    "/phpmyadmin/:path*",
    "/server-status",
    "/config.json",
    "/config.php"
  ]
};
