import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import {
  adminEntryCookieName,
  adminEntryCookieOptions,
  createAdminEntryCookieValue
} from "@/lib/admin-entry";
import { jsonNoStore } from "@/lib/security";
import {
  adminSignedOutAccessPath,
  canReopenPrivilegedAccessPath,
  type PrivilegedAccessRole,
  privilegedRoleForSignedOutAccessPath,
  signedOutAccessPathForRole,
  technicalSupportSignedOutAccessPath
} from "@/lib/privileged-access-paths";
import { applyAdminSecurityHeaders } from "@/lib/security";
import { applySignOutCookiesToResponse, secureSignOut } from "@/lib/secure-sign-out";
import { createClient } from "@/lib/supabase/server";
import {
  createTechnicalSupportEntryCookieValue,
  technicalSupportEntryCookieName,
  technicalSupportEntryCookieOptions
} from "@/lib/technical-support-entry";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const allowedSignedOutRedirects = new Set([
  adminSignedOutAccessPath,
  technicalSupportSignedOutAccessPath
]);

function safeSignedOutRedirect(value: string | null | undefined, request: Request) {
  if (!value?.trim()) return null;

  try {
    const requested = new URL(value, request.url);
    const current = new URL(request.url);
    if (requested.origin !== current.origin || !allowedSignedOutRedirects.has(requested.pathname)) {
      return null;
    }

    return requested.pathname;
  } catch {
    return null;
  }
}

function privilegedSignedOutRole(role: string | null): PrivilegedAccessRole | null {
  return role === "admin" || role === "support" ? role : null;
}

function requestedSignedOutRole(request: Request) {
  return privilegedSignedOutRole(new URL(request.url).searchParams.get("role"));
}

function applyPrivilegedReentryCookie(response: NextResponse, redirectTo: string, signedOutRole: PrivilegedAccessRole | null) {
  const role = privilegedRoleForSignedOutAccessPath(redirectTo);
  if (!canReopenPrivilegedAccessPath(role, signedOutRole)) return response;

  if (role === "admin") {
    const value = createAdminEntryCookieValue();
    if (value) {
      response.cookies.set(adminEntryCookieName, value, adminEntryCookieOptions());
    }
  }

  if (role === "support") {
    const value = createTechnicalSupportEntryCookieValue();
    if (value) {
      response.cookies.set(technicalSupportEntryCookieName, value, technicalSupportEntryCookieOptions());
    }
  }

  return response;
}

async function endPrivilegedSession(request: Request) {
  const result = await secureSignOut({
    supabase: await createClient(),
    cookieStore: await cookies(),
    headers: await headers(),
    reason: "privileged_session_ended"
  });
  const signedOutRole = privilegedSignedOutRole(result.role);
  const requestedRole = requestedSignedOutRole(request);
  const roleRedirect =
    requestedRole && canReopenPrivilegedAccessPath(requestedRole, signedOutRole)
      ? signedOutAccessPathForRole(requestedRole)
      : null;
  const redirectTo = safeSignedOutRedirect(new URL(request.url).searchParams.get("returnTo"), request) ?? roleRedirect ?? result.redirectTo;

  const response = jsonNoStore({ ok: true, redirectTo });
  applySignOutCookiesToResponse(response, result.cookieNames, result.logoutSignal);
  applyPrivilegedReentryCookie(response, redirectTo, signedOutRole);
  return applyAdminSecurityHeaders(response);
}

export async function POST(request: Request) {
  return endPrivilegedSession(request);
}

export async function GET(request: Request) {
  const result = await secureSignOut({
    supabase: await createClient(),
    cookieStore: await cookies(),
    headers: await headers(),
    reason: "privileged_session_ended"
  });

  const redirectTo = safeSignedOutRedirect(new URL(request.url).searchParams.get("returnTo"), request) ?? result.redirectTo;
  const signedOutRole = privilegedSignedOutRole(result.role);
  const response = NextResponse.redirect(new URL(redirectTo, request.url), { status: 303 });
  applySignOutCookiesToResponse(response, result.cookieNames, result.logoutSignal);
  applyPrivilegedReentryCookie(response, redirectTo, signedOutRole);
  return applyAdminSecurityHeaders(response);
}
