import { redirect } from "next/navigation";
import { PageTopBar } from "@/components/page-top-bar";
import {
  InstructorVehicleComplianceWorkspace,
  type ComplianceItem,
  type ComplianceStatus
} from "@/components/instructor-vehicle-compliance-workspace";
import {
  formatInstructorDocumentExpiry,
  getInstructorDocumentExpiryState
} from "@/lib/instructor-document-expiry";
import {
  getCurrentInstructorDocument,
  getPendingInstructorDocument,
  isApprovedInstructorDocumentStatus
} from "@/lib/instructor-document-versioning";
import { getInstructorApprovalState, redirectUnlessApprovedInstructor } from "@/lib/instructor-approval";
import {
  flattenInstructorVerificationRequirements,
  getInstructorVerificationRequirements,
  type InstructorVerificationRequirement
} from "@/lib/instructor-verification-requirements";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type InstructorDocumentMetadataRow = {
  id: string;
  document_type: string;
  status: string | null;
  created_at: string | null;
  reviewed_at: string | null;
  expires_at: string | null;
  document_version: number | null;
  storage_deleted_at: string | null;
  is_current: boolean | null;
  version_state: string | null;
};

function normaliseStatus(value?: string | null) {
  return String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function ownerForGroup(group: InstructorVerificationRequirement["group"]) {
  if (group === "vehicle") return "Vehicle";
  if (group === "insurance") return "Insurance";
  if (group === "authority" || group === "identity" || group === "professional") return "Instructor";
  return "LDA";
}

function statusForDocument(document?: InstructorDocumentMetadataRow | null): ComplianceStatus {
  if (!document) return "missing";
  const status = normaliseStatus(document.status);
  if (status === "rejected") return "missing";
  if (status === "pending" || status === "under_review" || status === "in_review") return "review";
  if (status === "approved" || status === "completed" || status === "clear") {
    const expiry = getInstructorDocumentExpiryState(document.expires_at);
    if (expiry.status === "expired") return "missing";
    if (expiry.status === "due_soon") return "due";
    return "verified";
  }
  return "review";
}

function buildComplianceItems(
  requirements: InstructorVerificationRequirement[],
  documents: InstructorDocumentMetadataRow[]
): ComplianceItem[] {
  return requirements.map((requirement) => {
    const current = getCurrentInstructorDocument(documents, requirement.type);
    const pending = getPendingInstructorDocument(documents, requirement.type);
    const document = current ?? pending;
    const status = statusForDocument(document);
    const expiry = document?.expires_at ? formatInstructorDocumentExpiry(document.expires_at) : "Not recorded";
    const expiryState = getInstructorDocumentExpiryState(document?.expires_at);
    const hasApprovedCurrent = isApprovedInstructorDocumentStatus(current?.status);
    const note =
      status === "verified" && hasApprovedCurrent
        ? pending
          ? `Approved by LDA. Version ${current?.document_version ?? 1} stays current while replacement version ${pending.document_version ?? 1} is reviewed.`
          : `Approved by LDA. Version ${current?.document_version ?? 1} is current.`
        : status === "due"
          ? `${expiryState.label}. Upload renewal evidence before learner-facing availability is restricted.`
          : status === "review"
            ? "Evidence is with LDA for review. Uploaded files are private and cannot be reopened from this page."
            : document
              ? "Evidence needs replacement or has expired. Upload a current document for LDA review."
              : "Required evidence has not been uploaded yet.";

    return {
      id: requirement.type,
      title: requirement.label,
      owner: ownerForGroup(requirement.group),
      expiry,
      status,
      note
    };
  });
}

export default async function InstructorVehicleCompliancePage() {
  const supabase = await createClient();

  if (hasSupabaseConfig() && supabase) {
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/auth/login?role=instructor");
    }

    const [approvalState, { data: profile }, { data: documentRows }] = await Promise.all([
      getInstructorApprovalState(supabase, user.id),
      supabase.from("profiles").select("full_name,email").eq("id", user.id).maybeSingle(),
      supabase
        .from("instructor_documents")
        .select("id,document_type,status,created_at,reviewed_at,expires_at,document_version,storage_deleted_at,is_current,version_state")
        .eq("instructor_id", user.id)
        .order("created_at", { ascending: false })
    ]);
    redirectUnlessApprovedInstructor(approvalState);
    const sections = await getInstructorVerificationRequirements(supabase);
    const complianceRequirements = flattenInstructorVerificationRequirements(sections).filter((document) =>
      ["authority", "vehicle", "insurance", "professional"].includes(document.group)
    );
    const complianceItems = buildComplianceItems(
      complianceRequirements,
      (documentRows as InstructorDocumentMetadataRow[] | null) ?? []
    );

    return (
      <>
        <PageTopBar backHref="/dashboard" backLabel="Back to dashboard" />
        <InstructorVehicleComplianceWorkspace
          instructorName={profile?.full_name || user.email || "LDA instructor"}
          initialComplianceItems={complianceItems}
        />
      </>
    );
  }

  return (
    <>
      <PageTopBar backHref="/dashboard" backLabel="Back to dashboard" />
      <InstructorVehicleComplianceWorkspace instructorName="LDA instructor" />
    </>
  );
}
