"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getMarketplaceRolesForUser } from "@/lib/account-role-guard";
import { createClient } from "@/lib/supabase/server";

function isLicenceHeldForTwoYears(value: string) {
  const heldSince = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(heldSince.getTime())) {
    return false;
  }

  const eligibleFrom = new Date(heldSince);
  eligibleFrom.setUTCFullYear(eligibleFrom.getUTCFullYear() + 2);
  return eligibleFrom.getTime() <= Date.now();
}

function transferRedirect(message: string): never {
  redirect(`/account/instructor-transfer?message=${encodeURIComponent(message)}`);
}

type TransferDocumentField = {
  fieldName: string;
  documentType: "adi_pdi_badge" | "driving_licence" | "insurance";
  label: string;
};

type UploadedFileLike = Blob & {
  name?: string;
  size: number;
};

const transferDocumentFields: TransferDocumentField[] = [
  { fieldName: "adiPdiDocument", documentType: "adi_pdi_badge", label: "ADI/PDI badge or certificate" },
  { fieldName: "drivingLicenceDocument", documentType: "driving_licence", label: "Driving licence" },
  { fieldName: "insuranceDocument", documentType: "insurance", label: "Insurance certificate" }
];

function getUploadedFile(formData: FormData, fieldName: string): UploadedFileLike | null {
  const value = formData.get(fieldName);

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

async function uploadTransferDocuments(supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>, userId: string, formData: FormData) {
  for (const { fieldName, label } of transferDocumentFields) {
    if (!getUploadedFile(formData, fieldName)) {
      transferRedirect(`Upload your ${label.toLowerCase()} before requesting instructor transfer.`);
    }
  }

  for (const { fieldName, documentType, label } of transferDocumentFields) {
    const file = getUploadedFile(formData, fieldName);

    if (!file) {
      transferRedirect(`Upload your ${label.toLowerCase()} before requesting instructor transfer.`);
    }

    if (file.size > 8 * 1024 * 1024) {
      transferRedirect(`${label} must be under 8MB.`);
    }

    const storagePath = `${userId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
    const { error: uploadError } = await supabase.storage.from("instructor-documents").upload(storagePath, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false
    });

    if (uploadError) {
      transferRedirect(`${label} could not be uploaded. ${uploadError.message}`);
    }

    const { error: documentError } = await supabase.from("instructor_documents").insert({
      instructor_id: userId,
      uploaded_by: userId,
      document_type: documentType,
      storage_path: storagePath,
      status: "pending"
    });

    if (documentError) {
      transferRedirect(`${label} could not be saved for review. ${documentError.message}`);
    }
  }
}

export async function requestInstructorTransfer(formData: FormData) {
  const supabase = await createClient();

  if (!supabase) {
    transferRedirect("Supabase is not configured yet.");
  }

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/auth/login?role=learner&message=Log in to your learner account before requesting an instructor transfer.");
  }

  const roles = await getMarketplaceRolesForUser(supabase, user.id);

  if (roles.includes("instructor")) {
    redirect("/instructor-dashboard");
  }

  if (!roles.includes("learner")) {
    redirect("/auth/verify?role=learner&message=Complete learner setup before requesting an instructor transfer.");
  }

  const fullLicenceHeldSince = String(formData.get("fullLicenceHeldSince") ?? "").trim();
  const adiPdiStatus = String(formData.get("adiPdiStatus") ?? "PDI");
  const adiPdiNumber = String(formData.get("adiPdiNumber") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const basePostcode = String(formData.get("basePostcode") ?? "").trim().toUpperCase();
  const hourlyRatePence = Math.round(Number(formData.get("hourlyRate") ?? "0") * 100);
  const areasCovered = String(formData.get("areasCovered") ?? "")
    .split(",")
    .map((area) => area.trim())
    .filter(Boolean);

  if (!isLicenceHeldForTwoYears(fullLicenceHeldSince)) {
    transferRedirect("Your full licence date is not eligible for an instructor transfer yet.");
  }

  if (!adiPdiNumber || !basePostcode || hourlyRatePence <= 0 || areasCovered.length === 0) {
    transferRedirect("Add your ADI/PDI number, base postcode, hourly price, and areas covered before requesting instructor transfer.");
  }

  const { error: learnerError } = await supabase
    .from("learner_profiles")
    .update({
      full_licence_held_since: fullLicenceHeldSince,
      full_licence_confirmed_at: new Date().toISOString()
    })
    .eq("user_id", user.id);

  if (learnerError) {
    transferRedirect(learnerError.message);
  }

  const { error: instructorProfileError } = await supabase.from("instructor_profiles").upsert({
    user_id: user.id,
    display_name: user.user_metadata?.full_name || user.email || "LDA instructor",
    adi_pdi_status: adiPdiStatus === "ADI" ? "ADI" : "PDI",
    adi_pdi_number: adiPdiNumber,
    verification_status: "pending",
    hourly_rate_pence: hourlyRatePence,
    transmission: String(formData.get("transmission") ?? "manual") === "automatic" ? "automatic" : "manual",
    car_make: String(formData.get("carMake") ?? "").trim() || null,
    car_model: String(formData.get("carModel") ?? "").trim() || null,
    areas_covered: areasCovered,
    base_postcode: basePostcode
  });

  if (instructorProfileError) {
    transferRedirect(instructorProfileError.message);
  }

  await uploadTransferDocuments(supabase, user.id, formData);

  const { error: requestError } = await supabase.from("account_role_transfer_requests").insert({
    user_id: user.id,
    from_role: "learner",
    to_role: "instructor",
    full_licence_held_since: fullLicenceHeldSince,
    adi_pdi_status: adiPdiStatus === "ADI" ? "ADI" : "PDI",
    adi_pdi_number: adiPdiNumber || null,
    notes: notes || null,
    status: "requested"
  });

  if (requestError) {
    transferRedirect(requestError.message);
  }

  revalidatePath("/account/instructor-transfer");
  redirect("/account/instructor-transfer?message=Instructor transfer request submitted for LDA admin review.");
}
