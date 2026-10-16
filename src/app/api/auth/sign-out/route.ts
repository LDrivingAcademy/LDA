import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { jsonNoStore } from "@/lib/security";
import {
  adminEntryCookieName,
  adminEntryCookieOptions,
  createAdminEntryCookieValue
} from "@/lib/admin-entry";
import {
  adminSignedOutAccessPath,
  canReopenPrivilegedAccessPath,
  type PrivilegedAccessRole,
  privilegedRoleForSignedOutAccessPath,
  technicalSupportSignedOutAccessPath
} from "@/lib/privileged-access-paths";
import { secureSignOut, applySignOutCookiesToResponse } from "@/lib/secure-sign-out";
import { createClient } from "@/lib/supabase/server";
import {
  createTechnicalSupportEntryCookieValue,
  technicalSupportEntryCookieName,
  technicalSupportEntryCookieOptions
} from "@/lib/technical-support-entry";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function wantsHtmlRedirect(request: Request) {
  const accept = request.headers.get("accept") || "";
  const fetchMode = request.headers.get("sec-fetch-mode") || "";
  return fetchMode === "navigate" || accept.includes("text/html");
}

const allowedSignedOutRedirects = new Set([
  "/",
  "/auth/login",
  adminSignedOutAccessPath,
  technicalSupportSignedOutAccessPath
]);

function safeSignedOutRedirect(value: FormDataEntryValue | string | null | undefined, request: Request) {
  if (typeof value !== "string" || !value.trim()) return null;

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

function signedOutRedirectFromReferer(value: string | null, request: Request) {
  if (!value?.trim()) return null;

  try {
    const referer = new URL(value, request.url);
    const current = new URL(request.url);
    if (referer.origin !== current.origin) return null;

    if (referer.pathname.startsWith("/technical-support")) return technicalSupportSignedOutAccessPath;
    if (referer.pathname.startsWith("/admin") || referer.pathname.startsWith("/owner-dashboard")) return adminSignedOutAccessPath;
  } catch {
    return null;
  }

  return null;
}

async function requestedSignedOutRedirect(request: Request) {
  const searchRedirect = safeSignedOutRedirect(new URL(request.url).searchParams.get("returnTo"), request);
  if (searchRedirect) return searchRedirect;

  if (request.method === "POST") {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
      const form = await request.formData().catch(() => null);
      const formRedirect = safeSignedOutRedirect(form?.get("returnTo"), request);
      if (formRedirect) return formRedirect;
    }
  }

  const refererRedirect = signedOutRedirectFromReferer(request.headers.get("referer"), request);
  if (refererRedirect) return refererRedirect;

  return null;
}

function privilegedSignedOutRole(role: string | null): PrivilegedAccessRole | null {
  return role === "admin" || role === "support" ? role : null;
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

export async function POST(request: Request) {
  const redirectOverride = await requestedSignedOutRedirect(request);
  const result = await secureSignOut({
    supabase: await createClient(),
    cookieStore: await cookies(),
    headers: await headers(),
    reason: "manual_sign_out"
  });
  const redirectTo = redirectOverride ?? result.redirectTo;
  const signedOutRole = privilegedSignedOutRole(result.role);

  if (wantsHtmlRedirect(request)) {
    const response = NextResponse.redirect(new URL(redirectTo, request.url), {
      status: 303
    });
    applySignOutCookiesToResponse(response, result.cookieNames, result.logoutSignal);
    return applyPrivilegedReentryCookie(response, redirectTo, signedOutRole);
  }

  const response = jsonNoStore({ ok: true, redirectTo });
  applySignOutCookiesToResponse(response, result.cookieNames, result.logoutSignal);
  return applyPrivilegedReentryCookie(response, redirectTo, signedOutRole);
}

export async function GET(request: Request) {
  const redirectOverride = await requestedSignedOutRedirect(request);
  const result = await secureSignOut({
    supabase: await createClient(),
    cookieStore: await cookies(),
    headers: await headers(),
    reason: "manual_sign_out"
  });
  const redirectTo = redirectOverride ?? result.redirectTo;
  const signedOutRole = privilegedSignedOutRole(result.role);

  const response = NextResponse.redirect(new URL(redirectTo, request.url), {
    status: 303
  });
  applySignOutCookiesToResponse(response, result.cookieNames, result.logoutSignal);
  return applyPrivilegedReentryCookie(response, redirectTo, signedOutRole);
}
