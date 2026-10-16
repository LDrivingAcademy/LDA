import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

const adminToken = "test-admin-launcher-token-with-at-least-256-bits-of-test-entropy-0000000000000000";
const supportToken = "test-support-launcher-token-with-at-least-256-bits-of-test-entropy-000000000000";

process.env.LDA_ADMIN_ENTRY_SECRET = Array(48).fill("q").join("");
process.env.LDA_PRIVILEGED_SESSION_SECRET = Array(48).fill("q").join("");
process.env.LDA_DIRECTOR_LAUNCH_HASH = sha256(adminToken);
process.env.LDA_TECHNICAL_SUPPORT_LAUNCH_TOKEN_HASH = sha256(supportToken);
process.env.LDA_TECHNICAL_SUPPORT_ENTRY_SECRET = Array(48).fill("q").join("");

const adminEntry = await import("../src/lib/admin-entry");
const supportEntry = await import("../src/lib/technical-support-entry");
const privilegedSession = await import("../src/lib/privileged-session-cookie");

assert.equal(adminEntry.hasValidAdminLaunchToken(adminToken), true);
assert.equal(adminEntry.hasValidAdminLaunchToken(`${adminToken}-bad`), false);
assert.equal(supportEntry.hasValidTechnicalSupportLaunchToken(supportToken), true);
assert.equal(supportEntry.hasValidTechnicalSupportLaunchToken(`${supportToken}-bad`), false);

const adminEntryCookie = adminEntry.createAdminEntryCookieValue();
const supportEntryCookie = supportEntry.createTechnicalSupportEntryCookieValue();
const adminSessionCookie = privilegedSession.createPrivilegedSessionCookieValue("admin");
const supportSessionCookie = privilegedSession.createPrivilegedSessionCookieValue("support");

assert.ok(adminEntryCookie);
assert.ok(supportEntryCookie);
assert.ok(adminSessionCookie);
assert.ok(supportSessionCookie);
assert.equal(adminEntry.hasValidAdminEntry(adminEntryCookie ?? undefined), true);
assert.equal(supportEntry.hasValidTechnicalSupportEntry(supportEntryCookie ?? undefined), true);
assert.equal(privilegedSession.getValidPrivilegedSessionRole(adminSessionCookie ?? undefined), "admin");
assert.equal(privilegedSession.getValidPrivilegedSessionRole(supportSessionCookie ?? undefined), "support");
assert.equal(privilegedSession.getValidPrivilegedSessionRole(`${supportSessionCookie}tampered`), null);

const middleware = read("src/middleware.ts");
const edgeVerifier = read("src/lib/privileged-entry-middleware.ts");
const adminLauncherRoute = read("src/app/director-master-key-lda-admin-9f4e7c2b6a/route.ts");
const privateAdminAccessPage = read("src/app/director-master-key-lda-admin-9f4e7c2b6a/access/page.tsx");
const supportLauncherRoute = read("src/app/technical-support-private-entry-cf6d99a438285f152bf5d2425b0b5a50/route.ts");
const privilegedAuditRoute = read("src/app/api/security/privileged-access-audit/route.ts");
const signOutRoute = read("src/app/api/auth/sign-out/route.ts");
const secureSignOut = read("src/lib/secure-sign-out.ts");
const authSessions = read("src/lib/auth-sessions.ts");
const adminDashboard = read("src/lib/admin-dashboard.ts");
const supportAccess = read("src/lib/technical-support-access.ts");
const refreshRoute = read("src/app/api/admin/session/refresh/route.ts");
const robots = read("src/app/robots.ts");
const sitemap = read("src/app/sitemap.ts");
const prefetcher = read("src/components/route-prefetcher.tsx");
const analyticsClient = read("src/components/site-analytics-tracker.tsx");
const analyticsRoute = read("src/app/api/analytics/track/route.ts");
const usbUpdater = read("scripts/update-usb-master-key.ps1");

assert.match(middleware, /export async function middleware\(request: NextRequest, event: NextFetchEvent\)/);
assert.match(middleware, /getValidPrivilegedSessionRoleForMiddleware/);
assert.match(middleware, /isAdminEntryGatePath\(request\.nextUrl\.pathname\) && !hasValidAdminEntry/);
assert.match(middleware, /isTechnicalSupportEntryGatePath\(request\.nextUrl\.pathname\)/);
assert.match(middleware, /requiresAdminEntry\(request\.nextUrl\.pathname\)[\s\S]*!hasAdminSessionCookie/);
assert.match(middleware, /requiresTechnicalSupportEntry\(request\.nextUrl\.pathname\)[\s\S]*!hasTechnicalSupportSessionCookie/);
assert.match(middleware, /url\.pathname = "\/"/);
assert.match(middleware, /queuePrivilegedRouteAudit/);
assert.match(middleware, /request\.nextUrl\.pathname/);
assert.doesNotMatch(middleware, /request\.nextUrl\.search/);
assert.doesNotMatch(middleware, /startsWith\("sb-"\)/);

assert.match(edgeVerifier, /privileged-session:\$\{encodedPayload\}/);
assert.match(edgeVerifier, /payload\.role === "admin" \|\| payload\.role === "support"/);
assert.match(edgeVerifier, /60 \* 60 \* 8/);

assert.match(adminLauncherRoute, /hasValidAdminLaunchToken\(request\.nextUrl\.searchParams\.get\("key"\)\)/);
assert.match(adminLauncherRoute, /recordAuthAudit/);
assert.match(adminLauncherRoute, /auth\.privileged_launcher/);
assert.match(adminLauncherRoute, /NextResponse\.redirect\(new URL\("\/director-master-key-lda-admin-9f4e7c2b6a\/access"/);
assert.doesNotMatch(adminLauncherRoute, /NextResponse\.redirect\(new URL\("\/admin-access"/);
assert.match(adminLauncherRoute, /applyAdminSecurityHeaders/);
assert.doesNotMatch(adminLauncherRoute, /console\.(?:warn|error|log)\([^)]*searchParams\.get\("key"\)/s);
assert.match(privateAdminAccessPage, /hasValidAdminEntry/);
assert.match(privateAdminAccessPage, /redirect\("\/"\)/);
assert.match(privateAdminAccessPage, /AdminAccessPanel/);
assert.match(privateAdminAccessPage, /topBarHref="\/director-master-key-lda-admin-9f4e7c2b6a\/access"/);

assert.match(supportLauncherRoute, /hasValidTechnicalSupportLaunchToken\(request\.nextUrl\.searchParams\.get\("key"\)\)/);
assert.match(supportLauncherRoute, /recordAuthAudit/);
assert.match(supportLauncherRoute, /auth\.privileged_launcher/);
assert.match(supportLauncherRoute, /NextResponse\.redirect\(new URL\("\/technical-support-access"/);
assert.match(supportLauncherRoute, /applyAdminSecurityHeaders/);
assert.doesNotMatch(supportLauncherRoute, /console\.(?:warn|error|log)\([^)]*searchParams\.get\("key"\)/s);

assert.match(privilegedAuditRoute, /x-lda-internal-audit/);
assert.match(privilegedAuditRoute, /return applyAdminSecurityHeaders\(new NextResponse\(null, \{ status: 404 \}\)\)/);
assert.match(privilegedAuditRoute, /safePath/);
assert.match(privilegedAuditRoute, /recordAuthAudit/);
assert.doesNotMatch(privilegedAuditRoute, /searchParams/);

assert.match(authSessions, /privilegedSessionCookieName/);
assert.match(authSessions, /createPrivilegedSessionCookieValue\(role\)/);
assert.match(authSessions, /role === "admin" \|\| role === "support"/);
assert.match(authSessions, /cookieStore\.set\(privilegedSessionCookieName/);

assert.match(secureSignOut, /privilegedSessionCookieName/);
assert.match(secureSignOut, /lowerName\.startsWith\("lda_privileged"\)/);
assert.match(signOutRoute, /adminSignedOutAccessPath/);
assert.match(signOutRoute, /technicalSupportSignedOutAccessPath/);
assert.match(signOutRoute, /applyPrivilegedReentryCookie/);

assert.match(adminDashboard, /getValidPrivilegedSessionRole/);
assert.match(adminDashboard, /privilegedSessionRole !== "admin"/);
assert.match(adminDashboard, /redirect\("\/"\)/);
assert.match(supportAccess, /getValidPrivilegedSessionRole/);
assert.match(supportAccess, /privilegedSessionRole !== "admin" && privilegedSessionRole !== "support"/);
assert.match(refreshRoute, /getValidPrivilegedSessionRole/);
assert.match(refreshRoute, /privilegedSessionRole === "admin"/);
assert.match(refreshRoute, /privilegedSessionRole === "support"/);

assert.doesNotMatch(robots, /\/admin/);
assert.doesNotMatch(robots, /\/admin-access/);
assert.doesNotMatch(robots, /\/admin-mfa/);
assert.doesNotMatch(robots, /\/owner-dashboard/);
assert.doesNotMatch(robots, /\/technical-support/);
assert.doesNotMatch(robots, /\/technical-support-access/);
assert.doesNotMatch(robots, /\/technical-support-mfa/);
assert.doesNotMatch(robots, /director-master-key-lda-admin/);
assert.doesNotMatch(robots, /technical-support-private-entry/);
assert.doesNotMatch(sitemap, /admin/);
assert.doesNotMatch(sitemap, /technical-support/);
assert.doesNotMatch(prefetcher, /routeWarmGroups\.admin/);
assert.doesNotMatch(analyticsClient, /director-master-key-lda-admin-9f4e7c2b6a/);
assert.doesNotMatch(analyticsClient, /technical-support-private-entry-cf6d99a438285f152bf5d2425b0b5a50/);
assert.match(analyticsClient, /firstSegment\.startsWith\(directorPrefix\)/);
assert.match(analyticsRoute, /technical-support-private-entry-cf6d99a438285f152bf5d2425b0b5a50/);

assert.match(usbUpdater, /LDA_TECHNICAL_SUPPORT_LAUNCH_TOKEN/);
assert.match(usbUpdater, /LDA_ADMIN_LAUNCH_TOKEN/);
assert.match(usbUpdater, /Open LDA Admin\.url/);
assert.match(usbUpdater, /technical-support-private-entry-cf6d99a438285f152bf5d2425b0b5a50/);

console.log("Privileged access hardening checks passed.");
