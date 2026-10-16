import type { InstructorVerificationDocumentType } from "@/lib/instructor-verification-requirements";

export type InstructorTransferDocumentField = {
  fieldName: string;
  documentType: InstructorVerificationDocumentType;
  label: string;
  detail: string;
};

export const instructorTransferDocumentFields: InstructorTransferDocumentField[] = [
  {
    fieldName: "drivingLicenceDocument",
    documentType: "driving_licence",
    label: "Full UK driving licence evidence",
    detail: "Confirms the instructor holds the driving entitlement attached to their teaching vehicle and transmission."
  },
  {
    fieldName: "adiPdiDocument",
    documentType: "adi_pdi_badge",
    label: "ADI badge, PDI licence, or ADI certificate",
    detail: "Confirms DVSA instructor authority before LDA can allow paid learner-facing lessons."
  },
  {
    fieldName: "dbsDocument",
    documentType: "dbs_check",
    label: "DBS certificate",
    detail: "Supports fit-and-proper checks and the 4-year ADI renewal standard."
  },
  {
    fieldName: "motCertificateDocument",
    documentType: "mot_certificate",
    label: "Current MOT certificate or exemption evidence",
    detail: "Required for lesson vehicles over 3 years old before they can be listed for learner bookings."
  },
  {
    fieldName: "vehicleTaxStatusDocument",
    documentType: "vehicle_tax_status",
    label: "Vehicle tax status confirmation",
    detail: "Confirms the lesson vehicle is taxed before being used for learner lessons or test-day support."
  },
  {
    fieldName: "vehicleRegistrationDocument",
    documentType: "vehicle_registration",
    label: "V5C, lease agreement, or keeper permission",
    detail: "Confirms the vehicle identity, registration, and authority to use it for LDA learner bookings."
  },
  {
    fieldName: "vehicleSafetyDeclarationDocument",
    documentType: "vehicle_safety_declaration",
    label: "Lesson vehicle safety declaration",
    detail: "Confirms L-plates, mirrors, tyres, lights, brakes, roadworthiness, and lesson-car suitability checks."
  },
  {
    fieldName: "tuitionInsuranceDocument",
    documentType: "tuition_insurance",
    label: "Paid driving tuition motor insurance",
    detail: "Must show the vehicle is insured for paid driving instruction or business tuition use."
  }
];

export const instructorTransferDocumentTypes = instructorTransferDocumentFields.map((field) => field.documentType);

export function isInstructorTransferDocumentType(value: string): value is InstructorVerificationDocumentType {
  return instructorTransferDocumentTypes.includes(value as InstructorVerificationDocumentType);
}
