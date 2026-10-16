import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CheckCircle2, Clock3, FileCheck2, FileWarning, Mail, ShieldCheck } from "lucide-react";

import { AdminTopBar } from "@/components/admin-top-bar";
import { PageTopBar } from "@/components/page-top-bar";
import { InstructorVerificationUploadForm } from "@/components/instructor-verification-upload-form";
import { isDirectorAdminEmail } from "@/lib/admin-access";
import {
  formatInstructorDocumentExpiry,
  getInstructorDocumentExpiryState,
  instructorDocumentRequiresExpiry
} from "@/lib/instructor-document-expiry";
import {
  getCurrentInstructorDocument,
  getDocumentVersionStateLabel,
  getLatestInstructorDocument,
  getPendingInstructorDocument,
  isApprovedInstructorDocumentStatus,
  isPendingInstructorDocumentStatus,
  isRejectedInstructorDocumentStatus
} from "@/lib/instructor-document-versioning";
import { getInstructorVerificationDisplay, getInstructorVerificationDisplayFromEvidence } from "@/lib/instructor-verification-status";
import {
  flattenInstructorVerificationRequirements,
  getInstructorVerificationRequirements,
  type InstructorVerificationDocumentType,
  type InstructorVerificationRequirement
} from "@/lib/instructor-verification-requirements";
import { getPageBackLink, type PageSourceSearchParams } from "@/lib/page-back-link";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

type InstructorVerificationPageProps = {
  searchParams?: PageSourceSearchParams;
};

type DocumentRow = {
  id: string;
  document_type: InstructorVerificationDocumentType;
  status: string;
  reviewed_at: string | null;
  created_at: string;
  expires_at: string | null;
  document_version: number | null;
  storage_deleted_at: string | null;
  is_current: boolean | null;
  version_state: string | null;
  archived_at: string | null;
  rejection_reason: string | null;
  replacement_requested_at: string | null;
};

function formatDate(value?: string | null) {
  if (!value) {
    return "Not reviewed yet";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function getLatestDocument(documents: DocumentRow[], type: InstructorVerificationDocumentType) {
  return documents.find((document) => document.document_type === type) ?? null;
}

function normaliseDocumentStatus(status?: string | null) {
  return String(status ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function isCompletedDocumentStatus(status?: string | null) {
  const normalised = normaliseDocumentStatus(status);
  return normalised === "completed" || normalised === "approved" || normalised === "clear";
}

function isDocumentLockedForReview(status?: string | null) {
  const normalised = normaliseDocumentStatus(status);
  return normalised === "pending" || normalised === "under_review" || normalised === "in_review" || normalised === "in_progress";
}

function getDocumentProgress(documents: DocumentRow[], requiredDocuments: InstructorVerificationRequirement[]) {
  const requiredProgress = requiredDocuments.map((document) => ({
    ...document,
    current: getCurrentInstructorDocument(documents, document.type),
    pending: getPendingInstructorDocument(documents, document.type),
    uploaded: getCurrentInstructorDocument(documents, document.type) ?? getPendingInstructorDocument(documents, document.type) ?? getLatestDocument(documents, document.type)
  }));
  const missingRequired = requiredProgress.filter((document) => !document.current && !document.pending);
  const pendingRequired = requiredProgress.filter((document) => Boolean(document.pending));
  const approvedRequired = requiredProgress.filter((document) => isApprovedInstructorDocumentStatus(document.current?.status));
  const rejectedRequired = requiredProgress.filter((document) => {
    const latest = getLatestInstructorDocument(documents, document.type);
    return !document.current && !document.pending && isRejectedInstructorDocumentStatus(latest?.status, latest?.version_state);
  });

  return {
    totalRequired: requiredDocuments.length,
    uploadedRequiredCount: requiredProgress.length - missingRequired.length,
    approvedRequiredCount: approvedRequired.length,
    pendingRequiredCount: pendingRequired.length,
    rejectedRequired,
    missingRequired,
    allRequiredUploaded: missingRequired.length === 0
  };
}

function getApplicationNextStep(progress: ReturnType<typeof getDocumentProgress>, verificationLabel: string) {
  if (verificationLabel === "Verified") {
    return "Your instructor verification is complete. The full instructor dashboard unlocks when the approved account state is live.";
  }

  if (progress.rejectedRequired.length) {
    return "Replace the required evidence marked as needing attention so LDA can review the application again.";
  }

  if (progress.missingRequired.length) {
    return "Upload the missing required evidence below. LDA cannot approve the instructor account until every required document is present.";
  }

  if (progress.pendingRequiredCount) {
    return "All required evidence has been uploaded. LDA now needs to review and approve the pending documents.";
  }

  return "Required evidence is uploaded and ready for final LDA admin review.";
}

export default async function InstructorVerificationPage({ searchParams }: InstructorVerificationPageProps) {
  const resolvedSearchParams = await searchParams;
  const pageSearchParams = resolvedSearchParams as Record<string, string | string[] | undefined> | undefined;
  const publicBackLink = await getPageBackLink(Promise.resolve(resolvedSearchParams));
  const flashMessage = Array.isArray(pageSearchParams?.message) ? pageSearchParams.message[0] : pageSearchParams?.message;
  const uploadedDocumentType = Array.isArray(pageSearchParams?.uploaded) ? pageSearchParams.uploaded[0] : pageSearchParams?.uploaded;
  const supabase = await createClient();

  if (!hasSupabaseConfig() || !supabase) {
    return (
      <main className="min-h-screen bg-white text-black">
        <PageTopBar backHref={publicBackLink.backHref} backLabel={publicBackLink.backLabel} />
        <section className="mx-auto max-w-4xl px-4 py-10">
          <div className="rounded border border-zinc-200 bg-white p-6 shadow-sm">
            <h1 className="text-3xl font-black">Connect Supabase to view verification.</h1>
            <p className="mt-3 text-base font-semibold leading-7 text-zinc-600">
              Instructor verification status and document records need Supabase before live account data can be shown.
            </p>
          </div>
        </section>
      </main>
    );
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?role=instructor");
  }

  const [{ data: profile }, { data: roles }, { data: instructorProfile }, { data: documents }] = await Promise.all([
    supabase.from("profiles").select("full_name,email").eq("id", user.id).maybeSingle(),
    supabase.from("account_roles").select("role").eq("user_id", user.id),
    supabase
      .from("instructor_profiles")
      .select("verification_status,rejection_reason,adi_pdi_status,adi_pdi_number,base_postcode,hourly_rate_pence,transmission,car_make,car_model,updated_at")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("instructor_documents")
      .select("id,document_type,status,reviewed_at,created_at,expires_at,document_version,storage_deleted_at,is_current,version_state,archived_at,rejection_reason,replacement_requested_at")
      .eq("instructor_id", user.id)
      .order("created_at", { ascending: false })
  ]);
  const isInstructor = roles?.some((role) => role.role === "instructor") ?? false;
  const isAdmin = Boolean(roles?.some((role) => role.role === "admin") && isDirectorAdminEmail(profile?.email ?? user.email));

  if (!isInstructor && !isAdmin) {
    redirect("/auth/login?role=instructor");
  }
  const { backHref, backLabel, fromAdmin } = await getPageBackLink(Promise.resolve(resolvedSearchParams), {
    allowAdminSource: isAdmin
  });

  const uploadedDocuments = (documents ?? []) as DocumentRow[];
  const verificationDocumentSections = await getInstructorVerificationRequirements(supabase);
  const allVerificationDocuments = flattenInstructorVerificationRequirements(verificationDocumentSections);
  const requiredDocuments = allVerificationDocuments.filter((document) => document.requirement === "required");
  const verificationDisplay = getInstructorVerificationDisplayFromEvidence(
    instructorProfile?.verification_status,
    uploadedDocuments.map((document) => document.status)
  );
  const documentProgress = getDocumentProgress(uploadedDocuments, requiredDocuments);
  const requiredUploadedCount = requiredDocuments.filter((document) => getLatestDocument(uploadedDocuments, document.type)).length;
  const accountEmail = profile?.email ?? user.email ?? "Unknown";
  const statusRequestHref = `mailto:info@ldrivingacademy.co.uk?subject=${encodeURIComponent(
    "Instructor verification status request"
  )}&body=${encodeURIComponent(
    `Hello LDA,\n\nPlease can you send me a status update on my instructor verification process.\n\nAccount: ${accountEmail}\nCurrent status: ${verificationDisplay.label}\n\nThank you.`
  )}`;

  return (
    <main className="min-h-screen bg-white text-black">
      {fromAdmin ? <AdminTopBar autoSignOutOnLeave /> : <PageTopBar backHref={backHref} backLabel={backLabel} />}
      <section className="bg-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 rounded border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm font-black text-red-100">
            <ShieldCheck size={16} /> Instructor verification
          </div>
          <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-normal sm:text-5xl">Verification status</h1>
          <p className="mt-4 max-w-3xl text-base font-semibold leading-7 text-zinc-300">
            Review the documents and account details LDA currently has for your instructor approval.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-5 px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid gap-5">
          {flashMessage ? (
            <div className="rounded border border-emerald-200 bg-emerald-50 p-4 text-sm font-black text-emerald-800">
              {flashMessage}
            </div>
          ) : null}

          <article className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <FileCheck2 className="text-brand" />
                <h2 className="mt-4 text-2xl font-black">Current status</h2>
                <p className="mt-2 text-base font-semibold leading-7 text-zinc-600">
                  {profile?.full_name || "Instructor account"} is currently marked as{" "}
                  <span className="font-black text-black">{verificationDisplay.label}</span>.
                </p>
              </div>
              <span className={`rounded-full border px-4 py-2 text-xs font-black uppercase ${verificationDisplay.toneClass}`}>
                {verificationDisplay.label}
              </span>
            </div>
            {instructorProfile?.rejection_reason ? (
              <div className="mt-5 rounded border border-red-200 bg-red-50 p-4 text-sm font-bold leading-6 text-red-950">
                {instructorProfile.rejection_reason}
              </div>
            ) : null}
          </article>

          <article className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
            <FileCheck2 className="text-brand" />
            <h2 className="mt-4 text-2xl font-black">Application readiness</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-zinc-600">
              {getApplicationNextStep(documentProgress, verificationDisplay.label)}
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-4">
              {[
                ["Required uploaded", `${documentProgress.uploadedRequiredCount}/${documentProgress.totalRequired}`],
                ["Approved", String(documentProgress.approvedRequiredCount)],
                ["Awaiting review", String(documentProgress.pendingRequiredCount)],
                ["Needs action", String(documentProgress.missingRequired.length + documentProgress.rejectedRequired.length)]
              ].map(([label, value]) => (
                <div key={label} className="rounded border border-zinc-200 bg-zinc-50 p-3">
                  <div className="text-2xl font-black">{value}</div>
                  <div className="mt-1 text-xs font-black uppercase text-zinc-500">{label}</div>
                </div>
              ))}
            </div>
            {documentProgress.missingRequired.length || documentProgress.rejectedRequired.length ? (
              <div className="mt-5 grid gap-3 lg:grid-cols-2">
                {documentProgress.missingRequired.length ? (
                  <div className="rounded border border-amber-200 bg-amber-50 p-4">
                    <h3 className="text-sm font-black uppercase text-amber-950">Missing required evidence</h3>
                    <div className="mt-3 grid gap-2 text-sm font-bold leading-6 text-amber-950">
                      {documentProgress.missingRequired.map((document) => (
                        <span key={document.type}>{document.label}</span>
                      ))}
                    </div>
                  </div>
                ) : null}
                {documentProgress.rejectedRequired.length ? (
                  <div className="rounded border border-red-200 bg-red-50 p-4">
                    <h3 className="text-sm font-black uppercase text-red-950">Needs replacement</h3>
                    <div className="mt-3 grid gap-2 text-sm font-bold leading-6 text-red-950">
                      {documentProgress.rejectedRequired.map((document) => (
                        <span key={document.type}>{document.label}</span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : documentProgress.allRequiredUploaded ? (
              <div className="mt-5 rounded border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold leading-6 text-emerald-950">
                All required evidence is uploaded. The account remains in progress until LDA completes review and approval.
              </div>
            ) : null}
          </article>

          <section className="rounded border border-red-200 bg-red-50 p-5 shadow-sm">
            <Mail className="text-brand" />
            <h2 className="mt-4 text-xl font-black">Request an update</h2>
            <p className="mt-2 text-sm font-bold leading-6 text-red-950">
              Ask LDA support to review the current verification status or confirm what still needs attention.
            </p>
            <Link href={statusRequestHref} className="lda-pill lda-pill-sm mt-5">
              Request update <ArrowRight size={16} />
            </Link>
          </section>

          <section className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-2xl font-black">Instructor onboarding documents</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-zinc-600">
              {requiredUploadedCount} of {requiredDocuments.length} required compliance documents are currently uploaded.
            </p>
            <div className="mt-5 grid gap-5">
              {verificationDocumentSections.map((section) => (
                <section key={section.title} className="rounded border border-zinc-200 bg-zinc-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-black">{section.title}</h3>
                      <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-zinc-600">{section.description}</p>
                    </div>
                    <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-black uppercase text-zinc-700">
                      {section.documents.length} checks
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3">
                    {section.documents.map((document) => {
                      const currentDocument = getCurrentInstructorDocument(uploadedDocuments, document.type);
                      const pendingDocument = getPendingInstructorDocument(uploadedDocuments, document.type);
                      const uploaded = currentDocument ?? pendingDocument ?? getLatestDocument(uploadedDocuments, document.type);

                      return (
                        <DocumentStatusRow
                          key={document.type}
                          documentType={document.type}
                          label={document.label}
                          detail={document.detail}
                          requirement={document.requirement}
                          document={uploaded}
                          currentDocument={currentDocument}
                          pendingDocument={pendingDocument}
                          uploadedRecently={uploadedDocumentType === document.type}
                        />
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function DocumentStatusRow({
  label,
  detail,
  requirement,
  documentType,
  document,
  currentDocument,
  pendingDocument,
  uploadedRecently = false
}: {
  label: string;
  detail: string;
  requirement: InstructorVerificationRequirement["requirement"];
  documentType: InstructorVerificationDocumentType;
  document: DocumentRow | null;
  currentDocument?: DocumentRow | null;
  pendingDocument?: DocumentRow | null;
  uploadedRecently?: boolean;
}) {
  const isUploaded = Boolean(document);
  const documentDisplay = getInstructorVerificationDisplay(document?.status);
  const hasCurrentApproved = isCompletedDocumentStatus(currentDocument?.status);
  const isCompleted = false;
  const isLockedForReview = Boolean(pendingDocument) || isDocumentLockedForReview(document?.status);
  const requiresExpiry = instructorDocumentRequiresExpiry(documentType);
  const activeDocument = currentDocument ?? document;
  const expiryState = getInstructorDocumentExpiryState(activeDocument?.expires_at);

  return (
    <article className="rounded border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {hasCurrentApproved ? <CheckCircle2 className="shrink-0 text-emerald-600" size={18} /> : <FileWarning className="shrink-0 text-amber-600" size={18} />}
            <h3 className="font-black">{label}</h3>
            <span
              className={`rounded-full border px-2 py-1 text-[11px] font-black uppercase ${
                requirement === "required"
                  ? "border-red-200 bg-red-50 text-red-800"
                  : "border-zinc-200 bg-zinc-50 text-zinc-700"
              }`}
            >
              {requirement === "required" ? "Required" : "Recommended"}
            </span>
          </div>
          <p className="mt-2 text-sm font-semibold leading-6 text-zinc-600">{detail}</p>
          {currentDocument ? (
            <p className="mt-2 text-sm font-bold leading-6 text-zinc-800">
              Current approved version {currentDocument.document_version ?? 1} &middot; Uploaded {formatDate(currentDocument.created_at)}
            </p>
          ) : null}
          {pendingDocument ? (
            <p className="mt-2 rounded border border-amber-200 bg-amber-50 p-2 text-sm font-bold leading-6 text-amber-950">
              Replacement version {pendingDocument.document_version ?? 1} is with LDA for review. Your current approved version stays active until this replacement is approved.
            </p>
          ) : null}
          {!currentDocument && document ? (
            <p className="mt-2 text-sm font-bold leading-6 text-zinc-800">
              Secure file received by LDA &middot; Version {document.document_version ?? 1} &middot; Uploaded {formatDate(document.created_at)} &middot; {getDocumentVersionStateLabel(document)}
            </p>
          ) : null}
          {requiresExpiry ? (
            <p className={`mt-2 text-sm font-black leading-6 ${
              expiryState.status === "expired"
                ? "text-red-700"
                : expiryState.status === "due_soon"
                  ? "text-amber-700"
                  : "text-zinc-700"
            }`}>
              {activeDocument?.expires_at ? expiryState.label : "Expiry date required before upload."}
            </p>
          ) : activeDocument?.expires_at ? (
            <p className="mt-2 text-sm font-black leading-6 text-zinc-700">
              Expires {formatInstructorDocumentExpiry(activeDocument.expires_at)}
            </p>
          ) : null}
          {document?.storage_deleted_at ? (
            <p className="mt-2 text-xs font-black uppercase text-emerald-700">
              Legacy evidence file removed after LDA review. Metadata retained.
            </p>
          ) : null}
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-black uppercase ${document ? documentDisplay.toneClass : "border-amber-200 bg-amber-50 text-amber-900"}`}>
          {document ? documentDisplay.label : "Missing"}
        </span>
      </div>
      {document ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm font-black">
          <span className="inline-flex items-center gap-2 text-zinc-600">
            <Clock3 size={15} /> Reviewed: {formatDate(document.reviewed_at)}
          </span>
        </div>
      ) : null}
      <InstructorVerificationUploadForm
        documentType={documentType}
        isUploaded={isUploaded}
        isCompleted={isCompleted}
        isLockedForReview={isLockedForReview}
        uploadedRecently={uploadedRecently}
        requiresExpiry={requiresExpiry}
      />
    </article>
  );
}
