"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminDashboardClient } from "@/lib/admin-dashboard";
import { sendAdminNoticeEmail } from "@/lib/email";
import { getInstructorDocumentExpiryState } from "@/lib/instructor-document-expiry";
import { getInstructorDocumentLabel } from "@/lib/instructor-document-labels";
import {
  getCurrentInstructorDocument,
  getLatestInstructorDocument,
  isApprovedInstructorDocumentStatus,
  isPendingInstructorDocumentStatus,
  isRejectedInstructorDocumentStatus
} from "@/lib/instructor-document-versioning";
import { instructorSetupPauseReason } from "@/lib/instructor-setup-readiness";
import {
  fallbackRequiredInstructorDocumentTypes,
  flattenInstructorVerificationRequirements,
  getInstructorVerificationRequirements
} from "@/lib/instructor-verification-requirements";
import { recordInstructorVerificationAudit } from "@/lib/instructor-verification-audit";
import { getAppOrigin } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminClientContext = Awaited<ReturnType<typeof requireAdminDashboardClient>>;
type SupabaseClient = AdminClientContext["supabase"];

const complianceExpiryPauseReasonPrefix = "Required instructor compliance evidence expired";

type InstructorProfile = {
  full_name: string | null;
  email: string | null;
  phone: string | null;
};

type InstructorDecisionDocument = {
  id: string;
  instructor_id: string;
  document_type: string;
  storage_path: string | null;
  status: string | null;
  created_at?: string | null;
  expires_at?: string | null;
  document_version?: number | null;
  is_current?: boolean | null;
  version_state?: string | null;
};

function adminInstructorsRedirect(message: string): never {
  redirect(`/admin/instructors?message=${encodeURIComponent(message)}`);
}

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function requireInstructorId(formData: FormData) {
  const instructorId = getString(formData, "instructorId");
  if (!/^[0-9a-f-]{36}$/i.test(instructorId)) {
    adminInstructorsRedirect("Instructor account was not recognised.");
  }
  return instructorId;
}

function normaliseStatus(value?: string | null) {
  return String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function isRejectedStatus(value?: string | null, versionState?: string | null) {
  return isRejectedInstructorDocumentStatus(value, versionState);
}

async function getAdminContext() {
  const { supabase } = await requireAdminDashboardClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return { supabase, adminId: user?.id ?? null };
}

async function getInstructorProfile(supabase: SupabaseClient, instructorId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,full_name,email,phone")
    .eq("id", instructorId)
    .maybeSingle();

  if (error) {
    adminInstructorsRedirect(error.message);
  }

  if (!data) {
    adminInstructorsRedirect("Instructor profile was not found.");
  }

  return data as InstructorProfile;
}

async function getRequiredDocumentTypes(supabase: SupabaseClient) {
  const sections = await getInstructorVerificationRequirements(supabase);
  const required = flattenInstructorVerificationRequirements(sections)
    .filter((document) => document.requirement === "required")
    .map((document) => document.type);

  return required.length ? required : fallbackRequiredInstructorDocumentTypes;
}

async function getInstructorDecisionDocuments(supabase: SupabaseClient, instructorId: string) {
  const documentClient = createAdminClient() ?? supabase;
  const { data, error } = await documentClient
    .from("instructor_documents")
    .select("id,instructor_id,document_type,storage_path,status,created_at,expires_at,document_version,is_current,version_state")
    .eq("instructor_id", instructorId)
    .order("created_at", { ascending: false });

  if (error) {
    adminInstructorsRedirect(error.message);
  }

  return ((data as InstructorDecisionDocument[] | null) ?? []).filter((document) => Boolean(document.id));
}

function latestDocumentsByType(documents: InstructorDecisionDocument[]) {
  const latest = new Map<string, InstructorDecisionDocument>();
  for (const document of documents) {
    if (!latest.has(document.document_type)) {
      latest.set(document.document_type, document);
    }
  }
  return latest;
}

async function notifyInstructorDocumentDecision({
  supabase,
  instructorId,
  profile,
  documentType,
  notificationType,
  title,
  body,
  emailSubject,
  emailTitle
}: {
  supabase: SupabaseClient;
  instructorId: string;
  profile: InstructorProfile;
  documentType: string;
  notificationType: string;
  title: string;
  body: string;
  emailSubject: string;
  emailTitle: string;
}) {
  await createInstructorNotification(supabase, instructorId, notificationType, title, body);

  if (profile.email) {
    await sendAdminNoticeEmail({
      to: profile.email,
      subject: emailSubject,
      title: emailTitle,
      body: `${body}\n\nOpen your instructor verification page: ${getAppOrigin()}/instructor-verification?from=email`
    });
  }
}

async function createInstructorNotification(
  supabase: SupabaseClient,
  instructorId: string,
  notificationType: string,
  title: string,
  body: string
) {
  const { error } = await supabase.from("notifications").insert({
    user_id: instructorId,
    notification_type: notificationType,
    title,
    body
  });

  if (error) {
    adminInstructorsRedirect(error.message);
  }
}

async function updateInstructorProfileStatus({
  supabase,
  instructorId,
  desiredStatus,
  fallbackStatus,
  patch
}: {
  supabase: SupabaseClient;
  instructorId: string;
  desiredStatus: string;
  fallbackStatus: "pending" | "approved" | "rejected";
  patch: Record<string, unknown>;
}) {
  const { error } = await supabase
    .from("instructor_profiles")
    .update({ ...patch, verification_status: desiredStatus })
    .eq("user_id", instructorId);

  if (!error) {
    return desiredStatus;
  }

  const { error: fallbackError } = await supabase
    .from("instructor_profiles")
    .update({ ...patch, verification_status: fallbackStatus })
    .eq("user_id", instructorId);

  if (fallbackError) {
    adminInstructorsRedirect(fallbackError.message);
  }

  return fallbackStatus;
}

async function markDecisionDocuments({
  instructorId,
  documents,
  adminId,
  status,
  summary
}: {
  instructorId: string;
  documents: InstructorDecisionDocument[];
  adminId?: string | null;
  status: "approved" | "rejected";
  summary: string;
}) {
  if (!documents.length) {
    return;
  }

  const documentClient = createAdminClient();
  if (!documentClient) {
    adminInstructorsRedirect("Supabase service role is not configured, so instructor evidence cannot be finalised securely.");
  }

  const now = new Date().toISOString();
  const ids = documents.map((document) => document.id);
  const pendingIds = documents
    .filter((document) => isPendingInstructorDocumentStatus(document.status, document.version_state) || status === "rejected")
    .map((document) => document.id);

  if (status === "approved") {
    for (const document of documents) {
      if (!pendingIds.includes(document.id) && !isApprovedInstructorDocumentStatus(document.status)) continue;

      const previousCurrent = documents.filter(
        (candidate) =>
          candidate.document_type === document.document_type &&
          candidate.id !== document.id &&
          (candidate.is_current || isApprovedInstructorDocumentStatus(candidate.status))
      );

      if (previousCurrent.length) {
        const { error: archiveError } = await documentClient
          .from("instructor_documents")
          .update({
            is_current: false,
            version_state: "archived",
            archived_at: now,
            archive_reason: `Replaced by version ${document.document_version ?? "new"}.`,
            replaced_by_document_id: document.id,
            updated_at: now
          })
          .in("id", previousCurrent.map((candidate) => candidate.id));

        if (archiveError) adminInstructorsRedirect(archiveError.message);
      }
    }
  }

  const { error } = await documentClient
    .from("instructor_documents")
    .update({
      status,
      is_current: status === "approved",
      version_state: status === "approved" ? "current" : "rejected",
      ai_verification_status: status === "approved" ? "passed" : "failed",
      ai_verification_summary: summary,
      ai_verified_at: status === "approved" ? now : null,
      ai_verification_checked_at: now,
      metadata_locked_at: now,
      reviewed_by: adminId ?? null,
      reviewed_at: now,
      review_note: summary,
      rejection_reason: status === "rejected" ? summary : null,
      renewal_reminder_sent_at: null,
      updated_at: now
    })
    .eq("instructor_id", instructorId)
    .in("id", pendingIds.length ? pendingIds : ids);

  if (error) {
    adminInstructorsRedirect(error.message);
  }
}

async function refreshInstructorComplianceStatus({
  supabase,
  instructorId
}: {
  supabase: SupabaseClient;
  instructorId: string;
}) {
  const documentClient = createAdminClient() ?? supabase;
  const requiredTypes = await getRequiredDocumentTypes(supabase);
  const now = new Date().toISOString();
  const { data: profile, error: profileError } = await supabase
    .from("instructor_profiles")
    .select("verification_status,learner_availability_paused,learner_availability_pause_reason")
    .eq("user_id", instructorId)
    .maybeSingle();

  if (profileError) adminInstructorsRedirect(profileError.message);
  if (normaliseStatus(profile?.verification_status) !== "approved") return;

  const { data: documents, error: documentError } = await documentClient
    .from("instructor_documents")
    .select("id,instructor_id,document_type,status,expires_at,created_at,document_version,is_current,version_state")
    .eq("instructor_id", instructorId)
    .order("created_at", { ascending: false });

  if (documentError) adminInstructorsRedirect(documentError.message);

  const blockedTypes = requiredTypes.filter((documentType) => {
    const current = getCurrentInstructorDocument((documents as InstructorDecisionDocument[] | null) ?? [], documentType);
    return (
      !current ||
      !isApprovedInstructorDocumentStatus(current.status) ||
      getInstructorDocumentExpiryState(current.expires_at).status === "expired"
    );
  });

  if (blockedTypes.length) {
    const reason = `${complianceExpiryPauseReasonPrefix}: ${blockedTypes
      .map((documentType) => getInstructorDocumentLabel(documentType))
      .join(", ")}.`;
    const { error } = await supabase
      .from("instructor_profiles")
      .update({
        compliance_status: "blocked",
        learner_availability_paused: true,
        learner_availability_pause_reason: reason,
        compliance_blocked_at: now,
        compliance_reviewed_at: now
      })
      .eq("user_id", instructorId);

    if (error) adminInstructorsRedirect(error.message);
    return;
  }

  const shouldClearAvailabilityPause =
    Boolean(profile?.learner_availability_paused) &&
    String(profile?.learner_availability_pause_reason ?? "").startsWith(complianceExpiryPauseReasonPrefix);

  const { error } = await supabase
    .from("instructor_profiles")
    .update({
      compliance_status: "clear",
      compliance_blocked_at: null,
      compliance_reviewed_at: now,
      ...(shouldClearAvailabilityPause
        ? {
            learner_availability_paused: false,
            learner_availability_pause_reason: null
          }
        : {})
    })
    .eq("user_id", instructorId);

  if (error) adminInstructorsRedirect(error.message);
}

async function refreshInstructorPages() {
  revalidatePath("/admin/instructors");
  revalidatePath("/dashboard");
  revalidatePath("/instructor-dashboard");
  revalidatePath("/instructor-verification");
  revalidatePath("/learner-dashboard");
}

async function approveInstructorAccount({
  supabase,
  instructorId,
  profile,
  adminId,
  reviewNote
}: {
  supabase: SupabaseClient;
  instructorId: string;
  profile: InstructorProfile;
  adminId?: string | null;
  reviewNote: string;
}) {
  const now = new Date().toISOString();

  const { data: existingInstructorProfile, error: existingInstructorProfileError } = await supabase
    .from("instructor_profiles")
    .select("verification_status")
    .eq("user_id", instructorId)
    .maybeSingle();

  if (existingInstructorProfileError) {
    adminInstructorsRedirect(existingInstructorProfileError.message);
  }

  const isNewlyApprovedInstructor = normaliseStatus(existingInstructorProfile?.verification_status) !== "approved";
  const { error: learnerRoleDeleteError } = await supabase
    .from("account_roles")
    .delete()
    .eq("user_id", instructorId)
    .eq("role", "learner");

  if (learnerRoleDeleteError) {
    adminInstructorsRedirect(learnerRoleDeleteError.message);
  }

  const { error: instructorRoleError } = await supabase.from("account_roles").upsert({
    user_id: instructorId,
    role: "instructor"
  }, { onConflict: "user_id,role" });

  if (instructorRoleError) {
    adminInstructorsRedirect(instructorRoleError.message);
  }

  const appliedStatus = await updateInstructorProfileStatus({
    supabase,
    instructorId,
    desiredStatus: "approved",
    fallbackStatus: "approved",
    patch: {
      approved_at: now,
      instructor_package: "instructor",
      instructor_subscription_status: "active",
      instructor_package_started_at: now,
      instructor_package_expires_at: null,
      instructor_package_source: "approved",
      compliance_status: "clear",
      learner_availability_paused: true,
      learner_availability_pause_reason: instructorSetupPauseReason,
      compliance_reviewed_at: now,
      compliance_blocked_at: null,
      rejection_reason: null
    }
  });

  if (isNewlyApprovedInstructor) {
    const adminClient = createAdminClient();
    if (adminClient) {
      const { data: authUser } = await adminClient.auth.admin.getUserById(instructorId);
      const currentMetadata = authUser.user?.user_metadata ?? {};
      await adminClient.auth.admin.updateUserById(instructorId, {
        user_metadata: {
          ...currentMetadata,
          lda_instructor_setup_prompt_eligible_at: now,
          lda_instructor_setup_prompt_dismissed_at: null,
          lda_instructor_setup_guide_enabled_at: null,
          lda_instructor_setup_guide_closed_at: null,
          lda_instructor_setup_completed_at: null
        }
      });
    }
  }

  await recordInstructorVerificationAudit({
    client: createAdminClient() ?? supabase,
    instructorId,
    adminId,
    actorUserId: adminId,
    action: "approve",
    notes: reviewNote || `Instructor verification approved with status ${appliedStatus}.`
  });

  await createInstructorNotification(
    supabase,
    instructorId,
    "admin_instructor_approved",
    "Your LDA instructor account has been approved",
    "Your instructor verification has been approved. Your instructor dashboard is unlocked. Complete any remaining setup tasks shown there so LDA can publish your availability for bookings and Smart Match."
  );

  if (profile.email) {
    await sendAdminNoticeEmail({
      to: profile.email,
      subject: "Your LDA instructor account has been approved",
      title: "Your instructor account has been approved",
      body:
        "Your LDA instructor verification has been approved and your instructor dashboard is unlocked. Complete any remaining finance, tax, payout, pricing, profile, vehicle, and compliance setup shown there. Once those items are clear, LDA can publish your learner-facing availability for bookings and Smart Match."
    });
  }
}

export async function approveInstructorVerificationAction(formData: FormData) {
  const instructorId = requireInstructorId(formData);
  const reviewNote = getString(formData, "reviewNote").slice(0, 1200);
  const { supabase, adminId } = await getAdminContext();
  const profile = await getInstructorProfile(supabase, instructorId);
  const documents = await getInstructorDecisionDocuments(supabase, instructorId);
  const latestByType = latestDocumentsByType(documents);
  const requiredTypes = await getRequiredDocumentTypes(supabase);
  const missing = requiredTypes.filter((documentType) => {
    const current = getCurrentInstructorDocument(documents, documentType);
    const pending = getLatestInstructorDocument(documents.filter((document) => isPendingInstructorDocumentStatus(document.status, document.version_state)), documentType);
    return !current && !pending;
  });
  const rejected = requiredTypes.filter((documentType) => {
    const latest = latestByType.get(documentType);
    const current = getCurrentInstructorDocument(documents, documentType);
    return !current && isRejectedStatus(latest?.status, latest?.version_state);
  });

  if (missing.length || rejected.length) {
    adminInstructorsRedirect(
      `This instructor cannot be approved yet. Missing required documents: ${missing.length}. Rejected required documents: ${rejected.length}.`
    );
  }

  await markDecisionDocuments({
    instructorId,
    documents,
    adminId,
    status: "approved",
    summary: reviewNote || "LDA admin approved this instructor verification after evidence review. Previous approved versions were archived where replaced."
  });
  await approveInstructorAccount({ supabase, instructorId, profile, adminId, reviewNote });
  await refreshInstructorPages();

  adminInstructorsRedirect(`${profile.full_name || profile.email || "Instructor"} has been approved. Previous document versions were archived where replaced.`);
}

async function closeInstructorVerificationWithAction({
  formData,
  desiredStatus,
  fallbackStatus,
  decisionStatus,
  auditAction,
  notificationType,
  notificationTitle,
  emailSubject,
  emailTitle,
  redirectPrefix
}: {
  formData: FormData;
  desiredStatus: string;
  fallbackStatus: "pending" | "rejected";
  decisionStatus: "rejected";
  auditAction: "reject" | "request_new_documents";
  notificationType: string;
  notificationTitle: string;
  emailSubject: string;
  emailTitle: string;
  redirectPrefix: string;
}) {
  const instructorId = requireInstructorId(formData);
  const reason =
    getString(formData, "reason").slice(0, 1200) ||
    "LDA needs updated instructor verification evidence before this account can be approved.";
  const { supabase, adminId } = await getAdminContext();
  const profile = await getInstructorProfile(supabase, instructorId);
  const documents = await getInstructorDecisionDocuments(supabase, instructorId);

  await markDecisionDocuments({
    instructorId,
    documents,
    adminId,
    status: decisionStatus,
    summary: `${notificationTitle}. Reason: ${reason} The submitted version was retained in the private archive.`
  });

  const appliedStatus = await updateInstructorProfileStatus({
    supabase,
    instructorId,
    desiredStatus,
    fallbackStatus,
    patch: {
      rejection_reason: reason,
      compliance_status: "under_review",
      learner_availability_paused: true,
      learner_availability_pause_reason: reason,
      compliance_reviewed_at: new Date().toISOString()
    }
  });
  await recordInstructorVerificationAudit({
    client: createAdminClient() ?? supabase,
    instructorId,
    adminId,
    actorUserId: adminId,
    action: auditAction,
    notes: `${reason} Applied status: ${appliedStatus}.`
  });

  await createInstructorNotification(supabase, instructorId, notificationType, notificationTitle, reason);

  if (profile.email) {
    await sendAdminNoticeEmail({
      to: profile.email,
      subject: emailSubject,
      title: emailTitle,
      body: `${reason}\n\nOpen your instructor verification page to continue: ${getAppOrigin()}/instructor-verification?from=email`
    });
  }

  await refreshInstructorPages();
  adminInstructorsRedirect(`${redirectPrefix} ${profile.full_name || profile.email || "instructor"}. Submitted versions were retained in the private archive.`);
}

async function getDocumentForAdminDecision(supabase: SupabaseClient, documentId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(documentId)) {
    adminInstructorsRedirect("Document was not recognised.");
  }

  const documentClient = createAdminClient() ?? supabase;
  const { data, error } = await documentClient
    .from("instructor_documents")
    .select("id,instructor_id,document_type,storage_path,status,created_at,expires_at,document_version,is_current,version_state")
    .eq("id", documentId)
    .maybeSingle();

  if (error) adminInstructorsRedirect(error.message);
  if (!data) adminInstructorsRedirect("Document was not found.");
  return data as InstructorDecisionDocument;
}

export async function approveInstructorDocumentVersionAction(formData: FormData) {
  const documentId = getString(formData, "documentId");
  const reviewNote = getString(formData, "reviewNote").slice(0, 1200);
  const { supabase, adminId } = await getAdminContext();
  const document = await getDocumentForAdminDecision(supabase, documentId);
  const profile = await getInstructorProfile(supabase, document.instructor_id);

  await markDecisionDocuments({
    instructorId: document.instructor_id,
    documents: (await getInstructorDecisionDocuments(supabase, document.instructor_id)).filter((row) => row.document_type === document.document_type),
    adminId,
    status: "approved",
    summary: reviewNote || `${getInstructorDocumentLabel(document.document_type)} approved. Previous active version archived if this replaced it.`
  });
  await refreshInstructorComplianceStatus({ supabase, instructorId: document.instructor_id });

  await recordInstructorVerificationAudit({
    client: createAdminClient() ?? supabase,
    instructorId: document.instructor_id,
    adminId,
    actorUserId: adminId,
    documentId: document.id,
    documentType: document.document_type,
    action: "approve",
    notes: reviewNote || "Admin approved document version."
  });

  await notifyInstructorDocumentDecision({
    supabase,
    instructorId: document.instructor_id,
    profile,
    documentType: document.document_type,
    notificationType: "instructor_document_approved",
    title: `${getInstructorDocumentLabel(document.document_type)} approved`,
    body: `Your ${getInstructorDocumentLabel(document.document_type)} has been approved. If this was a renewal, the previous version has been archived.`,
    emailSubject: `Your ${getInstructorDocumentLabel(document.document_type)} has been approved`,
    emailTitle: "Document approved"
  });

  await refreshInstructorPages();
  adminInstructorsRedirect(`${getInstructorDocumentLabel(document.document_type)} version approved.`);
}

export async function rejectInstructorDocumentVersionAction(formData: FormData) {
  const documentId = getString(formData, "documentId");
  const reason = getString(formData, "reason").slice(0, 1200) || "LDA needs a clearer or updated version before this document can be approved.";
  const { supabase, adminId } = await getAdminContext();
  const document = await getDocumentForAdminDecision(supabase, documentId);
  const profile = await getInstructorProfile(supabase, document.instructor_id);
  const documentClient = createAdminClient() ?? supabase;
  const now = new Date().toISOString();

  const { error } = await documentClient
    .from("instructor_documents")
    .update({
      status: "rejected",
      is_current: false,
      version_state: "rejected",
      reviewed_by: adminId ?? null,
      reviewed_at: now,
      metadata_locked_at: now,
      rejection_reason: reason,
      review_note: reason,
      updated_at: now
    })
    .eq("id", document.id);

  if (error) adminInstructorsRedirect(error.message);

  await recordInstructorVerificationAudit({
    client: documentClient,
    instructorId: document.instructor_id,
    adminId,
    actorUserId: adminId,
    documentId: document.id,
    documentType: document.document_type,
    action: "reject",
    notes: reason
  });

  await notifyInstructorDocumentDecision({
    supabase,
    instructorId: document.instructor_id,
    profile,
    documentType: document.document_type,
    notificationType: "instructor_document_rejected",
    title: `${getInstructorDocumentLabel(document.document_type)} needs another upload`,
    body: reason,
    emailSubject: `Your ${getInstructorDocumentLabel(document.document_type)} needs another upload`,
    emailTitle: "Replacement needed"
  });

  await refreshInstructorPages();
  adminInstructorsRedirect(`${getInstructorDocumentLabel(document.document_type)} version rejected.`);
}

export async function requestInstructorDocumentReplacementVersionAction(formData: FormData) {
  const documentId = getString(formData, "documentId");
  const reason = getString(formData, "reason").slice(0, 1200) || "LDA needs another replacement version for this document.";
  const { supabase, adminId } = await getAdminContext();
  const document = await getDocumentForAdminDecision(supabase, documentId);
  const profile = await getInstructorProfile(supabase, document.instructor_id);
  const documentClient = createAdminClient() ?? supabase;
  const now = new Date().toISOString();

  const { error } = await documentClient
    .from("instructor_documents")
    .update({
      status: "rejected",
      is_current: false,
      version_state: "replacement_requested",
      reviewed_by: adminId ?? null,
      reviewed_at: now,
      metadata_locked_at: now,
      replacement_requested_at: now,
      rejection_reason: reason,
      review_note: reason,
      updated_at: now
    })
    .eq("id", document.id);

  if (error) adminInstructorsRedirect(error.message);

  await recordInstructorVerificationAudit({
    client: documentClient,
    instructorId: document.instructor_id,
    adminId,
    actorUserId: adminId,
    documentId: document.id,
    documentType: document.document_type,
    action: "request_new_documents",
    notes: reason
  });

  await notifyInstructorDocumentDecision({
    supabase,
    instructorId: document.instructor_id,
    profile,
    documentType: document.document_type,
    notificationType: "instructor_document_replacement_requested",
    title: `${getInstructorDocumentLabel(document.document_type)} replacement requested`,
    body: reason,
    emailSubject: `LDA needs another ${getInstructorDocumentLabel(document.document_type)} upload`,
    emailTitle: "Another upload is needed"
  });

  await refreshInstructorPages();
  adminInstructorsRedirect(`Requested another ${getInstructorDocumentLabel(document.document_type)} replacement.`);
}

export async function requestInstructorNewDocumentsAction(formData: FormData) {
  await closeInstructorVerificationWithAction({
    formData,
    desiredStatus: "additional_documents_required",
    fallbackStatus: "rejected",
    decisionStatus: "rejected",
    auditAction: "request_new_documents",
    notificationType: "admin_instructor_documents_requested",
    notificationTitle: "LDA needs new instructor verification documents",
    emailSubject: "LDA needs updated instructor verification documents",
    emailTitle: "New verification documents needed",
    redirectPrefix: "Requested new documents from"
  });
}

export async function rejectInstructorVerificationAction(formData: FormData) {
  await closeInstructorVerificationWithAction({
    formData,
    desiredStatus: "rejected",
    fallbackStatus: "rejected",
    decisionStatus: "rejected",
    auditAction: "reject",
    notificationType: "admin_instructor_rejected",
    notificationTitle: "Your LDA instructor verification was not approved",
    emailSubject: "Your LDA instructor verification was not approved",
    emailTitle: "Instructor verification was not approved",
    redirectPrefix: "Rejected verification for"
  });
}

export async function updateInstructorVerificationRequirementAction(formData: FormData) {
  const documentType = getString(formData, "documentType")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  const label = getString(formData, "label").slice(0, 160);
  const detail = getString(formData, "detail").slice(0, 700);
  const requirement = getString(formData, "requirement") === "required" ? "required" : "recommended";
  const rawCategory = getString(formData, "category");
  const category = ["identity", "authority", "vehicle", "insurance", "professional", "supporting"].includes(rawCategory)
    ? rawCategory
    : "supporting";
  const displayOrder = Number.parseInt(getString(formData, "displayOrder"), 10);
  const isEnabled = formData.get("isEnabled") === "on";

  if (!documentType || !label || !detail) {
    adminInstructorsRedirect("Document type, label, and detail are required before saving a verification requirement.");
  }

  const { supabase, adminId } = await getAdminContext();
  const { error } = await supabase.from("instructor_verification_document_requirements").upsert({
    document_type: documentType,
    label,
    detail,
    requirement,
    category,
    display_order: Number.isFinite(displayOrder) ? displayOrder : 999,
    is_enabled: isEnabled,
    updated_by: adminId,
    updated_at: new Date().toISOString()
  }, { onConflict: "document_type" });

  if (error) {
    adminInstructorsRedirect(error.message);
  }

  revalidatePath("/admin/instructors");
  revalidatePath("/instructor-verification");
  adminInstructorsRedirect(`${label} verification requirement updated.`);
}
