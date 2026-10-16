import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextResponse } from "next/server";
import { adminEntryCookieName } from "@/lib/admin-entry";
import { adminLoginGuardCookieName } from "@/lib/admin-login-guard";
import {
  clearLdaAuthSessionCookie,
  ldaAuthSessionCookieName,
  recordAuthAudit,
  revokeCurrentLdaAuthSession,
  revokeUserAuthSessions,
  type LdaAuthSessionRole
} from "@/lib/auth-sessions";
import { clientLoginActivityPendingCookieName } from "@/lib/login-activity";
import { privilegedSessionCookieName } from "@/lib/privileged-session-cookie";
import { signedOutAccessPathForRole } from "@/lib/privileged-access-paths";
import { createAdminClient } from "@/lib/supabase/admin";
import { technicalSupportEntryCookieName } from "@/lib/technical-support-entry";

type CookieStore = {
  get(name: string): { value: string } | undefined;
  getAll(): Array<{ name: string; value: string }>;
  set(name: string, value: string, options?: Record<string, unknown>): void;
  delete(name: string): void;
};

type SecureSignOutInput = {
  supabase: SupabaseClient | null;
  cookieStore: CookieStore;
  headers: Headers;
  reason?: string;
};

const secure = process.env.NODE_ENV === "production";

export const logoutSignalCookieName = "lda_logout_signal";

const explicitAuthCookieNames = [
  ldaAuthSessionCookieName,
  privilegedSessionCookieName,
  logoutSignalCookieName,
  adminEntryCookieName,
  technicalSupportEntryCookieName,
  adminLoginGuardCookieName,
  clientLoginActivityPendingCookieName,
  "lda_demo_role",
  "lda_remember_identifier",
  "lda_remembered_device_id",
  "lda_remembered_device_name",
  "lda_auth_handoff",
  "lda_learner_verified",
  "lda_subscription_session"
];

function expireCookieOptions(httpOnly = true) {
  return {
    httpOnly,
    maxAge: 0,
    path: "/",
    sameSite: "lax" as const,
    secure
  };
}

function logoutSignalCookieOptions() {
  return {
    httpOnly: false,
    maxAge: 90,
    path: "/",
    sameSite: "lax" as const,
    secure
  };
}

function isAuthCookieName(name: string) {
  const lowerName = name.toLowerCase();
  return (
    lowerName.startsWith("sb-") ||
    lowerName.includes("supabase") ||
    lowerName.startsWith("lda_auth") ||
    lowerName.startsWith("lda_privileged") ||
    lowerName.startsWith("lda_secure") ||
    lowerName.startsWith("lda_remember") ||
    lowerName.startsWith("lda_admin") ||
    lowerName.startsWith("lda_technical") ||
    lowerName === "lda_demo_role" ||
    lowerName === clientLoginActivityPendingCookieName
  );
}

export function collectAuthCookieNames(cookieStore: CookieStore) {
  const names = new Set(explicitAuthCookieNames);

  for (const cookie of cookieStore.getAll()) {
    if (isAuthCookieName(cookie.name)) {
      names.add(cookie.name);
    }
  }

  return [...names];
}

export function clearAuthCookies(cookieStore: CookieStore, names = collectAuthCookieNames(cookieStore)) {
  for (const name of names) {
    cookieStore.set(name, "", expireCookieOptions(name !== logoutSignalCookieName));
  }
  clearLdaAuthSessionCookie(cookieStore);
}

export function applySignOutCookiesToResponse(response: NextResponse, names: string[], logoutSignal: string) {
  for (const name of names) {
    response.cookies.set(name, "", expireCookieOptions(name !== logoutSignalCookieName));
  }

  response.cookies.set(logoutSignalCookieName, logoutSignal, logoutSignalCookieOptions());
  return response;
}

export function signedOutRedirectForRole(role: LdaAuthSessionRole | null) {
  if (role === "admin" || role === "support") return signedOutAccessPathForRole(role);
  return "/";
}

async function getSignedInRole(supabase: SupabaseClient, userId: string): Promise<LdaAuthSessionRole | null> {
  const { data, error } = await supabase.from("account_roles").select("role").eq("user_id", userId);

  if (error) {
    return null;
  }

  const roles = new Set((data ?? []).map((row) => String(row.role)));
  if (roles.has("admin")) return "admin";
  if (roles.has("support")) return "support";
  if (roles.has("instructor")) return "instructor";
  if (roles.has("learner")) return "learner";
  return null;
}

function roleFromPrivateEntryCookies(cookieStore: CookieStore): LdaAuthSessionRole | null {
  if (cookieStore.get(adminEntryCookieName)?.value) return "admin";
  if (cookieStore.get(technicalSupportEntryCookieName)?.value) return "support";
  return null;
}

async function revokeSupabaseRefreshTokens(supabase: SupabaseClient) {
  try {
    await supabase.auth.signOut({ scope: "global" });
  } catch {
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // Cookie clearing below still prevents a stale browser session from being reused.
    }
  }
}

export async function secureSignOut({
  supabase,
  cookieStore,
  headers,
  reason = "manual_sign_out"
}: SecureSignOutInput) {
  const adminClient = createAdminClient();
  const cookieNames = collectAuthCookieNames(cookieStore);
  let userId: string | null = null;
  let role: LdaAuthSessionRole | null = roleFromPrivateEntryCookies(cookieStore);

  if (supabase) {
    try {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      userId = user?.id ?? null;
      if (userId) {
        role = await getSignedInRole(supabase, userId) ?? role;
      }
    } catch {
      userId = null;
    }
  }

  await revokeCurrentLdaAuthSession({
    adminClient,
    cookieStore,
    headers,
    userId,
    reason
  });

  if (userId) {
    await revokeUserAuthSessions({
      adminClient,
      userId,
      actorUserId: userId,
      reason,
      headers
    });

    await recordAuthAudit({
      adminClient,
      actorUserId: userId,
      subjectUserId: userId,
      role,
      action: "auth.manual_sign_out.completed",
      headers,
      metadata: { reason }
    });
  }

  if (supabase) {
    await revokeSupabaseRefreshTokens(supabase);
  }

  const logoutSignal = String(Date.now());
  clearAuthCookies(cookieStore, cookieNames);
  cookieStore.set(logoutSignalCookieName, logoutSignal, logoutSignalCookieOptions());

  return {
    cookieNames,
    logoutSignal,
    redirectTo: signedOutRedirectForRole(role),
    role
  };
}
