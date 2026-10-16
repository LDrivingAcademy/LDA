"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { sendSupportTicketResolvedEmail } from "@/lib/email";
import { supportTicketReference } from "@/lib/support-guidance";
import { requireTechnicalSupportClient } from "@/lib/technical-support-access";
import { runLiveTechnicalHealthCheck } from "@/lib/technical-support";
import { currentLondonDateKey, supportActorDisplayName } from "@/lib/technical-support-handover";

type SupportStatus = "new" | "reviewing" | "escalated" | "resolved";
type TicketStatus =
  | SupportStatus
  | "waiting_on_customer"
  | "triaged"
  | "assigned"
  | "in_progress"
  | "waiting_for_internal_team"
  | "closed"
  | "reopened";
type TechnicalSupportClient = Awaited<ReturnType<typeof requireTechnicalSupportClient>>;
type TicketPriority = "standard" | "urgent" | "critical";
type TicketSeverity = "sev1_critical" | "sev2_high" | "sev3_medium" | "sev4_low";
type AssignedTeam =
  | "technical_support"
  | "support_management"
  | "administration"
  | "finance"
  | "safeguarding"
  | "compliance"
  | "development";

const ticketStatuses = new Set<TicketStatus>([
  "new",
  "reviewing",
  "waiting_on_customer",
  "triaged",
  "assigned",
  "in_progress",
  "waiting_for_internal_team",
  "escalated",
  "resolved",
  "closed",
  "reopened"
]);
const ticketPriorities = new Set<TicketPriority>(["standard", "urgent", "critical"]);
const ticketSeverities = new Set<TicketSeverity>(["sev1_critical", "sev2_high", "sev3_medium", "sev4_low"]);
const assignedTeams = new Set<AssignedTeam>([
  "technical_support",
  "support_management",
  "administration",
  "finance",
  "safeguarding",
  "compliance",
  "development"
]);

async function recordSupportAuditEvent(
  supabase: TechnicalSupportClient["supabase"],
  user: TechnicalSupportClient["user"],
  input: {
    ticketId?: string;
    incidentId?: string;
    feedbackId?: string;
    healthReportId?: string;
    action: string;
    fromStatus?: string | null;
    toStatus?: string | null;
    summary?: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  const { error } = await supabase.from("support_audit_events").insert({
    ticket_id: input.ticketId ?? null,
    incident_id: input.incidentId ?? null,
    feedback_id: input.feedbackId ?? null,
    health_report_id: input.healthReportId ?? null,
    actor_user_id: user.id,
    actor_role: "technical_support",
    action: input.action,
    from_status: input.fromStatus ?? null,
    to_status: input.toStatus ?? null,
    summary: input.summary ?? null,
    metadata: input.metadata ?? {}
  });

  if (!error) return;

  if (error.code === "42P01" || error.code === "42703") {
    console.warn("[support.audit] audit table is not available yet; apply the Stage 1 support migration.", {
      action: input.action,
      ticketId: input.ticketId,
      incidentId: input.incidentId,
      feedbackId: input.feedbackId,
      healthReportId: input.healthReportId
    });
    return;
  }

  throw new Error(error.message);
}

function readStatus(value: FormDataEntryValue | null): SupportStatus {
  const status = String(value ?? "");
  if (status === "reviewing" || status === "escalated" || status === "resolved") return status;
  return "new";
}

function readId(value: FormDataEntryValue | null) {
  const id = String(value ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    throw new Error("Invalid support record.");
  }
  return id;
}

function readTicketStatus(value: FormDataEntryValue | null): TicketStatus {
  const status = String(value ?? "");
  return ticketStatuses.has(status as TicketStatus) ? status as TicketStatus : "new";
}

function readTicketPriority(value: FormDataEntryValue | null): TicketPriority {
  const priority = String(value ?? "");
  return ticketPriorities.has(priority as TicketPriority) ? priority as TicketPriority : "standard";
}

function readTicketSeverity(value: FormDataEntryValue | null): TicketSeverity {
  const severity = String(value ?? "");
  return ticketSeverities.has(severity as TicketSeverity) ? severity as TicketSeverity : "sev3_medium";
}

function readAssignedTeam(value: FormDataEntryValue | null): AssignedTeam {
  const assignedTeam = String(value ?? "");
  return assignedTeams.has(assignedTeam as AssignedTeam) ? assignedTeam as AssignedTeam : "technical_support";
}

export async function updateSupportTicketStatus(formData: FormData) {
  const { supabase, user } = await requireTechnicalSupportClient();
  const id = readId(formData.get("id"));
  const status = readTicketStatus(formData.get("status"));
  const now = new Date().toISOString();
  const actorName = supportActorDisplayName(user);

  const { data: currentTicket, error: currentError } = await supabase
    .from("support_tickets")
    .select("id,ticket_number,contact_email,status,subject,category")
    .eq("id", id)
    .maybeSingle();

  if (currentError) throw new Error(currentError.message);
  if (!currentTicket) throw new Error("Support ticket could not be found.");

  const update: Record<string, string | null> = {
    status,
    escalated_at: status === "escalated" ? now : null,
    escalated_by: status === "escalated" ? user.id : null,
    resolved_at: status === "resolved" ? now : null
  };
  if (status === "resolved") {
    update.resolved_by = user.id;
    update.resolved_by_name = actorName;
    update.resolution_signed_at = now;
  }
  if (status === "reviewing") update.assigned_to = user.id;
  if (status === "assigned" || status === "in_progress") update.assigned_to = user.id;
  if (status === "new") update.assigned_to = null;

  const { error } = await supabase.from("support_tickets").update(update).eq("id", id);
  if (error) throw new Error(error.message);

  await recordSupportAuditEvent(supabase, user, {
    ticketId: id,
    action: "change_status",
    fromStatus: String(currentTicket.status ?? "new"),
    toStatus: status,
    summary: status === "resolved" ? `Support ticket resolved and signed off by ${actorName}.` : `Support ticket status changed to ${status}.`,
    metadata: status === "resolved" ? { resolvedByName: actorName } : {}
  });

  const shouldSendResolvedEmail =
    status === "resolved" &&
    currentTicket.status !== "resolved" &&
    typeof currentTicket.contact_email === "string" &&
    currentTicket.contact_email.includes("@");

  if (shouldSendResolvedEmail) {
    const reference = supportTicketReference(Number(currentTicket.ticket_number));

    try {
      await sendSupportTicketResolvedEmail({
        to: currentTicket.contact_email,
        reference,
        categoryLabel: currentTicket.subject || String(currentTicket.category ?? "Support ticket"),
        idempotencyKey: `support-ticket-resolved-${currentTicket.id}`
      });
    } catch (emailError) {
      console.error("[support.ticket] resolved email failed", {
        ticketId: currentTicket.id,
        reference,
        error: emailError instanceof Error ? emailError.message : String(emailError)
      });
    }
  }

  revalidatePath("/technical-support");
  revalidatePath("/technical-support/feedback");
  revalidatePath("/admin/support-escalations");
}

export async function updateSupportTicketOwner(formData: FormData) {
  const { supabase, user } = await requireTechnicalSupportClient();
  const id = readId(formData.get("id"));
  const mode = String(formData.get("mode") ?? "assign");

  const { data: currentTicket, error: currentError } = await supabase
    .from("support_tickets")
    .select("id,assigned_to,status")
    .eq("id", id)
    .maybeSingle();

  if (currentError) throw new Error(currentError.message);
  if (!currentTicket) throw new Error("Support ticket could not be found.");

  const assigning = mode !== "release";
  const update: Record<string, string | null> = {
    assigned_to: assigning ? user.id : null
  };

  if (assigning && (currentTicket.status === "new" || currentTicket.status === "triaged")) {
    update.status = "assigned";
  }

  const { error } = await supabase.from("support_tickets").update(update).eq("id", id);
  if (error) throw new Error(error.message);

  await recordSupportAuditEvent(supabase, user, {
    ticketId: id,
    action: assigning ? "assign_ticket" : "release_ticket",
    summary: assigning ? "Ticket assigned to current technical support user." : "Ticket assignment released.",
    metadata: {
      previousAssignedTo: currentTicket.assigned_to ?? null
    }
  });

  revalidatePath("/technical-support");
  revalidatePath("/technical-support/feedback");
}

export async function updateSupportTicketRouting(formData: FormData) {
  const { supabase, user } = await requireTechnicalSupportClient();
  const id = readId(formData.get("id"));
  const priority = readTicketPriority(formData.get("priority"));
  const severity = readTicketSeverity(formData.get("severity"));
  const assignedTeam = readAssignedTeam(formData.get("assignedTeam"));

  const { data: currentTicket, error: currentError } = await supabase
    .from("support_tickets")
    .select("id,priority,severity,assigned_team")
    .eq("id", id)
    .maybeSingle();

  if (currentError) throw new Error(currentError.message);
  if (!currentTicket) throw new Error("Support ticket could not be found.");

  const { error } = await supabase
    .from("support_tickets")
    .update({
      priority,
      severity,
      assigned_team: assignedTeam
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  await recordSupportAuditEvent(supabase, user, {
    ticketId: id,
    action: "update_ticket_routing",
    summary: `Ticket routing updated for ${assignedTeam}.`,
    metadata: {
      previousPriority: currentTicket.priority ?? null,
      nextPriority: priority,
      previousSeverity: currentTicket.severity ?? null,
      nextSeverity: severity,
      previousAssignedTeam: currentTicket.assigned_team ?? null,
      nextAssignedTeam: assignedTeam
    }
  });

  revalidatePath("/technical-support");
  revalidatePath("/technical-support/feedback");
  revalidatePath("/admin/support-escalations");
}

export async function saveSupportTicketNote(formData: FormData) {
  const { supabase, user } = await requireTechnicalSupportClient();
  const id = readId(formData.get("id"));
  const internalNote = String(formData.get("internalNote") ?? "").trim().slice(0, 5000);
  const { error } = await supabase
    .from("support_tickets")
    .update({ internal_note: internalNote || null })
    .eq("id", id);
  if (error) throw new Error(error.message);

  await recordSupportAuditEvent(supabase, user, {
    ticketId: id,
    action: "add_private_note",
    summary: internalNote ? "Private support note saved." : "Private support note cleared.",
    metadata: {
      noteLength: internalNote.length
    }
  });

  revalidatePath("/technical-support/feedback");
  revalidatePath("/admin/support-escalations");
}

export async function saveSupportTicketSummary(formData: FormData) {
  const { supabase, user } = await requireTechnicalSupportClient();
  const id = readId(formData.get("id"));
  const agentSummary = String(formData.get("agentSummary") ?? "").trim().slice(0, 500);

  if (agentSummary.length < 1) {
    throw new Error("Support summary cannot be empty.");
  }

  const { data: currentTicket, error: currentError } = await supabase
    .from("support_tickets")
    .select("id,ai_summary,agent_summary")
    .eq("id", id)
    .maybeSingle();

  if (currentError) throw new Error(currentError.message);
  if (!currentTicket) throw new Error("Support ticket could not be found.");

  const { error } = await supabase
    .from("support_tickets")
    .update({
      agent_summary: agentSummary,
      agent_summary_edited_at: new Date().toISOString(),
      agent_summary_edited_by: user.id
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  await recordSupportAuditEvent(supabase, user, {
    ticketId: id,
    action: "edit_ai_summary",
    summary: "Agent-edited support summary saved.",
    metadata: {
      previousSummaryLength: String(currentTicket.agent_summary || currentTicket.ai_summary || "").length,
      nextSummaryLength: agentSummary.length
    }
  });

  revalidatePath("/technical-support/feedback");
  revalidatePath("/admin/support-escalations");
}

export async function updateFeedbackSupportStatus(formData: FormData) {
  const { supabase, user } = await requireTechnicalSupportClient();
  const id = readId(formData.get("id"));
  const supportStatus = readStatus(formData.get("status"));
  const now = new Date().toISOString();
  const actorName = supportActorDisplayName(user);
  const { data: currentFeedback, error: currentError } = await supabase
    .from("product_feedback")
    .select("id,support_status")
    .eq("id", id)
    .maybeSingle();

  if (currentError) throw new Error(currentError.message);
  if (!currentFeedback) throw new Error("Feedback record could not be found.");

  const { error } = await supabase
    .from("product_feedback")
    .update({
      support_status: supportStatus,
      escalated_at: supportStatus === "escalated" ? now : null,
      escalated_by: supportStatus === "escalated" ? user.id : null,
      resolved_at: supportStatus === "resolved" ? now : null,
      ...(supportStatus === "resolved"
        ? {
            resolved_by: user.id,
            resolved_by_name: actorName,
            resolution_signed_at: now
          }
        : {})
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  await recordSupportAuditEvent(supabase, user, {
    feedbackId: id,
    action: "change_feedback_status",
    fromStatus: String(currentFeedback.support_status ?? "new"),
    toStatus: supportStatus,
    summary: supportStatus === "resolved" ? `Feedback item resolved and signed off by ${actorName}.` : `Feedback support status changed to ${supportStatus}.`,
    metadata: supportStatus === "resolved" ? { resolvedByName: actorName } : {}
  });

  revalidatePath("/technical-support");
  revalidatePath("/technical-support/feedback");
  revalidatePath("/admin/support-escalations");
}

export async function updateIncidentStatus(formData: FormData) {
  const { supabase, user } = await requireTechnicalSupportClient();
  const id = readId(formData.get("id"));
  const status = readStatus(formData.get("status"));
  const now = new Date().toISOString();
  const actorName = supportActorDisplayName(user);
  const { data: currentIncident, error: currentError } = await supabase
    .from("technical_incidents")
    .select("id,status")
    .eq("id", id)
    .maybeSingle();

  if (currentError) throw new Error(currentError.message);
  if (!currentIncident) throw new Error("Technical incident could not be found.");

  const { error } = await supabase
    .from("technical_incidents")
    .update({
      status,
      escalated_at: status === "escalated" ? now : null,
      escalated_by: status === "escalated" ? user.id : null,
      resolved_at: status === "resolved" ? now : null,
      ...(status === "resolved"
        ? {
            resolved_by: user.id,
            resolved_by_name: actorName,
            resolution_signed_at: now
          }
        : {})
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  await recordSupportAuditEvent(supabase, user, {
    incidentId: id,
    action: "change_incident_status",
    fromStatus: String(currentIncident.status ?? "new"),
    toStatus: status,
    summary: status === "resolved" ? `Technical incident resolved and signed off by ${actorName}.` : `Technical incident status changed to ${status}.`,
    metadata: status === "resolved" ? { resolvedByName: actorName } : {}
  });

  revalidatePath("/technical-support");
  revalidatePath("/technical-support/incidents");
  revalidatePath("/admin/support-escalations");
}

export async function saveIncidentInvestigationPlan(formData: FormData) {
  const { supabase, user } = await requireTechnicalSupportClient();
  const id = readId(formData.get("id"));
  const suspectedCause = String(formData.get("suspectedCause") ?? "").trim().slice(0, 1500);
  const confirmedRootCause = String(formData.get("confirmedRootCause") ?? "").trim().slice(0, 1500);
  const workaround = String(formData.get("workaround") ?? "").trim().slice(0, 1500);
  const resolution = String(formData.get("resolution") ?? "").trim().slice(0, 1500);
  const correctiveActions = String(formData.get("correctiveActions") ?? "").trim().slice(0, 1500);
  const preventativeActions = String(formData.get("preventativeActions") ?? "").trim().slice(0, 1500);
  const postIncidentReview = String(formData.get("postIncidentReview") ?? "").trim().slice(0, 2500);

  const { error } = await supabase
    .from("technical_incidents")
    .update({
      suspected_cause: suspectedCause || null,
      confirmed_root_cause: confirmedRootCause || null,
      workaround: workaround || null,
      resolution: resolution || null,
      corrective_actions: correctiveActions || null,
      preventative_actions: preventativeActions || null,
      post_incident_review: postIncidentReview || null
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  await recordSupportAuditEvent(supabase, user, {
    incidentId: id,
    action: "update_incident_investigation_plan",
    summary: "Incident investigation and recovery notes saved.",
    metadata: {
      hasWorkaround: Boolean(workaround),
      hasResolution: Boolean(resolution),
      hasPostIncidentReview: Boolean(postIncidentReview)
    }
  });

  revalidatePath("/technical-support");
  revalidatePath("/technical-support/incidents");
  revalidatePath("/admin/support-escalations");
}

export async function escalateHealthReport(formData: FormData) {
  const { supabase, user } = await requireTechnicalSupportClient();
  const id = readId(formData.get("id"));
  const { error } = await supabase
    .from("site_health_reports")
    .update({
      escalated_at: new Date().toISOString(),
      escalated_by: user.id
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  await recordSupportAuditEvent(supabase, user, {
    healthReportId: id,
    action: "escalate_health_report",
    summary: "Website health report sent to admin.",
    metadata: {}
  });

  revalidatePath("/technical-support");
  revalidatePath("/technical-support/health");
  revalidatePath("/admin/support-escalations");
}

export async function runLiveHealthCheck() {
  await requireTechnicalSupportClient();
  const headerStore = await headers();
  await runLiveTechnicalHealthCheck(headerStore.get("origin") || undefined);
  revalidatePath("/technical-support");
  revalidatePath("/technical-support/health");
  revalidatePath("/admin/support-escalations");
}

export async function acknowledgeShiftHandover(formData: FormData) {
  const { supabase, user, accessRole } = await requireTechnicalSupportClient();
  const now = new Date().toISOString();
  const handoverDate = currentLondonDateKey();
  const actorName = supportActorDisplayName(user);
  const briefSummary = String(formData.get("briefSummary") ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 3000);

  const { error } = await supabase.from("support_shift_handover_acknowledgements").upsert(
    {
      actor_user_id: user.id,
      actor_role: accessRole,
      actor_name: actorName,
      handover_date: handoverDate,
      brief_summary: briefSummary || "Daily technical support handover acknowledged.",
      acknowledged_at: now
    },
    { onConflict: "actor_user_id,handover_date" }
  );

  if (error) throw new Error(error.message);

  revalidatePath("/technical-support");
}
