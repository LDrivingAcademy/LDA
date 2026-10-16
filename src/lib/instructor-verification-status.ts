export type InstructorVerificationDisplay = {
  label: string;
  toneClass: string;
};

function titleCaseStatus(status: string) {
  return status
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normaliseVerificationStatus(status?: string | null) {
  return String(status || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function getInstructorVerificationDisplay(status?: string | null): InstructorVerificationDisplay {
  const normalised = normaliseVerificationStatus(status) || "not_started";

  if (normalised === "draft" || normalised === "not_started") {
    return {
      label: "Not started",
      toneClass: "border-zinc-200 bg-zinc-50 text-zinc-700"
    };
  }

  if (normalised === "documents_required") {
    return {
      label: "Documents required",
      toneClass: "border-amber-200 bg-amber-50 text-amber-900"
    };
  }

  if (normalised === "upload_in_progress" || normalised === "in_progress" || normalised === "in-progress") {
    return {
      label: "Upload in progress",
      toneClass: "border-sky-200 bg-sky-50 text-sky-800"
    };
  }

  if (normalised === "pending" || normalised === "submitted" || normalised === "under_review" || normalised === "in_review") {
    return {
      label: "Under review",
      toneClass: "border-amber-200 bg-amber-50 text-amber-900"
    };
  }

  if (normalised === "additional_documents_required") {
    return {
      label: "Additional documents required",
      toneClass: "border-red-200 bg-red-50 text-brand"
    };
  }

  if (normalised === "approved" || normalised === "verified" || normalised === "completed" || normalised === "clear") {
    return {
      label: "Verified",
      toneClass: "border-emerald-200 bg-emerald-50 text-emerald-800"
    };
  }

  if (normalised === "verification_expiring_soon") {
    return {
      label: "Verification expiring soon",
      toneClass: "border-amber-200 bg-amber-50 text-amber-900"
    };
  }

  if (normalised === "reverification_required") {
    return {
      label: "Reverification required",
      toneClass: "border-red-200 bg-red-50 text-brand"
    };
  }

  if (normalised === "rejected") {
    return {
      label: "Rejected",
      toneClass: "border-red-200 bg-red-50 text-brand"
    };
  }

  return {
    label: titleCaseStatus(normalised),
    toneClass: "border-zinc-200 bg-zinc-50 text-zinc-700"
  };
}

export function getInstructorVerificationDisplayFromEvidence(
  profileStatus?: string | null,
  documentStatuses: Array<string | null | undefined> = []
): InstructorVerificationDisplay {
  const normalisedProfile = normaliseVerificationStatus(profileStatus);
  const hasUploadedDocuments = documentStatuses.some((status) => Boolean(normaliseVerificationStatus(status)));

  if ((!normalisedProfile || normalisedProfile === "draft" || normalisedProfile === "not_started") && hasUploadedDocuments) {
    return getInstructorVerificationDisplay("pending");
  }

  return getInstructorVerificationDisplay(profileStatus);
}
