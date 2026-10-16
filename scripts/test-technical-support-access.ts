import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createTechnicalSupportEntryCookieValue,
  hasValidTechnicalSupportEntry
} from "../src/lib/technical-support-entry";
import { isTechnicalSupportEmail } from "../src/lib/technical-support-access";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

process.env.LDA_TECHNICAL_SUPPORT_ENTRY_SECRET = Array(48).fill("q").join("");
process.env.LDA_TECHNICAL_SUPPORT_EMAILS =
  "support.one@ldrivingacademy.co.uk, Support.Two@ldrivingacademy.co.uk ";

const token = createTechnicalSupportEntryCookieValue();
assert.ok(token, "A configured support entry secret should issue a token.");
assert.equal(hasValidTechnicalSupportEntry(token), true, "A new signed token should validate.");
assert.equal(
  hasValidTechnicalSupportEntry(`${token}tampered`),
  false,
  "A modified signature must not validate."
);
assert.equal(
  hasValidTechnicalSupportEntry("not-a-token"),
  false,
  "Malformed values must not validate."
);

assert.equal(
  isTechnicalSupportEmail("SUPPORT.ONE@ldrivingacademy.co.uk"),
  true,
  "Support email matching should be case-insensitive."
);
assert.equal(
  isTechnicalSupportEmail("support.two@ldrivingacademy.co.uk"),
  true,
  "Configured support emails should be trimmed."
);
assert.equal(
  isTechnicalSupportEmail("learner@example.com"),
  false,
  "Unapproved email addresses must be rejected."
);

const supportMfaActions = read("src/app/technical-support-mfa/actions.ts");
const supportSignInRoute = read("src/app/api/auth/technical-support-sign-in/route.ts");
const signOutRoute = read("src/app/api/auth/sign-out/route.ts");
const supportDashboardPage = read("src/app/technical-support/page.tsx");
const supportAccessHelper = read("src/lib/technical-support-access.ts");
const supportAccessPage = read("src/app/technical-support-access/page.tsx");
const supportMfaPage = read("src/app/technical-support-mfa/page.tsx");
const middlewareSource = read("src/middleware.ts");
const cookieConsent = read("src/components/cookie-consent.tsx");
const supportActions = read("src/app/technical-support/actions.ts");
const supportQueuePage = read("src/app/technical-support/feedback/page.tsx");
const supportIncidentsPage = read("src/app/technical-support/incidents/page.tsx");
const supportHealthPage = read("src/app/technical-support/health/page.tsx");
const supportTopBar = read("src/components/technical-support-top-bar.tsx");
const supportHandoverBrief = read("src/components/technical-support-handover-brief.tsx");
const privilegedAutoSignOut = read("src/components/admin-session-auto-sign-out.tsx");
const supportOperatingModel = read("src/components/technical-support-operating-model.tsx");
const supportEscalationMatrix = read("src/components/technical-support-escalation-matrix.tsx");
const supportPageSelector = read("src/components/technical-support-page-selector.tsx");
const technicalSupportSurfaces = [
  supportDashboardPage,
  supportQueuePage,
  supportIncidentsPage,
  supportHealthPage,
  supportTopBar,
  supportHandoverBrief,
  supportOperatingModel,
  supportEscalationMatrix,
  supportPageSelector
].join("\n");

assert.match(supportMfaActions, /issueLdaAuthSession/);
assert.match(supportMfaActions, /role:\s*"support"/);
assert.match(supportMfaActions, /rememberMe:\s*false/);
assert.match(supportMfaActions, /Secure support session could not be created/);
assert.match(supportAccessPage, /action="\/api\/auth\/technical-support-sign-in"/);
assert.match(supportAccessPage, /method="post"/);
assert.doesNotMatch(supportAccessPage, /action=\{signIn\}/);
assert.match(supportSignInRoute, /signInWithPassword/);
assert.match(supportSignInRoute, /isTechnicalSupportEmail/);
assert.match(supportSignInRoute, /ensureTechnicalSupportRole/);
assert.match(supportSignInRoute, /issueLdaAuthSession/);
assert.match(supportSignInRoute, /role:\s*"support"/);
assert.match(supportSignInRoute, /rememberMe:\s*false/);
assert.match(supportSignInRoute, /technicalSupportEntryCookieName/);
assert.match(supportSignInRoute, /privilegedFailedLoginMessage/);
assert.doesNotMatch(supportSignInRoute, /Technical support login failed/);
assert.match(middlewareSource, /request\.method === "POST" && request\.nextUrl\.pathname === "\/technical-support-access"/);
assert.match(middlewareSource, /\/api\/auth\/technical-support-sign-in/);

assert.match(supportDashboardPage, /async function safeSupportQuery/);
assert.match(supportDashboardPage, /safeSupportQuery<TicketRow>/);
assert.match(supportDashboardPage, /safeSupportQuery<HealthRow>/);
assert.match(supportDashboardPage, /dashboard query failed/);
assert.match(supportAccessHelper, /readOnly:\s*true/);
assert.doesNotMatch(supportAccessHelper, /Technical support access expired[\s\S]{0,180}supabase\.auth\.signOut/);
assert.match(cookieConsent, /cookieConsentAllowedOnPath/);
assert.match(cookieConsent, /\["technical", "support"\]\.join\("-"\)/);
assert.match(cookieConsent, /firstSegment\.startsWith\("admin"\)/);
assert.doesNotMatch(cookieConsent, /technical-support-access/);
assert.doesNotMatch(cookieConsent, /technical-support-mfa/);
assert.doesNotMatch(cookieConsent, /admin-access/);
assert.match(supportAccessPage, /This secure workspace is for approved LDA technical support personnel/);
assert.match(supportAccessPage, /Access is limited to technical support duties/);
assert.doesNotMatch(supportAccessPage, /consent reporting, and website health workspace/);
assert.doesNotMatch(supportAccessPage, /Back to website/);
assert.doesNotMatch(supportAccessPage, /href="\/"/);
assert.match(supportAccessPage, /Secure technical access/);
assert.match(supportAccessPage, /href="\/technical-support-access"/);
assert.doesNotMatch(supportMfaPage, /href="\/"/);
assert.match(supportMfaPage, /href="\/technical-support-access"/);
assert.match(signOutRoute, /function wantsHtmlRedirect/);
assert.match(signOutRoute, /allowedSignedOutRedirects/);
assert.match(signOutRoute, /requestedSignedOutRedirect/);
assert.match(signOutRoute, /form\?\.get\("returnTo"\)/);
assert.match(signOutRoute, /signedOutRedirectFromReferer/);
assert.match(signOutRoute, /referer\.pathname\.startsWith\("\/technical-support"\)/);
assert.match(signOutRoute, /technicalSupportSignedOutAccessPath/);
assert.match(signOutRoute, /applyPrivilegedReentryCookie/);
assert.match(signOutRoute, /sec-fetch-mode/);
assert.match(signOutRoute, /accept\.includes\("text\/html"\)/);
assert.match(signOutRoute, /NextResponse\.redirect\(new URL\(redirectTo, request\.url\)/);
assert.match(supportDashboardPage, /bg-emerald-200 text-black/);
assert.match(supportDashboardPage, /bg-amber-200 text-black/);
assert.match(supportDashboardPage, /bg-red-200 text-black/);
assert.ok(
  supportDashboardPage.indexOf('label: "AI resolution rate"') <
    supportDashboardPage.indexOf('label: "Avg resolution"') &&
    supportDashboardPage.indexOf('label: "Avg resolution"') <
      supportDashboardPage.indexOf('label: "Last deployment"'),
  "Operations KPI strip should keep live status cards together before static summary cards."
);
assert.match(supportDashboardPage, /Support team command workflow/);
assert.doesNotMatch(supportDashboardPage, /TechnicalSupportEscalationMatrix/);
assert.match(supportDashboardPage, /Incoming work/);
assert.match(supportDashboardPage, /What needs attention now/);
assert.match(supportDashboardPage, /Newest incident/);
assert.match(supportDashboardPage, /Newest support ticket/);
assert.match(supportDashboardPage, /Newest feedback/);
assert.match(supportDashboardPage, /function IncomingWorkCard/);
assert.match(supportDashboardPage, /Shift handover/);
assert.match(supportDashboardPage, /TechnicalSupportHandoverBrief/);
assert.match(supportDashboardPage, /support_shift_handover_acknowledgements/);
assert.match(supportDashboardPage, /Major outages/);
assert.match(supportDashboardPage, /Priority work/);
assert.match(supportDashboardPage, /Before signing off/);
assert.match(supportDashboardPage, /Run live health check/);
assert.match(supportDashboardPage, /WebkitTextFillColor:\s*"#ffffff"/);
assert.match(supportHandoverBrief, /"use client"/);
assert.match(supportHandoverBrief, /Handover brief/);
assert.match(supportHandoverBrief, /initiallyOpen/);
assert.match(supportHandoverBrief, /requiresAcknowledgement/);
assert.match(supportHandoverBrief, /setOpen\(true\)/);
assert.match(supportHandoverBrief, /acknowledgeShiftHandover/);
assert.match(supportHandoverBrief, /aria-modal="true"/);
assert.match(supportHandoverBrief, /role="dialog"/);
assert.match(supportHandoverBrief, /OK, I have read the handover/);
assert.match(supportHandoverBrief, /OK, close brief/);
assert.match(supportQueuePage, /Ownership rule/);
assert.match(supportQueuePage, /TechnicalSupportOperatingModel/);
assert.match(supportQueuePage, /TechnicalSupportEscalationMatrix/);
assert.match(supportQueuePage, /TechnicalSupportPageSelector/);
assert.match(supportQueuePage, /const queuePageSize = 5/);
assert.match(supportQueuePage, /visibleTickets\.map/);
assert.match(supportQueuePage, /visibleFeedback\.map/);
assert.match(supportQueuePage, /Update route/);
assert.match(supportQueuePage, /Customer update/);
assert.match(supportQueuePage, /Closure check/);
assert.match(supportQueuePage, /resolved_by_name/);
assert.match(supportQueuePage, /Resolved sign-off/);
assert.match(supportIncidentsPage, /Update investigation notes/);
assert.match(supportIncidentsPage, /TechnicalSupportOperatingModel/);
assert.match(supportIncidentsPage, /TechnicalSupportEscalationMatrix/);
assert.match(supportIncidentsPage, /TechnicalSupportPageSelector/);
assert.match(supportIncidentsPage, /const incidentPageSize = 5/);
assert.match(supportIncidentsPage, /visibleIncidents\.map/);
assert.match(supportIncidentsPage, /Post-incident review/);
assert.match(supportIncidentsPage, /resolved_by_name/);
assert.match(supportHealthPage, /Escalation threshold/);
assert.match(supportHealthPage, /TechnicalSupportEscalationMatrix/);
assert.match(supportActions, /updateSupportTicketOwner/);
assert.match(supportActions, /updateSupportTicketRouting/);
assert.match(supportActions, /saveIncidentInvestigationPlan/);
assert.match(supportActions, /acknowledgeShiftHandover/);
assert.match(supportActions, /supportActorDisplayName/);
assert.match(supportActions, /resolved_by_name/);
assert.match(supportTopBar, /backgroundColor:\s*"#000000"/);
assert.match(supportTopBar, /<Brand size="home" href="\/technical-support" label="LDA technical support dashboard" \/>/);
assert.match(supportTopBar, /className="lda-technical-support-topbar lda-universal-topbar w-full max-w-none/);
assert.match(supportTopBar, /width:\s*"100%"/);
assert.match(supportTopBar, /maxWidth:\s*"none"/);
assert.match(supportTopBar, /flex-1 justify-center/);
assert.match(supportTopBar, /lda-technical-support-nav-label/);
assert.match(supportTopBar, /<span className="lda-technical-support-nav-label whitespace-nowrap">\{link\.label\}<\/span>/);
assert.match(supportTopBar, /action="\/api\/auth\/sign-out"/);
assert.match(supportTopBar, /method="post"/);
assert.match(supportTopBar, /name="returnTo" value=\{technicalSupportSignedOutAccessPath\}/);
assert.match(supportTopBar, /text-zinc-200/);
assert.match(supportTopBar, /border-white\/25/);
assert.match(supportTopBar, /hover:ring-red-500\/35/);
assert.match(supportTopBar, /WebkitTextFillColor:\s*"#ffffff"/);
assert.doesNotMatch(privilegedAutoSignOut, /signedOutAccessPathForRole/);
assert.match(privilegedAutoSignOut, /searchParams\.set\("role", redirectRole\)/);
assert.match(supportOperatingModel, /Support team command workflow/);
assert.match(supportOperatingModel, /1\. Triage/);
assert.match(supportOperatingModel, /2\. Investigate/);
assert.match(supportOperatingModel, /3\. Escalate/);
assert.match(supportOperatingModel, /4\. Close/);
assert.match(supportEscalationMatrix, /Severity and SLA matrix/);
assert.match(supportEscalationMatrix, /SEV1 critical/);
assert.match(supportEscalationMatrix, /Admin approval required/);
assert.match(supportEscalationMatrix, /Before resolve or handoff/);
assert.match(supportEscalationMatrix, /Never store card details/);
assert.match(supportPageSelector, /Page \{currentPage\} of \{totalPages\}/);
assert.match(supportPageSelector, /Previous/);
assert.match(supportPageSelector, /Next/);
assert.match(supportPageSelector, /totalPages <= 1/);
assert.doesNotMatch(technicalSupportSurfaces, /[ÂÃâ�]/);

const supportHandoverHelper = read("src/lib/technical-support-handover.ts");
const handoverMigration = read("supabase/migrations/20260906171000_technical_support_resolution_accountability_handover.sql");

assert.match(supportHandoverHelper, /currentLondonDateKey/);
assert.match(supportHandoverHelper, /supportActorDisplayName/);
assert.match(handoverMigration, /add column if not exists resolved_by/i);
assert.match(handoverMigration, /add column if not exists resolved_by_name/i);
assert.match(handoverMigration, /create table if not exists public\.support_shift_handover_acknowledgements/i);
assert.match(handoverMigration, /unique \(actor_user_id, handover_date\)/i);
assert.match(handoverMigration, /enable row level security/i);
assert.match(handoverMigration, /private\.current_user_can_access_support/i);

console.log("Technical support access checks passed.");
