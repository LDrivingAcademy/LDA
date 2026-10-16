import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { hasApprovedAdminRole } from "@/lib/admin-access";
import { adminEntryCookieName, hasValidAdminEntry } from "@/lib/admin-entry";
import { recordAuthAudit, requireActiveLdaAuthSession } from "@/lib/auth-sessions";
import {
  getValidPrivilegedSessionRole,
  privilegedSessionCookieName
} from "@/lib/privileged-session-cookie";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function requireAdminDashboardClient() {
  const cookieStore = await cookies();
  const hasAdminEntry = hasValidAdminEntry(cookieStore.get(adminEntryCookieName)?.value);
  const privilegedSessionRole = getValidPrivilegedSessionRole(cookieStore.get(privilegedSessionCookieName)?.value);

  if (!hasAdminEntry && privilegedSessionRole !== "admin") {
    redirect("/");
  }

  const supabase = await createClient();

  if (!supabase) {
    redirect(hasAdminEntry ? "/admin-access?message=Supabase is not configured for admin access." : "/");
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(hasAdminEntry ? "/admin-access?message=Sign in before opening the admin dashboard." : "/");
  }

  if (!(await hasApprovedAdminRole(supabase, user))) {
    redirect(hasAdminEntry ? "/admin-access?message=This account is not authorised for LDA admin access." : "/");
  }

  const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  if (aalError || aal?.currentLevel !== "aal2") {
    redirect("/admin-mfa");
  }

  const adminClient = createAdminClient();
  const requestHeaders = await headers();
  const activeSession = await requireActiveLdaAuthSession({
    adminClient,
    cookieStore,
    headers: requestHeaders,
    userId: user.id,
    role: "admin",
    readOnly: true
  });

  if (!activeSession.ok) {
    redirect(hasAdminEntry
      ? "/admin-access?message=Admin access expired. Sign in again and complete authenticator verification."
      : "/");
  }

  await recordAuthAudit({
    adminClient,
    actorUserId: user.id,
    subjectUserId: user.id,
    role: "admin",
    action: "admin.access.authorized",
    targetType: "admin_workspace",
    sessionId: activeSession.sessionId,
    headers: requestHeaders
  });

  return { supabase, user };
}
