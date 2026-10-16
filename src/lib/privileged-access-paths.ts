export type PrivilegedAccessRole = "admin" | "support";

export const adminSignedOutAccessPath = "/director-master-key-lda-admin-9f4e7c2b6a/access";
export const technicalSupportSignedOutAccessPath = "/technical-support-access";

export function signedOutAccessPathForRole(role: PrivilegedAccessRole) {
  return role === "admin" ? adminSignedOutAccessPath : technicalSupportSignedOutAccessPath;
}

export function privilegedRoleForSignedOutAccessPath(pathname: string): PrivilegedAccessRole | null {
  if (pathname === adminSignedOutAccessPath) return "admin";
  if (pathname === technicalSupportSignedOutAccessPath) return "support";
  return null;
}

export function canReopenPrivilegedAccessPath(
  targetRole: PrivilegedAccessRole | null,
  signedOutRole: PrivilegedAccessRole | null
) {
  if (!targetRole || !signedOutRole) return false;
  return signedOutRole === targetRole || (signedOutRole === "admin" && targetRole === "support");
}
