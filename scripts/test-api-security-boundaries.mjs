import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function assertIncludes(source, needle, message) {
  assert(source.includes(needle), message);
}

function assertMatches(source, pattern, message) {
  assert.match(source, pattern, message);
}

const middleware = read("src/middleware.ts");
const security = read("src/lib/security.ts");
const supabaseAdmin = read("src/lib/supabase/admin.ts");
const supabaseServer = read("src/lib/supabase/server.ts");
const supportRouter = read("src/app/support/page.tsx");
const stripeWebhook = read("src/app/api/webhooks/stripe/route.ts");
const privilegedAudit = read("src/app/api/security/privileged-access-audit/route.ts");
const analyticsTracker = read("src/app/api/analytics/track/route.ts");
const signOutRoute = read("src/app/api/auth/sign-out/route.ts");
const allowedSignedOutRedirectBlock =
  signOutRoute.match(/const allowedSignedOutRedirects = new Set\(\[[\s\S]*?\]\);/)?.[0] ?? "";

assertIncludes(middleware, 'const writeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"])', "Middleware must define all state-changing HTTP verbs as write methods.");
assertIncludes(middleware, '"/api/webhooks/stripe"', "Stripe webhooks must be the only payment write route allowed to bypass browser-origin CSRF checks.");
assertIncludes(middleware, '"/api/cron/site-health"', "Cron site-health writes must remain an explicit CSRF bypass path.");
assertIncludes(middleware, '"/api/cron/account-deletions"', "Cron account-deletion writes must remain an explicit CSRF bypass path.");
assertMatches(middleware, /origin && !isTrustedOrigin\(origin, request\)[\s\S]*return true/, "Middleware must reject writes from untrusted Origin headers.");
assertMatches(middleware, /return fetchSite === "cross-site"/, "Middleware must reject browser cross-site write requests even when Origin is omitted.");
assertMatches(middleware, /NextResponse\.json\(\{ error: "Cross-site write requests are not allowed\." \}, \{ status: 403 \}\)/, "Cross-site writes must fail closed with HTTP 403.");
assertMatches(middleware, /matcher:\s*\[[\s\S]*"\/api\/:path\*"/, "Middleware CSRF guard must run across API routes.");
assert.doesNotMatch(middleware, /\/api\/bookings|\/api\/instant-lessons|\/api\/instructor-location|\/api\/instructor-availability|\/api\/auth\/sign-out/, "User-facing booking, instructor, auth, and live-location APIs must not be added to the cross-origin write bypass list.");

assertIncludes(security, "Content-Security-Policy", "Runtime security headers must include CSP.");
assertIncludes(security, "frame-ancestors 'none'", "Runtime CSP must block framing.");
assertIncludes(security, "form-action 'self'", "Runtime CSP must limit form posts to the app origin.");
assertIncludes(security, "Strict-Transport-Security", "Runtime security headers must enforce HSTS.");
assertIncludes(security, "X-Robots-Tag", "Privileged/noindex security helpers must apply X-Robots-Tag.");
assertIncludes(security, "hasTrustedPostOrigin", "Handler-level CSRF helper must remain available for especially sensitive routes.");

assertIncludes(supabaseAdmin, 'getRuntimeEnvValue("SUPABASE_SERVICE_ROLE_KEY").value', "Supabase service-role key must be read only from server runtime env.");
assert.doesNotMatch(supabaseAdmin, /NEXT_PUBLIC_[A-Z0-9_]*SERVICE_ROLE/, "Service-role keys must never use NEXT_PUBLIC env names.");
assertIncludes(supabaseAdmin, "persistSession: false", "Supabase admin client must not persist service-role sessions.");
assertIncludes(supabaseAdmin, "autoRefreshToken: false", "Supabase admin client must not refresh service-role sessions.");
assertIncludes(supabaseServer, "supabasePublishableKey", "Browser/session Supabase client must use the publishable/anon key, not the service-role key.");
assert.doesNotMatch(supabaseServer, /SERVICE_ROLE/, "Server session client must not load the Supabase service-role key.");

assert.doesNotMatch(supportRouter, /redirect\("\/technical-support"\)/, "Public-looking /support router must not directly reveal the Technical Operations Centre URL.");
assertIncludes(supportRouter, "redirect(account.dashboardHref)", "Privileged /support routing must use the already validated account dashboard href.");

assertIncludes(stripeWebhook, 'request.headers.get("stripe-signature")', "Stripe webhook must verify the Stripe-Signature header.");
assertIncludes(stripeWebhook, 'createHmac("sha256"', "Stripe webhook must compute an HMAC over the raw payload.");
assertIncludes(stripeWebhook, "timingSafeEqual", "Stripe webhook signature comparison must be timing-safe.");
assertMatches(stripeWebhook, /ageSeconds > 300/, "Stripe webhook signatures must expire after a short replay window.");
assertIncludes(stripeWebhook, "const payload = await request.text()", "Stripe webhook must verify the raw request body, not parsed JSON.");
assert.doesNotMatch(stripeWebhook, /readJsonBody|request\.json\(\)/, "Stripe webhook must not parse JSON before signature verification.");
assert.doesNotMatch(stripeWebhook, /payment_method_types/, "Stripe checkout/webhook code must not hard-code payment_method_types.");

assertIncludes(privilegedAudit, 'return "/privileged-launcher/admin"', "Privileged audit must normalise admin launcher paths before logging.");
assertIncludes(privilegedAudit, 'return "/privileged-launcher/support"', "Privileged audit must normalise technical support launcher paths before logging.");
assert.doesNotMatch(privilegedAudit, /searchParams/, "Privileged audit must not persist raw launcher query strings or tokens.");

assertIncludes(analyticsTracker, "isPrivatePath(path)", "Analytics tracker must ignore private paths.");
assertIncludes(analyticsTracker, '"/technical-support-private-entry-cf6d99a438285f152bf5d2425b0b5a50"', "Analytics private path list must include the support launcher.");
assertIncludes(analyticsTracker, '"/director-master-key-lda-admin-9f4e7c2b6a"', "Analytics private path list must include the admin launcher.");

assertIncludes(signOutRoute, "adminSignedOutAccessPath", "Admin sign-out must return to the admin sign-in flow.");
assertIncludes(signOutRoute, "technicalSupportSignedOutAccessPath", "TOC sign-out must return to the TOC sign-in flow.");
assertIncludes(signOutRoute, "signedOutRedirectFromReferer", "Sign-out must infer privileged return targets from the current workspace.");
assert.doesNotMatch(allowedSignedOutRedirectBlock, /"\/technical-support"/, "Signed-out redirects must not return directly into protected TOC workspace pages.");
assert.doesNotMatch(allowedSignedOutRedirectBlock, /"\/admin"/, "Signed-out redirects must not return directly into protected admin workspace pages.");

console.log("API security boundary checks passed.");
