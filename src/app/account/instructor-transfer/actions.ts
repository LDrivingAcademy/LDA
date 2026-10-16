"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getMarketplaceRolesForUser } from "@/lib/account-role-guard";
import { sendInstructorVerificationSubmittedEmail } from "@/lib/email";
import { createInstructorDocumentAiVerification } from "@/lib/instructor-document-ai-verification";
import { buildInstructorApplicationDocumentPath, instructorDocumentsBucket } from "@/lib/instructor-document-storage";
import { recordInstructorVerificationAudit } from "@/lib/instructor-verification-audit";
import { validateInstructorVerificationFile } from "@/lib/instructor-verification-file-security";
import { instructorTransferDocumentFields } from "@/lib/instructor-transfer-documents";
import type { InstructorVerificationDocumentType } from "@/lib/instructor-verification-requirements";
import { isLdaQaBypassInstructorEmail } from "@/lib/lda-demo-accounts";
import { getAppOrigin } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function transferRedirect(message: string): never {
  redirect(`/account/instructor-transfer?message=${encodeURIComponent(message)}`);
}

type TransferDocumentField = {
  fieldName: string;
  documentType: InstructorVerificationDocumentType;
  label: string;
};

type UploadedFileLike = Blob & {
  name?: string;
  size: number;
};

type SupabaseWriteClient = NonNullable<ReturnType<typeof createAdminClient>> | NonNullable<Awaited<ReturnType<typeof createClient>>>;

const transferDocumentFields: TransferDocumentField[] = instructorTransferDocumentFields.map(({ fieldName, documentType, label }) => ({
  fieldName,
  documentType,
  label
}));

function getUploadedFile(formData: FormData, fieldName: string): UploadedFileLike | null {
  const value = formData.get(fieldName);

  if (!value || typeof value === "string" || !("arrayBuffer" in value) || !("size" in value) || value.size <= 0) {
    return null;
  }

  return value as UploadedFileLike;
}

async function trySaveDocumentSecurityMetadata({
  client,
  documentId,
  scan
}: {
  client: SupabaseWriteClient;
  documentId: string;
  scan: Awaited<ReturnType<typeof validateInstructorVerificationFile>>;
}) {
  if (!scan.ok) {
    return;
  }

  try {
    await client
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

async function uploadTransferDocuments({
  writeClient,
  userId,
  userEmail,
  formData
}: {
  writeClient: SupabaseWriteClient;
  userId: string;
  userEmail: string | null | undefined;
  formData: FormData;
}) {
  const { data: savedDrafts, error: draftError } = await writeClient
    .from("instructor_documents")
    .select("id,document_type,storage_path,status,created_at")
    .eq("instructor_id", userId)
    .eq("status", "draft")
    .in("document_type", transferDocumentFields.map((field) => field.documentType))
    .order("created_at", { ascending: false });

  if (draftError) {
    transferRedirect(draftError.message);
  }

  const latestDraftByType = new Map<string, { id: string; document_type: string; storage_path?: string | null }>();
  for (const document of savedDrafts ?? []) {
    if (!latestDraftByType.has(document.document_type)) {
      latestDraftByType.set(document.document_type, document);
    }
  }

  for (const { fieldName, documentType, label } of transferDocumentFields) {
    const file = getUploadedFile(formData, fieldName);
    const draft = latestDraftByType.get(documentType);

    if (!file && !draft) {
      transferRedirect(`Upload your ${label.toLowerCase()} before submitting your instructor application.`);
    }
  }

  for (const { fieldName, documentType, label } of transferDocumentFields) {
    const file = getUploadedFile(formData, fieldName);
    const draft = latestDraftByType.get(documentType);

    if (!file && draft) {
      const { error: draftSubmitError } = await writeClient
        .from("instructor_documents")
        .update({ status: "pending", is_current: false, version_state: "pending" })
        .eq("id", draft.id)
        .eq("instructor_id", userId)
        .eq("status", "draft");

      if (draftSubmitError) {
        transferRedirect(`${label} draft could not be submitted for review. ${draftSubmitError.message}`);
      }

      await recordInstructorVerificationAudit({
        client: writeClient,
        instructorId: userId,
        actorUserId: userId,
        documentId: draft.id,
        documentType,
        action: "status_change",
        outcome: "success",
        notes: "Learner submitted saved draft evidence for instructor transfer review."
      });
      continue;
    }

    if (!file) {
      transferRedirect(`Upload your ${label.toLowerCase()} before submitting your instructor application.`);
    }

    const scan = await validateInstructorVerificationFile(file);
    if (!scan.ok) {
      transferRedirect(scan.reason || `${label} could not be accepted for verification.`);
    }

    if (draft?.storage_path) {
      await writeClient.storage.from(instructorDocumentsBucket).remove([draft.storage_path]);
      await writeClient.from("instructor_documents").delete().eq("id", draft.id).eq("status", "draft");
    }

    const storagePath = buildInstructorApplicationDocumentPath(userId, file.name);
    const aiVerification = createInstructorDocumentAiVerification({
      documentType,
      file,
      isDemoAccount: isLdaQaBypassInstructorEmail(userEmail)
    });
    const { error: uploadError } = await writeClient.storage.from(instructorDocumentsBucket).upload(storagePath, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false
    });

    if (uploadError) {
      transferRedirect(`${label} could not be uploaded. ${uploadError.message}`);
    }

    const { data: insertedDocument, error: documentError } = await writeClient
      .from("instructor_documents")
      .insert({
        instructor_id: userId,
        uploaded_by: userId,
        document_type: documentType,
        storage_path: storagePath,
        status: "pending",
        is_current: false,
        version_state: "pending",
        ...aiVerification
      })
      .select("id")
      .single();

    if (documentError) {
      await writeClient.storage.from(instructorDocumentsBucket).remove([storagePath]);
      transferRedirect(`${label} could not be saved for review. ${documentError.message}`);
    }

    await trySaveDocumentSecurityMetadata({ client: writeClient, documentId: insertedDocument.id, scan });
    await recordInstructorVerificationAudit({
      client: writeClient,
      instructorId: userId,
      actorUserId: userId,
      documentId: insertedDocument.id,
      documentType,
      action: "upload",
      outcome: "success",
      notes: "Learner submitted instructor transfer evidence for LDA admin review."
    });
  }
}

export async function requestInstructorTransfer(formData: FormData) {
  const supabase = await createClient();

  if (!supabase) {
    transferRedirect("Secure account access is temporarily unavailable. Please try again later.");
  }

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/auth/login?role=learner&message=Log in to your learner account before applying to become an instructor.");
  }

  const roles = await getMarketplaceRolesForUser(supabase, user.id);

  if (roles.includes("instructor")) {
    redirect("/instructor-dashboard");
  }

  if (!roles.includes("learner")) {
    redirect("/auth/verify?role=learner&message=Complete learner setup before applying to become an instructor.");
  }

  const requestClient = createAdminClient() ?? supabase;
  const { data: existingTransfer } = await requestClient
    .from("account_role_transfer_requests")
    .select("status")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingTransfer?.status && ["requested", "approved"].includes(existingTransfer.status)) {
    transferRedirect("Your instructor application has already been submitted for LDA review.");
  }

  const { data: existingInstructorProfile, error: existingInstructorProfileError } = await supabase
    .from("instructor_profiles")
    .select("verification_status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingInstructorProfileError) {
    transferRedirect(existingInstructorProfileError.message);
  }

  if (existingInstructorProfile?.verification_status === "approved") {
    redirect("/instructor-dashboard");
  }

  const notes = String(formData.get("notes") ?? "").trim();
  const { data: profile } = await requestClient
    .from("profiles")
    .select("full_name,email")
    .eq("id", user.id)
    .maybeSingle();

  const { error: draftProfileError } = await requestClient.from("instructor_profiles").upsert({
    user_id: user.id,
    display_name: profile?.full_name || profile?.email || user.email || "LDA instructor",
    verification_status: "draft",
    instructor_package: "instructor",
    instructor_subscription_status: "draft",
    instructor_package_started_at: null,
    instructor_package_expires_at: null,
    instructor_package_source: "application"
  }, { onConflict: "user_id" });

  if (draftProfileError) {
    transferRedirect(draftProfileError.message);
  }

  await uploadTransferDocuments({
    writeClient: requestClient,
    userId: user.id,
    userEmail: user.email,
    formData
  });

  const { error: requestError } = await requestClient.from("account_role_transfer_requests").insert({
    user_id: user.id,
    from_role: "learner",
    to_role: "instructor",
    notes: notes || "Learner-to-instructor ADI evidence uploaded for LDA admin review. Instructor profile details must be collected after approval.",
    status: "requested"
  });

  if (requestError) {
    transferRedirect(requestError.message);
  }

  const { error: learnerRoleDeleteError } = await requestClient
    .from("account_roles")
    .delete()
    .eq("user_id", user.id)
    .eq("role", "learner");

  if (learnerRoleDeleteError) {
    transferRedirect(learnerRoleDeleteError.message);
  }

  const { error: instructorRoleError } = await requestClient.from("account_roles").upsert({
    user_id: user.id,
    role: "instructor"
  }, { onConflict: "user_id,role" });

  if (instructorRoleError) {
    transferRedirect(instructorRoleError.message);
  }

  const { error: instructorProfileError } = await requestClient.from("instructor_profiles").upsert({
    user_id: user.id,
    display_name: profile?.full_name || profile?.email || user.email || "LDA instructor",
    verification_status: "pending",
    instructor_package: "instructor",
    instructor_subscription_status: "in_progress",
    instructor_package_started_at: null,
    instructor_package_expires_at: null,
    instructor_package_source: "application"
  }, { onConflict: "user_id" });

  if (instructorProfileError) {
    transferRedirect(instructorProfileError.message);
  }

  const { error: notificationError } = await requestClient.from("notifications").insert({
    user_id: user.id,
    notification_type: "instructor_application_under_review",
    title: "Your instructor application is under review",
    body: "LDA has received your ADI evidence. Your account is now in progress while admin reviews your documents."
  });

  if (notificationError) {
    console.error("[instructor-transfer] notification failed", {
      userId: user.id,
      error: notificationError.message
    });
  }

  const recipientEmail = profile?.email || user.email || "";
  if (recipientEmail) {
    try {
      await sendInstructorVerificationSubmittedEmail({
        to: recipientEmail,
        fullName: profile?.full_name || "",
        statusUrl: `${getAppOrigin()}/instructor-dashboard?verification=pending`
      });
    } catch (emailError) {
      console.error("[instructor-transfer] review email failed", {
        userId: user.id,
        error: emailError
      });
    }
  }

  revalidatePath("/account/instructor-transfer");
  revalidatePath("/dashboard");
  revalidatePath("/instructor-dashboard");
  redirect("/instructor-dashboard?verification=pending");
}
