export const instructorDocumentTypesRequiringExpiry = new Set([
  "adi_pdi_badge",
  "driving_licence",
  "dbs_check",
  "standards_check",
  "tuition_insurance",
  "insurance",
  "public_liability_insurance",
  "mot_certificate",
  "vehicle_tax_status",
  "vehicle_safety_declaration"
]);

export function instructorDocumentRequiresExpiry(documentType: string) {
  return instructorDocumentTypesRequiringExpiry.has(documentType);
}

export function normaliseInstructorDocumentExpiry(value: FormDataEntryValue | string | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return null;
  }

  const parsed = new Date(`${raw}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return raw;
}

export function formatInstructorDocumentExpiry(value?: string | null) {
  if (!value) {
    return "No expiry recorded";
  }

  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return "Expiry not recorded";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

export function getInstructorDocumentExpiryState(value?: string | null, now = new Date()) {
  if (!value) {
    return {
      status: "none" as const,
      daysRemaining: null,
      label: "No expiry recorded"
    };
  }

  const expiry = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(expiry.getTime())) {
    return {
      status: "none" as const,
      daysRemaining: null,
      label: "Expiry not recorded"
    };
  }

  const today = new Date(now);
  today.setUTCHours(12, 0, 0, 0);
  const daysRemaining = Math.ceil((expiry.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

  if (daysRemaining < 0) {
    return {
      status: "expired" as const,
      daysRemaining,
      label: `Expired ${formatInstructorDocumentExpiry(value)}`
    };
  }

  if (daysRemaining <= 30) {
    return {
      status: "due_soon" as const,
      daysRemaining,
      label: `Expires ${formatInstructorDocumentExpiry(value)}`
    };
  }

  return {
    status: "current" as const,
    daysRemaining,
    label: `Expires ${formatInstructorDocumentExpiry(value)}`
  };
}
