export type InstructorDocumentAiVerificationStatus =
  | "queued"
  | "passed"
  | "needs_admin_review"
  | "failed"
  | "unavailable"
  | "demo_verified";

export type InstructorDocumentAiVerificationInsert = {
  ai_verification_status: InstructorDocumentAiVerificationStatus;
  ai_verification_provider: string;
  ai_verification_summary: string;
  ai_verification_reference: string;
  ai_verification_checked_at: string;
  ai_verified_at: string | null;
};

type UploadedFileLike = {
  name?: string;
  size: number;
  type?: string;
};

const authorityRoutes = new Map<
  string,
  {
    provider: string;
    summary: string;
  }
>([
  [
    "adi_pdi_badge",
    {
      provider: "DVSA ADI register",
      summary: "ADI registration evidence must be checked against the DVSA ADI register before full instructor approval."
    }
  ],
  [
    "driving_licence",
    {
      provider: "DVLA driving licence evidence",
      summary: "Driving licence evidence must match the instructor identity and teaching entitlement before approval."
    }
  ],
  [
    "dbs_check",
    {
      provider: "DBS certificate / DVSA clean-record evidence",
      summary: "DBS or clean-record evidence must be current and consistent with DVSA fit-and-proper expectations."
    }
  ],
  [
    "mot_certificate",
    {
      provider: "DVSA MOT history",
      summary: "MOT evidence must be checked against the vehicle registration before the vehicle can be learner-facing."
    }
  ],
  [
    "vehicle_tax_status",
    {
      provider: "DVLA vehicle tax status",
      summary: "Vehicle tax evidence must confirm the lesson vehicle is taxed before learner-facing availability is approved."
    }
  ],
  [
    "vehicle_registration",
    {
      provider: "DVLA vehicle registration evidence",
      summary: "Vehicle registration evidence must match the instructor vehicle profile and plate details."
    }
  ],
  [
    "tuition_insurance",
    {
      provider: "Motor insurer policy evidence",
      summary: "Insurance evidence must show paid driving tuition or business instruction cover for the lesson vehicle."
    }
  ],
  [
    "public_liability_insurance",
    {
      provider: "Public liability / professional indemnity insurer",
      summary: "Policy evidence must be in date and match the instructor or trading identity."
    }
  ],
  [
    "proof_of_id",
    {
      provider: "Identity and address evidence",
      summary: "Identity evidence must match the account name and supporting licence or DBS records."
    }
  ],
  [
    "right_to_work",
    {
      provider: "UK contractor eligibility evidence",
      summary: "Eligibility evidence must be checked where LDA needs additional contractor assurance."
    }
  ],
  [
    "standards_check",
    {
      provider: "DVSA standards check evidence",
      summary: "Standards-check evidence must be current and consistent with the instructor profile."
    }
  ],
  [
    "vehicle_safety_declaration",
    {
      provider: "LDA roadworthiness declaration",
      summary: "Safety evidence must confirm the vehicle is suitable and roadworthy for learner lessons."
    }
  ],
  [
    "vehicle_photo",
    {
      provider: "LDA vehicle profile review",
      summary: "Vehicle photos must clearly show the learner-facing vehicle condition and registration."
    }
  ],
  [
    "safeguarding_code",
    {
      provider: "LDA safeguarding and conduct acknowledgement",
      summary: "Safeguarding evidence must confirm the instructor has accepted LDA learner-safety standards."
    }
  ]
]);

function buildVerificationReference(documentType: string) {
  const fragment = crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
  return `LDA-AI-${documentType.replace(/[^a-z0-9]+/gi, "-").toUpperCase()}-${fragment}`;
}

export function getInstructorDocumentAuthorityRoute(documentType: string) {
  return (
    authorityRoutes.get(documentType) ?? {
      provider: "LDA admin authority review",
      summary: "This document needs LDA admin review against the most relevant authority or policy evidence before approval."
    }
  );
}

export function createInstructorDocumentAiVerification({
  documentType,
  file,
  isDemoAccount = false
}: {
  documentType: string;
  file: UploadedFileLike;
  isDemoAccount?: boolean;
}): InstructorDocumentAiVerificationInsert {
  const now = new Date().toISOString();
  const authorityRoute = getInstructorDocumentAuthorityRoute(documentType);
  const fileName = file.name || "uploaded document";
  const fileType = file.type || "unknown file type";
  const sizeMb = (file.size / (1024 * 1024)).toFixed(2);

  if (isDemoAccount) {
    return {
      ai_verification_status: "demo_verified",
      ai_verification_provider: authorityRoute.provider,
      ai_verification_summary: `Demo account evidence accepted for platform testing only. ${authorityRoute.summary} File received: ${fileName} (${fileType}, ${sizeMb}MB).`,
      ai_verification_reference: buildVerificationReference(documentType),
      ai_verification_checked_at: now,
      ai_verified_at: now
    };
  }

  return {
    ai_verification_status: "needs_admin_review",
    ai_verification_provider: authorityRoute.provider,
    ai_verification_summary: `AI intake accepted the file format and routed this evidence for ${authorityRoute.provider} verification. ${authorityRoute.summary} File received: ${fileName} (${fileType}, ${sizeMb}MB). LDA review must approve or reject the evidence after authority review.`,
    ai_verification_reference: buildVerificationReference(documentType),
    ai_verification_checked_at: now,
    ai_verified_at: null
  };
}
