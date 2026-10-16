import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeAccountEmail } from "@/lib/account-role-guard";
import { isLdaTestInstructorEmail } from "@/lib/lda-demo-accounts";

const DEFAULT_ADMIN_EMAILS = [
  "info@ldrivingacademy.co.uk"
];

const DEFAULT_SUSPENDED_ADMIN_EMAILS: string[] = [];

type AdminUser = {
  id: string;
  email?: string | null;
  user_metadata?: {
    full_name?: string;
  } | null;
};

function normalisedEmailSet(values: string[]) {
  return new Set(
    values
      .map((value) => normalizeAccountEmail(value))
      .filter(Boolean)
  );
}

export function isSuspendedDirectorAdminEmail(email: string | null | undefined) {
  const suspendedEmails = process.env.LDA_SUSPENDED_ADMIN_EMAILS?.split(",") ?? DEFAULT_SUSPENDED_ADMIN_EMAILS;
  return normalisedEmailSet(suspendedEmails).has(normalizeAccountEmail(email));
}

export function isMarketplaceTestInstructorEmail(email: string | null | undefined) {
  return isLdaTestInstructorEmail(email);
}

export function isDirectorAdminEmail(email: string | null | undefined) {
  if (isLdaTestInstructorEmail(email)) {
    return false;
  }

  if (isSuspendedDirectorAdminEmail(email)) {
    return false;
  }

  const configuredEmails = process.env.LDA_ADMIN_EMAILS?.split(",") ?? DEFAULT_ADMIN_EMAILS;
  const allowedEmails = normalisedEmailSet(configuredEmails);

  return allowedEmails.has(normalizeAccountEmail(email));
}

export async function hasApprovedAdminRole(client: SupabaseClient, user: AdminUser) {
  if (!isDirectorAdminEmail(user.email)) {
    return false;
  }

  const { data, error } = await client
    .from("account_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}

export async function ensureDirectorAdminRole(client: SupabaseClient, user: AdminUser) {
  if (!isDirectorAdminEmail(user.email)) {
    return false;
  }

  const email = normalizeAccountEmail(user.email);
  const { error: profileError } = await client.from("profiles").upsert({
    id: user.id,
    email,
    full_name: user.user_metadata?.full_name || "LDA Director"
  }, { onConflict: "id" });

  if (profileError) {
    throw new Error(profileError.message);
  }

  const { error: roleError } = await client.from("account_roles").upsert({
    user_id: user.id,
    role: "admin"
  }, { onConflict: "user_id,role" });

  if (roleError) {
    throw new Error(roleError.message);
  }

  return true;
}
