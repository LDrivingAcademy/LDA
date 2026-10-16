"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sendAdminNoticeEmail, sendInstructorDocumentUploadedEmail } from "@/lib/email";
import { createInstructorDocumentAiVerification } from "@/lib/instructor-document-ai-verification";
import { instructorDocumentRequiresExpiry, normaliseInstructorDocumentExpiry } from "@/lib/instructor-document-expiry";
import { buildInstructorApplicationDocumentPath, instructorDocumentsBucket } from "@/lib/instructor-document-storage";
import { getInstructorDocumentLabel } from "@/lib/instructor-document-labels";
import {
  getCurrentInstructorDocument,
  getNextInstructorDocumentVersion,
  getPendingInstructorDocument
} from "@/lib/instructor-document-versioning";
import { recordInstructorVerificationAudit } from "@/lib/instructor-verification-audit";
import { validateInstructorVerificationFile } from "@/lib/instructor-verification-file-security";
import { fallbackRequiredInstructorDocumentTypes } from "@/lib/instructor-verification-requirements";
import { isLdaQaBypassInstructorEmail } from "@/lib/lda-demo-accounts";
import { getAppOrigin } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type VerificationDocumentType =
  | "passport"
  | "national_id_card"
  | "professional_licence"
  | "teaching_qualification"
  | "adi_pdi_badge"
  | "driving_licence"
  | "proof_of_id"
  | "proof_of_address"
  | "insurance"
  | "tuition_insurance"
  | "mot_certificate"
  | "vehicle_tax_status"
  | "vehicle_registration"
  | "vehicle_safety_declaration"
  | "public_liability_insurance"
  | "standards_check"
  | "safeguarding_code"
  | "right_to_work"
  | "dbs_check"
  | "vehicle_photo"
  | "other";

type UploadedFileLike = Blob & {
  name?: string;
  size: number;
};

const allowedDocumentTypes = new Set<VerificationDocumentType>([
  "passport",
  "national_id_card",
  "professional_licence",
  "teaching_qualification",
  "adi_pdi_badge",
  "driving_licence",
  "proof_of_id",
  "proof_of_address",
  "insurance",
  "tuition_insurance",
  "mot_certificate",
  "vehicle_tax_status",
  "vehicle_registration",
  "vehicle_safety_declaration",
  "public_liability_insurance",
  "standards_check",
  "safeguarding_code",
  "right_to_work",
  "dbs_check",
  "vehicle_photo",
  "other"
]);

function uploadRedirect(message: string): never {
  redirect(`/instructor-verification?from=dashboard&message=${encodeURIComponent(message)}`);
}

function uploadSuccessRedirect(message: string, documentType: VerificationDocumentType): never {
  redirect(`/instructor-verification?from=dashboard&uploaded=${encodeURIComponent(documentType)}&message=${encodeURIComponent(message)}`);
}

function getUploadedFile(formData: FormData): UploadedFileLike | null {
  const value = formData.get("documentFile");

  if (!value || typeof value === "string" || !("arrayBuffer" in value) || !("size" in value) || value.size <= 0) {
    return null;
  }

  return value as UploadedFileLike;
}

async function trySetInstructorVerificationStatus(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, status: string) {
  if (!supabase) {
    return;
  }

  const { error } = await supabase.from("instructor_profiles").update({ verification_status: status }).eq("user_id", userId);
  if (error && status !== "pending") {
    await supabase.from("instructor_profiles").update({ verification_status: "pending" }).eq("user_id", userId);
  }
}

async function notifyAdminsOfInstructorReplacement({
  instructorId,
  instructorEmail,
  instructorName,
  documentLabel,
  documentId
}: {
  instructorId: string;
  instructorEmail?: string | null;
  instructorName?: string | null;
  documentLabel: string;
  documentId: string;
}) {
  const adminClient = createAdminClient();
  if (!adminClient) return;

  const { data: adminRoles } = await adminClient
    .from("account_roles")
    .select("user_id,profiles(email,full_name)")
    .in("role", ["admin", "technical_support"]);

  const adminRows = (adminRoles ?? []) as Array<{
    user_id: string;
    profiles?: { email?: string | null; full_name?: string | null } | { email?: string | null; full_name?: string | null }[] | null;
  }>;
  const body = `${instructorName || instructorEmail || "An instructor"} uploaded a replacement ${documentLabel}. The current approved version stays active until admin approves this pending version.`;
  const notificationRows = adminRows.map((row) => ({
    user_id: row.user_id,
    notification_type: "instructor_document_replacement_uploaded",
    title: "Instructor replacement document uploaded",
    body
  }));

  if (notificationRows.length) {
    await adminClient.from("notifications").insert(notificationRows);
  }

  const emails = new Set<string>();
  for (const row of adminRows) {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    if (profile?.email) emails.add(profile.email);
  }

  await Promise.allSettled(
    [...emails].map((email) =>
      sendAdminNoticeEmail({
        to: email,
        subject: "LDA replacement instructor document uploaded",
        title: "Replacement document needs review",
        body: `${body}\n\nOpen admin instructor review: ${getAppOrigin()}/admin/instructors#in-progress-instructors\n\nDocument reference: ${documentId}\nInstructor account: ${instructorEmail || instructorId}`
      })
    )
  );
}

async function trySaveDocumentSecurityMetadata({
  supabase,
  documentId,
  scan
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  documentId: string;
  scan: Awaited<ReturnType<typeof validateInstructorVerificationFile>>;
}) {
  if (!supabase || !scan.ok) {
    return;
  }

  try {
    await supabase
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
    // Metadata columns are added by the production hardening migration.
  }
}

export async function uploadInstructorVerificationDocument(formData: FormData) {
  const supabase = await createClient();

  if (!supabase) {
    uploadRedirect("Secure account access is temporarily unavailable. Please try again later.");
  }

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/auth/login?role=instructor&message=Log in before uploading verification documents.");
  }

  const documentType = String(formData.get("documentType") ?? "") as VerificationDocumentType;
  if (!allowedDocumentTypes.has(documentType)) {
    uploadRedirect("Choose a valid document type before uploading.");
  }

  const file = getUploadedFile(formData);
  if (!file) {
    uploadRedirect("Choose a photo or PDF before pressing upload.");
  }

  const scan = await validateInstructorVerificationFile(file);
  if (!scan.ok) {
    uploadRedirect(scan.reason || "This file cannot be accepted for verification.");
  }

  const expiresAt = normaliseInstructorDocumentExpiry(formData.get("expiresAt"));
  if (instructorDocumentRequiresExpiry(documentType) && !expiresAt) {
    uploadRedirect("Add the expiry or renewal date shown on this document before uploading.");
  }

  const { data: existingDocuments, error: latestDocumentError } = await supabase
    .from("instructor_documents")
    .select("id,document_type,status,created_at,expires_at,document_version,is_current,version_state")
    .eq("instructor_id", user.id)
    .eq("document_type", documentType)
    .order("created_at", { ascending: false });

  if (latestDocumentError) {
    uploadRedirect(latestDocumentError.message);
  }

  const documentHistory = (existingDocuments ?? []).map((document) => ({
    ...document,
    document_type: String(document.document_type)
  }));
  const currentDocument = getCurrentInstructorDocument(documentHistory, documentType);
  const pendingDocument = getPendingInstructorDocument(documentHistory, documentType);
  if (pendingDocument) {
    uploadRedirect("This document is already with LDA for review. Wait for admin review before uploading another replacement.");
  }

  const documentVersion = getNextInstructorDocumentVersion(documentHistory);

  const { data: instructorProfile } = await supabase
    .from("instructor_profiles")
    .select("verification_status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (instructorProfile?.verification_status !== "approved") {
    const profilePayload = {
      user_id: user.id,
      display_name: user.user_metadata?.full_name || user.email || "LDA instructor",
      verification_status: "upload_in_progress",
      instructor_package: "instructor",
      instructor_subscription_status: "in_progress",
      instructor_package_started_at: null,
      instructor_package_expires_at: null,
      instructor_package_source: "application"
    };
    const { error: profileError } = await supabase.from("instructor_profiles").upsert(profilePayload);

    if (profileError) {
      const { error: fallbackProfileError } = await supabase.from("instructor_profiles").upsert({
        ...profilePayload,
        verification_status: "pending"
      });

      if (fallbackProfileError) {
        uploadRedirect(fallbackProfileError.message);
      }
    }
  }

  const storagePath = buildInstructorApplicationDocumentPath(user.id, file.name);
  const aiVerification = createInstructorDocumentAiVerification({
    documentType,
    file,
    isDemoAccount: isLdaQaBypassInstructorEmail(user.email)
  });
  const { error: uploadError } = await supabase.storage.from(instructorDocumentsBucket).upload(storagePath, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false
  });

  if (uploadError) {
    uploadRedirect(`Document could not be uploaded. ${uploadError.message}`);
  }

  const { data: insertedDocument, error: documentError } = await supabase
    .from("instructor_documents")
    .insert({
      instructor_id: user.id,
      uploaded_by: user.id,
      document_type: documentType,
      storage_path: storagePath,
      expires_at: expiresAt,
      document_version: documentVersion,
      status: "pending",
      is_current: false,
      version_state: "pending",
      ...aiVerification
    })
    .select("id")
    .single();

  if (documentError) {
    await supabase.storage.from(instructorDocumentsBucket).remove([storagePath]);
    uploadRedirect(`Document could not be saved for review. ${documentError.message}`);
  }

  await trySaveDocumentSecurityMetadata({ supabase, documentId: insertedDocument.id, scan });
  await recordInstructorVerificationAudit({
    client: supabase,
    instructorId: user.id,
    actorUserId: user.id,
    documentId: insertedDocument.id,
    documentType,
    action: "upload",
    outcome: "success",
    notes: "Instructor uploaded verification evidence for temporary LDA review."
  });

  if (currentDocument) {
    await notifyAdminsOfInstructorReplacement({
      instructorId: user.id,
      instructorEmail: user.email,
      instructorName: user.user_metadata?.full_name || "",
      documentLabel: getInstructorDocumentLabel(documentType),
      documentId: insertedDocument.id
    });
  }

  const { data: requiredDocuments } = await supabase
    .from("instructor_documents")
    .select("id,document_type,status,created_at,is_current,version_state")
    .eq("instructor_id", user.id)
    .in("document_type", fallbackRequiredInstructorDocumentTypes)
    .order("created_at", { ascending: false });
  const latestRequired = new Map<string, { status?: string | null }>();
  for (const document of requiredDocuments ?? []) {
    if (!latestRequired.has(document.document_type)) latestRequired.set(document.document_type, document);
  }
  const allRequiredUploaded = fallbackRequiredInstructorDocumentTypes.every((documentType) => latestRequired.has(documentType));
  if (allRequiredUploaded) {
    await trySetInstructorVerificationStatus(supabase, user.id, "under_review");
  }

  if (user.email) {
    try {
      await sendInstructorDocumentUploadedEmail({
        to: user.email,
        fullName: user.user_metadata?.full_name || "",
        documentLabel: getInstructorDocumentLabel(documentType),
        statusUrl: `${getAppOrigin()}/instructor-verification?from=email`
      });
    } catch (emailError) {
      console.error("[instructor-verification] status email failed", {
        userId: user.id,
        documentType,
        error: emailError
      });
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/instructor-dashboard");
  revalidatePath("/instructor-verification");
  revalidatePath("/admin/instructors");
  uploadSuccessRedirect("Document uploaded. LDA has locked it for secure review.", documentType);
}
