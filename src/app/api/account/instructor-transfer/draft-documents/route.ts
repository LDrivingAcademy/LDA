import { NextResponse } from "next/server";
import { getMarketplaceRolesForUser } from "@/lib/account-role-guard";
import { createInstructorDocumentAiVerification } from "@/lib/instructor-document-ai-verification";
import { buildInstructorApplicationDocumentPath, instructorDocumentsBucket } from "@/lib/instructor-document-storage";
import { recordInstructorVerificationAudit } from "@/lib/instructor-verification-audit";
import { validateInstructorVerificationFile } from "@/lib/instructor-verification-file-security";
import { isInstructorTransferDocumentType } from "@/lib/instructor-transfer-documents";
import { isLdaQaBypassInstructorEmail } from "@/lib/lda-demo-accounts";
import { applyNoIndexSecurityHeaders, readJsonBody } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type UploadedFileLike = Blob & {
  name?: string;
  size: number;
};

function secureJson(body: unknown, init?: ResponseInit) {
  return applyNoIndexSecurityHeaders(NextResponse.json(body, init));
}

function isUuid(value: string) {
  return /^[0-9a-f-]{36}$/i.test(value);
}

function getUploadedFile(formData: FormData): UploadedFileLike | null {
  const value = formData.get("documentFile");

  if (!value || typeof value === "string" || !("arrayBuffer" in value) || !("size" in value) || value.size <= 0) {
    return null;
  }

  return value as UploadedFileLike;
}

async function getDraftAccess() {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  if (!supabase || !adminClient) {
    return { error: secureJson({ error: "Secure draft uploads are not configured yet." }, { status: 503 }) };
  }

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: secureJson({ error: "Log in to your learner account before saving instructor application drafts." }, { status: 401 }) };
  }

  const roles = await getMarketplaceRolesForUser(supabase, user.id);
  if (!roles.includes("learner") || roles.includes("instructor")) {
    return { error: secureJson({ error: "Draft instructor applications are only available from a learner account." }, { status: 403 }) };
  }

  const { data: existingTransfer } = await adminClient
    .from("account_role_transfer_requests")
    .select("status")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingTransfer?.status && ["requested", "approved"].includes(existingTransfer.status)) {
    return { error: secureJson({ error: "This instructor application has already been submitted for review." }, { status: 409 }) };
  }

  return { supabase, adminClient, user };
}

async function trySaveDocumentSecurityMetadata({
  adminClient,
  documentId,
  scan
}: {
  adminClient: NonNullable<ReturnType<typeof createAdminClient>>;
  documentId: string;
  scan: Awaited<ReturnType<typeof validateInstructorVerificationFile>>;
}) {
  if (!scan.ok) {
    return;
  }

  try {
    await adminClient
      .from("instructor_documents")
      .update({
        file_sha256: scan.sha256,
        file_size_bytes: scan.sizeBytes,
        mime_type: scan.mimeType,
        original_extension: scan.extension,
        malware_scan_status: scan.scanStatus,
        malware_scan_provider: scan.scanProvider,
        malware_scan_checked_at: new Date().toISOString()
      })
      .eq("id", documentId);
  } catch {
    // Older environments may not have the hardening metadata columns yet.
  }
}

export async function POST(request: Request) {
  const access = await getDraftAccess();
  if (access.error) {
    return access.error;
  }

  const { adminClient, user } = access;
  const formData = await request.formData();
  const documentType = String(formData.get("documentType") ?? "");

  if (!isInstructorTransferDocumentType(documentType)) {
    return secureJson({ error: "Choose a valid instructor application document type." }, { status: 400 });
  }

  const file = getUploadedFile(formData);
  if (!file) {
    return secureJson({ error: "Choose a PDF, JPG, JPEG, or PNG before saving a draft." }, { status: 400 });
  }

  const scan = await validateInstructorVerificationFile(file);
  if (!scan.ok) {
    return secureJson({ error: scan.reason || "This document could not be accepted." }, { status: 400 });
  }

  const { error: profileError } = await adminClient.from("instructor_profiles").upsert({
    user_id: user.id,
    display_name: user.user_metadata?.full_name || user.email || "LDA instructor",
    verification_status: "draft",
    instructor_package: "instructor",
    instructor_subscription_status: "draft",
    instructor_package_started_at: null,
    instructor_package_expires_at: null,
    instructor_package_source: "application"
  }, { onConflict: "user_id" });

  if (profileError) {
    return secureJson({ error: profileError.message }, { status: 400 });
  }

  const { data: oldDrafts } = await adminClient
    .from("instructor_documents")
    .select("id,storage_path")
    .eq("instructor_id", user.id)
    .eq("document_type", documentType)
    .eq("status", "draft");

  const oldStoragePaths = (oldDrafts ?? []).map((document) => document.storage_path).filter(Boolean);
  const oldDocumentIds = (oldDrafts ?? []).map((document) => document.id).filter(Boolean);

  if (oldStoragePaths.length) {
    await adminClient.storage.from(instructorDocumentsBucket).remove(oldStoragePaths);
  }

  if (oldDocumentIds.length) {
    await adminClient.from("instructor_documents").delete().in("id", oldDocumentIds);
  }

  const storagePath = buildInstructorApplicationDocumentPath(user.id, file.name);
  const { error: uploadError } = await adminClient.storage.from(instructorDocumentsBucket).upload(storagePath, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false
  });

  if (uploadError) {
    return secureJson({ error: `Document could not be saved. ${uploadError.message}` }, { status: 400 });
  }

  const aiVerification = createInstructorDocumentAiVerification({
    documentType,
    file,
    isDemoAccount: isLdaQaBypassInstructorEmail(user.email)
  });
  const { data: insertedDocument, error: documentError } = await adminClient
    .from("instructor_documents")
    .insert({
      instructor_id: user.id,
      uploaded_by: user.id,
      document_type: documentType,
      storage_path: storagePath,
      status: "draft",
      is_current: false,
      version_state: "draft",
      ...aiVerification
    })
    .select("id,document_type,status,created_at")
    .single();

  if (documentError) {
    await adminClient.storage.from(instructorDocumentsBucket).remove([storagePath]);
    return secureJson({ error: `Document could not be saved to your account. ${documentError.message}` }, { status: 400 });
  }

  await trySaveDocumentSecurityMetadata({ adminClient, documentId: insertedDocument.id, scan });
  await recordInstructorVerificationAudit({
    client: adminClient,
    instructorId: user.id,
    actorUserId: user.id,
    documentId: insertedDocument.id,
    documentType,
    action: "upload",
    outcome: "success",
    notes: "Learner saved instructor transfer evidence as a draft before submission."
  });

  return secureJson({
    document: {
      id: insertedDocument.id,
      documentType: insertedDocument.document_type,
      createdAt: insertedDocument.created_at,
      previewHref: `/api/account/instructor-transfer/draft-documents/${insertedDocument.id}/preview`,
      fileName: file.name || "Saved document",
      fileSize: scan.sizeBytes,
      mimeType: scan.mimeType
    }
  });
}

export async function DELETE(request: Request) {
  const access = await getDraftAccess();
  if (access.error) {
    return access.error;
  }

  const { adminClient, user } = access;
  const body = await readJsonBody<{ documentId?: string }>(request);
  const documentId = String(body?.documentId ?? "");

  if (!isUuid(documentId)) {
    return secureJson({ error: "Draft document was not recognised." }, { status: 400 });
  }

  const { data: document, error } = await adminClient
    .from("instructor_documents")
    .select("id,instructor_id,document_type,storage_path,status")
    .eq("id", documentId)
    .eq("instructor_id", user.id)
    .eq("status", "draft")
    .maybeSingle();

  if (error || !document) {
    return secureJson({ error: "Saved draft was not found." }, { status: 404 });
  }

  if (document.storage_path) {
    await adminClient.storage.from(instructorDocumentsBucket).remove([document.storage_path]);
  }

  const { error: deleteError } = await adminClient.from("instructor_documents").delete().eq("id", document.id);
  if (deleteError) {
    return secureJson({ error: deleteError.message }, { status: 400 });
  }

  await recordInstructorVerificationAudit({
    client: adminClient,
    instructorId: user.id,
    actorUserId: user.id,
    documentId: document.id,
    documentType: document.document_type,
    action: "manual_deletion",
    outcome: "success",
    notes: "Learner deleted a draft instructor transfer evidence document before submission."
  });

  return secureJson({ ok: true });
}
