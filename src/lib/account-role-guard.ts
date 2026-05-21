import type { SupabaseClient } from "@supabase/supabase-js";

export type MarketplaceRole = "learner" | "instructor";

type AccountRoleRow = {
  role: MarketplaceRole | "admin";
};

type ProfileRow = {
  id: string;
  email?: string | null;
};

const DUAL_MARKETPLACE_ROLE_TEST_EMAIL = "joshuamn1@hotmail.com";
const DUAL_MARKETPLACE_ROLE_TEST_EMAILS = new Set([DUAL_MARKETPLACE_ROLE_TEST_EMAIL]);

export function normalizeAccountEmail(email: string | null | undefined) {
  return String(email ?? "").trim().toLowerCase();
}

export function isDualMarketplaceRoleTestEmail(email: string | null | undefined) {
  return DUAL_MARKETPLACE_ROLE_TEST_EMAILS.has(normalizeAccountEmail(email));
}

export function oppositeMarketplaceRole(role: MarketplaceRole): MarketplaceRole {
  return role === "learner" ? "instructor" : "learner";
}

export function roleConflictMessage(existingRole: MarketplaceRole, requestedRole: MarketplaceRole) {
  if (existingRole === requestedRole) {
    return `This email already has an LDA ${existingRole} account. Log in instead of creating another account.`;
  }

  if (existingRole === "learner" && requestedRole === "instructor") {
    return "This email is already registered as a learner account. Log in to that account and request an instructor transfer once you are eligible.";
  }

  return "This email is already registered as an instructor account. Use that instructor login, or use a different email for a learner account.";
}

export async function getMarketplaceRolesForUser(client: SupabaseClient, userId: string) {
  const { data, error } = await client
    .from("account_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["learner", "instructor"])
    .returns<AccountRoleRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => row.role).filter((role): role is MarketplaceRole => role === "learner" || role === "instructor");
}

export async function getMarketplaceRolesForEmail(client: SupabaseClient, email: string) {
  const normalizedEmail = normalizeAccountEmail(email);
  const { data: profiles, error: profileError } = await client
    .from("profiles")
    .select("id")
    .eq("email", normalizedEmail)
    .limit(1)
    .returns<ProfileRow[]>();

  if (profileError) {
    throw new Error(profileError.message);
  }

  const profile = profiles?.[0];
  if (!profile) {
    return [];
  }

  return getMarketplaceRolesForUser(client, profile.id);
}

export async function isDualMarketplaceRoleTestUser(client: SupabaseClient, userId: string) {
  const { data: profiles, error } = await client
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .limit(1)
    .returns<ProfileRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  const email = profiles?.[0]?.email;
  return email ? isDualMarketplaceRoleTestEmail(email) : false;
}

export async function ensureEmailCanUseRole(client: SupabaseClient, email: string, requestedRole: MarketplaceRole) {
  const existingRoles = await getMarketplaceRolesForEmail(client, email);
  const matchingRole = existingRoles.find((role) => role === requestedRole);
  const conflictingRole = existingRoles.find((role) => role !== requestedRole);

  if (matchingRole) {
    throw new Error(roleConflictMessage(matchingRole, requestedRole));
  }

  // Only the named LDA test account may hold learner and instructor roles at once.
  if (conflictingRole && !isDualMarketplaceRoleTestEmail(email)) {
    throw new Error(roleConflictMessage(conflictingRole, requestedRole));
  }
}

export async function ensureEmailDoesNotHaveDifferentRole(client: SupabaseClient, email: string, requestedRole: MarketplaceRole) {
  if (isDualMarketplaceRoleTestEmail(email)) {
    return;
  }

  const existingRoles = await getMarketplaceRolesForEmail(client, email);
  const conflictingRole = existingRoles.find((role) => role !== requestedRole);

  if (conflictingRole) {
    throw new Error(roleConflictMessage(conflictingRole, requestedRole));
  }
}

export async function ensureUserCanUseRole(client: SupabaseClient, userId: string, requestedRole: MarketplaceRole) {
  const existingRoles = await getMarketplaceRolesForUser(client, userId);
  const conflictingRole = existingRoles.find((role) => role !== requestedRole);

  if (conflictingRole && !(await isDualMarketplaceRoleTestUser(client, userId))) {
    throw new Error(roleConflictMessage(conflictingRole, requestedRole));
  }
}
