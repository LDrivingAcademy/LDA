import { getInstructorDocumentExpiryState } from "@/lib/instructor-document-expiry";

export type InstructorDocumentVersionRow = {
  id: string;
  instructor_id?: string | null;
  document_type: string;
  status?: string | null;
  created_at?: string | null;
  expires_at?: string | null;
  document_version?: number | null;
  is_current?: boolean | null;
  version_state?: string | null;
};

export function normaliseInstructorDocumentStatus(value?: string | null) {
  return String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function isApprovedInstructorDocumentStatus(value?: string | null) {
  const status = normaliseInstructorDocumentStatus(value);
  return status === "approved" || status === "completed" || status === "clear";
}

export function isPendingInstructorDocumentStatus(value?: string | null, versionState?: string | null) {
  const status = normaliseInstructorDocumentStatus(value);
  const state = normaliseInstructorDocumentStatus(versionState);
  return status === "pending" || status === "submitted" || status === "under_review" || status === "in_review" || state === "pending";
}

export function isRejectedInstructorDocumentStatus(value?: string | null, versionState?: string | null) {
  const status = normaliseInstructorDocumentStatus(value);
  const state = normaliseInstructorDocumentStatus(versionState);
  return status === "rejected" || state === "rejected" || state === "replacement_requested";
}

export function getDocumentVersionState(document?: Pick<InstructorDocumentVersionRow, "status" | "is_current" | "version_state"> | null) {
  const state = normaliseInstructorDocumentStatus(document?.version_state);
  if (document?.is_current || state === "current") return "current";
  if (isPendingInstructorDocumentStatus(document?.status, document?.version_state)) return "pending";
  if (state === "archived") return "archived";
  if (isRejectedInstructorDocumentStatus(document?.status, document?.version_state)) return state === "replacement_requested" ? "replacement_requested" : "rejected";
  if (isApprovedInstructorDocumentStatus(document?.status)) return "current";
  return state || "pending";
}

export function getDocumentVersionStateLabel(document?: Pick<InstructorDocumentVersionRow, "status" | "is_current" | "version_state"> | null) {
  const state = getDocumentVersionState(document);
  if (state === "current") return "Current";
  if (state === "pending") return "Pending review";
  if (state === "archived") return "Archived";
  if (state === "replacement_requested") return "Replacement requested";
  if (state === "rejected") return "Rejected";
  return "Under review";
}

function sortNewestFirst<T extends Pick<InstructorDocumentVersionRow, "created_at" | "document_version">>(documents: T[]) {
  return [...documents].sort((left, right) => {
    const rightVersion = Number(right.document_version ?? 0);
    const leftVersion = Number(left.document_version ?? 0);
    if (rightVersion !== leftVersion) return rightVersion - leftVersion;
    return new Date(right.created_at ?? 0).getTime() - new Date(left.created_at ?? 0).getTime();
  });
}

export function getCurrentInstructorDocument<T extends InstructorDocumentVersionRow>(documents: T[], documentType: string) {
  const typed = sortNewestFirst(documents.filter((document) => document.document_type === documentType));
  return (
    typed.find((document) => getDocumentVersionState(document) === "current") ??
    typed.find((document) => isApprovedInstructorDocumentStatus(document.status)) ??
    null
  );
}

export function getPendingInstructorDocument<T extends InstructorDocumentVersionRow>(documents: T[], documentType: string) {
  const typed = sortNewestFirst(documents.filter((document) => document.document_type === documentType));
  return typed.find((document) => getDocumentVersionState(document) === "pending") ?? null;
}

export function getLatestInstructorDocument<T extends InstructorDocumentVersionRow>(documents: T[], documentType: string) {
  return sortNewestFirst(documents.filter((document) => document.document_type === documentType))[0] ?? null;
}

export function getNextInstructorDocumentVersion(documents: Pick<InstructorDocumentVersionRow, "document_version">[]) {
  const highest = documents.reduce((max, document) => Math.max(max, Number(document.document_version ?? 0)), 0);
  return highest > 0 ? highest + 1 : 1;
}

export function isCurrentDocumentValid(document?: Pick<InstructorDocumentVersionRow, "status" | "expires_at"> | null) {
  if (!document || !isApprovedInstructorDocumentStatus(document.status)) return false;
  return getInstructorDocumentExpiryState(document.expires_at).status !== "expired";
}
