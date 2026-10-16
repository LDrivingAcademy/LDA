import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const supportHeader = read("src/components/technical-support-page-header.tsx");
const adminHeader = read("src/components/admin-page-header.tsx");
const supportDashboard = read("src/app/technical-support/page.tsx");
const supportQueue = read("src/app/technical-support/feedback/page.tsx");
const supportIncidents = read("src/app/technical-support/incidents/page.tsx");
const supportHealth = read("src/app/technical-support/health/page.tsx");
const supportCookieConsent = read("src/app/technical-support/cookie-consent/page.tsx");
const supportTopBar = read("src/components/technical-support-top-bar.tsx");
const adminEscalations = read("src/app/admin/support-escalations/page.tsx");
const legacyAdminFeedback = read("src/app/admin/feedback/page.tsx");
const adminGuard = read("src/lib/admin-dashboard.ts");
const supportGuard = read("src/lib/technical-support-access.ts");
const middleware = read("src/middleware.ts");

const supportPages = [
  supportDashboard,
  supportQueue,
  supportIncidents,
  supportHealth,
  supportCookieConsent
].join("\n");

assert.match(
  supportHeader,
  /showAdminBack \? <AdminBackToDashboardLink \/> : null/,
  "Support page header must render the admin back button only when explicitly allowed."
);
assert.match(
  adminHeader,
  /fallbackHref="\/admin"[\s\S]*fallbackLabel="Back to admin dashboard"/,
  "Support admin back button must reuse the black admin back link to /admin."
);
assert.match(
  supportHeader,
  /AdminBackToDashboardLink/,
  "Support page header must reuse the shared admin back link component."
);
assert.match(
  supportDashboard,
  /title="Technical Support Operations Centre"/,
  "Technical support dashboard must use the requested full title."
);
assert.match(
  supportDashboard,
  /showAdminBack=\{accessRole === "admin"\}/,
  "Technical support dashboard must show admin back navigation only for real admin access."
);
assert.match(
  supportQueue,
  /showAdminBack=\{accessRole === "admin"\}/,
  "Support queue must use server-confirmed role-aware admin back navigation."
);
assert.match(
  supportIncidents,
  /showAdminBack=\{accessRole === "admin"\}/,
  "Incident queue must use server-confirmed role-aware admin back navigation."
);
assert.match(
  supportHealth,
  /showAdminBack=\{accessRole === "admin"\}/,
  "Website health must use server-confirmed role-aware admin back navigation."
);
assert.match(
  supportCookieConsent,
  /showAdminBack=\{accessRole === "admin"\}/,
  "Cookie consent operations must use server-confirmed role-aware admin back navigation."
);
assert.doesNotMatch(
  supportPages,
  /from=admin|searchParams\.from|resolvedSearchParams\.from/,
  "Support pages must not reveal admin navigation from a query-string hint."
);

assert.match(
  supportTopBar,
  /canAccessAdmin \? \([\s\S]*href="\/admin"/,
  "Only users already confirmed as admin may see the support topbar admin link."
);
assert.doesNotMatch(
  supportTopBar,
  /href="\/owner-dashboard"/,
  "Technical support navigation must not link to owner/admin-only dashboard pages."
);

assert.match(
  adminEscalations,
  /requireAdminDashboardClient/,
  "Technical Support Escalations is an admin decision page and must require admin access."
);
assert.match(
  adminEscalations,
  /<AdminPageHeader/,
  "Technical Support Escalations must use the shared admin header with the black back button."
);
assert.match(
  legacyAdminFeedback,
  /requireAdminDashboardClient/,
  "Legacy /admin/feedback must not be usable by support users."
);
assert.doesNotMatch(
  legacyAdminFeedback,
  /requireTechnicalSupportClient/,
  "Legacy /admin/feedback must not rely on the support guard."
);

assert.match(
  adminGuard,
  /hasApprovedAdminRole/,
  "Admin routes must validate the approved admin role server-side."
);
assert.match(
  adminGuard,
  /privilegedSessionRole !== "admin"/,
  "Admin routes must not accept support privileged sessions."
);
assert.match(
  supportGuard,
  /accessRole: "admin" \| "support" \| null/,
  "Support routes must distinguish admin-supervised access from support-user access."
);
assert.match(
  supportGuard,
  /hasApprovedAdminRole\(supabase, user\)/,
  "Support routes must verify real admin role before admin-supervised access."
);
assert.match(
  supportGuard,
  /hasApprovedTechnicalSupportRole\(supabase, user\)/,
  "Support routes must verify real technical support role before support access."
);
assert.match(
  middleware,
  /requiresAdminEntry\(request\.nextUrl\.pathname\) && !hasValidAdminEntry && !hasAdminSessionCookie/,
  "Middleware must keep admin routes hidden without an admin entry or admin session."
);
assert.match(
  middleware,
  /const hasAdminSessionCookie = privilegedSessionRole === "admin";/,
  "Middleware must not treat support sessions as admin sessions."
);

console.log("Admin support preview access checks passed.");
