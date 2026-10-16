"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  adminLockoutMessage,
  clearAdminLoginGuard,
  getAdminLoginLockout,
  recordAdminLoginFailure
} from "@/lib/admin-login-guard";
import { issueLdaAuthSession } from "@/lib/auth-sessions";
import { hasApprovedTechnicalSupportRole } from "@/lib/technical-support-access";
import {
  hasValidTechnicalSupportEntry,
  technicalSupportEntryCookieName
} from "@/lib/technical-support-entry";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function mfaRedirect(message: string): never {
  redirect(`/technical-support-mfa?message=${encodeURIComponent(message)}`);
}

export async function verifyTechnicalSupportMfa(formData: FormData) {
  const factorId = String(formData.get("factorId") ?? "").trim();
  const code = String(formData.get("code") ?? "").replace(/\s+/g, "");
  const cookieStore = await cookies();
  const headerStore = await headers();

  if (
    !hasValidTechnicalSupportEntry(
      cookieStore.get(technicalSupportEntryCookieName)?.value
    )
  ) {
    redirect("/technical-support-access");
  }

  const supabase = await createClient();
  if (!supabase) {
    mfaRedirect("Technical support authentication is temporarily unavailable.");
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user || !(await hasApprovedTechnicalSupportRole(supabase, user))) {
    await supabase.auth.signOut({ scope: "local" });
    redirect("/technical-support-access?message=This account is not authorised for technical support.");
  }

  const guardIdentifier = `support:${user.email ?? user.id}`;
  const lockout = getAdminLoginLockout(cookieStore, guardIdentifier);
  if (lockout) {
    await supabase.auth.signOut({ scope: "local" });
    redirect(
      `/technical-support-access?message=${encodeURIComponent(
        adminLockoutMessage(lockout.secondsRemaining)
      )}`
    );
  }

  const meta = {
    identifier: user.email
      ? `${user.email.slice(0, 2)}***@${user.email.split("@")[1] ?? "unknown"}`
      : user.id.slice(0, 8),
    ip:
      headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      headerStore.get("x-real-ip") ||
      "unknown",
    userAgent: headerStore.get("user-agent")?.slice(0, 180) || "missing"
  };

  if (!factorId || !/^\d{6}$/.test(code)) {
    const guard = recordAdminLoginFailure(cookieStore, guardIdentifier);
    console.warn("[support.mfa] invalid code format", {
      ...meta,
      failures: guard.failures,
      locked: Boolean(guard.lockedUntil)
    });
    mfaRedirect("Enter the 6-digit code from your authenticator app.");
  }

  const { data: verification, error: verificationError } =
    await supabase.auth.mfa.challengeAndVerify({ factorId, code });

  if (
    verificationError ||
    !verification?.access_token ||
    !verification.refresh_token
  ) {
    const guard = recordAdminLoginFailure(cookieStore, guardIdentifier);
    console.warn("[support.mfa] code verification failed", {
      ...meta,
      failures: guard.failures,
      locked: Boolean(guard.lockedUntil)
    });
    if (guard.lockedUntil) {
      await supabase.auth.signOut({ scope: "local" });
      redirect(
        `/technical-support-access?message=${encodeURIComponent(
          adminLockoutMessage(30 * 60)
        )}`
      );
    }
    mfaRedirect("That authenticator code was not accepted. Try the latest code.");
  }

  await supabase.auth.setSession({
    access_token: verification.access_token,
    refresh_token: verification.refresh_token
  });

  const { data: aal, error: aalError } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel(
      verification.access_token
    );
  if (aalError || aal?.currentLevel !== "aal2") {
    mfaRedirect("Authenticator verification did not complete. Please try again.");
  }

  const sessionResult = await issueLdaAuthSession({
    adminClient: createAdminClient(),
    cookieStore,
    headers: headerStore,
    userId: user.id,
    role: "support",
    rememberMe: false
  });

  if (!sessionResult.ok) {
    await supabase.auth.signOut({ scope: "local" });
    redirect(
      `/technical-support-access?message=${encodeURIComponent(
        "Secure support session could not be created. Please sign in again."
      )}`
    );
  }

  clearAdminLoginGuard(cookieStore);
  revalidatePath("/technical-support");
  redirect("/technical-support");
}
