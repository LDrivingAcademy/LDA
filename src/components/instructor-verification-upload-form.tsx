"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, FileText, ImageIcon, Maximize2, Upload, X } from "lucide-react";

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
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
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
  const clearSelectedFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setIsPreviewOpen(false);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  return (
    <form action={uploadInstructorVerificationDocument} className="mt-4 rounded border border-zinc-200 bg-zinc-50 p-3">
      <input type="hidden" name="documentType" value={documentType} />
      <div className="grid gap-3 lg:grid-cols-[auto_auto_minmax(180px,1fr)] lg:items-start">
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
          <div className="relative max-w-sm rounded border border-zinc-200 bg-white p-2 pr-8">
            <button
              type="button"
              aria-label="Remove selected document"
              onClick={clearSelectedFile}
              className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:border-red-200 hover:text-brand"
            >
              <X size={14} />
            </button>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsPreviewOpen(true)}
                className="group relative flex h-16 w-20 shrink-0 items-center justify-center overflow-hidden rounded border border-zinc-200 bg-zinc-50 hover:ring-2 hover:ring-brand"
                aria-label={`Preview ${selectedFile.name}`}
              >
                {isPdf ? (
                  <FileText size={26} className="text-brand" />
                ) : isImage ? (
                  <img src={previewUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <ImageIcon size={26} className="text-brand" />
                )}
                <span className="absolute inset-0 hidden items-center justify-center bg-black/40 text-white group-hover:flex">
                  <Maximize2 size={16} />
                </span>
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs font-black uppercase text-zinc-700">
                  {isPdf ? <FileText size={14} className="text-brand" /> : <ImageIcon size={14} className="text-brand" />}
                  <span>{isPdf ? "PDF selected" : "Photo selected"}</span>
                </div>
                <p className="mt-1 truncate text-xs font-bold text-zinc-600">{selectedFile.name}</p>
                <button type="button" onClick={() => setIsPreviewOpen(true)} className="mt-1 text-xs font-black text-brand hover:underline">
                  Preview full size
                </button>
              </div>
            </div>
            {isPreviewOpen ? (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
                <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col rounded bg-white p-3 shadow-2xl">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-black">{selectedFile.name}</p>
                      <p className="text-xs font-bold text-zinc-500">{isPdf ? "PDF preview" : "Photo preview"}</p>
                    </div>
                    <button
                      type="button"
                      aria-label="Close preview"
                      onClick={() => setIsPreviewOpen(false)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 hover:border-red-200 hover:text-brand"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  {isPdf ? (
                    <iframe title={`${selectedFile.name} preview`} src={previewUrl} className="h-[75vh] w-full rounded border border-zinc-200 bg-white" />
                  ) : isImage ? (
                    <img src={previewUrl} alt={`${selectedFile.name} preview`} className="max-h-[75vh] w-full rounded border border-zinc-200 object-contain" />
                  ) : (
                    <div className="rounded border border-zinc-200 bg-zinc-50 p-5 text-sm font-bold text-zinc-600">
                      Preview is not available for this file type. The selected file name is shown above.
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <p className="mt-2 text-xs font-bold leading-5 text-zinc-500">
        Preview the selected file first, then upload when you are happy it is the correct document. Uploads must be photos or PDFs under 8MB.
      </p>
    </form>
  );
}
