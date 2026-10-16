export const instructorDocumentsBucket = "instructor-documents";

export type InstructorDocumentStorageArea = "application" | "compliance" | "legacy";

export function safeInstructorDocumentFileName(value?: string) {
  return (
    String(value || "document")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "document"
  );
}

export function safeInstructorDocumentExtension(value?: string) {
  const extension = String(value || "")
    .toLowerCase()
    .match(/\.([a-z0-9]{1,8})$/)?.[1];

  if (extension === "jpeg") return "jpg";
  if (extension === "pdf" || extension === "jpg" || extension === "png") return extension;
  return "bin";
}

export function buildInstructorApplicationDocumentPath(userId: string, fileName?: string) {
  return `applications/${userId}/${crypto.randomUUID()}.${safeInstructorDocumentExtension(fileName)}`;
}

export function buildInstructorComplianceDocumentPath(userId: string, fileName?: string) {
  return `compliance/${userId}/${crypto.randomUUID()}.${safeInstructorDocumentExtension(fileName)}`;
}

export function getInstructorDocumentStorageArea(storagePath?: string | null): InstructorDocumentStorageArea {
  const area = String(storagePath ?? "").split("/")[0]?.trim().toLowerCase();

  if (area === "applications") return "application";
  if (area === "compliance") return "compliance";
  return "legacy";
}

export function getInstructorDocumentStorageAreaLabel(storagePath?: string | null) {
  const area = getInstructorDocumentStorageArea(storagePath);

  if (area === "application") return "In-progress application vault";
  if (area === "compliance") return "Instructor compliance vault";
  return "Legacy secure vault";
}
