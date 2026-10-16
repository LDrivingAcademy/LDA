import { cookies, headers } from "next/headers";

type SupabaseLikeClient = {
  from: (table: string) => any;
};

export type InstructorVerificationAuditAction =
  | "upload"
  | "view"
  | "approve"
  | "reject"
  | "request_new_documents"
  | "automatic_deletion"
  | "manual_deletion"
  | "status_change";

export async function getVerificationRequestMeta() {
  const [headerStore, cookieStore] = await Promise.all([headers(), cookies()]);
  const forwardedFor = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim();

  return {
    ipAddress: forwardedFor || headerStore.get("x-real-ip") || null,
    sessionId:
      cookieStore.get("sb-session")?.value?.slice(0, 80) ||
      cookieStore.get("sb-access-token")?.value?.slice(0, 80) ||
      cookieStore.get("lda-admin-entry")?.value?.slice(0, 80) ||
      null
  };
}

export async function recordInstructorVerificationAudit({
  client,
  instructorId,
  actorUserId,
  adminId,
  action,
  outcome = "success",
  documentId,
  documentType,
  notes
}: {
  client: SupabaseLikeClient | null | undefined;
  instructorId: string;
  actorUserId?: string | null;
  adminId?: string | null;
  action: InstructorVerificationAuditAction;
  outcome?: "success" | "failed";
  documentId?: string | null;
  documentType?: string | null;
  notes?: string | null;
}) {
  if (!client) {
    return;
  }

  try {
    const meta = await getVerificationRequestMeta();
    await client.from("instructor_verification_audit_events").insert({
      instructor_id: instructorId,
      actor_user_id: actorUserId ?? null,
      admin_id: adminId ?? null,
      document_id: documentId ?? null,
      document_type: documentType ?? null,
      action,
      outcome,
      session_id: meta.sessionId,
      ip_address: meta.ipAddress,
      notes: notes?.slice(0, 1200) ?? null
    });
  } catch {
    // Audit table may not exist until the matching migration is applied. The
    // core workflow must continue, but production migration checks cover this.
  }
}
