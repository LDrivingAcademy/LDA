"use server";

import { redirect } from "next/navigation";
import { getMarketplaceRoleState } from "@/lib/account-route-guard";
import { sendOffPlatformReportEmail, sendSupportTicketConfirmationEmail } from "@/lib/email";
import { safeText } from "@/lib/security";
import { classifySupportRequest, supportTicketReference } from "@/lib/support-guidance";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const reportPath = "/support/learner/off-platform-report";

function reportRedirect(message: string): never {
  redirect(`${reportPath}?message=${encodeURIComponent(message)}`);
}

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export async function submitOffPlatformReport(formData: FormData) {
  const supabase = await createClient();

  if (!supabase) {
    redirect(`/auth/login?role=learner&next=${encodeURIComponent(reportPath)}`);
  }

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect(`/auth/login?role=learner&next=${encodeURIComponent(reportPath)}`);
  }

  const roleState = await getMarketplaceRoleState(supabase, user.id);
  if (roleState.effectiveRole !== "learner") {
    redirect(roleState.effectiveRole === "instructor" ? "/support/instructor/dashboard" : "/learner-dashboard");
  }

  const learnerName = safeText(formData.get("learnerName"), "", 120);
  const instructorName = safeText(formData.get("instructorName"), "", 120);
  const incidentDate = safeText(formData.get("incidentDate"), "", 10);
  const additionalDates = safeText(formData.get("additionalDates"), "", 500);
  const details = safeText(formData.get("details"), "", 2800);

  if (learnerName.length < 2) {
    reportRedirect("Enter your name.");
  }

  if (instructorName.length < 2) {
    reportRedirect("Enter the instructor's name.");
  }

  if (!validDate(incidentDate)) {
    reportRedirect("Choose the date the request happened.");
  }

  if (details.length < 20) {
    reportRedirect("Add a little more detail about what the instructor asked you to do.");
  }

  const adminClient = createAdminClient();
  if (!adminClient) {
    reportRedirect("The report service is temporarily unavailable. Please try again shortly.");
  }

  const { data: profile } = await adminClient
    .from("profiles")
    .select("email")
    .eq("id", user.id)
    .maybeSingle();
  const contactEmail = String(profile?.email ?? user.email ?? "").trim().toLowerCase();

  if (!contactEmail) {
    reportRedirect("Add an email address to your LDA account before submitting this report.");
  }

  const message = [
    `${learnerName} reported that ${instructorName} made an off-platform lesson or payment request.`,
    `Date of request: ${incidentDate}.`,
    additionalDates ? `Other relevant dates: ${additionalDates}.` : "",
    `Report: ${details}`
  ].filter(Boolean).join("\n\n");
  const classification = classifySupportRequest({
    message,
    role: "learner",
    hasBookingReference: false,
    hasContactEmail: true
  });
  const submittedAt = new Date().toISOString();
  const { data: ticket, error: ticketError } = await adminClient
    .from("support_tickets")
    .insert({
      requester_user_id: user.id,
      requester_role: "learner",
      contact_email: contactEmail,
      category: "off_platform",
      priority: "urgent",
      status: "escalated",
      subject: "Off-platform request investigation",
      message,
      ai_summary: classification.summary,
      assistant_guidance: "Do not make any payment or arrange lessons outside LDA. Keep any messages or screenshots available for the investigation team.",
      booking_context: {
        learnerName,
        instructorName,
        incidentDate,
        additionalDates: additionalDates || null
      },
      conversation: [],
      risk_flags: ["off_platform_payment", "investigation_required"],
      source_path: reportPath,
      request_context: {
        workflow: "learner_off_platform_report",
        submittedAt,
        callbackAvailable: false
      },
      preferred_contact_method: "email",
      callback_requested: false,
      callback_status: "not_requested",
      escalated_at: submittedAt
    })
    .select("id,ticket_number")
    .single();

  if (ticketError || !ticket) {
    console.error("[support.off-platform] create failed", ticketError?.message);
    reportRedirect("The report could not be saved. Please try again.");
  }

  const reference = supportTicketReference(Number(ticket.ticket_number));
  const emailResults = await Promise.allSettled([
    sendOffPlatformReportEmail({
      id: ticket.id,
      reference,
      learnerName,
      learnerEmail: contactEmail,
      instructorName,
      incidentDate,
      additionalDates,
      details
    }),
    sendSupportTicketConfirmationEmail({
      to: contactEmail,
      reference,
      categoryLabel: "Off-platform request investigation",
      priority: "urgent",
      idempotencyKey: `off-platform-confirmation-${ticket.id}`
    })
  ]);

  emailResults.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(`[support.off-platform] email ${index + 1} failed`, result.reason);
    }
  });

  redirect(`${reportPath}?submitted=${encodeURIComponent(reference)}`);
}
