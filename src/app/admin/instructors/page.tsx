import Link from "next/link";
import { AlertTriangle, CarFront, FileCheck2, Star, type LucideIcon } from "lucide-react";
import { updateInstructorVerificationRequirementAction } from "@/app/admin/instructors/actions";
import { InstructorDocumentReview } from "@/components/admin-instructor-document-review";
import { InstructorAdminActions } from "@/components/admin-instructor-actions";
import { AdminPageHeader } from "@/components/admin-page-header";
import { AdminTopBar } from "@/components/admin-top-bar";
import { requireAdminDashboardClient } from "@/lib/admin-dashboard";
import { getInstructorDocumentExpiryState } from "@/lib/instructor-document-expiry";
import { getInstructorDocumentStorageAreaLabel } from "@/lib/instructor-document-storage";
import {
  getCurrentInstructorDocument,
  getPendingInstructorDocument,
  isApprovedInstructorDocumentStatus,
  isPendingInstructorDocumentStatus
} from "@/lib/instructor-document-versioning";
import {
  fallbackInstructorVerificationRequirements,
  flattenInstructorVerificationRequirements,
  getInstructorVerificationRequirements
} from "@/lib/instructor-verification-requirements";
import { formatMoney } from "@/lib/money";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true
  }
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
};

type InstructorRow = {
  user_id: string;
  display_name: string | null;
  adi_pdi_status: string | null;
  adi_pdi_number: string | null;
  verification_status: string | null;
  rejection_reason: string | null;
  hourly_rate_pence: number | null;
  transmission: string | null;
  car_make: string | null;
  car_model: string | null;
  car_registration: string | null;
  areas_covered: string[] | null;
  base_postcode: string | null;
  auto_accept_bookings: boolean | null;
  approved_at: string | null;
  instructor_package: string | null;
  instructor_subscription_status: string | null;
  instructor_package_expires_at: string | null;
  compliance_status: string | null;
  learner_availability_paused: boolean | null;
  learner_availability_pause_reason: string | null;
  compliance_reviewed_at: string | null;
  compliance_blocked_at: string | null;
  updated_at: string | null;
};

type DocumentRow = {
  id: string;
  instructor_id: string;
  document_type: string;
  storage_path: string | null;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  updated_at: string | null;
  expires_at: string | null;
  document_version: number | null;
  metadata_locked_at: string | null;
  storage_deleted_at: string | null;
  is_current: boolean | null;
  version_state: string | null;
  archived_at: string | null;
  archive_reason: string | null;
  replaced_by_document_id: string | null;
  rejection_reason: string | null;
  replacement_requested_at: string | null;
  review_note: string | null;
  renewal_reminder_sent_at: string | null;
  ai_verification_status: string | null;
  ai_verification_provider: string | null;
  ai_verification_summary: string | null;
  ai_verification_reference: string | null;
  ai_verification_checked_at: string | null;
  ai_verified_at: string | null;
};

type ReviewRow = {
  instructor_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

type RequiredInstructorDocument = {
  type: string;
  label: string;
  group: string;
};

const fallbackRequiredInstructorDocuments = fallbackInstructorVerificationRequirements
  .filter((document) => document.requirement === "required")
  .map((document) => ({
    type: document.type,
    label: document.label,
    group: document.group
  }));

const fallbackDocumentLabels = new Map(fallbackInstructorVerificationRequirements.map((document) => [document.type, document.label]));

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("en-GB") : "Not recorded";
}

function normaliseStatus(value?: string | null) {
  return String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function flagTone(status?: string | null) {
  const normalised = normaliseStatus(status);
  if (normalised === "approved" || normalised === "completed" || normalised === "clear") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-100";
  if (normalised === "due_soon") return "border-amber-500/40 bg-amber-500/10 text-amber-100";
  if (normalised === "blocked" || normalised === "rejected") return "border-red-500/50 bg-red-600 text-white";
  if (normalised === "expired") return "border-red-500/50 bg-red-600 text-white";
  return "border-amber-500/40 bg-amber-500/10 text-amber-100";
}

function getLatestDocumentsByType(documents: DocumentRow[]) {
  const latest = new Map<string, DocumentRow>();

  for (const document of documents) {
    if (!latest.has(document.document_type)) {
      latest.set(document.document_type, document);
    }
  }

  return latest;
}

function getActiveDocumentsByType(documents: DocumentRow[]) {
  const active = new Map<string, DocumentRow>();
  const documentTypes = Array.from(new Set(documents.map((document) => document.document_type)));
  for (const documentType of documentTypes) {
    const current = getCurrentInstructorDocument(documents, documentType);
    const pending = getPendingInstructorDocument(documents, documentType);
    active.set(documentType, current ?? pending ?? getLatestDocumentsByType(documents).get(documentType)!);
  }
  return active;
}

function getDocumentDisplayStatus(documents: DocumentRow[], documentType: string) {
  const currentDocument = getCurrentInstructorDocument(documents, documentType);
  const pendingDocument = getPendingInstructorDocument(documents, documentType);
  const latestDocument = currentDocument ?? pendingDocument ?? getLatestDocumentsByType(documents).get(documentType);
  const latestStatus = normaliseStatus(latestDocument?.status);
  if (!latestDocument) return "Missing";
  if (currentDocument && pendingDocument) return "Renewal review";
  if (pendingDocument || latestStatus === "pending" || latestStatus === "under_review" || latestStatus === "in_review") return "Under review";
  if (latestStatus === "completed" || latestStatus === "approved" || latestStatus === "clear") {
    const expiry = getInstructorDocumentExpiryState(latestDocument.expires_at);
    if (expiry.status === "expired") return "Expired";
    if (expiry.status === "due_soon") return "Due soon";
    return "Completed";
  }
  if (latestStatus === "rejected") return "Rejected";
  return latestDocument.status;
}

function getInstructorRiskSignals(
  instructor: InstructorRow,
  documents: DocumentRow[],
  reviews: ReviewRow[],
  requiredInstructorDocuments: RequiredInstructorDocument[] = fallbackRequiredInstructorDocuments
) {
  const latestDocuments = getActiveDocumentsByType(documents);
  const missingRequiredDocuments = requiredInstructorDocuments.filter((document) => !latestDocuments.has(document.type));
  const rejectedRequiredDocuments = requiredInstructorDocuments.filter((document) => normaliseStatus(latestDocuments.get(document.type)?.status) === "rejected");
  const expiredRequiredDocuments = requiredInstructorDocuments.filter((document) => {
    const latestDocument = latestDocuments.get(document.type);
    return isApprovedInstructorDocumentStatus(latestDocument?.status) &&
      getInstructorDocumentExpiryState(latestDocument?.expires_at).status === "expired";
  });
  const expiringRequiredDocuments = requiredInstructorDocuments.filter((document) => {
    const latestDocument = latestDocuments.get(document.type);
    return isApprovedInstructorDocumentStatus(latestDocument?.status) &&
      getInstructorDocumentExpiryState(latestDocument?.expires_at).status === "due_soon";
  });
  const pendingRequiredDocuments = requiredInstructorDocuments.filter((document) => {
    const latest = latestDocuments.get(document.type);
    return isPendingInstructorDocumentStatus(latest?.status, latest?.version_state);
  });
  const pendingDocuments = documents.filter((document) => {
    const status = normaliseStatus(document.status);
    return status === "pending" || status === "under_review" || status === "in_review";
  }).length;
  const rejectedDocuments = documents.filter((document) => normaliseStatus(document.status) === "rejected").length;
  const negativeReviews = reviews.filter((review) => review.rating <= 2);
  const authorityGaps = missingRequiredDocuments.filter((document) => document.group === "authority").length + rejectedRequiredDocuments.filter((document) => document.group === "authority").length;
  const vehicleGaps = missingRequiredDocuments.filter((document) => document.group === "vehicle").length + rejectedRequiredDocuments.filter((document) => document.group === "vehicle").length;
  const insuranceGaps = missingRequiredDocuments.filter((document) => document.group === "insurance").length + rejectedRequiredDocuments.filter((document) => document.group === "insurance").length;
  const signals = [
    instructor.verification_status && !["approved"].includes(instructor.verification_status) ? `${instructor.verification_status} verification` : "",
    instructor.compliance_status && instructor.compliance_status !== "clear" ? `${instructor.compliance_status} compliance` : "",
    instructor.learner_availability_paused ? "learner availability paused" : "",
    authorityGaps ? `${authorityGaps} authority / clean-record gap${authorityGaps === 1 ? "" : "s"}` : "",
    vehicleGaps ? `${vehicleGaps} MOT, tax, registration, or roadworthy gap${vehicleGaps === 1 ? "" : "s"}` : "",
    insuranceGaps ? "tuition insurance evidence gap" : "",
    pendingRequiredDocuments.length ? `${pendingRequiredDocuments.length} required evidence item${pendingRequiredDocuments.length === 1 ? "" : "s"} awaiting review` : "",
    expiredRequiredDocuments.length ? `${expiredRequiredDocuments.length} expired required evidence item${expiredRequiredDocuments.length === 1 ? "" : "s"}` : "",
    expiringRequiredDocuments.length ? `${expiringRequiredDocuments.length} required evidence item${expiringRequiredDocuments.length === 1 ? "" : "s"} expiring soon` : "",
    pendingDocuments ? `${pendingDocuments} document${pendingDocuments === 1 ? "" : "s"} awaiting review` : "",
    rejectedDocuments ? `${rejectedDocuments} rejected document${rejectedDocuments === 1 ? "" : "s"}` : "",
    !instructor.adi_pdi_number ? "ADI number missing" : "",
    !instructor.car_registration ? "vehicle registration missing" : "",
    negativeReviews.length ? `${negativeReviews.length} bad review flag${negativeReviews.length === 1 ? "" : "s"}` : ""
  ].filter(Boolean);

  return {
    missingRequiredDocuments,
    pendingRequiredDocuments,
    rejectedRequiredDocuments,
    expiredRequiredDocuments,
    expiringRequiredDocuments,
    pendingDocuments,
    rejectedDocuments,
    negativeReviews,
    authorityGaps,
    vehicleGaps,
    insuranceGaps,
    signals
  };
}

export default async function AdminInstructorsPage({
  searchParams
}: {
  searchParams?: Promise<{ message?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const message = typeof params?.message === "string" ? params.message : "";
  const { supabase } = await requireAdminDashboardClient();
  const documentClient = createAdminClient() ?? supabase;
  const verificationSections = await getInstructorVerificationRequirements(supabase);
  const allConfiguredDocuments = flattenInstructorVerificationRequirements(verificationSections);
  const requiredInstructorDocuments = allConfiguredDocuments
    .filter((document) => document.requirement === "required")
    .map((document) => ({
      type: document.type,
      label: document.label,
      group: document.group
    }));
  const activeRequiredInstructorDocuments = requiredInstructorDocuments.length ? requiredInstructorDocuments : fallbackRequiredInstructorDocuments;
  const documentLabels: Map<string, string> = new Map([
    ...fallbackDocumentLabels,
    ...allConfiguredDocuments.map((document) => [document.type, document.label] as const)
  ]);

  const [{ data: instructors }, { data: documents }, { data: reviews }] = await Promise.all([
    supabase
      .from("instructor_profiles")
      .select("user_id,display_name,adi_pdi_status,adi_pdi_number,verification_status,rejection_reason,hourly_rate_pence,transmission,car_make,car_model,car_registration,areas_covered,base_postcode,auto_accept_bookings,approved_at,instructor_package,instructor_subscription_status,instructor_package_expires_at,compliance_status,learner_availability_paused,learner_availability_pause_reason,compliance_reviewed_at,compliance_blocked_at,updated_at")
      .order("updated_at", { ascending: false })
      .limit(500),
    documentClient.from("instructor_documents").select("id,instructor_id,document_type,storage_path,status,created_at,reviewed_at,reviewed_by,updated_at,expires_at,document_version,metadata_locked_at,storage_deleted_at,is_current,version_state,archived_at,archive_reason,replaced_by_document_id,rejection_reason,replacement_requested_at,review_note,renewal_reminder_sent_at,ai_verification_status,ai_verification_provider,ai_verification_summary,ai_verification_reference,ai_verification_checked_at,ai_verified_at").order("created_at", { ascending: false }).limit(2000),
    supabase.from("reviews").select("instructor_id,rating,comment,created_at").order("created_at", { ascending: false }).limit(5000)
  ]);

  const instructorRows = (instructors as InstructorRow[] | null) ?? [];
  const documentRows = (documents as DocumentRow[] | null) ?? [];
  const instructorIds = instructorRows.map((instructor) => instructor.user_id).filter(Boolean);
  const reviewerIds = documentRows.map((document) => document.reviewed_by).filter((value): value is string => Boolean(value));
  const profileIds = Array.from(new Set([...instructorIds, ...reviewerIds]));
  const { data: profiles } = profileIds.length
    ? await supabase.from("profiles").select("id,full_name,email,phone").in("id", profileIds)
    : { data: [] };

  const profileById = new Map((profiles as ProfileRow[] | null ?? []).map((profile) => [profile.id, profile]));
  const documentsByInstructor = new Map<string, DocumentRow[]>();
  const reviewsByInstructor = new Map<string, ReviewRow[]>();
  const documentLinks = new Map(
    documentRows.map((document) => {
      return [document.id, document.storage_path ? `/api/admin/instructor-documents/${document.id}/preview` : null] as const;
    })
  );

  for (const document of documentRows) {
    documentsByInstructor.set(document.instructor_id, [...(documentsByInstructor.get(document.instructor_id) ?? []), document]);
  }

  for (const review of (reviews as ReviewRow[] | null ?? [])) {
    reviewsByInstructor.set(review.instructor_id, [...(reviewsByInstructor.get(review.instructor_id) ?? []), review]);
  }

  const pending = instructorRows.filter((row) => row.verification_status === "pending").length;
  const inProgressRows = instructorRows.filter((row) => normaliseStatus(row.verification_status) !== "approved");
  const approvedAndClear = instructorRows.filter((row) => row.verification_status === "approved" && (row.compliance_status ?? "clear") === "clear" && !row.learner_availability_paused).length;
  const underReviewRows = instructorRows.map((instructor) => {
    const instructorDocuments = documentsByInstructor.get(instructor.user_id) ?? [];
    const instructorReviews = reviewsByInstructor.get(instructor.user_id) ?? [];
    const risk = getInstructorRiskSignals(instructor, instructorDocuments, instructorReviews, activeRequiredInstructorDocuments);

    return {
      instructor,
      profile: profileById.get(instructor.user_id),
      documents: instructorDocuments,
      reviews: instructorReviews,
      ...risk
    };
  }).filter((row) => row.signals.length > 0).sort((left, right) => {
    if (right.signals.length !== left.signals.length) return right.signals.length - left.signals.length;
    return right.negativeReviews.length - left.negativeReviews.length;
  });

  return (
    <main className="min-h-screen bg-black text-white">
      <AdminTopBar autoSignOutOnLeave />
      <AdminPageHeader
        eyebrow="Instructor operations"
        title="Instructor verification and risk control"
        description="Admin-only instructor register with onboarding state, ADI details, document review, compliance blockers, packages, and negative-review alerts."
        right={(
          <div className="rounded border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-black text-zinc-200">
            {instructorRows.length} instructor profile{instructorRows.length === 1 ? "" : "s"}
          </div>
        )}
      />

      <section className="mx-auto max-w-7xl px-4 py-8">
        {message ? (
          <div className="mb-5 rounded border border-red-500/40 bg-red-600 px-4 py-3 text-sm font-black text-white">
            {message}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-4">
          <Metric label="Total instructors" value={instructorRows.length} detail="All instructor profiles" />
          <Metric label="Approved clear" value={approvedAndClear} detail="Visible in learner search" />
          <Metric label="In progress" value={inProgressRows.length} detail="Applications not yet approved" />
          <Metric label="Risk flags" value={underReviewRows.length} detail="Evidence gaps, pauses, or bad reviews" />
        </div>

        <section className="mt-6 rounded border border-zinc-800 bg-zinc-950 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-sm font-black uppercase text-red-200">Verification requirements</div>
              <h2 className="mt-1 text-2xl font-black">Instructor evidence checklist</h2>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-zinc-400">
                Admin-managed document requirements used by the instructor upload page and this review dashboard. Change required/recommended status, wording, category, or visibility without creating a new verification flow.
              </p>
            </div>
            <div className="rounded-full border border-zinc-700 px-4 py-2 text-sm font-black text-zinc-200">
              {allConfiguredDocuments.length} active item{allConfiguredDocuments.length === 1 ? "" : "s"}
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {allConfiguredDocuments.map((document) => (
              <RequirementEditorCard
                key={document.type}
                documentType={document.type}
                label={document.label}
                detail={document.detail}
                requirement={document.requirement}
                category={document.group}
                displayOrder={document.displayOrder}
              />
            ))}
          </div>
        </section>

        <section id="in-progress-instructors" className="mt-6 scroll-mt-24 rounded border border-amber-500/40 bg-amber-500/10 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-sm font-black uppercase text-amber-100">In progress instructors</div>
              <h2 className="mt-1 text-2xl font-black">{inProgressRows.length} application{inProgressRows.length === 1 ? "" : "s"} waiting for LDA review</h2>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-zinc-300">
                Review uploaded ADI onboarding evidence from the in-progress application vault before moving an account into full instructor access. Files stay private, open through the LDA admin-only preview, and remain in the audit archive when a version is finalised.
              </p>
            </div>
            <div className="rounded-full border border-amber-500/40 px-4 py-2 text-sm font-black text-amber-100">
              {pending} pending
            </div>
          </div>

          <div className="mt-5 grid gap-4">
            {inProgressRows.map((instructor) => {
              const profile = profileById.get(instructor.user_id);
              const instructorDocuments = documentsByInstructor.get(instructor.user_id) ?? [];
              const displayName = instructor.display_name || profile?.full_name || profile?.email || "Unnamed instructor";
              const latestDocuments = getLatestDocumentsByType(instructorDocuments);
              const completedDocuments = activeRequiredInstructorDocuments.filter((requiredDocument) => {
                const status = normaliseStatus(latestDocuments.get(requiredDocument.type)?.status);
                return status === "completed" || status === "approved" || status === "clear";
              }).length;
              const documentsUploaded = instructorDocuments.length;

              return (
                <article key={instructor.user_id} className="rounded border border-amber-500/30 bg-black p-4">
                  <details className="group">
                    <summary className="cursor-pointer list-none">
                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,0.8fr))_auto] lg:items-center">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <FileCheck2 className="shrink-0 text-amber-200" size={21} />
                            <h3 className="truncate text-xl font-black">{displayName}</h3>
                          </div>
                          <div className="mt-1 truncate text-sm font-semibold text-zinc-400">{profile?.email ?? "Email not recorded"}</div>
                        </div>
                        <CompactDetail label="Phone" value={profile?.phone ?? "Not recorded"} />
                        <CompactDetail label="Base" value={instructor.base_postcode ?? "Not recorded"} />
                        <CompactDetail label="Package" value={instructor.instructor_package ?? "in progress"} />
                        <CompactDetail label="Documents" value={`${completedDocuments}/${activeRequiredInstructorDocuments.length} complete`} />
                        <span className="rounded-full border border-amber-500/40 px-4 py-3 text-center text-sm font-black text-amber-100 transition group-open:border-white group-open:text-white group-hover:border-white group-hover:text-white">
                          Review application
                        </span>
                      </div>
                    </summary>

                    <div className="mt-5 border-t border-zinc-800 pt-5">
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <Detail label="Verification" value={instructor.verification_status ?? "draft"} tone={flagTone(instructor.verification_status)} />
                        <Detail label="ADI number" value={instructor.adi_pdi_number ?? "Not recorded"} />
                        <Detail label="Uploaded documents" value={String(documentsUploaded)} tone={documentsUploaded ? "border-amber-500/40 bg-amber-500/10 text-amber-100" : "border-red-500/50 bg-red-600 text-white"} />
                        <Detail label="Last updated" value={formatDate(instructor.updated_at)} />
                      </div>

                      <div className="mt-5 rounded border border-zinc-800 bg-zinc-950 p-4">
                        <h3 className="flex items-center gap-2 text-base font-black"><FileCheck2 size={18} className="text-brand" /> Onboarding documents</h3>
                        <div className="mt-3 grid gap-2 lg:grid-cols-2">
                          {instructorDocuments.length ? instructorDocuments.map((document) => (
                            <InstructorDocumentReview
                              key={document.id}
                              instructorId={instructor.user_id}
                              documentId={document.id}
                              documentLabel={documentLabels.get(document.document_type) ?? document.document_type.replaceAll("_", " ")}
                              documentType={document.document_type}
                              status={document.status}
                              uploadedAt={document.created_at}
                              reviewedAt={document.reviewed_at}
                              verifierName={document.reviewed_by ? profileById.get(document.reviewed_by)?.full_name || profileById.get(document.reviewed_by)?.email || "LDA admin" : null}
                              expiresAt={document.expires_at}
                              documentVersion={document.document_version}
                              metadataLockedAt={document.metadata_locked_at}
                              storageDeletedAt={document.storage_deleted_at}
                              isCurrent={document.is_current}
                              versionState={document.version_state}
                              archivedAt={document.archived_at}
                              archiveReason={document.archive_reason}
                              rejectionReason={document.rejection_reason}
                              replacementRequestedAt={document.replacement_requested_at}
                              reviewNote={document.review_note}
                              aiVerificationStatus={document.ai_verification_status}
                              aiVerificationProvider={document.ai_verification_provider}
                              aiVerificationSummary={document.ai_verification_summary}
                              aiVerificationReference={document.ai_verification_reference}
                              aiVerificationCheckedAt={document.ai_verification_checked_at}
                              aiVerifiedAt={document.ai_verified_at}
                              fileUrl={documentLinks.get(document.id) ?? null}
                              storageAreaLabel={getInstructorDocumentStorageAreaLabel(document.storage_path)}
                            />
                          )) : <span className="text-sm font-semibold text-zinc-500">No documents uploaded yet. The in-progress instructor can upload documents from their verification status page.</span>}
                        </div>
                      </div>

                      <InstructorAdminActions
                        instructorId={instructor.user_id}
                        instructorName={displayName}
                        verificationStatus={instructor.verification_status ?? "draft"}
                        complianceStatus={instructor.compliance_status ?? "clear"}
                        availabilityPaused={Boolean(instructor.learner_availability_paused)}
                      />
                    </div>
                  </details>
                </article>
              );
            })}
            {inProgressRows.length ? null : (
              <div className="rounded border border-zinc-800 bg-black p-4 text-sm font-semibold text-zinc-400">
                No in-progress instructor applications are waiting for review.
              </div>
            )}
          </div>
        </section>

        <section className="mt-6 rounded border border-red-500/40 bg-red-950/25 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-sm font-black uppercase text-red-200">Under review</div>
              <h2 className="mt-1 text-2xl font-black">{underReviewRows.length} instructor profile{underReviewRows.length === 1 ? "" : "s"} flagged</h2>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-zinc-300">
                Pattern and compliance monitor for ADI authority, DBS/clean-record evidence, MOT, tax, roadworthy declaration, tuition insurance, paused learner availability, and negative review trends. This queues review; it does not automatically revoke anyone.
              </p>
            </div>
            <Link href="/instructor-verification?from=admin" className="rounded-full border border-red-500/50 bg-red-600 px-4 py-2 text-sm font-black text-white hover:bg-red-500">
              Open verification flow
            </Link>
          </div>

          <div className="mt-5 grid gap-3">
            {underReviewRows.slice(0, 6).map((row) => {
              const instructor = row.instructor;
              const displayName = instructor.display_name || row.profile?.full_name || row.profile?.email || "Unnamed instructor";

              return (
                <article key={instructor.user_id} className="rounded border border-red-500/30 bg-black p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-black">{displayName}</h3>
                      <div className="mt-1 text-sm font-semibold text-zinc-400">
                        {row.profile?.email ?? "No email recorded"} · {instructor.car_registration ?? "vehicle registration missing"}
                      </div>
                    </div>
                    <div className="rounded-full border border-red-500/40 bg-red-600 px-3 py-1 text-xs font-black uppercase text-white">
                      Manual review
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {row.signals.map((signal) => (
                      <span key={signal} className="rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1 text-xs font-black text-zinc-200">
                        {signal}
                      </span>
                    ))}
                  </div>
                </article>
              );
            })}
            {underReviewRows.length ? null : (
              <div className="rounded border border-zinc-800 bg-black p-4 text-sm font-semibold text-zinc-400">
                No instructor compliance or review patterns are currently above review threshold.
              </div>
            )}
          </div>
        </section>

        <section className="mt-6 rounded border border-zinc-800 bg-zinc-950 p-5">
          <div>
            <h2 className="text-2xl font-black">Instructor profiles</h2>
            <p className="mt-1 text-sm font-semibold text-zinc-400">Compact instructor register with key contact, pricing, location, and package details. Expand a profile when admin needs secure compliance-vault documents, review information, or deeper account controls.</p>
          </div>

          <div className="mt-5 grid gap-4">
          {instructorRows.map((instructor) => {
            const profile = profileById.get(instructor.user_id);
            const instructorDocuments = documentsByInstructor.get(instructor.user_id) ?? [];
            const instructorReviews = reviewsByInstructor.get(instructor.user_id) ?? [];
            const risk = getInstructorRiskSignals(instructor, instructorDocuments, instructorReviews, activeRequiredInstructorDocuments);
            const negativeReviews = instructorReviews.filter((review) => review.rating <= 2);
            const averageRating = instructorReviews.length
              ? (instructorReviews.reduce((sum, review) => sum + review.rating, 0) / instructorReviews.length).toFixed(1)
              : "No reviews";
            const displayName = instructor.display_name || profile?.full_name || profile?.email || "Unnamed instructor";
            const vehicle = [instructor.car_make, instructor.car_model, instructor.car_registration].filter(Boolean).join(" ") || "Vehicle not recorded";

            return (
              <article key={instructor.user_id} className="rounded border border-zinc-800 bg-black p-5">
                <details className="group">
                  <summary className="cursor-pointer list-none">
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_repeat(4,minmax(0,0.8fr))_auto] lg:items-center">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <CarFront className="shrink-0 text-brand" size={21} />
                          <h2 className="truncate text-2xl font-black">{displayName}</h2>
                        </div>
                        <div className="mt-1 truncate text-sm font-semibold text-zinc-400">{profile?.email ?? "Email not recorded"}</div>
                      </div>
                      <CompactDetail label="Base" value={instructor.base_postcode ?? "Not recorded"} />
                      <CompactDetail label="Rate" value={formatMoney(instructor.hourly_rate_pence ?? 0)} />
                      <CompactDetail label="Phone" value={profile?.phone ?? "Not recorded"} />
                      <CompactDetail label="Package" value={instructor.instructor_package ?? "instructor"} />
                      <span className="rounded-full border border-zinc-700 px-4 py-3 text-center text-sm font-black text-zinc-100 transition group-open:border-red-500 group-open:text-white group-hover:border-red-500 group-hover:text-white">
                        More details
                      </span>
                    </div>
                  </summary>
                    <div className="mt-5 border-t border-zinc-800 pt-5">
                      {risk.signals.length || negativeReviews.length ? (
                        <div className="mb-5 flex flex-wrap gap-2">
                          {negativeReviews.length ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1 text-xs font-black uppercase text-red-100">
                              <AlertTriangle size={14} /> Bad review attention
                            </span>
                          ) : null}
                          {risk.signals.slice(0, 8).map((signal) => (
                            <span key={signal} className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-black uppercase text-red-100">
                              {signal}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                        <Detail label="Verification" value={instructor.verification_status ?? "draft"} tone={flagTone(instructor.verification_status)} />
                        <Detail label="Compliance" value={instructor.compliance_status ?? "clear"} tone={flagTone(instructor.compliance_status)} />
                        <Detail label="ADI" value={[instructor.adi_pdi_status || "ADI", instructor.adi_pdi_number].filter(Boolean).join(" ") || "Not recorded"} />
                        <Detail label="Vehicle" value={vehicle} />
                        <Detail label="Rating" value={typeof averageRating === "string" ? averageRating : `${averageRating}/5`} />
                        <Detail label="DBS / record check" value={getDocumentDisplayStatus(instructorDocuments, "dbs_check")} tone={flagTone(getDocumentDisplayStatus(instructorDocuments, "dbs_check").toLowerCase())} />
                        <Detail label="MOT evidence" value={getDocumentDisplayStatus(instructorDocuments, "mot_certificate")} tone={flagTone(getDocumentDisplayStatus(instructorDocuments, "mot_certificate").toLowerCase())} />
                        <Detail label="Vehicle tax" value={getDocumentDisplayStatus(instructorDocuments, "vehicle_tax_status")} tone={flagTone(getDocumentDisplayStatus(instructorDocuments, "vehicle_tax_status").toLowerCase())} />
                        <Detail label="Roadworthy declaration" value={getDocumentDisplayStatus(instructorDocuments, "vehicle_safety_declaration")} tone={flagTone(getDocumentDisplayStatus(instructorDocuments, "vehicle_safety_declaration").toLowerCase())} />
                        <Detail label="Tuition insurance" value={getDocumentDisplayStatus(instructorDocuments, "tuition_insurance")} tone={flagTone(getDocumentDisplayStatus(instructorDocuments, "tuition_insurance").toLowerCase())} />
                      </div>

                      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr]">
                        <div className="rounded border border-zinc-800 bg-black p-4">
                          <h3 className="flex items-center gap-2 text-base font-black"><FileCheck2 size={18} className="text-brand" /> Documents</h3>
                          <div className="mt-3 grid gap-2">
                            {instructorDocuments.length ? instructorDocuments.map((document) => (
                              <InstructorDocumentReview
                                key={document.id}
                                instructorId={instructor.user_id}
                                documentId={document.id}
                                documentLabel={documentLabels.get(document.document_type) ?? document.document_type.replaceAll("_", " ")}
                                documentType={document.document_type}
                                status={document.status}
                                uploadedAt={document.created_at}
                                reviewedAt={document.reviewed_at}
                                verifierName={document.reviewed_by ? profileById.get(document.reviewed_by)?.full_name || profileById.get(document.reviewed_by)?.email || "LDA admin" : null}
                                expiresAt={document.expires_at}
                                documentVersion={document.document_version}
                                metadataLockedAt={document.metadata_locked_at}
                                storageDeletedAt={document.storage_deleted_at}
                                isCurrent={document.is_current}
                                versionState={document.version_state}
                                archivedAt={document.archived_at}
                                archiveReason={document.archive_reason}
                                rejectionReason={document.rejection_reason}
                                replacementRequestedAt={document.replacement_requested_at}
                                reviewNote={document.review_note}
                                aiVerificationStatus={document.ai_verification_status}
                                aiVerificationProvider={document.ai_verification_provider}
                                aiVerificationSummary={document.ai_verification_summary}
                                aiVerificationReference={document.ai_verification_reference}
                                aiVerificationCheckedAt={document.ai_verification_checked_at}
                                aiVerifiedAt={document.ai_verified_at}
                                fileUrl={documentLinks.get(document.id) ?? null}
                                storageAreaLabel={getInstructorDocumentStorageAreaLabel(document.storage_path)}
                              />
                            )) : <span className="text-sm font-semibold text-zinc-500">No uploaded documents found.</span>}
                          </div>
                        </div>

                        <div className="rounded border border-zinc-800 bg-black p-4">
                          <h3 className="flex items-center gap-2 text-base font-black"><Star size={18} className="text-brand" /> Review watch</h3>
                          {negativeReviews.length ? (
                            <div className="mt-3 grid gap-2">
                              {negativeReviews.slice(0, 3).map((review) => (
                                <div key={`${review.created_at}-${review.rating}`} className="rounded border border-red-500/30 bg-red-500/10 p-3 text-sm">
                                  <div className="font-black text-red-100">{review.rating}/5 on {formatDate(review.created_at)}</div>
                                  <p className="mt-1 font-semibold text-red-100/80">{review.comment || "No written comment."}</p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-3 text-sm font-semibold text-zinc-500">No negative review flags.</p>
                          )}
                        </div>
                      </div>

                      <InstructorAdminActions
                        instructorId={instructor.user_id}
                        instructorName={displayName}
                        verificationStatus={instructor.verification_status ?? "draft"}
                        complianceStatus={instructor.compliance_status ?? "clear"}
                        availabilityPaused={Boolean(instructor.learner_availability_paused)}
                      />
                    </div>
                </details>
              </article>
            );
          })}
          {instructorRows.length ? null : (
            <div className="rounded border border-zinc-800 bg-zinc-950 p-6 text-sm font-semibold text-zinc-400">No instructor profiles found yet.</div>
          )}
          </div>
        </section>
      </section>
    </main>
  );
}

function Metric({ label, value, detail }: { label: string; value: number | string; detail: string }) {
  return (
    <article className="rounded border border-zinc-800 bg-zinc-950 p-5">
      <div className="text-sm font-bold text-zinc-400">{label}</div>
      <div className="mt-2 text-3xl font-black">{value}</div>
      <p className="mt-1 text-sm font-semibold leading-6 text-zinc-400">{detail}</p>
    </article>
  );
}

function CompactDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded border border-zinc-800 bg-zinc-950 px-3 py-2">
      <div className="text-xs font-black uppercase text-zinc-500">{label}</div>
      <div className="mt-1 truncate text-sm font-black text-zinc-100">{value}</div>
    </div>
  );
}

function Detail({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className={`rounded border bg-black p-3 ${tone ?? "border-zinc-800 text-zinc-100"}`}>
      <div className="text-xs font-black uppercase opacity-70">{label}</div>
      <div className="mt-1 text-sm font-black">{value}</div>
    </div>
  );
}

function RequirementEditorCard({
  documentType,
  label,
  detail,
  requirement,
  category,
  displayOrder
}: {
  documentType: string;
  label: string;
  detail: string;
  requirement: "required" | "recommended";
  category: string;
  displayOrder: number;
}) {
  return (
    <details className="rounded border border-zinc-800 bg-black p-4">
      <summary className="cursor-pointer list-none">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-black text-zinc-100">{label}</h3>
            <p className="mt-1 text-xs font-black uppercase text-zinc-500">{documentType.replaceAll("_", " ")}</p>
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs font-black uppercase ${
            requirement === "required"
              ? "border-red-500/40 bg-red-600 text-white"
              : "border-zinc-700 bg-zinc-950 text-zinc-200"
          }`}>
            {requirement}
          </span>
        </div>
        <p className="mt-3 text-sm font-semibold leading-6 text-zinc-400">{detail}</p>
      </summary>

      <form action={updateInstructorVerificationRequirementAction} className="mt-4 grid gap-3 border-t border-zinc-800 pt-4">
        <input type="hidden" name="documentType" value={documentType} />
        <label className="grid gap-1 text-xs font-black uppercase text-zinc-500">
          Label
          <input name="label" defaultValue={label} className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-bold normal-case text-white" />
        </label>
        <label className="grid gap-1 text-xs font-black uppercase text-zinc-500">
          Detail
          <textarea name="detail" rows={3} defaultValue={detail} className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-bold normal-case leading-6 text-white" />
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="grid gap-1 text-xs font-black uppercase text-zinc-500">
            Requirement
            <select name="requirement" defaultValue={requirement} className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-bold normal-case text-white">
              <option value="required">Required</option>
              <option value="recommended">Recommended</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-black uppercase text-zinc-500">
            Category
            <select name="category" defaultValue={category} className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-bold normal-case text-white">
              <option value="identity">Identity</option>
              <option value="authority">Authority</option>
              <option value="vehicle">Vehicle</option>
              <option value="insurance">Insurance</option>
              <option value="professional">Professional</option>
              <option value="supporting">Supporting</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-black uppercase text-zinc-500">
            Order
            <input name="displayOrder" type="number" defaultValue={displayOrder} className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-bold normal-case text-white" />
          </label>
        </div>
        <label className="inline-flex items-center gap-2 text-sm font-black text-zinc-200">
          <input name="isEnabled" type="checkbox" defaultChecked className="h-4 w-4 accent-red-600" />
          Show this requirement
        </label>
        <button type="submit" className="w-fit rounded-full bg-red-600 px-4 py-2 text-sm font-black text-white hover:bg-red-500">
          Save requirement
        </button>
      </form>
    </details>
  );
}
