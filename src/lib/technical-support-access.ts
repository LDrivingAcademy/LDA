import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { hasApprovedAdminRole } from "@/lib/admin-access";
import { adminEntryCookieName, hasValidAdminEntry } from "@/lib/admin-entry";
import { recordAuthAudit, requireActiveLdaAuthSession } from "@/lib/auth-sessions";
import { normalizeAccountEmail } from "@/lib/account-role-guard";
import {
  getValidPrivilegedSessionRole,
  privilegedSessionCookieName
} from "@/lib/privileged-session-cookie";
import {
  hasValidTechnicalSupportEntry,
  technicalSupportEntryCookieName
} from "@/lib/technical-support-entry";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_TECHNICAL_SUPPORT_EMAILS = ["info@ldrivingacademy.co.uk"];

type TechnicalSupportUser = {
  id: string;
  email?: string | null;
};

function technicalSupportEmailSet() {
  const configuredEmails =
    process.env.LDA_TECHNICAL_SUPPORT_EMAILS?.split(",") ?? DEFAULT_TECHNICAL_SUPPORT_EMAILS;

  return new Set(
    configuredEmails
      .map((email) => normalizeAccountEmail(email))
      .filter(Boolean)
  );
}

export function isTechnicalSupportEmail(email: string | null | undefined) {
  return technicalSupportEmailSet().has(normalizeAccountEmail(email));
}

export async function hasApprovedTechnicalSupportRole(
  client: SupabaseClient,
  user: TechnicalSupportUser
) {
  if (!isTechnicalSupportEmail(user.email)) {
    return false;
  }

  const { data, error } = await client
    .from("account_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "support")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}

export async function ensureTechnicalSupportRole(
  client: SupabaseClient,
  user: TechnicalSupportUser
) {
  if (!isTechnicalSupportEmail(user.email)) {
    return false;
  }

  const email = normalizeAccountEmail(user.email);
  const { error: profileError } = await client.from("profiles").upsert(
    {
      id: user.id,
      email
    },
    { onConflict: "id" }
  );

  if (profileError) {
    throw new Error(profileError.message);
  }

  const { error: roleError } = await client.from("account_roles").upsert(
    {
      user_id: user.id,
      role: "support"
    },
    { onConflict: "user_id,role" }
  );

  if (roleError) {
    throw new Error(roleError.message);
  }

  return true;
}

export async function requireTechnicalSupportClient() {
  const cookieStore = await cookies();
  const hasAdminEntry = hasValidAdminEntry(cookieStore.get(adminEntryCookieName)?.value);
  const hasSupportEntry = hasValidTechnicalSupportEntry(
    cookieStore.get(technicalSupportEntryCookieName)?.value
  );
  const privilegedSessionRole = getValidPrivilegedSessionRole(
    cookieStore.get(privilegedSessionCookieName)?.value
  );

  if (!hasAdminEntry && !hasSupportEntry && privilegedSessionRole !== "admin" && privilegedSessionRole !== "support") {
    redirect("/");
  }

  const supabase = await createClient();
  if (!supabase) {
    redirect(hasAdminEntry || hasSupportEntry ? "/technical-support-access?message=Support access is temporarily unavailable." : "/");
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    if (hasAdminEntry) redirect("/admin-access?message=Sign in before opening support.");
    if (hasSupportEntry) redirect("/technical-support-access?message=Sign in before opening technical support.");
    redirect("/");
  }

  let accessRole: "admin" | "support" | null = null;

  if ((hasAdminEntry || privilegedSessionRole === "admin") && (await hasApprovedAdminRole(supabase, user))) {
    accessRole = "admin";
  } else if ((hasSupportEntry || privilegedSessionRole === "support") && (await hasApprovedTechnicalSupportRole(supabase, user))) {
    accessRole = "support";
  }

  if (!accessRole) {
    redirect(hasAdminEntry || hasSupportEntry
      ? "/technical-support-access?message=This account is not authorised for technical support."
      : "/");
  }

  const { data: aal, error: aalError } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  if (aalError || aal?.currentLevel !== "aal2") {
    redirect(accessRole === "admin" ? "/admin-mfa" : "/technical-support-mfa");
  }

  const adminClient = createAdminClient();
  const requestHeaders = await headers();
  const activeSession = await requireActiveLdaAuthSession({
    adminClient,
    cookieStore,
    headers: requestHeaders,
    userId: user.id,
    role: accessRole,
    readOnly: true
  });

  if (!activeSession.ok) {
    redirect(hasAdminEntry || hasSupportEntry
      ? accessRole === "admin"
        ? "/admin-access?message=Admin access expired. Sign in again and complete authenticator verification."
        : "/technical-support-access?message=Technical support access expired. Sign in again and complete authenticator verification."
      : "/");
  }

  await recordAuthAudit({
    adminClient,
    actorUserId: user.id,
    subjectUserId: user.id,
    role: accessRole,
    action: `${accessRole}.technical_support.access.authorized`,
    targetType: "technical_support_workspace",
    sessionId: activeSession.sessionId,
    headers: requestHeaders
  });

  return { supabase, user, accessRole };
}
