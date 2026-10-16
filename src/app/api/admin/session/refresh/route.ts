import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { hasApprovedAdminRole } from "@/lib/admin-access";
import { adminEntryCookieName, hasValidAdminEntry } from "@/lib/admin-entry";
import { recordAuthAudit, requireActiveLdaAuthSession } from "@/lib/auth-sessions";
import {
  getValidPrivilegedSessionRole,
  privilegedSessionCookieName
} from "@/lib/privileged-session-cookie";
import { applyAdminSecurityHeaders } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { hasApprovedTechnicalSupportRole } from "@/lib/technical-support-access";
import {
  hasValidTechnicalSupportEntry,
  technicalSupportEntryCookieName
} from "@/lib/technical-support-entry";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return applyAdminSecurityHeaders(
    NextResponse.json(body, {
      status,
      headers: {
        "Cache-Control": "no-store"
      }
    })
  );
}

export async function POST() {
  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const supabase = await createClient();

  if (!supabase) {
    return jsonResponse({ ok: false, error: "supabase_not_configured" }, 503);
  }

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return jsonResponse({ ok: false, error: "not_authenticated" }, 401);
  }

  const { data: aal, error: aalError } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  if (aalError || aal?.currentLevel !== "aal2") {
    return jsonResponse({ ok: false, error: "mfa_required" }, 403);
  }

  const hasAdminEntry = hasValidAdminEntry(cookieStore.get(adminEntryCookieName)?.value);
  const hasSupportEntry = hasValidTechnicalSupportEntry(
    cookieStore.get(technicalSupportEntryCookieName)?.value
  );
  const privilegedSessionRole = getValidPrivilegedSessionRole(
    cookieStore.get(privilegedSessionCookieName)?.value
  );
  const adminClient = createAdminClient();
  let role: "admin" | "support" | null = null;

  if ((hasAdminEntry || privilegedSessionRole === "admin") && (await hasApprovedAdminRole(supabase, user))) {
    role = "admin";
  } else if ((hasSupportEntry || privilegedSessionRole === "support") && (await hasApprovedTechnicalSupportRole(supabase, user))) {
    role = "support";
  }

  if (!role) {
    return jsonResponse({ ok: false, error: "not_authorised" }, 403);
  }

  const activeSession = await requireActiveLdaAuthSession({
    adminClient,
    cookieStore,
    headers: requestHeaders,
    userId: user.id,
    role
  });

  if (!activeSession.ok) {
    return jsonResponse({ ok: false, error: activeSession.reason }, 401);
  }

  await recordAuthAudit({
    adminClient,
    actorUserId: user.id,
    subjectUserId: user.id,
    role,
    action: "auth.privileged_session.refreshed",
    targetType: "auth_session",
    sessionId: activeSession.sessionId,
    headers: requestHeaders
  });

  return jsonResponse({
    ok: true,
    role,
    refreshed: true
  });
}
