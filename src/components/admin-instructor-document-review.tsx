"use client";

import { useState } from "react";
import { Bot, ExternalLink } from "lucide-react";
import {
  approveInstructorDocumentVersionAction,
  rejectInstructorDocumentVersionAction,
  requestInstructorDocumentReplacementVersionAction
} from "@/app/admin/instructors/actions";
import { formatInstructorDocumentExpiry, getInstructorDocumentExpiryState } from "@/lib/instructor-document-expiry";
import { getDocumentVersionState, getDocumentVersionStateLabel } from "@/lib/instructor-document-versioning";

type InstructorDocumentReviewProps = {
  instructorId: string;
  documentId: string;
  documentLabel: string;
  documentType: string;
  status: string;
  uploadedAt?: string | null;
  reviewedAt?: string | null;
  verifierName?: string | null;
  expiresAt?: string | null;
  documentVersion?: number | null;
  metadataLockedAt?: string | null;
  storageDeletedAt?: string | null;
  isCurrent?: boolean | null;
  versionState?: string | null;
  archivedAt?: string | null;
  archiveReason?: string | null;
  rejectionReason?: string | null;
  replacementRequestedAt?: string | null;
  reviewNote?: string | null;
  aiVerificationStatus?: string | null;
  aiVerificationProvider?: string | null;
  aiVerificationSummary?: string | null;
  aiVerificationReference?: string | null;
  aiVerificationCheckedAt?: string | null;
  aiVerifiedAt?: string | null;
  fileUrl?: string | null;
  storageAreaLabel?: string;
};

function normaliseStatus(value?: string | null) {
  return String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function isCompletedStatus(value?: string | null) {
  const status = normaliseStatus(value);
  return status === "completed" || status === "approved" || status === "clear";
}

function statusLabel(value?: string | null) {
  const status = normaliseStatus(value);
  if (status === "pending" || status === "under_review" || status === "in_review") return "Under review";
  if (isCompletedStatus(status)) return "Approved";
  if (status === "rejected") return "Rejected";
  return "Missing";
}

function formatDateTime(value?: string | null) {
  return value ? new Date(value).toLocaleString("en-GB") : "Not recorded";
}

export function AdminDocumentAiReviewPanel({
  documentType,
  status,
  aiVerificationStatus,
  aiVerificationProvider,
  aiVerificationSummary,
  aiVerificationReference,
  aiVerificationCheckedAt,
  aiVerifiedAt
}: {
  documentType: string;
  status: string;
  aiVerificationStatus?: string | null;
  aiVerificationProvider?: string | null;
  aiVerificationSummary?: string | null;
  aiVerificationReference?: string | null;
  aiVerificationCheckedAt?: string | null;
  aiVerifiedAt?: string | null;
}) {
  const aiStatus = normaliseStatus(aiVerificationStatus || "queued");
  const aiTone =
    aiStatus === "passed" || aiStatus === "demo_verified"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
      : aiStatus === "failed" || aiStatus === "unavailable"
        ? "border-red-500/50 bg-red-600 text-white"
        : "border-amber-500/40 bg-amber-500/10 text-amber-100";
  const checkedLabel = aiVerificationCheckedAt ? new Date(aiVerificationCheckedAt).toLocaleString("en-GB") : "Not checked yet";
  const verifiedLabel = aiVerifiedAt ? new Date(aiVerifiedAt).toLocaleString("en-GB") : "Not authority-approved yet";

  return (
    <div className="mt-3 rounded border border-zinc-800 bg-zinc-950 p-3 text-xs font-bold leading-5 text-zinc-400">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-red-100">
          <Bot size={15} className="text-brand" /> AI and authority verification
        </span>
        <span className={`rounded-full border px-2 py-1 text-[11px] font-black uppercase ${aiTone}`}>
          {aiStatus.replaceAll("_", " ")}
        </span>
      </div>
      <p className="mt-2">
        <span className="text-zinc-200">{documentType.replaceAll("_", " ")}</span> is currently{" "}
        <span className="text-zinc-200">{statusLabel(status)}</span>. Verification route:{" "}
        <span className="text-zinc-200">{aiVerificationProvider || "LDA admin authority review"}</span>.
      </p>
      <div className="mt-2 grid gap-1">
        <span>Reference: <span className="text-zinc-200">{aiVerificationReference || "Pending reference"}</span></span>
        <span>AI intake checked: <span className="text-zinc-200">{checkedLabel}</span></span>
        <span>Authority verified: <span className="text-zinc-200">{verifiedLabel}</span></span>
      </div>
      <p className="mt-2 text-zinc-300">
        {aiVerificationSummary ||
          "AI intake is queued. LDA admin must confirm the document against the relevant authority or policy evidence before marking it completed."}
      </p>
    </div>
  );
}

export function InstructorDocumentReview({
  instructorId,
  documentId,
  documentLabel,
  documentType,
  status,
  uploadedAt,
  reviewedAt,
  verifierName,
  expiresAt,
  documentVersion,
  metadataLockedAt,
  storageDeletedAt,
  isCurrent,
  versionState,
  archivedAt,
  archiveReason,
  rejectionReason,
  replacementRequestedAt,
  reviewNote,
  aiVerificationStatus,
  aiVerificationProvider,
  aiVerificationSummary,
  aiVerificationReference,
  aiVerificationCheckedAt,
  aiVerifiedAt,
  fileUrl,
  storageAreaLabel
}: InstructorDocumentReviewProps) {
  const [open, setOpen] = useState(false);
  const completed = isCompletedStatus(status);
  const versionStateValue = getDocumentVersionState({ status, is_current: isCurrent, version_state: versionState });
  const canReview = versionStateValue === "pending";
  const expiryState = getInstructorDocumentExpiryState(expiresAt);

  return (
    <div className="rounded border border-zinc-800 bg-zinc-950 p-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <span>
          <span className="block text-sm font-black text-zinc-100">{documentLabel}</span>
          <span className="mt-1 block text-xs font-bold uppercase text-zinc-500">{documentType.replaceAll("_", " ")}</span>
          <span className="mt-1 block text-xs font-bold text-zinc-400">
            Version {documentVersion ?? 1} &middot; Uploaded {formatDateTime(uploadedAt)}
          </span>
          <span className="mt-1 block text-xs font-black uppercase text-zinc-300">
            {getDocumentVersionStateLabel({ status, is_current: isCurrent, version_state: versionState })}
          </span>
          {storageAreaLabel ? (
            <span className="mt-1 block text-xs font-black uppercase text-red-100">{storageAreaLabel}</span>
          ) : null}
        </span>
        <span className={`rounded-full border px-3 py-1 text-xs font-black uppercase ${completed ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100" : normaliseStatus(status) === "rejected" ? "border-red-500/50 bg-red-600 text-white" : "border-amber-500/40 bg-amber-500/10 text-amber-100"}`}>
          {statusLabel(status)}
        </span>
      </button>

      {open ? (
        <div className="mt-3">
          <div className="grid gap-2 rounded border border-zinc-800 bg-black p-3 text-xs font-bold leading-5 text-zinc-400 sm:grid-cols-2">
            <span>Expiry: <span className={`text-zinc-200 ${expiryState.status === "expired" ? "text-red-100" : expiryState.status === "due_soon" ? "text-amber-100" : ""}`}>
              {expiresAt ? expiryState.label : formatInstructorDocumentExpiry(expiresAt)}
            </span></span>
            <span>Reviewed: <span className="text-zinc-200">{formatDateTime(reviewedAt)}</span></span>
            <span>Verifier: <span className="text-zinc-200">{verifierName || "Not assigned"}</span></span>
            <span>Metadata locked: <span className="text-zinc-200">{formatDateTime(metadataLockedAt)}</span></span>
            <span>Archived: <span className="text-zinc-200">{formatDateTime(archivedAt)}</span></span>
            <span>Replacement requested: <span className="text-zinc-200">{formatDateTime(replacementRequestedAt)}</span></span>
            {archiveReason ? <span className="sm:col-span-2">Archive reason: <span className="text-zinc-200">{archiveReason}</span></span> : null}
            {rejectionReason ? <span className="sm:col-span-2">Decision reason: <span className="text-zinc-200">{rejectionReason}</span></span> : null}
            {reviewNote ? <span className="sm:col-span-2">Review note: <span className="text-zinc-200">{reviewNote}</span></span> : null}
            <span className="sm:col-span-2">
              File retention: <span className="text-zinc-200">{storageDeletedAt ? `Legacy evidence removed ${formatDateTime(storageDeletedAt)}` : "Private evidence retained in the admin-only archive. Instructors cannot reopen files."}</span>
            </span>
          </div>
          <AdminDocumentAiReviewPanel
            documentType={documentType}
            status={status}
            aiVerificationStatus={aiVerificationStatus}
            aiVerificationProvider={aiVerificationProvider}
            aiVerificationSummary={aiVerificationSummary}
            aiVerificationReference={aiVerificationReference}
            aiVerificationCheckedAt={aiVerificationCheckedAt}
            aiVerifiedAt={aiVerifiedAt}
          />
          {fileUrl ? (
            <a
              href={fileUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-black uppercase text-zinc-100 hover:border-red-500"
            >
              <ExternalLink size={14} /> Open secure evidence
            </a>
          ) : (
            <div className="mt-3 rounded border border-zinc-800 bg-black p-3 text-xs font-bold text-zinc-500">
              Secure evidence link is unavailable for this document, usually because it was finalised before archive retention was introduced.
            </div>
          )}
          {canReview ? (
            <div className="mt-3 grid gap-3 rounded border border-zinc-800 bg-black p-3">
              <form action={approveInstructorDocumentVersionAction} className="grid gap-2">
                <input type="hidden" name="documentId" value={documentId} />
                <textarea
                  name="reviewNote"
                  rows={2}
                  defaultValue={`${documentLabel} version ${documentVersion ?? 1} approved by LDA.`}
                  className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs font-bold text-white"
                />
                <button type="submit" className="w-fit rounded-full bg-red-600 px-3 py-2 text-xs font-black text-white hover:bg-red-500">
                  Approve this version
                </button>
              </form>
              <details className="rounded border border-zinc-800 bg-zinc-950 p-3">
                <summary className="cursor-pointer text-xs font-black uppercase text-red-100">Reject or request another replacement</summary>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <form action={rejectInstructorDocumentVersionAction} className="grid gap-2">
                    <input type="hidden" name="documentId" value={documentId} />
                    <textarea
                      name="reason"
                      rows={3}
                      defaultValue="LDA could not approve this version from the evidence provided."
                      className="rounded border border-zinc-700 bg-black px-3 py-2 text-xs font-bold text-white"
                    />
                    <button type="submit" className="rounded-full border border-red-500/50 bg-red-700 px-3 py-2 text-xs font-black text-white hover:bg-red-600">
                      Reject version
                    </button>
                  </form>
                  <form action={requestInstructorDocumentReplacementVersionAction} className="grid gap-2">
                    <input type="hidden" name="documentId" value={documentId} />
                    <textarea
                      name="reason"
                      rows={3}
                      defaultValue="LDA needs a clearer or more current replacement for this document."
                      className="rounded border border-zinc-700 bg-black px-3 py-2 text-xs font-bold text-white"
                    />
                    <button type="submit" className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-black text-zinc-100 hover:border-red-500">
                      Request another replacement
                    </button>
                  </form>
                </div>
              </details>
            </div>
          ) : null}
          <p className="mt-3 rounded border border-zinc-800 bg-black p-3 text-xs font-bold leading-5 text-zinc-500">
            Decisions are stored with full audit history. Approved replacements become the current version; the previous approved version moves into archive.
          </p>
        </div>
      ) : null}
    </div>
  );
}
