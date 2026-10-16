import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function assertContains(file, patterns, label) {
  const content = read(file);
  const missing = patterns.filter((pattern) => !content.includes(pattern));
  if (missing.length) {
    throw new Error(`${label} is missing expected wiring in ${file}: ${missing.join(", ")}`);
  }
}

function assertRegex(file, patterns, label) {
  const content = read(file);
  const missing = patterns.filter((pattern) => !pattern.test(content));
  if (missing.length) {
    throw new Error(`${label} is missing expected wiring in ${file}: ${missing.map(String).join(", ")}`);
  }
}

assertContains(
  "src/app/api/support/assistant/route.ts",
  [
    ".from(\"support_tickets\")",
    "requester_role",
    "assigned_team",
    "conversation",
    "request_context",
    "assistant_session_id",
    "sendSupportEscalationEmail",
    "sendSupportTicketConfirmationEmail"
  ],
  "Support AI escalation"
);

assertContains(
  "src/app/technical-support/page.tsx",
  [
    "AdminAutoRefresh",
    ".from(\"support_tickets\")",
    ".from(\"product_feedback\")",
    ".from(\"technical_incidents\")",
    ".from(\"site_health_reports\")",
    ".from(\"support_audit_events\")",
    "Platform service panel",
    "Support queue",
    "Incident command timeline"
  ],
  "Technical operations console"
);

assertContains(
  "src/app/technical-support/actions.ts",
  [
    "recordSupportAuditEvent",
    "sendSupportTicketResolvedEmail",
    "revalidatePath(\"/technical-support\")",
    "revalidatePath(\"/technical-support/feedback\")",
    "revalidatePath(\"/technical-support/health\")",
    "revalidatePath(\"/admin/support-escalations\")"
  ],
  "Technical support actions"
);

assertContains(
  "src/app/admin/support-escalations/page.tsx",
  [
    ".from(\"support_tickets\")",
    ".eq(\"status\", \"escalated\")",
    ".from(\"product_feedback\")",
    ".from(\"technical_incidents\")",
    ".from(\"site_health_reports\")",
    "Return to support review",
    "Mark decision complete"
  ],
  "Admin support escalation view"
);

assertContains(
  "src/components/site-analytics-tracker.tsx",
  [
    "eventType: \"pageview\"",
    "eventType: \"click\"",
    "eventType: \"engagement\"",
    "readAnalyticsConsent",
    "isPrivatePath",
    "/api/analytics/track"
  ],
  "Client analytics tracker"
);

assertContains(
  "src/app/api/analytics/track/route.ts",
  [
    "readConsentFromCookieHeader",
    "hashVisitorIp",
    "record_site_analytics_visitor",
    ".from(\"site_analytics_events\")",
    "visitor_ip_hash",
    "privatePathPrefixes"
  ],
  "Analytics ingestion endpoint"
);

assertContains(
  "src/app/admin/analytics/page.tsx",
  [
    "AdminAutoRefresh",
    ".from(\"site_analytics_events\")",
    ".from(\"site_analytics_visitors\")",
    ".from(\"profiles\")",
    "New IP visitors",
    "Page visits",
    "Accounts created",
    "Avg stay signal",
    "Clicks"
  ],
  "Admin live analytics dashboard"
);

assertContains(
  "src/app/support/learner/payment-help/actions.ts",
  [
    ".from(\"support_tickets\")",
    "category: \"payment\"",
    "booking_context",
    "sendSupportEscalationEmail",
    "sendSupportTicketConfirmationEmail",
    ".from(\"notifications\")"
  ],
  "Payment support ticket flow"
);

assertContains(
  "src/app/support/learner/off-platform-report/actions.ts",
  [
    ".from(\"support_tickets\")",
    "category: \"off_platform\"",
    "status: \"escalated\"",
    "risk_flags",
    "sendOffPlatformReportEmail",
    "sendSupportTicketConfirmationEmail"
  ],
  "Off-platform investigation flow"
);

assertContains(
  "src/lib/email.ts",
  [
    "sendBookingConfirmationEmails",
    "sendInstantBookingConfirmationEmail",
    "sendSupportEscalationEmail",
    "sendSupportTicketConfirmationEmail",
    "sendSupportTicketResolvedEmail",
    "sendOffPlatformReportEmail",
    "sendSiteHealthAlertEmail",
    "sendLdaBrandedEmail"
  ],
  "Transactional email routing"
);

assertRegex(
  "supabase/migrations/20260723171839_ai_first_support_tickets.sql",
  [
    /create table if not exists public\.support_tickets/i,
    /support_tickets_status_created_idx/i,
    /support_tickets_priority_created_idx/i,
    /support_tickets_requester_created_idx/i,
    /support_tickets_booking_reference_idx/i,
    /enable row level security/i
  ],
  "Support ticket storage"
);

assertRegex(
  "supabase/migrations/0012_site_analytics_events.sql",
  [
    /create table if not exists public\.site_analytics_events/i,
    /site_analytics_events_created_idx/i,
    /site_analytics_events_path_idx/i,
    /site_analytics_events_type_idx/i,
    /enable row level security/i
  ],
  "Analytics event storage"
);

assertRegex(
  "supabase/migrations/0041_site_analytics_ip_visitors.sql",
  [
    /create table if not exists public\.site_analytics_visitors/i,
    /site_analytics_visitors_first_seen_idx/i,
    /site_analytics_visitors_last_seen_idx/i,
    /enable row level security/i
  ],
  "Analytics visitor storage"
);

assertRegex(
  "supabase/migrations/20260730031500_link_paid_bookings_tracking_and_analytics.sql",
  [
    /create or replace function public\.record_site_analytics_visitor/i,
    /insert into public\.site_analytics_visitors/i,
    /on conflict \(visitor_ip_hash\) do update/i,
    /grant execute on function public\.record_site_analytics_visitor/i
  ],
  "Analytics visitor upsert function"
);

assertRegex(
  "supabase/migrations/20260731010500_support_operations_stage1_foundation.sql",
  [
    /create table if not exists public\.support_audit_events/i,
    /support_audit_events_ticket_idx/i,
    /support_audit_events_incident_idx/i,
    /support_audit_events_health_report_idx/i,
    /enable row level security/i
  ],
  "Support operations audit trail"
);

console.log("Operational data-flow audit passed.");
