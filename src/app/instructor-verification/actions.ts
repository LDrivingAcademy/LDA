"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type VerificationDocumentType =
  | "adi_pdi_badge"
  | "driving_licence"
  | "proof_of_id"
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
  "adi_pdi_badge",
  "driving_licence",
  "proof_of_id",
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

const allowedMimeTypes = new Set([
  "application/pdf",
  "image/heic",
  "image/heif",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp"
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

function safeFileName(value?: string) {
  return String(value || "document")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "document";
}

export async function uploadInstructorVerificationDocument(formData: FormData) {
  const supabase = await createClient();

  if (!supabase) {
    uploadRedirect("Supabase is not configured yet.");
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

  if (file.size > 8 * 1024 * 1024) {
    uploadRedirect("Verification documents must be under 8MB.");
  }

  if (file.type && !allowedMimeTypes.has(file.type.toLowerCase())) {
    uploadRedirect("Upload a PDF, JPG, PNG, WEBP, HEIC, or HEIF file.");
  }

  const { data: instructorProfile } = await supabase
    .from("instructor_profiles")
    .select("verification_status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (instructorProfile?.verification_status !== "approved") {
    const { error: profileError } = await supabase.from("instructor_profiles").upsert({
      user_id: user.id,
      display_name: user.user_metadata?.full_name || user.email || "LDA instructor",
      verification_status: "pending"
    });

    if (profileError) {
      uploadRedirect(profileError.message);
    }
  }

  const storagePath = `${user.id}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
  const { error: uploadError } = await supabase.storage.from("instructor-documents").upload(storagePath, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false
  });

  if (uploadError) {
    uploadRedirect(`Document could not be uploaded. ${uploadError.message}`);
  }

  const { error: documentError } = await supabase.from("instructor_documents").insert({
    instructor_id: user.id,
    uploaded_by: user.id,
    document_type: documentType,
    storage_path: storagePath,
    status: "pending"
  });

  if (documentError) {
    uploadRedirect(`Document could not be saved for review. ${documentError.message}`);
  }

  revalidatePath("/dashboard");
  revalidatePath("/instructor-dashboard");
  revalidatePath("/instructor-verification");
  uploadSuccessRedirect("Document uploaded. LDA can now review it.", documentType);
}
