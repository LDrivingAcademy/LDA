import { redirect } from "next/navigation";
import { isDirectorAdminEmail } from "@/lib/admin-access";

type SupabaseRoleClient = {
  from: (table: string) => any;
};

type AccountRoleRow = {
  role?: string | null;
};

type ProfileEmailRow = {
  email?: string | null;
};

type InstructorApprovalState = {
  isAdmin: boolean;
  isApproved: boolean;
  isInstructor: boolean;
  verificationStatus: string | null;
};

export async function getInstructorApprovalState(client: SupabaseRoleClient, userId: string): Promise<InstructorApprovalState> {
  const [{ data: roles }, { data: instructorProfile }, { data: profile }] = await Promise.all([
    client.from("account_roles").select("role").eq("user_id", userId),
    client.from("instructor_profiles").select("verification_status").eq("user_id", userId).maybeSingle(),
    client.from("profiles").select("email").eq("id", userId).maybeSingle()
  ]);
  const roleNames = ((roles ?? []) as AccountRoleRow[]).map((accountRole) => String(accountRole.role));
  const verificationStatus = String(instructorProfile?.verification_status ?? "draft");
  const isAdmin = roleNames.includes("admin") && isDirectorAdminEmail((profile as ProfileEmailRow | null)?.email);
  const isInstructor = roleNames.includes("instructor");

  return {
    isAdmin,
    isInstructor,
    verificationStatus,
    isApproved: isAdmin || (isInstructor && verificationStatus === "approved")
  };
}

export function redirectUnlessApprovedInstructor(state: InstructorApprovalState): void {
  if (!state.isInstructor && !state.isAdmin) {
    redirect("/dashboard");
  }

  if (!state.isApproved) {
    redirect("/instructor-verification?from=dashboard");
  }
}
