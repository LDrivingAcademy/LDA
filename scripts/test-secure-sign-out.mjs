import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const secureSignOut = read("src/lib/secure-sign-out.ts");
const privilegedAccessPaths = read("src/lib/privileged-access-paths.ts");
const signOutAction = read("src/app/auth/actions.ts");
const signOutRoute = read("src/app/api/auth/sign-out/route.ts");
const adminSessionEndRoute = read("src/app/api/admin/session/end/route.ts");
const logoutStateSync = read("src/components/logout-state-sync.tsx");
const fastSignOutButton = read("src/components/fast-sign-out-button.tsx");
const layout = read("src/app/layout.tsx");
const authSessions = read("src/lib/auth-sessions.ts");
const loginPage = read("src/app/auth/login/page.tsx");
const loginRememberHelper = read("src/components/auth/login-remember-helper.tsx");

assert.match(secureSignOut, /export async function secureSignOut/);
assert.match(secureSignOut, /auth\.signOut\(\{\s*scope:\s*"global"\s*\}\)/);
assert.match(secureSignOut, /revokeCurrentLdaAuthSession/);
assert.match(secureSignOut, /revokeUserAuthSessions/);
assert.match(secureSignOut, /collectAuthCookieNames/);
assert.match(secureSignOut, /lowerName\.startsWith\("sb-"\)/);
assert.match(secureSignOut, /lowerName\.includes\("supabase"\)/);
assert.match(secureSignOut, /ldaAuthSessionCookieName/);
assert.match(secureSignOut, /lda_remember_identifier/);
assert.match(secureSignOut, /lda_remembered_device_id/);
assert.match(secureSignOut, /lda_logout_signal/);
assert.match(secureSignOut, /signedOutRedirectForRole/);
assert.match(secureSignOut, /role === "admin"/);
assert.match(secureSignOut, /role === "support"/);
assert.match(secureSignOut, /signedOutAccessPathForRole\(role\)/);
assert.match(secureSignOut, /return "\/";/);
assert.doesNotMatch(secureSignOut, /return "\/auth\/login";/);
assert.match(privilegedAccessPaths, /adminSignedOutAccessPath = "\/director-master-key-lda-admin-9f4e7c2b6a\/access"/);
assert.match(privilegedAccessPaths, /technicalSupportSignedOutAccessPath = "\/technical-support-access"/);
assert.match(privilegedAccessPaths, /canReopenPrivilegedAccessPath/);
assert.match(privilegedAccessPaths, /signedOutRole === "admin" && targetRole === "support"/);

assert.match(signOutAction, /secureSignOut/);
assert.match(signOutAction, /reason:\s*"manual_sign_out"/);
assert.match(signOutAction, /result\.role === "admin"[\s\S]{0,180}createAdminEntryCookieValue/);
assert.match(signOutAction, /result\.role === "support"[\s\S]{0,220}createTechnicalSupportEntryCookieValue/);
assert.match(signOutAction, /redirect\(result\.redirectTo\)/);
assert.doesNotMatch(signOutAction, /export async function signOut\(\)[\s\S]*?redirect\("\/"\)/);

assert.match(signOutRoute, /POST/);
assert.match(signOutRoute, /secureSignOut/);
assert.match(signOutRoute, /applySignOutCookiesToResponse/);
assert.match(signOutRoute, /safeSignedOutRedirect/);
assert.match(signOutRoute, /adminSignedOutAccessPath/);
assert.match(signOutRoute, /technicalSupportSignedOutAccessPath/);
assert.match(signOutRoute, /applyPrivilegedReentryCookie/);
assert.match(signOutRoute, /privilegedSignedOutRole\(result\.role\)/);
assert.match(signOutRoute, /canReopenPrivilegedAccessPath\(role, signedOutRole\)/);
assert.match(signOutRoute, /signedOutRedirectFromReferer/);
assert.match(signOutRoute, /createAdminEntryCookieValue/);
assert.match(signOutRoute, /createTechnicalSupportEntryCookieValue/);
assert.match(signOutRoute, /jsonNoStore\(\{\s*ok:\s*true,\s*redirectTo\s*\}\)/);

assert.match(adminSessionEndRoute, /secureSignOut/);
assert.match(adminSessionEndRoute, /reason:\s*"privileged_session_ended"/);
assert.match(adminSessionEndRoute, /applyAdminSecurityHeaders/);
assert.match(adminSessionEndRoute, /applySignOutCookiesToResponse/);
assert.match(adminSessionEndRoute, /safeSignedOutRedirect/);
assert.match(adminSessionEndRoute, /applyPrivilegedReentryCookie/);
assert.match(adminSessionEndRoute, /privilegedSignedOutRole\(result\.role\)/);
assert.match(adminSessionEndRoute, /canReopenPrivilegedAccessPath\(role, signedOutRole\)/);
assert.match(adminSessionEndRoute, /createAdminEntryCookieValue/);
assert.match(adminSessionEndRoute, /createTechnicalSupportEntryCookieValue/);

assert.match(logoutStateSync, /logoutChannelName = "lda-auth"/);
assert.match(logoutStateSync, /export function broadcastLdaLogout\(\) \{[\s\S]{0,120}wipeClientAuthState\(\);/);
assert.match(logoutStateSync, /new BroadcastChannel\(logoutChannelName\)/);
assert.match(logoutStateSync, /window\.addEventListener\("storage"/);
assert.match(logoutStateSync, /localStorage\.setItem\(logoutStorageKey/);
assert.match(logoutStateSync, /removeMatchingStorage\(window\.localStorage\)/);
assert.match(logoutStateSync, /removeMatchingStorage\(window\.sessionStorage\)/);
assert.match(logoutStateSync, /window\.sessionStorage\.clear\(\)/);
assert.match(logoutStateSync, /lda_logout_signal/);
assert.match(logoutStateSync, /window\.location\.replace\(target\)/);
assert.doesNotMatch(logoutStateSync, /adminSignedOutAccessPath/);
assert.doesNotMatch(logoutStateSync, /technicalSupportSignedOutAccessPath/);
assert.doesNotMatch(logoutStateSync, /director-master-key-lda-admin/);
assert.doesNotMatch(logoutStateSync, /technical-support-private-entry/);
assert.match(logoutStateSync, /return "\/api\/auth\/sign-out";/);

assert.match(fastSignOutButton, /\/api\/auth\/sign-out/);
assert.match(fastSignOutButton, /broadcastLdaLogout/);
assert.doesNotMatch(fastSignOutButton, /auth\.signOut\(\{\s*scope:\s*"local"\s*\}\)/);
assert.doesNotMatch(fastSignOutButton, /router\.replace\("\/"\)/);
assert.match(fastSignOutButton, /router\.prefetch\("\/"\)/);

assert.match(layout, /<LogoutStateSync \/>/);

assert.match(authSessions, /persistent = marketplaceRole && rememberMe/);
assert.match(authSessions, /role === "learner" \|\| role === "instructor"/);
assert.match(authSessions, /applySupabaseAuthCookiePersistence\(cookieStore, \{ persistent \}\)/);
assert.doesNotMatch(loginPage, /name="rememberMe"[\s\S]{0,400}admin/);
assert.match(loginRememberHelper, /function forgetCurrentDevice\(\)/);
assert.match(loginRememberHelper, /readStoredJson<TrustedDevice\[\]>\(TRUSTED_DEVICES_KEY, \[\]\)/);
assert.match(loginRememberHelper, /devices\.filter\(\(item\) => item\.name !== deviceName\)/);
assert.match(loginRememberHelper, /localStorage\.removeItem\(TRUSTED_DEVICES_KEY\)/);
assert.match(loginRememberHelper, /form\.requestSubmit\(submitButton \?\? undefined\)/);
assert.match(loginRememberHelper, /rememberInput\?\.checked/);
assert.match(loginRememberHelper, /autoSubmitted/);

console.log("Secure sign-out checks passed.");
