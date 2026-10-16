"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { ExternalLink, FileCheck2, Trash2 } from "lucide-react";

type SavedDraftDocument = {
  id: string;
  documentType: string;
  createdAt: string;
  previewHref: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
};

type InstructorApplicationDocumentPickerProps = {
  name: string;
  label: string;
  required?: boolean;
  disabled?: boolean;
  draftDocumentType?: string;
  initialDraftDocument?: SavedDraftDocument | null;
};

const acceptedInstructorDocumentTypes = ".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg";

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 KB";
  }

  const megabytes = bytes / (1024 * 1024);
  if (megabytes >= 1) {
    return `${megabytes.toFixed(megabytes >= 10 ? 0 : 1)} MB`;
  }

  return `${Math.ceil(bytes / 1024)} KB`;
}

function formatDraftDate(value?: string) {
  if (!value) {
    return "Saved to your account";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function InstructorApplicationDocumentPicker({
  name,
  label,
  required = false,
  disabled = false,
  draftDocumentType,
  initialDraftDocument = null
}: InstructorApplicationDocumentPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [reviewUrl, setReviewUrl] = useState<string | null>(null);
  const [savedDraftDocument, setSavedDraftDocument] = useState<SavedDraftDocument | null>(initialDraftDocument);
  const [draftState, setDraftState] = useState<"idle" | "saving" | "saved" | "deleting" | "error">(initialDraftDocument ? "saved" : "idle");
  const [draftMessage, setDraftMessage] = useState(initialDraftDocument ? "Draft saved to your account." : "");

  useEffect(() => {
    if (!selectedFile) {
      setReviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    setReviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedFile]);

  async function saveDraft(file: File) {
    if (!draftDocumentType) {
      return;
    }

    setDraftState("saving");
    setDraftMessage("Saving this document as a draft...");

    const formData = new FormData();
    formData.append("documentType", draftDocumentType);
    formData.append("documentFile", file);

    const response = await fetch("/api/account/instructor-transfer/draft-documents", {
      method: "POST",
      body: formData
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || !payload.document) {
      setDraftState("error");
      setDraftMessage(String(payload.error || "This document could not be saved as a draft."));
      return;
    }

    if (inputRef.current) {
      inputRef.current.value = "";
    }

    setSavedDraftDocument(payload.document as SavedDraftDocument);
    setDraftState("saved");
    setDraftMessage("Draft saved to your account. You can leave and come back before submitting.");
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0] ?? null;
    setSelectedFile(file);

    if (file && draftDocumentType) {
      void saveDraft(file);
    }
  }

  async function clearSelectedFile() {
    if (savedDraftDocument && draftDocumentType) {
      setDraftState("deleting");
      setDraftMessage("Removing saved draft...");

      const response = await fetch("/api/account/instructor-transfer/draft-documents", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ documentId: savedDraftDocument.id })
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setDraftState("error");
        setDraftMessage(String(payload.error || "This saved draft could not be removed."));
        return;
      }
    }

    if (inputRef.current) {
      inputRef.current.value = "";
    }

    setSelectedFile(null);
    setSavedDraftDocument(null);
    setDraftState("idle");
    setDraftMessage("");
  }

  const hasSavedDraft = Boolean(savedDraftDocument);
  const activeReviewUrl = reviewUrl || savedDraftDocument?.previewHref || "";
  const activeFileName = selectedFile?.name || savedDraftDocument?.fileName || label;
  const activeFileMeta = selectedFile
    ? `${formatFileSize(selectedFile.size)} | ${selectedFile.type || "Selected document"}`
    : savedDraftDocument?.fileSize
      ? `${formatFileSize(savedDraftDocument.fileSize)} | ${savedDraftDocument.mimeType || "Saved draft"}`
      : formatDraftDate(savedDraftDocument?.createdAt);
  const inputRequired = required && !draftDocumentType && !hasSavedDraft;
  const statusTitle = hasSavedDraft
    ? "Draft saved to your account"
    : draftState === "saving"
      ? "Saving draft"
      : "Document ready to submit";

  return (
    <div className="grid gap-2">
      <label className="grid gap-1">
        <span className="text-sm font-bold text-zinc-600">{label}</span>
        <input
          ref={inputRef}
          required={inputRequired}
          disabled={disabled || draftState === "deleting"}
          name={name}
          type="file"
          accept={acceptedInstructorDocumentTypes}
          onChange={handleFileChange}
          className="rounded border border-zinc-300 bg-white px-3 py-3 text-black file:mr-3 file:rounded file:border-0 file:bg-black file:px-3 file:py-2 file:text-sm file:font-black file:text-white disabled:cursor-not-allowed disabled:opacity-60"
        />
      </label>

      {selectedFile || hasSavedDraft ? (
        <div className="rounded border border-emerald-200 bg-emerald-50 p-3">
          <div className="flex items-start gap-3">
            <FileCheck2 className="mt-1 shrink-0 text-emerald-700" size={20} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-emerald-950">{statusTitle}</p>
              <p className="mt-1 break-words text-sm font-bold text-zinc-800">{activeFileName}</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-normal text-zinc-500">{activeFileMeta}</p>
            </div>
          </div>
          {draftMessage ? (
            <p className={`mt-3 text-xs font-black leading-5 ${draftState === "error" ? "text-brand" : "text-emerald-800"}`}>
              {draftMessage}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {activeReviewUrl ? (
              <a
                href={activeReviewUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 items-center gap-2 rounded bg-black px-3 py-2 text-sm font-black text-white"
              >
                <ExternalLink size={16} /> Review document
              </a>
            ) : null}
            <button
              type="button"
              onClick={clearSelectedFile}
              disabled={disabled || draftState === "saving" || draftState === "deleting"}
              className="inline-flex min-h-10 items-center gap-2 rounded border border-red-200 bg-white px-3 py-2 text-sm font-black text-brand disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Trash2 size={16} /> {hasSavedDraft ? "Delete draft" : "Remove"}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs font-bold leading-5 text-zinc-500">
          {draftDocumentType
            ? "Upload a PDF, JPG, JPEG, or PNG. LDA will save it as a draft so you can leave and return before submitting."
            : "Upload a PDF, JPG, JPEG, or PNG. You can review or remove it before submitting."}
        </p>
      )}
    </div>
  );
}
