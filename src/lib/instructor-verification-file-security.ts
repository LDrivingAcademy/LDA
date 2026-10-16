import { createHash } from "node:crypto";
import { normaliseBooleanEnv } from "@/lib/runtime-env";

type UploadedFileLike = Blob & {
  name?: string;
  size: number;
  type?: string;
};

export type InstructorVerificationFileScan = {
  ok: boolean;
  reason?: string;
  sha256?: string;
  mimeType?: string;
  extension?: "pdf" | "jpg" | "png";
  sizeBytes?: number;
  scanProvider: string;
  scanStatus: "passed" | "failed" | "unavailable";
};

const maxFileSizeBytes = 8 * 1024 * 1024;
const allowedMimeTypes = new Set(["application/pdf", "image/jpeg", "image/jpg", "image/png"]);
const allowedExtensions = new Set(["pdf", "jpg", "jpeg", "png"]);

export function normaliseInstructorVerificationStatus(value?: string | null) {
  return String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function isCompletedDocumentStatus(status?: string | null) {
  const normalised = normaliseInstructorVerificationStatus(status);
  return normalised === "completed" || normalised === "approved" || normalised === "clear";
}

export function isLockedForReviewStatus(status?: string | null) {
  const normalised = normaliseInstructorVerificationStatus(status);
  return normalised === "pending" || normalised === "submitted" || normalised === "under_review" || normalised === "in_review" || normalised === "upload_in_progress";
}

function getExtension(fileName?: string) {
  return String(fileName || "")
    .toLowerCase()
    .match(/\.([a-z0-9]{1,8})$/)?.[1];
}

function hasPdfMagic(bytes: Uint8Array) {
  return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
}

function hasJpegMagic(bytes: Uint8Array) {
  return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function hasPngMagic(bytes: Uint8Array) {
  return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
}

function detectExtensionFromBytes(bytes: Uint8Array): "pdf" | "jpg" | "png" | null {
  if (hasPdfMagic(bytes)) return "pdf";
  if (hasJpegMagic(bytes)) return "jpg";
  if (hasPngMagic(bytes)) return "png";
  return null;
}

function hasRiskyPdfActiveContent(buffer: Buffer) {
  const head = buffer.subarray(0, Math.min(buffer.length, 1024 * 1024)).toString("latin1").toLowerCase();
  return ["/javascript", "/js", "/openaction", "/launch", "/embeddedfile", "/xfa"].some((needle) => head.includes(needle));
}

async function scanWithExternalProvider(buffer: Buffer, file: UploadedFileLike) {
  const endpoint = process.env.LDA_MALWARE_SCAN_ENDPOINT?.trim();
  const token = process.env.LDA_MALWARE_SCAN_TOKEN?.trim();

  if (!endpoint) {
    return null;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: new Blob([new Uint8Array(buffer)], { type: file.type || "application/octet-stream" })
  });

  if (!response.ok) {
    return {
      ok: false,
      reason: "The malware scan service rejected this file.",
      scanProvider: "external_malware_scan",
      scanStatus: "failed" as const
    };
  }

  const result = await response.json().catch(() => ({}));
  const status = String(result.status ?? result.verdict ?? "passed").toLowerCase();
  const clean = status === "clean" || status === "passed" || status === "safe";

  return {
    ok: clean,
    reason: clean ? undefined : "The malware scan found a problem with this file.",
    scanProvider: "external_malware_scan",
    scanStatus: clean ? ("passed" as const) : ("failed" as const)
  };
}

export async function validateInstructorVerificationFile(file: UploadedFileLike): Promise<InstructorVerificationFileScan> {
  if (file.size <= 0) {
    return { ok: false, reason: "Choose a file before uploading.", scanProvider: "lda_file_validation", scanStatus: "failed" };
  }

  if (file.size > maxFileSizeBytes) {
    return { ok: false, reason: "Verification documents must be under 8MB.", scanProvider: "lda_file_validation", scanStatus: "failed" };
  }

  const extension = getExtension(file.name);
  if (!extension || !allowedExtensions.has(extension)) {
    return { ok: false, reason: "Upload a PDF, JPG, JPEG, or PNG file.", scanProvider: "lda_file_validation", scanStatus: "failed" };
  }

  const mimeType = String(file.type || "").toLowerCase();
  if (mimeType && !allowedMimeTypes.has(mimeType)) {
    return { ok: false, reason: "The file type does not match an allowed verification document format.", scanProvider: "lda_file_validation", scanStatus: "failed" };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const bytes = new Uint8Array(buffer);
  const detectedExtension = detectExtensionFromBytes(bytes);
  const normalisedExtension = extension === "jpeg" ? "jpg" : extension;

  if (!detectedExtension || detectedExtension !== normalisedExtension) {
    return { ok: false, reason: "The file appears corrupt or its content does not match the file extension.", scanProvider: "lda_file_validation", scanStatus: "failed" };
  }

  if (detectedExtension === "pdf" && hasRiskyPdfActiveContent(buffer)) {
    return { ok: false, reason: "This PDF contains active content that cannot be accepted for verification.", scanProvider: "lda_file_validation", scanStatus: "failed" };
  }

  const externalScan = await scanWithExternalProvider(buffer, file);
  if (externalScan && !externalScan.ok) {
    return externalScan;
  }

  if (!externalScan && normaliseBooleanEnv(process.env.LDA_REQUIRE_EXTERNAL_MALWARE_SCAN)) {
    return {
      ok: false,
      reason: "The malware scan service is not configured, so verification uploads are temporarily unavailable.",
      scanProvider: "external_malware_scan",
      scanStatus: "unavailable"
    };
  }

  return {
    ok: true,
    sha256: createHash("sha256").update(buffer).digest("hex"),
    mimeType: mimeType || (detectedExtension === "pdf" ? "application/pdf" : detectedExtension === "png" ? "image/png" : "image/jpeg"),
    extension: detectedExtension,
    sizeBytes: file.size,
    scanProvider: externalScan?.scanProvider ?? "lda_structural_file_scan",
    scanStatus: "passed"
  };
}
