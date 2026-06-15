"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, FileText, ImageIcon, Upload } from "lucide-react";

import { uploadInstructorVerificationDocument } from "@/app/instructor-verification/actions";

type InstructorVerificationUploadFormProps = {
  documentType: string;
  isUploaded: boolean;
  uploadedRecently?: boolean;
};

function UploadButton({ isUploaded, uploadedRecently }: { isUploaded: boolean; uploadedRecently: boolean }) {
  const { pending } = useFormStatus();
  const defaultLabel = isUploaded ? "Upload document again" : "Upload document";

  return (
    <button
      type="submit"
      disabled={pending || uploadedRecently}
      className={`rounded-full border px-3 py-1 text-xs font-black uppercase transition hover:ring-2 hover:ring-brand disabled:cursor-not-allowed ${
        uploadedRecently
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-red-200 bg-red-50 text-brand"
      }`}
    >
      {uploadedRecently ? (
        <span className="inline-flex items-center gap-2">
          <CheckCircle2 size={14} /> Document uploaded
        </span>
      ) : pending ? (
        "Uploading..."
      ) : (
        defaultLabel
      )}
    </button>
  );
}

export function InstructorVerificationUploadForm({
  documentType,
  isUploaded,
  uploadedRecently = false
}: InstructorVerificationUploadFormProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showUploaded, setShowUploaded] = useState(uploadedRecently);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  useEffect(() => {
    if (!showUploaded) {
      return;
    }

    const timeout = window.setTimeout(() => setShowUploaded(false), 4000);
    return () => window.clearTimeout(timeout);
  }, [showUploaded]);

  const isPdf = selectedFile?.type === "application/pdf" || selectedFile?.name.toLowerCase().endsWith(".pdf");
  const isImage = Boolean(selectedFile?.type.startsWith("image/"));

  return (
    <form action={uploadInstructorVerificationDocument} className="mt-4 rounded border border-zinc-200 bg-zinc-50 p-3">
      <input type="hidden" name="documentType" value={documentType} />
      <div className="grid gap-3 lg:grid-cols-[auto_auto_minmax(220px,1fr)] lg:items-start">
        <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-black uppercase text-zinc-800 hover:ring-2 hover:ring-brand">
          <Upload size={14} />
          Choose photo or PDF
          <input
            ref={inputRef}
            name="documentFile"
            type="file"
            accept="application/pdf,image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif"
            className="sr-only"
            required
            onChange={(event) => {
              setSelectedFile(event.currentTarget.files?.[0] ?? null);
              setShowUploaded(false);
            }}
          />
        </label>
        <UploadButton isUploaded={isUploaded} uploadedRecently={showUploaded} />
        {selectedFile && previewUrl ? (
          <div className="rounded border border-zinc-200 bg-white p-2">
            <div className="flex items-center gap-2 text-xs font-black uppercase text-zinc-700">
              {isPdf ? <FileText size={14} className="text-brand" /> : <ImageIcon size={14} className="text-brand" />}
              <span className="truncate">{selectedFile.name}</span>
            </div>
            {isPdf ? (
              <iframe title={`${selectedFile.name} preview`} src={previewUrl} className="mt-2 h-40 w-full rounded border border-zinc-200 bg-white" />
            ) : isImage ? (
              <img src={previewUrl} alt={`${selectedFile.name} preview`} className="mt-2 h-40 w-full rounded border border-zinc-200 object-contain" />
            ) : (
              <div className="mt-2 rounded border border-zinc-200 bg-zinc-50 p-3 text-xs font-bold text-zinc-600">
                Preview is not available for this file type. The selected file name is shown above.
              </div>
            )}
          </div>
        ) : null}
      </div>
      <p className="mt-2 text-xs font-bold leading-5 text-zinc-500">
        Preview the selected file first, then upload when you are happy it is the correct document. Uploads must be photos or PDFs under 8MB.
      </p>
    </form>
  );
}
