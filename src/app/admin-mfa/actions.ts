"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { adminEntryCookieName, hasValidAdminEntry } from "@/lib/admin-entry";
import { hasApprovedAdminRole } from "@/lib/admin-access";
import { adminLockoutMessage, clearAdminLoginGuard, getAdminLoginLockout, recordAdminLoginFailure } from "@/lib/admin-login-guard";
import { createClient } from "@/lib/supabase/server";

function mfaRedirect(message: string): never {
  redirect(`/admin-mfa?message=${encodeURIComponent(message)}`);
}

function getHeaderValue(headerStore: Awaited<ReturnType<typeof headers>>, name: string) {
  return headerStore.get(name) ?? "";
}

function maskedIdentifier(identifier: string | null | undefined) {
  if (!identifier) return "unknown";
  const [name, domain] = identifier.split("@");
  if (!domain) return `${identifier.slice(0, 2)}***`;
  return `${name.slice(0, 2)}***@${domain}`;
}

async function requireAdminContext(supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>) {
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/admin-access?message=Sign in before completing admin MFA.");
  }

  if (!(await hasApprovedAdminRole(supabase, user))) {
    await supabase.auth.signOut();
    redirect("/admin-access?message=This account is not authorised for LDA admin access.");
  }

  return user;
}

export async function verifyAdminMfa(formData: FormData) {
  const factorId = String(formData.get("factorId") ?? "").trim();
  const code = String(formData.get("code") ?? "").replace(/\s+/g, "");
  const cookieStore = await cookies();
  const headerStore = await headers();

  if (!hasValidAdminEntry(cookieStore.get(adminEntryCookieName)?.value)) {
    console.warn("[admin.mfa] blocked MFA attempt without private entry");
    redirect("/admin-access?message=Sign in before completing admin MFA.");
  }

  const supabase = await createClient();
  if (!supabase) {
    mfaRedirect("Supabase environment variables are not configured yet.");
  }

  const user = await requireAdminContext(supabase);
  const lockout = getAdminLoginLockout(cookieStore, user.email);
  if (lockout) {
    await supabase.auth.signOut();
    redirect(`/admin-access?message=${encodeURIComponent(adminLockoutMessage(lockout.secondsRemaining))}`);
  }

  const meta = {
    identifier: maskedIdentifier(user.email),
    ip: getHeaderValue(headerStore, "x-forwarded-for").split(",")[0]?.trim() || getHeaderValue(headerStore, "x-real-ip") || "unknown",
    userAgent: getHeaderValue(headerStore, "user-agent").slice(0, 180) || "missing"
  };

  if (!factorId || !/^\d{6}$/.test(code)) {
    const guard = recordAdminLoginFailure(cookieStore, user.email);
    console.warn("[admin.mfa] invalid code format", { ...meta, failures: guard.failures, locked: Boolean(guard.lockedUntil) });
    if (guard.lockedUntil) {
      await supabase.auth.signOut();
      redirect(`/admin-access?message=${encodeURIComponent(adminLockoutMessage(30 * 60))}`);
    }
    mfaRedirect("Enter the 6-digit code from your authenticator app.");
  }

  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
  if (challengeError || !challenge?.id) {
    const guard = recordAdminLoginFailure(cookieStore, user.email);
    console.warn("[admin.mfa] challenge failed", { ...meta, failures: guard.failures, locked: Boolean(guard.lockedUntil) });
    if (guard.lockedUntil) {
      await supabase.auth.signOut();
      redirect(`/admin-access?message=${encodeURIComponent(adminLockoutMessage(30 * 60))}`);
    }
    mfaRedirect(challengeError?.message || "LDA could not start the authenticator check. Try again.");
  }

  const { data: verification, error: verificationError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code
  });

  if (verificationError || !verification?.access_token || !verification.refresh_token) {
    const guard = recordAdminLoginFailure(cookieStore, user.email);
    console.warn("[admin.mfa] code verification failed", { ...meta, failures: guard.failures, locked: Boolean(guard.lockedUntil) });
    if (guard.lockedUntil) {
      await supabase.auth.signOut();
      redirect(`/admin-access?message=${encodeURIComponent(adminLockoutMessage(30 * 60))}`);
    }
    mfaRedirect("That authenticator code was not accepted. Open your authenticator app and try the latest code.");
  }

  await supabase.auth.setSession({
    access_token: verification.access_token,
    refresh_token: verification.refresh_token
  });

  const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel(verification.access_token);
  if (aalError || aal?.currentLevel !== "aal2") {
    mfaRedirect("MFA was verified, but the admin session was not upgraded. Please try again.");
  }

  clearAdminLoginGuard(cookieStore);
  revalidatePath("/admin");
  redirect("/admin");
}
