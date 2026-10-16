import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function normaliseHref(href) {
  const url = new URL(href, "https://ldrivingacademy.co.uk");
  return `${url.pathname}${url.search}${url.hash}`;
}

const privilegedNeedles = [
  "/admin",
  "/admin-access",
  "/admin-mfa",
  "/admin-preview",
  "/owner-dashboard",
  "/technical-support",
  "/technical-support-access",
  "/technical-support-mfa",
  "director-master-key-lda-admin",
  "technical-support-private-entry"
];

const publicDiscoveryFiles = [
  "src/app/robots.ts",
  "src/app/sitemap.ts",
  "src/app/sitemap/page.tsx",
  "src/app/support/page.tsx",
  "src/components/route-prefetcher.tsx",
  "src/components/navigation-history.ts",
  "src/components/main-menu.tsx",
  "src/components/home-account-controls.tsx",
  "src/components/home-suggestion-grid.tsx",
  "src/components/logout-state-sync.tsx",
  "src/components/terms-acceptance-global-banner-client.tsx",
  "src/components/cookie-consent.tsx",
  "src/components/site-analytics-tracker.tsx",
  "src/components/homepage-ai-assistant.tsx",
  "src/components/technical-error-page.tsx"
];

for (const file of publicDiscoveryFiles) {
  const source = read(file);
  for (const needle of privilegedNeedles) {
    assert(
      !source.includes(needle),
      `${file} must not expose privileged route literal ${needle} to public discovery surfaces.`
    );
  }
}

const currentAccount = read("src/lib/current-account.ts");
assert.match(
  currentAccount,
  /roleNames\.includes\("admin"\) && isDirectorAdminEmail\(user\.email\)/,
  "Admin homepage/menu links must be created only after server-side admin role validation."
);
assert.match(
  currentAccount,
  /privilegedMenuLinks:\s*\[/,
  "Admin-only homepage menu links must live behind the authenticated account-summary response."
);
assert.match(
  currentAccount,
  /const isSupport = roleNames\.includes\("support"\)/,
  "Technical support accounts must be detected explicitly instead of falling through as learner accounts."
);
assert.match(
  currentAccount,
  /role: "support"/,
  "Authenticated support account summaries must preserve the support role for menu and sign-out routing."
);

const mainMenu = read("src/components/main-menu.tsx");
assert.match(
  mainMenu,
  /resolvedAccount\.role === "support"\s*\?\s*"Technical Operations Centre"/,
  "Shared account menus must label support dashboard access as Technical Operations Centre."
);
assert.doesNotMatch(
  mainMenu,
  /resolvedAccount\.role === "support"[\s\S]{0,600}Admin dashboard/,
  "Support account menus must not expose admin dashboard links."
);

const backLink = read("src/lib/page-back-link.ts");
assert.match(
  backLink,
  /const fromAdmin = Boolean\(options\.allowAdminSource && source === "admin"\)/,
  "from=admin must be ignored unless the page has already confirmed admin access server-side."
);

const fromAdminPages = {
  "src/app/booking-history/page.tsx": /allowAdminSource:\s*await isSignedInAdmin\(\)/,
  "src/app/rate-instructor/page.tsx": /allowAdminSource:\s*await isSignedInAdmin\(\)/,
  "src/app/learner-calendar/page.tsx": /allowAdminSource:\s*await isSignedInAdmin\(\)/,
  "src/app/instructor-finance/page.tsx": /allowAdminSource:\s*await isSignedInAdmin\(\)/,
  "src/app/support/learner/page.tsx": /allowAdminSource:\s*account\.role === "admin"/,
  "src/app/instructor-verification/page.tsx": /allowAdminSource:\s*isAdmin/
};

for (const [file, pattern] of Object.entries(fromAdminPages)) {
  assert.match(read(file), pattern, `${file} must not trust ?from=admin without server-side role validation.`);
}

const supportPages = [
  "src/app/technical-support/page.tsx",
  "src/app/technical-support/feedback/page.tsx",
  "src/app/technical-support/incidents/page.tsx",
  "src/app/technical-support/health/page.tsx",
  "src/app/technical-support/cookie-consent/page.tsx"
].map(read).join("\n");

assert.doesNotMatch(
  supportPages,
  /from=admin|searchParams\.from|resolvedSearchParams\.from/,
  "TOC pages must not reveal admin navigation from query-string spoofing."
);
assert.match(
  supportPages,
  /showAdminBack=\{accessRole === "admin"\}/,
  "Admin-only TOC back navigation must be gated by server-confirmed admin access."
);

const supportTopBar = read("src/components/technical-support-top-bar.tsx");
assert.match(
  supportTopBar,
  /canAccessAdmin \? \([\s\S]*href="\/admin"/,
  "Admin link in TOC must render only for verified admin access."
);
assert.doesNotMatch(
  supportTopBar,
  /owner-dashboard|admin-mfa|admin-preview/,
  "TOC top bar must not expose owner dashboard, admin MFA, or admin preview links."
);

const adminGuard = read("src/lib/admin-dashboard.ts");
assert.match(adminGuard, /hasApprovedAdminRole/, "Admin routes must validate the approved admin role server-side.");
assert.match(adminGuard, /privilegedSessionRole !== "admin"/, "Support privileged sessions must not count as admin sessions.");

const supportGuard = read("src/lib/technical-support-access.ts");
assert.match(supportGuard, /accessRole: "admin" \| "support" \| null/, "TOC guard must preserve admin/support separation.");
assert.match(supportGuard, /hasApprovedAdminRole\(supabase, user\)/, "Admin-supervised TOC access must verify the admin role server-side.");
assert.match(supportGuard, /hasApprovedTechnicalSupportRole\(supabase, user\)/, "Support TOC access must verify the support role server-side.");

const policy = JSON.parse(read("src/lib/chat-permission-policy.json"));
const publicLikeRoles = ["visitor", "learner", "instructor", "in_progress", "support"];
const privilegedRoutePattern = /^\/(?:admin|admin-access|admin-mfa|admin-preview|owner-dashboard|technical-support|technical-support-access|technical-support-mfa)(?:\/|\?|#|$)/;

for (const route of policy.routes ?? []) {
  const href = normaliseHref(route.href);
  if (privilegedRoutePattern.test(href)) {
    for (const role of publicLikeRoles) {
      assert(
        !route.allowedRoles.includes(role),
        `AI route ${route.id} must not expose ${href} to ${role}.`
      );
    }
  }
}

const presentationPolicy = read("src/lib/presentation-policy.ts");
assert.match(presentationPolicy, /const internalAudiences = new Set<PresentationAudience>\(\["admin", "system"\]\)/);
assert.match(presentationPolicy, /owner-dashboard/);
assert.match(presentationPolicy, /technical-support-mfa/);
assert.match(presentationPolicy, /director-master-key/);
assert.match(presentationPolicy, /private-entry/);

const privilegedAudit = read("src/app/api/security/privileged-access-audit/route.ts");
assert.match(privilegedAudit, /return "\/privileged-launcher\/admin"/);
assert.match(privilegedAudit, /return "\/privileged-launcher\/support"/);
assert.doesNotMatch(privilegedAudit, /searchParams/);

console.log("Privileged navigation exposure checks passed.");
