import { NextRequest, NextResponse } from "next/server";
import {
  createTechnicalSupportEntryCookieValue,
  hasConfiguredTechnicalSupportLaunchTokenHash,
  hasValidTechnicalSupportLaunchToken,
  technicalSupportEntryCookieName,
  technicalSupportEntryCookieOptions
} from "@/lib/technical-support-entry";
import { recordAuthAudit } from "@/lib/auth-sessions";
import { applyAdminSecurityHeaders } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const supportShortcutClearedCookies = [
  "lda_demo_role",
  "lda_remember_identifier",
  "lda_auth_handoff",
  "lda_learner_verified",
  "lda_subscription_session"
];

function expireCookie(response: NextResponse, name: string) {
  response.cookies.set(name, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });
}

function clearReusableSessionCookies(request: NextRequest, response: NextResponse) {
  const cookieNames = new Set(supportShortcutClearedCookies);

  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith("sb-") || cookie.name.includes("supabase")) {
      cookieNames.add(cookie.name);
    }
  }

  for (const cookieName of cookieNames) {
    expireCookie(response, cookieName);
  }
}

async function auditLauncherAttempt(request: NextRequest, outcome: "accepted" | "blocked", metadata: Record<string, unknown>) {
  await recordAuthAudit({
    adminClient: createAdminClient(),
    action: `auth.privileged_launcher.${outcome}`,
    targetType: "privileged_launcher",
    targetId: "support",
    headers: request.headers,
    metadata
  });
}

export async function GET(request: NextRequest) {
  const entryCookieValue = createTechnicalSupportEntryCookieValue();
  const response = NextResponse.redirect(new URL("/technical-support-access", request.url));

  if (!entryCookieValue || !hasValidTechnicalSupportLaunchToken(request.nextUrl.searchParams.get("key"))) {
    await auditLauncherAttempt(request, "blocked", {
      hasEntrySecret: Boolean(entryCookieValue),
      hasLaunchTokenHash: hasConfiguredTechnicalSupportLaunchTokenHash()
    });
    console.warn("[technical-support.entry] blocked private launcher without valid token", {
      hasEntrySecret: Boolean(entryCookieValue),
      hasLaunchTokenHash: hasConfiguredTechnicalSupportLaunchTokenHash()
    });
    return applyAdminSecurityHeaders(NextResponse.redirect(new URL("/", request.url)));
  }

  clearReusableSessionCookies(request, response);
  response.cookies.set(technicalSupportEntryCookieName, entryCookieValue, technicalSupportEntryCookieOptions());
  await auditLauncherAttempt(request, "accepted", {
    hasLaunchTokenHash: hasConfiguredTechnicalSupportLaunchTokenHash()
  });

  return applyAdminSecurityHeaders(response);
}
