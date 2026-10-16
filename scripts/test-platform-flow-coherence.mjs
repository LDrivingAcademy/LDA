import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertContains(file, patterns, label) {
  const source = read(file);
  const missing = patterns.filter((pattern) => !source.includes(pattern));
  assert(!missing.length, `${label} is missing expected wiring in ${file}: ${missing.join(", ")}`);
}

function assertMatches(file, patterns, label) {
  const source = read(file);
  const missing = patterns.filter((pattern) => !pattern.test(source));
  assert(!missing.length, `${label} is missing expected wiring in ${file}: ${missing.map(String).join(", ")}`);
}

function assertDoesNotMatch(file, patterns, label) {
  const source = read(file);
  const matches = patterns.filter((pattern) => pattern.test(source));
  assert(!matches.length, `${label} contains unsafe or stale wiring in ${file}: ${matches.map(String).join(", ")}`);
}

assertContains(
  "src/lib/current-account.ts",
  [
    'roleNames.includes("admin") && isDirectorAdminEmail(user.email)',
    'roleNames.includes("support")',
    'role: "support"',
    'dashboardHref: "/technical-support"',
    'needsTermsAcceptance: false'
  ],
  "Shared account summary role separation"
);

assertContains(
  "src/lib/account-route-guard.ts",
  [
    "isSupport: boolean",
    'effectiveRole: MarketplaceRole | "admin" | "support" | null',
    'roleNames.includes("support")',
    'redirect("/technical-support")'
  ],
  "Marketplace route guard support denial path"
);

assertContains(
  "src/app/account/page.tsx",
  [
    'roleNames.includes("support")',
    '!hasSupportAccount',
    'redirect("/technical-support")'
  ],
  "Account centre support role separation"
);

assertContains(
  "src/components/main-menu.tsx",
  [
    'role: "instructor" | "learner" | "admin" | "support"',
    'resolvedAccount.role === "support"',
    '"Technical Operations Centre"'
  ],
  "Shared menu support identity"
);

assertContains(
  "src/app/support/page.tsx",
  [
    'account.role === "instructor"',
    'account.role === "learner"',
    'account.role === "admin" || account.role === "support"',
    "redirect(account.dashboardHref)",
    'redirect("/support/guest?from=role-router")'
  ],
  "Support router role destinations"
);

assertContains(
  "src/app/api/support/assistant/route.ts",
  [
    "roleState.isSupport",
    '"support"',
    "sanitizePresentationObject",
    "filterPresentationActions",
    "supportTicketOps",
    ".from(\"support_tickets\")",
    "conversation",
    "request_context",
    "sendSupportEscalationEmail",
    "sendSupportTicketConfirmationEmail"
  ],
  "Support assistant ticket and presentation flow"
);

assertContains(
  "src/app/api/bookings/checkout/route.ts",
  [
    "canUseMarketplaceRole(roleState, \"learner\")",
    "getCurrentTermsStatus",
    "hasCompletedLearnerEligibility",
    "getInstructorFutureComplianceStatus",
    "assertInstructorSlotAvailable",
    "https://api.stripe.com/v1/checkout/sessions",
    "metadata[booking_id]",
    "payment_intent_data[transfer_data][destination]"
  ],
  "Signed-in learner Stripe booking flow"
);

assertContains(
  "src/app/api/bookings/complete/route.ts",
  [
    "getStripeCheckoutSession",
    "session.payment_status !== \"paid\"",
    ".from(\"lesson_booking_records\")",
    "upsert(recordRows",
    ".from(\"availability_slots\")",
    "sendBookingConfirmationEmails",
    "sendSms",
    ".from(\"notifications\")"
  ],
  "Stripe completion to durable dashboard records"
);

assertContains(
  "src/app/api/instant-lessons/checkout/route.ts",
  [
    "verifyProvisionalLicenceNumber",
    "verifyAndSaveProvisionalLicence",
    "normaliseSmartMatchHandoff(body.smartMatchContext)",
    "buildSmartMatchLessonNote(smartMatchContext)",
    "smartMatchStripeMetadata(smartMatchContext)",
    "guest_on_demand",
    "waiting_for_instructor",
    "stripe_checkout_session_id",
    "lesson-now/confirmed"
  ],
  "On-demand guest and learner checkout flow"
);

assertContains(
  "src/lib/smart-match-handoff.ts",
  [
    'privateNote: input.disclosureConsent ? cleanText(input.privateNote, 500) : ""',
    "Learner private note for booked instructor",
    "preserveSmartMatchLessonNote",
    "smart_match_private_note_shared"
  ],
  "Smart Match booking handoff privacy controls"
);

assertDoesNotMatch(
  "src/lib/smart-match-handoff.ts",
  [/smart_match_private_note\s*=/],
  "Smart Match raw private note Stripe metadata"
);

assertContains(
  "src/app/api/instant-lessons/instructor-response/route.ts",
  [
    "canUseMarketplaceRole(roleState, \"instructor\")",
    "getActiveOnDemandInstructorIds",
    "smartMatchRequirementsFromRecord(record)",
    "smartMatchCandidateScore",
    "preserveSmartMatchLessonNote",
    "getInstructorFutureComplianceStatus",
    "instant_lesson_instructor_offers",
    "status: \"instructor_en_route\"",
    "sendInstantBookingConfirmationEmail",
    "sendInstructorEnRouteEmail"
  ],
  "Instructor on-demand acceptance and learner notification flow"
);

assertContains(
  "src/app/api/instant-lessons/status/route.ts",
  [
    "smartMatchRequirementsFromRecord(record)",
    "smartMatchCandidateScore",
    "preserveSmartMatchLessonNote",
    "assignInstantInstructor"
  ],
  "On-demand Smart Match assignment and status preservation"
);

assertContains(
  "src/components/instant-lesson-booking.tsx",
  [
    'window.sessionStorage.getItem("lda:smart-match-context:v1")',
    "setSmartMatchContext(parsed)",
    "window.location.pathname",
    "encodeURIComponent(next)",
    'fetch("/api/smart-match/preferences"',
    'bookingPath: "on-demand"',
    "smartMatchContext,"
  ],
  "On-demand Smart Match session handoff"
);

assertContains(
  "src/components/smart-match-experience.tsx",
  [
    "returningFromAuth && pendingAuthPath && restoredInput",
    "setAuthGatePath(null)",
    "availabilityForSmartMatchPath(pendingAuthPath)",
    "writeDraft({ input: nextInput, selectedPath: pendingAuthPath, step: steps.length - 1, authGatePath: null })",
    'fetch("/api/smart-match",'
  ],
  "Smart Match learner auth return handoff"
);

assertContains(
  "src/app/auth/actions.ts",
  [
    'next: nextPath',
    'const requestedNextPath = safeNextPath(formData.get("next") ?? dashboardPathForRole(role))',
    'const nextPath = `/auth/verify?role=${role}&next=${encodeURIComponent(requestedNextPath)}`',
    "redirect(nextPath)"
  ],
  "Learner auth and verification return path preservation"
);

assertContains(
  "src/app/auth/verify/page.tsx",
  [
    'searchParams: Promise<{ role?: string; message?: string; next?: string }>',
    'redirect(nextPath)',
    'name="next"',
    'value={nextPath}'
  ],
  "Learner verification Smart Match return path"
);

assertContains(
  "src/app/auth/login/page.tsx",
  [
    "learnerLoginHref",
    "instructorLoginHref",
    "encodeURIComponent(nextPath)"
  ],
  "Login role picker next path preservation"
);

assertContains(
  "src/app/auth/sign-up/page.tsx",
  [
    "learnerSignUpHref",
    "instructorSignUpHref",
    "redirect(nextPath)",
    "encodeURIComponent(nextPath)"
  ],
  "Sign-up role picker next path preservation"
);

assertContains(
  "src/components/learner-booking-dashboard.tsx",
  [
    'window.sessionStorage.getItem("lda:smart-match-context:v1")',
    "smartMatchInstructorScore",
    "smartMatchContext"
  ],
  "Scheduled and standard booking Smart Match handoff"
);

assertContains(
  "src/app/api/instructor-availability/route.ts",
  [
    "canUseMarketplaceRole(roleState, \"instructor\")",
    "assertApprovedInstructorCanControlWorkState",
    "getInstructorFutureComplianceStatus",
    "expireInstructorLiveLocations",
    'action === "log_off"',
    'is_active: false'
  ],
  "Instructor availability and sign-off flow"
);

assertContains(
  "src/app/api/instructor-location/live/route.ts",
  [
    "canUseMarketplaceRole(roleState, \"instructor\")",
    "hasActiveWorkWindow",
    "normaliseGpsAccuracy",
    "activeDriverLiveWindowMs",
    "is_active: true"
  ],
  "Instructor live work GPS submission"
);

assertContains(
  "src/lib/admin-active-driver-locations.ts",
  [
    "activeDriverLiveWindowMs = 45_000",
    ".from(\"availability_slots\")",
    ".from(\"instructor_live_locations\")",
    "location.is_active === false",
    "nowMs - recordedAtMs > activeDriverLiveWindowMs",
    "staleSignedOnInstructors"
  ],
  "Admin active driver map data minimisation"
);

assertContains(
  "src/components/admin-active-drivers-map.tsx",
  [
    "new google.maps.Map",
    "google.maps.SymbolPath.CIRCLE",
    'fillColor: "#e50914"',
    "Accuracy:",
    "/api/admin/active-driver-locations",
    "No active instructor locations today"
  ],
  "Always-present active driver safety map UI"
);

assertContains(
  "src/components/smart-match-experience.tsx",
  [
    "Sign language",
    "sign language support",
    "Written or visual directions",
    "written or visual directions"
  ],
  "Smart Match inclusive communication choices"
);

assertContains(
  "src/lib/smart-match.ts",
  [
    "sign language support",
    "written or visual directions",
    "hearing-aware communication"
  ],
  "Smart Match inclusive communication scoring"
);

assertContains(
  "src/components/instructor-smart-match-profile-section.tsx",
  [
    "Sign language support",
    "Written or visual directions",
    "Hearing-aware communication"
  ],
  "Instructor Smart Match inclusive communication capabilities"
);

assertContains(
  "src/lib/technical-support-access.ts",
  [
    'accessRole: "admin" | "support" | null',
    "hasApprovedAdminRole(supabase, user)",
    "hasApprovedTechnicalSupportRole(supabase, user)",
    'redirect(accessRole === "admin" ? "/admin-mfa" : "/technical-support-mfa")',
    'role: accessRole'
  ],
  "TOC admin/support server-side role boundary"
);

assertContains(
  "src/components/technical-support-page-header.tsx",
  [
    "showAdminBack",
    "AdminBackToDashboardLink",
    "lg:items-start lg:justify-between",
    "sm:items-end"
  ],
  "Consistent TOC back-navigation placement"
);

assertContains(
  "src/app/admin/support-escalations/page.tsx",
  [
    "requireAdminDashboardClient",
    "AdminPageHeader",
    "Technical support escalations",
    'href="/technical-support"',
    "Return to support review",
    "Mark decision complete"
  ],
  "Admin support escalation preview"
);

assertMatches(
  "src/components/admin-page-header.tsx",
  [
    /AdminBackToDashboardLink/,
    /fallbackHref="\/admin"/,
    /bg-black/,
    /text-white/
  ],
  "Admin page black back-dashboard link"
);

console.log("Platform flow coherence checks passed.");
