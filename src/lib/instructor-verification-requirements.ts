export type InstructorVerificationDocumentType =
  | "passport"
  | "national_id_card"
  | "professional_licence"
  | "teaching_qualification"
  | "adi_pdi_badge"
  | "driving_licence"
  | "proof_of_id"
  | "proof_of_address"
  | "insurance"
  | "tuition_insurance"
  | "mot_certificate"
  | "vehicle_tax_status"
  | "vehicle_registration"
  | "vehicle_safety_declaration"
  | "public_liability_insurance"
  | "standards_check"
  | "safeguarding_code"
  | "right_to_work"
  | "dbs_check"
  | "vehicle_photo"
  | "other";

export type InstructorVerificationRequirement = {
  type: InstructorVerificationDocumentType;
  label: string;
  detail: string;
  requirement: "required" | "recommended";
  group: "identity" | "authority" | "vehicle" | "insurance" | "professional" | "supporting";
  displayOrder: number;
};

export type InstructorVerificationRequirementSection = {
  title: string;
  description: string;
  documents: InstructorVerificationRequirement[];
};

type SupabaseLikeClient = {
  from: (table: string) => any;
};

export const instructorVerificationRequirementSections: InstructorVerificationRequirementSection[] = [
  {
    title: "Identity",
    description: "Evidence used to confirm the person behind the instructor account while collecting only what LDA needs for verification.",
    documents: [
      {
        type: "driving_licence",
        label: "Full UK driving licence",
        detail: "Confirms the instructor holds the driving entitlement attached to their teaching vehicle and transmission.",
        requirement: "required",
        group: "identity",
        displayOrder: 20
      },
      {
        type: "proof_of_id",
        label: "Proof of ID",
        detail: "Optional identity evidence where LDA needs an additional identity check.",
        requirement: "recommended",
        group: "identity",
        displayOrder: 30
      }
    ]
  },
  {
    title: "Instructor authority",
    description: "Proof that the instructor is legally able to teach, charge for lessons, and remain in good standing with DVSA expectations.",
    documents: [
      {
        type: "adi_pdi_badge",
        label: "ADI badge or certificate",
        detail: "Confirms the DVSA ADI registration needed before an instructor can charge for lessons through LDA.",
        requirement: "required",
        group: "authority",
        displayOrder: 100
      },
      {
        type: "dbs_check",
        label: "DBS certificate",
        detail: "Supports DVSA fit-and-proper checks and the 4-year ADI renewal cycle before learner-facing availability is approved.",
        requirement: "required",
        group: "authority",
        displayOrder: 110
      },
      {
        type: "standards_check",
        label: "Latest ADI standards check",
        detail: "Supports teaching quality assurance, review history, and ongoing instructor development.",
        requirement: "recommended",
        group: "professional",
        displayOrder: 120
      },
      {
        type: "safeguarding_code",
        label: "Safeguarding and conduct agreement",
        detail: "Confirms the instructor has accepted LDA safeguarding, learner conduct, and platform safety standards.",
        requirement: "recommended",
        group: "professional",
        displayOrder: 130
      },
      {
        type: "right_to_work",
        label: "Right to work confirmation",
        detail: "Optional supporting evidence where LDA needs additional contractor eligibility checks.",
        requirement: "recommended",
        group: "professional",
        displayOrder: 140
      }
    ]
  },
  {
    title: "Vehicle compliance",
    description: "Vehicle evidence LDA needs before confidently listing a learner-facing lesson car on the platform.",
    documents: [
      {
        type: "mot_certificate",
        label: "Current MOT certificate or exemption evidence",
        detail: "Required for vehicles over 3 years old and used to evidence roadworthiness before lessons are offered.",
        requirement: "required",
        group: "vehicle",
        displayOrder: 200
      },
      {
        type: "vehicle_tax_status",
        label: "Vehicle tax status confirmation",
        detail: "Confirms the lesson vehicle is taxed before being used for learner lessons or test-day support.",
        requirement: "required",
        group: "vehicle",
        displayOrder: 210
      },
      {
        type: "vehicle_registration",
        label: "V5C, lease agreement, or keeper permission",
        detail: "Confirms the vehicle identity, registration, and authority to use it for LDA learner bookings.",
        requirement: "required",
        group: "vehicle",
        displayOrder: 220
      },
      {
        type: "vehicle_safety_declaration",
        label: "Lesson vehicle safety declaration",
        detail: "Confirms L-plates, mirrors, tyres, lights, brakes, roadworthiness, and any dual-control or test-suitability checks.",
        requirement: "required",
        group: "vehicle",
        displayOrder: 230
      },
      {
        type: "vehicle_photo",
        label: "Vehicle photos",
        detail: "Shows the learner-facing car condition, plates, mirrors, signage, and profile images before the vehicle goes live.",
        requirement: "recommended",
        group: "vehicle",
        displayOrder: 240
      }
    ]
  },
  {
    title: "Insurance and professional cover",
    description: "Insurance evidence that protects learners, instructors, and LDA before lessons or platform bookings are accepted.",
    documents: [
      {
        type: "tuition_insurance",
        label: "Paid driving tuition motor insurance",
        detail: "Must show the vehicle is insured for paid driving instruction or business tuition use, not ordinary private cover only.",
        requirement: "required",
        group: "insurance",
        displayOrder: 300
      },
      {
        type: "insurance",
        label: "General insurance evidence",
        detail: "Optional supporting insurance evidence where LDA asks for additional cover information.",
        requirement: "recommended",
        group: "insurance",
        displayOrder: 305
      },
      {
        type: "public_liability_insurance",
        label: "Public liability or professional indemnity cover",
        detail: "Useful platform protection evidence for claims, disputes, and professional services.",
        requirement: "recommended",
        group: "insurance",
        displayOrder: 310
      },
      {
        type: "other",
        label: "Other supporting documents",
        detail: "Any extra evidence LDA specifically asks for during verification.",
        requirement: "recommended",
        group: "supporting",
        displayOrder: 900
      }
    ]
  }
];

export const fallbackInstructorVerificationRequirements = instructorVerificationRequirementSections.flatMap(
  (section) => section.documents
);

export const fallbackRequiredInstructorDocumentTypes = fallbackInstructorVerificationRequirements
  .filter((document) => document.requirement === "required")
  .map((document) => document.type);

export function getFallbackRequirementByType(documentType: string) {
  return fallbackInstructorVerificationRequirements.find((document) => document.type === documentType) ?? null;
}

export async function getInstructorVerificationRequirements(client?: SupabaseLikeClient | null) {
  if (!client) {
    return instructorVerificationRequirementSections;
  }

  try {
    const { data, error } = await client
      .from("instructor_verification_document_requirements")
      .select("document_type,label,detail,requirement,category,display_order,is_enabled")
      .eq("is_enabled", true)
      .order("display_order", { ascending: true });

    if (error || !Array.isArray(data) || data.length === 0) {
      return instructorVerificationRequirementSections;
    }

    const grouped = new Map<string, InstructorVerificationRequirementSection>();
    for (const row of data) {
      const group = String(row.category || "supporting") as InstructorVerificationRequirement["group"];
      const sectionTitle = sectionTitleForGroup(group);
      const existing = grouped.get(group) ?? {
        title: sectionTitle,
        description: sectionDescriptionForGroup(group),
        documents: []
      };

      existing.documents.push({
        type: row.document_type,
        label: row.label,
        detail: row.detail,
        requirement: row.requirement === "required" ? "required" : "recommended",
        group,
        displayOrder: Number(row.display_order ?? 999)
      });
      grouped.set(group, existing);
    }

    return [...grouped.values()];
  } catch {
    return instructorVerificationRequirementSections;
  }
}

export function flattenInstructorVerificationRequirements(sections: InstructorVerificationRequirementSection[]) {
  return sections.flatMap((section) => section.documents);
}

export function sectionTitleForGroup(group: InstructorVerificationRequirement["group"]) {
  switch (group) {
    case "identity":
      return "Identity";
    case "authority":
      return "Instructor authority";
    case "vehicle":
      return "Vehicle compliance";
    case "insurance":
      return "Insurance and professional cover";
    case "professional":
      return "Professional evidence";
    default:
      return "Supporting documents";
  }
}

function sectionDescriptionForGroup(group: InstructorVerificationRequirement["group"]) {
  switch (group) {
    case "identity":
      return "Evidence used to confirm the person behind the instructor account while collecting only what LDA needs for verification.";
    case "authority":
      return "Proof that the instructor is legally able to teach, charge for lessons, and remain in good standing with DVSA expectations.";
    case "vehicle":
      return "Vehicle evidence LDA needs before confidently listing a learner-facing lesson car on the platform.";
    case "insurance":
      return "Insurance evidence that protects learners, instructors, and LDA before lessons or platform bookings are accepted.";
    case "professional":
      return "Professional evidence used for quality assurance and specialist instructor records.";
    default:
      return "Any extra evidence LDA specifically asks for during verification.";
  }
}
