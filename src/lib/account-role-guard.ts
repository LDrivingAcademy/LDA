import type { SupabaseClient } from "@supabase/supabase-js";

export type MarketplaceRole = "learner" | "instructor";

type AccountRoleRow = {
  role: MarketplaceRole | "admin";
};

type ProfileRow = {
  id: string;
};

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
  const normalizedEmail = email.trim().toLowerCase();
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

export async function ensureEmailCanUseRole(client: SupabaseClient, email: string, requestedRole: MarketplaceRole) {
  const existingRoles = await getMarketplaceRolesForEmail(client, email);
  const existingMarketplaceRole = existingRoles.find((role) => role === requestedRole) ?? existingRoles[0];

  if (existingMarketplaceRole) {
    throw new Error(roleConflictMessage(existingMarketplaceRole, requestedRole));
  }
}

export async function ensureEmailDoesNotHaveDifferentRole(client: SupabaseClient, email: string, requestedRole: MarketplaceRole) {
  const existingRoles = await getMarketplaceRolesForEmail(client, email);
  const conflictingRole = existingRoles.find((role) => role !== requestedRole);

  if (conflictingRole) {
    throw new Error(roleConflictMessage(conflictingRole, requestedRole));
  }
}

export async function ensureUserCanUseRole(client: SupabaseClient, userId: string, requestedRole: MarketplaceRole) {
  const existingRoles = await getMarketplaceRolesForUser(client, userId);
  const conflictingRole = existingRoles.find((role) => role !== requestedRole);

  if (conflictingRole) {
    throw new Error(roleConflictMessage(conflictingRole, requestedRole));
  }
}
