import {
  instructorDocumentRequiresExpiry,
  normaliseInstructorDocumentExpiry
} from "@/lib/instructor-document-expiry";
import {
  getCurrentInstructorDocument,
  isApprovedInstructorDocumentStatus,
  type InstructorDocumentVersionRow
} from "@/lib/instructor-document-versioning";

export type FutureComplianceDocumentRow = InstructorDocumentVersionRow & {
  instructor_id?: string | null;
  renewal_reminder_sent_at?: string | null;
};

export type FutureComplianceIssue = {
  documentType: string;
  reason: "missing" | "not_approved" | "expiry_missing" | "expires_before_lesson";
  expiresAt?: string | null;
};

export type FutureComplianceStatus = {
  ok: boolean;
  lessonDate: string;
  issues: FutureComplianceIssue[];
  earliestExpiryDate: string | null;
};

type SupabaseLikeClient = {
  from: (table: string) => any;
};

const londonDateFormatter = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "Europe/London",
  year: "numeric"
});

export function londonDateKey(value: Date | string) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return londonDateFormatter.format(new Date());
  }

  return londonDateFormatter.format(date);
}

function expiryIsBeforeLesson(expiryDate: string, lessonDate: string) {
  return expiryDate < lessonDate;
}

export function getInstructorFutureComplianceStatus(
  documents: FutureComplianceDocumentRow[],
  requiredDocumentTypes: string[],
  lessonAt: Date | string
): FutureComplianceStatus {
  const lessonDate = londonDateKey(lessonAt);
  const issues: FutureComplianceIssue[] = [];
  const expiryDates: string[] = [];

  for (const documentType of Array.from(new Set(requiredDocumentTypes)).filter(Boolean)) {
    const document = getCurrentInstructorDocument(documents, documentType);

    if (!document) {
      issues.push({ documentType, reason: "missing" });
      continue;
    }

    if (!isApprovedInstructorDocumentStatus(document.status)) {
      issues.push({ documentType, reason: "not_approved", expiresAt: document.expires_at });
      continue;
    }

    if (!instructorDocumentRequiresExpiry(documentType)) {
      continue;
    }

    const expiryDate = normaliseInstructorDocumentExpiry(document.expires_at);
    if (!expiryDate) {
      issues.push({ documentType, reason: "expiry_missing", expiresAt: document.expires_at });
      continue;
    }

    expiryDates.push(expiryDate);
    if (expiryIsBeforeLesson(expiryDate, lessonDate)) {
      issues.push({ documentType, reason: "expires_before_lesson", expiresAt: expiryDate });
    }
  }

  return {
    ok: issues.length === 0,
    lessonDate,
    issues,
    earliestExpiryDate: expiryDates.sort()[0] ?? null
  };
}

export function getInstructorFutureComplianceBlockMessage(status: FutureComplianceStatus) {
  if (status.ok) return "";

  const expiring = status.issues.find((issue) => issue.reason === "expires_before_lesson");
  if (expiring?.expiresAt) {
    return `This instructor has compliance evidence expiring before ${status.lessonDate}. Please choose another instructor or an earlier valid lesson date.`;
  }

  return "This instructor needs LDA compliance review before learner-facing bookings can be accepted.";
}

export async function readInstructorFutureComplianceDocuments(
  client: SupabaseLikeClient | null | undefined,
  instructorIds: string[]
) {
  const ids = Array.from(new Set(instructorIds.filter(Boolean)));
  const byInstructor = new Map<string, FutureComplianceDocumentRow[]>();
  for (const id of ids) {
    byInstructor.set(id, []);
  }

  if (!client || !ids.length) {
    return byInstructor;
  }

  const { data, error } = await client
    .from("instructor_documents")
    .select("id,instructor_id,document_type,status,expires_at,created_at,updated_at,document_version,is_current,version_state,archived_at,archive_reason,replaced_by_document_id")
    .in("instructor_id", ids)
    .order("created_at", { ascending: false });

  if (error || !Array.isArray(data)) {
    return byInstructor;
  }

  for (const document of data as FutureComplianceDocumentRow[]) {
    if (!document.instructor_id) continue;
    byInstructor.set(document.instructor_id, [...(byInstructor.get(document.instructor_id) ?? []), document]);
  }

  return byInstructor;
}

export function filterAvailabilitySlotsByFutureCompliance<TSlot extends { instructor_id: string; starts_at: string }>(
  slots: TSlot[],
  documentsByInstructor: Map<string, FutureComplianceDocumentRow[]>,
  requiredDocumentTypes: string[]
) {
  return slots.filter((slot) => {
    const status = getInstructorFutureComplianceStatus(
      documentsByInstructor.get(slot.instructor_id) ?? [],
      requiredDocumentTypes,
      slot.starts_at
    );
    return status.ok;
  });
}

