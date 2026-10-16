import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import {
  clearAdminLoginGuard,
  getAdminLoginLockout as getCookieAdminLoginLockout,
  recordAdminLoginFailure
} from "@/lib/admin-login-guard";
import { issueLdaAuthSession, recordAuthAudit } from "@/lib/auth-sessions";
import {
  getPrivilegedLoginLockout,
  privilegedFailedLoginMessage,
  recordPrivilegedLoginFailure
} from "@/lib/privileged-login-monitor";
import { createAdminClient } from "@/lib/supabase/admin";
import { authServiceErrorMessage } from "@/lib/supabase/errors";
import { createClient } from "@/lib/supabase/server";
import {
  ensureTechnicalSupportRole,
  isTechnicalSupportEmail
} from "@/lib/technical-support-access";
import {
  createTechnicalSupportEntryCookieValue,
  technicalSupportEntryCookieName,
  technicalSupportEntryCookieOptions
} from "@/lib/technical-support-entry";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function safeNextPath(value: FormDataEntryValue | null) {
  const nextPath = String(value ?? "/technical-support-mfa");
  return nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/technical-support-mfa";
}

function maskedIdentifier(value: string) {
  const trimmed = value.trim();
  if (!trimmed.includes("@")) return trimmed ? `${trimmed.slice(0, 3)}***` : "not-provided";
  const [name = "", domain = ""] = trimmed.toLowerCase().split("@");
  return `${name.slice(0, 2)}***@${domain}`;
}

function redirectWithMessage(request: Request, message: string, identifier?: string) {
  const url = new URL("/technical-support-access", request.url);
  url.searchParams.set("message", message);
  if (identifier) url.searchParams.set("identifier", identifier);

  const response = NextResponse.redirect(url, { status: 303 });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function redirectTo(request: Request, path: string) {
  const response = NextResponse.redirect(new URL(path, request.url), { status: 303 });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

async function signOutLocalSession(supabase: Awaited<ReturnType<typeof createClient>>) {
  if (!supabase) return;

  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // Keep the original login failure clear for the user.
  }
}

async function recordSupportFailure({
  identifier,
  headers: headerStore,
  cookieStore,
  reason
}: {
  identifier: string;
  headers: Headers;
  cookieStore: Awaited<ReturnType<typeof cookies>>;
  reason: string;
}) {
  const guard = recordAdminLoginFailure(cookieStore, `support:${identifier}`);
  const monitor = await recordPrivilegedLoginFailure({
    adminClient: createAdminClient(),
    role: "support",
    identifier,
    route: "/technical-support-access",
    headers: headerStore,
    reason
  });

  return { guard, monitor };
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const identifier = String(formData.get("username") ?? formData.get("identifier") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const nextPath = safeNextPath(formData.get("next"));
  const cookieStore = await cookies();
  const headerStore = await headers();
  const guardIdentifier = `support:${identifier}`;
  const requestMeta = {
    identifier: maskedIdentifier(identifier),
    ip: headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() || headerStore.get("x-real-ip") || "unknown",
    userAgent: headerStore.get("user-agent")?.slice(0, 180) || "missing"
  };

  const adminClientForMonitor = createAdminClient();
  const centralLockout = await getPrivilegedLoginLockout({
    adminClient: adminClientForMonitor,
    role: "support",
    identifier,
    route: "/technical-support-access",
    headers: headerStore
  });
  const cookieLockout = getCookieAdminLoginLockout(cookieStore, guardIdentifier);
  if (centralLockout || cookieLockout) {
    console.warn("[support.auth.route] blocked by temporary privileged lockout", {
      ...requestMeta,
      secondsRemaining: centralLockout?.secondsRemaining ?? cookieLockout?.secondsRemaining
    });
    return redirectWithMessage(request, privilegedFailedLoginMessage, identifier);
  }

  if (!identifier || !password) {
    const { guard, monitor } = await recordSupportFailure({
      identifier,
      headers: headerStore,
      cookieStore,
      reason: "missing_credentials"
    });
    console.warn("[support.auth.route] missing credentials", {
      ...requestMeta,
      failures: guard.failures,
      locked: Boolean(guard.lockedUntil) || monitor.locked
    });
    return redirectWithMessage(request, privilegedFailedLoginMessage, identifier);
  }

  if (!identifier.includes("@")) {
    const { guard, monitor } = await recordSupportFailure({
      identifier,
      headers: headerStore,
      cookieStore,
      reason: "non_email_identifier"
    });
    console.warn("[support.auth.route] rejected non-email identifier", {
      ...requestMeta,
      failures: guard.failures,
      locked: Boolean(guard.lockedUntil) || monitor.locked
    });
    return redirectWithMessage(request, privilegedFailedLoginMessage, identifier);
  }

  const supabase = await createClient();
  if (!supabase) {
    return redirectWithMessage(request, privilegedFailedLoginMessage, identifier);
  }

  try {
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: identifier,
      password
    });

    if (signInError) {
      const { guard, monitor } = await recordSupportFailure({
        identifier,
        headers: headerStore,
        cookieStore,
        reason: "invalid_password"
      });
      console.warn("[support.auth.route] sign-in failed", {
        ...requestMeta,
        failures: guard.failures,
        locked: Boolean(guard.lockedUntil) || monitor.locked
      });
      return redirectWithMessage(request, privilegedFailedLoginMessage, identifier);
    }

    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.warn("[support.auth.route] user read failed after sign-in", {
        ...requestMeta
      });
      return redirectWithMessage(request, privilegedFailedLoginMessage, identifier);
    }

    if (!isTechnicalSupportEmail(user.email)) {
      await signOutLocalSession(supabase);
      const { guard, monitor } = await recordSupportFailure({
        identifier,
        headers: headerStore,
        cookieStore,
        reason: "support_email_allowlist_rejected"
      });
      console.warn("[support.auth.route] authenticated account rejected by allowlist", {
        ...requestMeta,
        failures: guard.failures,
        locked: Boolean(guard.lockedUntil) || monitor.locked
      });
      return redirectWithMessage(request, privilegedFailedLoginMessage, identifier);
    }

    const adminClient = createAdminClient();
    if (!adminClient) {
      await signOutLocalSession(supabase);
      return redirectWithMessage(request, privilegedFailedLoginMessage, identifier);
    }

    await ensureTechnicalSupportRole(adminClient, user);

    const { data: supportRole, error: supportRoleError } = await adminClient
      .from("account_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "support")
      .maybeSingle();

    if (supportRoleError || !supportRole) {
      await signOutLocalSession(supabase);
      const { guard, monitor } = await recordSupportFailure({
        identifier,
        headers: headerStore,
        cookieStore,
        reason: "support_role_missing"
      });
      console.warn("[support.auth.route] authenticated account rejected for missing support role", {
        ...requestMeta,
        failures: guard.failures,
        locked: Boolean(guard.lockedUntil) || monitor.locked
      });
      return redirectWithMessage(request, privilegedFailedLoginMessage, identifier);
    }

    const supportEntryValue = createTechnicalSupportEntryCookieValue();
    if (!supportEntryValue) {
      await signOutLocalSession(supabase);
      return redirectWithMessage(request, privilegedFailedLoginMessage, identifier);
    }

    cookieStore.set(
      technicalSupportEntryCookieName,
      supportEntryValue,
      technicalSupportEntryCookieOptions()
    );

    const sessionResult = await issueLdaAuthSession({
      adminClient,
      cookieStore,
      headers: headerStore,
      userId: user.id,
      role: "support",
      rememberMe: false
    });

    if (!sessionResult.ok) {
      await signOutLocalSession(supabase);
      return redirectWithMessage(request, privilegedFailedLoginMessage, identifier);
    }

    await recordAuthAudit({
      adminClient,
      actorUserId: user.id,
      subjectUserId: user.id,
      role: "support",
      action: "support.login.password_verified",
      headers: headerStore
    });

    clearAdminLoginGuard(cookieStore);
    cookieStore.delete("lda_remember_identifier");
    cookieStore.delete("lda_remembered_device_id");
    cookieStore.delete("lda_remembered_device_name");

    return redirectTo(request, nextPath);
  } catch (error) {
    console.error("[support.auth.route] technical support sign-in failed", {
      ...requestMeta,
      message: error instanceof Error ? error.message : String(error)
    });
    return redirectWithMessage(request, privilegedFailedLoginMessage, identifier);
  }
}
