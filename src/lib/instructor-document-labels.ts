const instructorDocumentLabels = new Map<string, string>([
  ["passport", "passport"],
  ["national_id_card", "national ID card"],
  ["professional_licence", "professional licence"],
  ["teaching_qualification", "teaching qualification"],
  ["adi_pdi_badge", "ADI badge or certificate"],
  ["driving_licence", "driving licence"],
  ["proof_of_id", "proof of ID"],
  ["proof_of_address", "proof of address"],
  ["insurance", "insurance document"],
  ["tuition_insurance", "tuition insurance"],
  ["mot_certificate", "MOT certificate"],
  ["vehicle_tax_status", "vehicle tax status"],
  ["vehicle_registration", "vehicle registration document"],
  ["vehicle_safety_declaration", "vehicle safety declaration"],
  ["public_liability_insurance", "public liability insurance"],
  ["standards_check", "DVSA standards check"],
  ["safeguarding_code", "safeguarding code"],
  ["right_to_work", "right to work document"],
  ["dbs_check", "DBS check"],
  ["vehicle_photo", "vehicle photo"],
  ["other", "supporting document"]
]);

export function getInstructorDocumentLabel(documentType?: string | null) {
  const normalised = String(documentType ?? "").trim().toLowerCase();
  const fallback = normalised.replaceAll("_", " ");
  return instructorDocumentLabels.get(normalised) ?? (fallback || "instructor document");
}
