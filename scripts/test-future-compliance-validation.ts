import assert from "node:assert/strict";
import {
  filterAvailabilitySlotsByFutureCompliance,
  getInstructorFutureComplianceStatus,
  type FutureComplianceDocumentRow
} from "../src/lib/instructor-future-compliance";

const requiredTypes = [
  "driving_licence",
  "adi_pdi_badge",
  "dbs_check",
  "mot_certificate",
  "vehicle_tax_status",
  "vehicle_registration",
  "vehicle_safety_declaration",
  "tuition_insurance"
];

function document(type: string, expiresAt?: string | null): FutureComplianceDocumentRow {
  return {
    id: `${type}-doc`,
    instructor_id: "instructor-1",
    document_type: type,
    status: "approved",
    created_at: "2026-07-01T10:00:00.000Z",
    expires_at: expiresAt ?? null,
    document_version: 1,
    is_current: true,
    version_state: "current"
  };
}

function completeDocumentSet(overrides: Partial<Record<string, string | null>> = {}) {
  return requiredTypes.map((type) => document(type, overrides[type] === undefined ? "2026-12-31" : overrides[type]));
}

{
  const status = getInstructorFutureComplianceStatus(
    completeDocumentSet({ tuition_insurance: "2026-08-02" }),
    requiredTypes,
    "2026-08-02"
  );
  assert.equal(status.ok, true, "documents expiring on the lesson date remain valid for that date");
}

{
  const status = getInstructorFutureComplianceStatus(
    completeDocumentSet({ tuition_insurance: "2026-08-02" }),
    requiredTypes,
    "2026-08-03"
  );
  assert.equal(status.ok, false, "documents expiring before the lesson date block future bookings");
  assert.equal(status.issues[0]?.reason, "expires_before_lesson");
}

{
  const status = getInstructorFutureComplianceStatus(
    completeDocumentSet({ mot_certificate: null }),
    requiredTypes,
    "2026-08-20"
  );
  assert.equal(status.ok, false, "expiry-required documents without an expiry date are not valid for future lessons");
  assert.equal(status.issues.some((issue) => issue.reason === "expiry_missing"), true);
}

{
  const documentsByInstructor = new Map<string, FutureComplianceDocumentRow[]>([
    ["instructor-1", completeDocumentSet({ tuition_insurance: "2026-08-02" })]
  ]);
  const slots = [
    { instructor_id: "instructor-1", starts_at: "2026-08-02T10:00:00.000Z" },
    { instructor_id: "instructor-1", starts_at: "2026-08-03T10:00:00.000Z" }
  ];
  const filtered = filterAvailabilitySlotsByFutureCompliance(slots, documentsByInstructor, requiredTypes);
  assert.equal(filtered.length, 1, "slot filtering keeps valid dates and removes dates after expiry");
  assert.equal(filtered[0]?.starts_at, "2026-08-02T10:00:00.000Z");
}

console.log("Future compliance validation checks passed.");

