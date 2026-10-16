import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Cookie,
  Database,
  FileText,
  Gauge,
  GitBranch,
  KeyRound,
  MailCheck,
  MessageSquareText,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  TicketCheck,
  UsersRound,
  Workflow
} from "lucide-react";
import { AdminAutoRefresh } from "@/components/admin-auto-refresh";
import { TechnicalSupportPageHeader } from "@/components/technical-support-page-header";
import { TechnicalSupportHandoverBrief } from "@/components/technical-support-handover-brief";
import { TechnicalSupportTopBar } from "@/components/technical-support-top-bar";
import { requireTechnicalSupportClient } from "@/lib/technical-support-access";
import { currentLondonDateKey } from "@/lib/technical-support-handover";
import { supportTicketReference } from "@/lib/support-guidance";
import { runLiveHealthCheck } from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { robots: { index: false, follow: false, nocache: true } };

type TicketRow = {
  id: string;
  ticket_number: number;
  status: string;
  priority: "standard" | "urgent" | "critical";
  severity: string | null;
  assigned_team: string | null;
  category: string;
  subcategory: string | null;
  created_at: string;
  resolved_at: string | null;
  first_response_due_at: string | null;
  resolution_due_at: string | null;
  assistant_session_id: string | null;
  related_incident_id: string | null;
  source_path: string | null;
  subject: string;
  ai_summary: string | null;
  agent_summary: string | null;
  resolved_by_name: string | null;
  resolution_signed_at: string | null;
};

type FeedbackRow = {
  id: string;
  support_status: string;
  created_at: string;
  issue: string;
  summary: string;
  page_url: string | null;
};

type IncidentRow = {
  id: string;
  incident_reference: number | null;
  status: string;
  severity: string;
  source: string;
  title: string;
  summary: string;
  path: string | null;
  affected_services: string[] | null;
  occurrence_count: number;
  first_seen_at: string;
  last_seen_at: string;
  suspected_cause: string | null;
  confirmed_root_cause: string | null;
  resolution: string | null;
};

type CheckResult = {
  name: string;
  ok: boolean;
  slow: boolean;
  status: number;
  durationMs: number;
  message: string;
};

type HealthRow = {
  id: string;
  target: string;
  status: "ok" | "degraded" | "fail";
  checked_at: string;
  success_rate: number;
  total_checks: number;
  passed_checks: number;
  failed_checks: number;
  slow_checks_count: number;
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
  max_ms: number;
  results: CheckResult[] | null;
  alert_reason: string | null;
};

type SessionRow = {
  id: string;
  status: string;
  created_at: string;
  last_message_at: string;
};

type AuditRow = {
  id: string;
  action: string;
  summary: string | null;
  actor_role: string;
  created_at: string;
};

type KnowledgeRow = {
  id: string;
  active: boolean;
  category: string;
};

type HandoverAckRow = {
  id: string;
  acknowledged_at: string;
};

type KpiTone = "ok" | "urgent" | "critical" | "neutral";
type SafeQueryResult<T> = {
  data: T[] | null;
  error: { message?: string } | null;
  count?: number | null;
};

const activeStatuses = new Set(["new", "reviewing", "waiting_on_customer", "triaged", "assigned", "in_progress", "waiting_for_customer", "waiting_for_internal_team", "escalated", "reopened"]);
const resolvedStatuses = new Set(["resolved", "closed"]);
const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/London"
});

function asArray<T>(value: T[] | null | undefined) {
  return Array.isArray(value) ? value : [];
}

async function safeSupportQuery<T>(
  label: string,
  query: PromiseLike<SafeQueryResult<T>>
): Promise<SafeQueryResult<T>> {
  try {
    return await query;
  } catch (error) {
    console.warn("[technical-support] dashboard query failed", {
      label,
      message: error instanceof Error ? error.message : String(error)
    });
    return {
      data: null,
      error: {
        message: error instanceof Error ? error.message : "Query failed"
      }
    };
  }
}

function label(value: string | null | undefined) {
  return String(value || "not set").replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function sourcePage(value: string | null) {
  if (!value) return "Page not recorded";
  try {
    const url = new URL(value, "https://ldrivingacademy.co.uk");
    return `${url.pathname}${url.search}`;
  } catch {
    return value;
  }
}

function minutesBetween(start: string, end: string) {
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));
}

function durationLabel(minutes: number) {
  if (!Number.isFinite(minutes)) return "-";
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / 1440)}d`;
}

function averageResolution(tickets: TicketRow[]) {
  const resolved = tickets.filter((ticket) => ticket.resolved_at && resolvedStatuses.has(ticket.status));
  if (!resolved.length) return "-";
  const avgMinutes = Math.round(
    resolved.reduce((total, ticket) => total + minutesBetween(ticket.created_at, ticket.resolved_at as string), 0) / resolved.length
  );
  return durationLabel(avgMinutes);
}

function dueState(ticket: TicketRow) {
  const due = ticket.resolution_due_at || ticket.first_response_due_at;
  if (!due || resolvedStatuses.has(ticket.status)) return { label: "No SLA due", tone: "neutral" as const, minutes: null };
  const minutes = Math.round((new Date(due).getTime() - Date.now()) / 60000);
  if (minutes < 0) return { label: `${durationLabel(Math.abs(minutes))} overdue`, tone: "critical" as const, minutes };
  if (minutes < 60) return { label: `${minutes}m left`, tone: "urgent" as const, minutes };
  return { label: `${durationLabel(minutes)} left`, tone: "ok" as const, minutes };
}

function latestDeploymentLabel() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7);
  const env = process.env.VERCEL_ENV || "production";
  return sha ? `${sha} - ${env}` : "Latest production";
}

function servicePanel(latest: HealthRow | undefined) {
  const results = asArray(latest?.results);
  const serviceChecks = [
    {
      key: "api",
      label: "API uptime",
      icon: Activity,
      matches: (name: string) => name.includes("/api/")
    },
    {
      key: "payments",
      label: "Payments",
      icon: ReceiptText,
      matches: (name: string) => name.includes("checkout") || name.includes("payment") || name.includes("stripe") || name.includes("package")
    },
    {
      key: "auth",
      label: "Auth",
      icon: KeyRound,
      matches: (name: string) => name.includes("login") || name.includes("auth") || name.includes("dashboard") || name.includes("admin requires")
    },
    {
      key: "database",
      label: "Database",
      icon: Database,
      matches: (name: string) => name.includes("feedback") || name.includes("support/assistant") || name.includes("bookings/")
    },
    {
      key: "notifications",
      label: "Notifications",
      icon: MailCheck,
      matches: (name: string) => name.includes("translate") || name.includes("devices") || name.includes("progress-feedback")
    }
  ];

  return serviceChecks.map((service) => {
    const checks = results.filter((result) => service.matches(result.name.toLowerCase()));
    const failed = checks.filter((check) => !check.ok).length;
    const slow = checks.filter((check) => check.ok && check.slow).length;
    const avg = checks.length ? Math.round(checks.reduce((total, check) => total + check.durationMs, 0) / checks.length) : 0;
    return {
      ...service,
      status: failed ? "fail" : slow ? "degraded" : checks.length ? "ok" : "unknown",
      detail: checks.length ? `${checks.length} checks - avg ${avg}ms` : "No recent signal",
      failed,
      slow
    };
  });
}

function trendCounts(tickets: TicketRow[], feedback: FeedbackRow[]) {
  const counts = new Map<string, number>();
  for (const ticket of tickets) {
    counts.set(label(ticket.subcategory || ticket.category), (counts.get(label(ticket.subcategory || ticket.category)) ?? 0) + 1);
  }
  for (const item of feedback) {
    counts.set("Product feedback", (counts.get("Product feedback") ?? 0) + 1);
  }
  return [...counts.entries()].sort((first, second) => second[1] - first[1]).slice(0, 6);
}

export default async function TechnicalSupportDashboard() {
  const { supabase, user, accessRole } = await requireTechnicalSupportClient();
  const handoverDate = currentLondonDateKey();
  const [
    ticketResult,
    feedbackResult,
    incidentResult,
    healthResult,
    sessionResult,
    auditResult,
    knowledgeResult,
    cookieConsentResult,
    handoverAckResult
  ] = await Promise.all([
    safeSupportQuery<TicketRow>(
      "support_tickets",
      supabase
        .from("support_tickets")
        .select("id,ticket_number,status,priority,severity,assigned_team,category,subcategory,created_at,resolved_at,first_response_due_at,resolution_due_at,assistant_session_id,related_incident_id,source_path,subject,ai_summary,agent_summary,resolved_by_name,resolution_signed_at")
        .order("created_at", { ascending: false })
        .limit(250)
    ),
    safeSupportQuery<FeedbackRow>(
      "product_feedback",
      supabase
        .from("product_feedback")
        .select("id,support_status,created_at,issue,summary,page_url")
        .order("created_at", { ascending: false })
        .limit(250)
    ),
    safeSupportQuery<IncidentRow>(
      "technical_incidents",
      supabase
        .from("technical_incidents")
        .select("id,incident_reference,status,severity,source,title,summary,path,affected_services,occurrence_count,first_seen_at,last_seen_at,suspected_cause,confirmed_root_cause,resolution")
        .order("last_seen_at", { ascending: false })
        .limit(100)
    ),
    safeSupportQuery<HealthRow>(
      "site_health_reports",
      supabase
        .from("site_health_reports")
        .select("id,target,status,checked_at,success_rate,total_checks,passed_checks,failed_checks,slow_checks_count,p50_ms,p95_ms,p99_ms,max_ms,results,alert_reason")
        .order("checked_at", { ascending: false })
        .limit(10)
    ),
    safeSupportQuery<SessionRow>(
      "support_assistant_sessions",
      supabase
        .from("support_assistant_sessions")
        .select("id,status,created_at,last_message_at")
        .order("last_message_at", { ascending: false })
        .limit(250)
    ),
    safeSupportQuery<AuditRow>(
      "support_audit_events",
      supabase
        .from("support_audit_events")
        .select("id,action,summary,actor_role,created_at")
        .order("created_at", { ascending: false })
        .limit(8)
    ),
    safeSupportQuery<KnowledgeRow>(
      "support_knowledge_articles",
      supabase
        .from("support_knowledge_articles")
        .select("id,active,category")
        .limit(500)
    ),
    safeSupportQuery<{ id: string }>(
      "cookie_consent_events",
      supabase.from("cookie_consent_events").select("id", { count: "exact", head: true })
    ),
    safeSupportQuery<HandoverAckRow>(
      "support_shift_handover_acknowledgements",
      supabase
        .from("support_shift_handover_acknowledgements")
        .select("id,acknowledged_at")
        .eq("actor_user_id", user.id)
        .eq("handover_date", handoverDate)
        .limit(1)
    )
  ]);

  const tickets = (ticketResult.data as TicketRow[] | null) ?? [];
  const feedback = (feedbackResult.data as FeedbackRow[] | null) ?? [];
  const incidents = (incidentResult.data as IncidentRow[] | null) ?? [];
  const healthReports = (healthResult.data as HealthRow[] | null) ?? [];
  const sessions = (sessionResult.data as SessionRow[] | null) ?? [];
  const audits = (auditResult.data as AuditRow[] | null) ?? [];
  const knowledge = (knowledgeResult.data as KnowledgeRow[] | null) ?? [];

  const latestHealth = healthReports[0];
  const activeTickets = tickets.filter((ticket) => activeStatuses.has(ticket.status));
  const criticalTickets = activeTickets.filter((ticket) => ticket.priority === "critical" || ticket.severity === "sev1_critical");
  const activeFeedback = feedback.filter((item) => item.support_status !== "resolved");
  const activeIncidents = incidents.filter((incident) => !resolvedStatuses.has(incident.status));
  const criticalIncidents = activeIncidents.filter((incident) => incident.severity === "critical" || incident.severity === "sev1_critical");
  const openQueue = activeTickets.length + activeFeedback.length;
  const aiResolved = sessions.filter((session) => session.status === "resolved_without_ticket").length;
  const aiResolutionRate = sessions.length ? `${Math.round((aiResolved / sessions.length) * 100)}%` : "-";
  const overdueTickets = activeTickets.filter((ticket) => dueState(ticket).tone === "critical");
  const queueByTeam = activeTickets.reduce<Record<string, number>>((teams, ticket) => {
    const team = label(ticket.assigned_team || "technical_support");
    teams[team] = (teams[team] ?? 0) + 1;
    return teams;
  }, {});
  const workload = Object.entries(queueByTeam).sort((first, second) => second[1] - first[1]);
  const hotTrends = trendCounts(tickets, feedback);
  const services = servicePanel(latestHealth);
  const loadError = ticketResult.error || feedbackResult.error || incidentResult.error || healthResult.error;
  const newestIncident = activeIncidents[0] ?? incidents[0];
  const newestTicket = activeTickets[0] ?? tickets[0];
  const newestFeedback = activeFeedback[0] ?? feedback[0];
  const handoverLines = [
    {
      label: "Major outages",
      value: latestHealth?.status && latestHealth.status !== "ok"
        ? `Latest health check is ${label(latestHealth.status)} with ${latestHealth.failed_checks} failed check${Number(latestHealth.failed_checks) === 1 ? "" : "s"}.`
        : "No active outage is showing from the latest health check."
    },
    {
      label: "Priority work",
      value: overdueTickets.length
        ? `${overdueTickets.length} SLA-overdue ticket${overdueTickets.length === 1 ? "" : "s"}`
        : criticalTickets.length
          ? `${criticalTickets.length} critical ticket${criticalTickets.length === 1 ? "" : "s"}`
          : criticalIncidents.length
            ? `${criticalIncidents.length} critical incident${criticalIncidents.length === 1 ? "" : "s"}`
            : "new support handoffs and repeat reports"
    },
    {
      label: "Main issue today",
      value: activeIncidents[0]
        ? `${activeIncidents[0].title}: ${activeIncidents[0].summary}`
        : hotTrends[0]
          ? `${hotTrends[0][0]} is the highest-repeat queue pattern today.`
          : "No major repeating issue is visible yet."
    },
    {
      label: "Before signing off",
      value: "Assign an owner, record what was checked, add a customer-safe summary, then resolve under your own name."
    }
  ];
  const handoverSummary = handoverLines.map((line) => `${line.label}: ${line.value}`).join(" ");
  const showHandoverGate = !handoverAckResult.error && !handoverAckResult.data?.length;

  const kpis: Array<{
    label: string;
    value: string | number;
    detail: string;
    icon: typeof Activity;
    tone: KpiTone;
  }> = [
    {
      label: "Platform health",
      value: latestHealth ? `${Number(latestHealth.success_rate).toFixed(1)}%` : "-",
      detail: latestHealth ? `p95 ${latestHealth.p95_ms}ms - ${latestHealth.failed_checks} failed` : "Run first health check",
      icon: Gauge,
      tone: latestHealth?.status === "ok" ? "ok" : latestHealth ? "critical" : "neutral"
    },
    {
      label: "Active incidents",
      value: activeIncidents.length,
      detail: `${criticalIncidents.length} critical - ${activeIncidents.reduce((sum, item) => sum + Number(item.occurrence_count ?? 0), 0)} occurrences`,
      icon: AlertTriangle,
      tone: criticalIncidents.length ? "critical" : activeIncidents.length ? "urgent" : "ok"
    },
    {
      label: "Open tickets",
      value: openQueue,
      detail: `${criticalTickets.length} critical - ${overdueTickets.length} SLA overdue`,
      icon: TicketCheck,
      tone: criticalTickets.length || overdueTickets.length ? "critical" : openQueue ? "urgent" : "ok"
    },
    {
      label: "AI resolution rate",
      value: aiResolutionRate,
      detail: `${aiResolved} resolved without ticket - ${sessions.length} sessions sampled`,
      icon: Bot,
      tone: "ok"
    },
    {
      label: "Avg resolution",
      value: averageResolution(tickets),
      detail: "Resolved support tickets in latest dataset",
      icon: Clock3,
      tone: "neutral"
    },
    {
      label: "Last deployment",
      value: latestDeploymentLabel(),
      detail: process.env.VERCEL_URL ? process.env.VERCEL_URL : "Production alias active",
      icon: GitBranch,
      tone: "neutral"
    }
  ];

  return (
    <main className="min-h-screen bg-black text-white">
      <AdminAutoRefresh />
      <TechnicalSupportTopBar canAccessAdmin={accessRole === "admin"} />
      <TechnicalSupportPageHeader
        eyebrow="Technical operations center"
        title="Technical Support Operations Centre"
        containerClassName="max-w-[1500px]"
        description="Monitor platform health, triage AI-guided support, investigate incidents, review knowledge coverage, and escalate business decisions without changing production settings, accounts, bookings, or payments."
        showAdminBack={accessRole === "admin"}
        right={(
          <TechnicalSupportHandoverBrief
            accessLabel={accessRole === "admin" ? "Admin view" : "Technical team view"}
            briefSummary={handoverSummary}
            handoverDate={handoverDate}
            initiallyOpen={showHandoverGate}
            lines={handoverLines}
            requiresAcknowledgement={showHandoverGate}
          />
        )}
      />

      <section className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:px-10">
        {loadError ? (
          <div className="mb-6 rounded border border-red-500/40 bg-red-500/10 p-5 text-sm font-semibold text-red-100">
            Some operations data could not be loaded. Existing access controls remain active; refresh the page or run a health check.
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          {kpis.map((kpi) => (
            <KpiTile key={kpi.label} {...kpi} />
          ))}
        </section>

        <section className="mt-6 rounded border border-zinc-800 bg-zinc-950 p-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-sm font-black uppercase text-red-200">Incoming work</div>
              <h2 className="mt-1 text-2xl font-black">What needs attention now</h2>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-zinc-400">
                A clean live intake view for the newest incident, support ticket, and product feedback signal before the team opens the detailed workspaces.
              </p>
            </div>
            <Link href="/technical-support/feedback" className="inline-flex items-center gap-2 rounded border border-zinc-700 px-4 py-3 text-sm font-black text-white transition hover:border-red-500">
              Open working queue <ArrowRight size={16} />
            </Link>
          </div>
          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            <IncomingWorkCard
              icon={AlertTriangle}
              label="Newest incident"
              title={newestIncident ? newestIncident.title : "No incident waiting"}
              detail={
                newestIncident
                  ? `${label(newestIncident.status)} - last seen ${dateFormatter.format(new Date(newestIncident.last_seen_at))}`
                  : "The incident queue is currently clear."
              }
              href="/technical-support/incidents"
            />
            <IncomingWorkCard
              icon={TicketCheck}
              label="Newest support ticket"
              title={newestTicket ? `${supportTicketReference(Number(newestTicket.ticket_number))} - ${newestTicket.subject || label(newestTicket.category)}` : "No ticket waiting"}
              detail={
                newestTicket
                  ? `${label(newestTicket.status)} - ${dueState(newestTicket).label}`
                  : "The support queue is currently clear."
              }
              href="/technical-support/feedback"
            />
            <IncomingWorkCard
              icon={MessageSquareText}
              label="Newest feedback"
              title={newestFeedback ? newestFeedback.issue : "No feedback waiting"}
              detail={
                newestFeedback
                  ? `${label(newestFeedback.support_status)} - ${sourcePage(newestFeedback.page_url)}`
                  : "No product feedback is waiting for review."
              }
              href="/technical-support/feedback"
            />
          </div>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
          <article className="rounded border border-zinc-800 bg-zinc-950 p-5">
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 place-items-center rounded border border-red-500/30 bg-red-500/15 text-brand">
                <Workflow size={22} />
              </div>
              <div>
                <div className="text-sm font-black uppercase text-red-200">Operating model</div>
                <h2 className="mt-1 text-2xl font-black">Support team command workflow</h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-zinc-400">
                  Use this console to triage, assign, investigate, document, escalate, and close support work without changing customer accounts, bookings, payments, or business settings.
                </p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <RunbookCard title="1. Triage" body="Check critical cases, SLA overdue items, new AI handoffs, then repeat incidents. Confirm category, severity, priority, and owner." />
              <RunbookCard title="2. Investigate" body="Review transcript, AI summary, diagnostics, booking context, affected routes, and related incidents before contacting admin." />
              <RunbookCard title="3. Escalate" body="Send to admin only when a business decision, account change, payment action, safeguarding review, or code fix is required." />
              <RunbookCard title="4. Close" body="Save a customer-safe summary, internal note, resolution evidence, and handover details before marking resolved." />
            </div>
          </article>

          <article className="rounded border border-zinc-800 bg-zinc-950 p-5">
            <div className="flex items-start gap-3">
              <ClipboardCheck className="mt-1 text-brand" size={22} />
              <div>
                <div className="text-sm font-black uppercase text-red-200">Shift handover</div>
                <h2 className="mt-1 text-2xl font-black">What the next operator needs</h2>
              </div>
            </div>
            <div className="mt-5 grid gap-3">
              <HandoverLine label="Open workload" value={`${openQueue} queue items, ${activeIncidents.length} active incidents`} />
              <HandoverLine label="Start first" value={overdueTickets.length ? "SLA overdue tickets" : criticalTickets.length ? "Critical tickets" : activeIncidents.length ? "Active incidents" : "New support handoffs"} />
              <HandoverLine label="Record before leaving" value="Owner, current diagnosis, what was tried, next action, admin decision needed, and customer update status." />
              <HandoverLine label="Never expose" value="Internal health data, raw logs, personal data, card data, security codes, or admin-only decisions." />
            </div>
          </article>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,0.8fr)]">
          <article className="rounded border border-zinc-800 bg-zinc-950 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-sm font-black uppercase text-red-200">Live monitoring</div>
                <h2 className="mt-1 text-2xl font-black">Platform service panel</h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-zinc-400">
                  API uptime, payment routes, auth protection, database-backed flows, and notifications are read from the latest health report.
                </p>
              </div>
              <form action={runLiveHealthCheck}>
                <button
                  className="rounded bg-red-600 px-4 py-3 text-sm font-black text-white hover:bg-red-500"
                  style={{ color: "#ffffff", WebkitTextFillColor: "#ffffff" }}
                >
                  Run live health check
                </button>
              </form>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-5">
              {services.map((service) => {
                const Icon = service.icon;
                return (
                  <div key={service.key} className="rounded border border-zinc-800 bg-black p-4">
                    <div className="flex items-center justify-between gap-3">
                      <Icon className="text-brand" size={21} />
                      <StatusDot status={service.status} />
                    </div>
                    <div className="mt-4 text-sm font-black">{service.label}</div>
                    <p className="mt-2 text-xs font-semibold leading-5 text-zinc-500">{service.detail}</p>
                  </div>
                );
              })}
            </div>
            <div className="mt-5 overflow-x-auto rounded border border-zinc-800">
              <div className="min-w-[720px]">
                <div className="grid grid-cols-[minmax(240px,1fr)_100px_100px_minmax(240px,1fr)] bg-black px-4 py-3 text-xs font-black uppercase text-zinc-500">
                  <div>Latest checks</div><div>Status</div><div>Time</div><div>Result</div>
                </div>
                {asArray(latestHealth?.results).slice(0, 8).map((result) => (
                  <div key={result.name} className="grid grid-cols-[minmax(240px,1fr)_100px_100px_minmax(240px,1fr)] border-t border-zinc-800 px-4 py-3 text-sm">
                    <div className="font-black">{result.name}</div>
                    <div className={result.ok ? "text-emerald-300" : "text-red-200"}>{result.ok ? "Pass" : "Fail"}</div>
                    <div>{result.durationMs}ms</div>
                    <div className="text-zinc-400">{result.message}</div>
                  </div>
                ))}
                {!latestHealth ? (
                  <div className="border-t border-zinc-800 px-4 py-5 text-sm font-semibold text-zinc-500">No health report exists yet.</div>
                ) : null}
              </div>
            </div>
          </article>

          <article className="rounded border border-zinc-800 bg-zinc-950 p-5">
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 place-items-center rounded border border-red-500/30 bg-red-500/15 text-brand">
                <Sparkles size={22} />
              </div>
              <div>
                <div className="text-sm font-black uppercase text-red-200">AI ops assistant</div>
                <h2 className="mt-1 text-2xl font-black">Triage hunches</h2>
              </div>
            </div>
            <div className="mt-5 grid gap-3">
              <Insight
                title="Similar case lookup"
                body={
                  hotTrends.length
                    ? `${hotTrends[0][0]} is the highest-repeat queue pattern in the current sample. Start there before opening new investigation threads.`
                    : "No repeated case pattern is visible yet."
                }
              />
              <Insight
                title="Root cause hunch"
                body={
                  activeIncidents.length
                    ? `${activeIncidents[0].title}: ${activeIncidents[0].suspected_cause || activeIncidents[0].summary}`
                    : latestHealth?.status === "ok"
                      ? "Platform health is currently clear. Prioritise account or booking-specific tickets."
                      : "Run a health check to refresh the operational signal."
                }
              />
              <Insight
                title="Draft next step"
                body={
                  overdueTickets.length
                    ? "Start with SLA-overdue cases, assign an owner, then update the internal note before resolving or escalating."
                    : criticalTickets.length
                      ? "Review critical tickets first and link them to any matching incidents before replying."
                      : "Queue is stable. Keep monitoring new support handoffs and repeat feedback."
                }
              />
            </div>
          </article>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
          <article className="rounded border border-zinc-800 bg-zinc-950 p-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="text-sm font-black uppercase text-red-200">Support queue</div>
                <h2 className="mt-1 text-2xl font-black">Priority triage and workload</h2>
              </div>
              <Link href="/technical-support/feedback" className="inline-flex items-center gap-2 rounded border border-zinc-700 px-4 py-3 text-sm font-black text-white hover:border-red-500">
                Open full queue <ArrowRight size={16} />
              </Link>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <MiniMetric label="Open / active" value={openQueue} detail={`${activeTickets.length} tickets - ${activeFeedback.length} feedback`} />
              <MiniMetric label="Critical" value={criticalTickets.length} detail="Priority or sev1 support cases" />
              <MiniMetric label="SLA overdue" value={overdueTickets.length} detail="Needs owner or escalation" />
            </div>
            <div className="mt-5 grid gap-3">
              {activeTickets.slice(0, 6).map((ticket) => {
                const due = dueState(ticket);
                return (
                  <Link key={ticket.id} href="/technical-support/feedback" className="rounded border border-zinc-800 bg-black p-4 transition hover:border-red-500">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-black uppercase text-red-200">{supportTicketReference(Number(ticket.ticket_number))} - {label(ticket.assigned_team)}</div>
                        <h3 className="mt-1 text-base font-black">{ticket.subject || label(ticket.category)}</h3>
                        <p className="mt-2 line-clamp-2 text-sm font-semibold leading-6 text-zinc-400">{ticket.agent_summary || ticket.ai_summary || "No summary recorded yet."}</p>
                        {ticket.resolved_by_name && ticket.resolution_signed_at ? (
                          <p className="mt-2 text-xs font-black uppercase text-zinc-500">
                            Last resolved by {ticket.resolved_by_name} on {dateFormatter.format(new Date(ticket.resolution_signed_at))}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <PriorityPill priority={ticket.priority} severity={ticket.severity} />
                        <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${due.tone === "critical" ? "bg-red-600 text-white" : due.tone === "urgent" ? "bg-amber-500 text-black" : "border border-zinc-700 text-zinc-300"}`}>
                          {due.label}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
              {!activeTickets.length ? <Empty text="No active tickets are waiting." /> : null}
            </div>
          </article>

          <article className="rounded border border-zinc-800 bg-zinc-950 p-5">
            <div className="text-sm font-black uppercase text-red-200">Workload balancing</div>
            <h2 className="mt-1 text-2xl font-black">Team load</h2>
            <div className="mt-5 grid gap-3">
              {workload.map(([team, count]) => (
                <div key={team} className="rounded border border-zinc-800 bg-black p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="font-black">{team}</div>
                    <div className="text-2xl font-black">{count}</div>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-900">
                    <div className="h-full rounded-full bg-red-600" style={{ width: `${Math.min(100, Math.max(8, (count / Math.max(1, activeTickets.length)) * 100))}%` }} />
                  </div>
                </div>
              ))}
              {!workload.length ? <Empty text="No team workload to balance right now." /> : null}
            </div>
          </article>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-3">
          <article className="rounded border border-zinc-800 bg-zinc-950 p-5 xl:col-span-2">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="text-sm font-black uppercase text-red-200">Incidents</div>
                <h2 className="mt-1 text-2xl font-black">Incident command timeline</h2>
              </div>
              <Link
                href="/technical-support/incidents"
                className="inline-flex items-center gap-2 rounded border border-black bg-black px-4 py-3 text-sm font-black text-white transition hover:border-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-300"
              >
                Open incidents <ArrowRight size={16} />
              </Link>
            </div>
            <div className="mt-5 grid gap-4">
              {incidents.slice(0, 4).map((incident) => (
                <div key={incident.id} className="rounded border border-zinc-800 bg-black p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-black uppercase text-red-200">INC-{String(incident.incident_reference ?? 0).padStart(5, "0")} - {label(incident.severity)}</div>
                      <h3 className="mt-1 text-lg font-black">{incident.title}</h3>
                      <p className="mt-2 text-sm font-semibold leading-6 text-zinc-400">{incident.summary}</p>
                    </div>
                    <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs font-black uppercase text-zinc-300">{label(incident.status)}</span>
                  </div>
                  <div className="mt-4 grid gap-3 border-t border-zinc-800 pt-4 md:grid-cols-4">
                    <TimelinePoint label="Detected" value={dateFormatter.format(new Date(incident.first_seen_at))} />
                    <TimelinePoint label="Last seen" value={dateFormatter.format(new Date(incident.last_seen_at))} />
                    <TimelinePoint label="Impact" value={incident.affected_services?.length ? incident.affected_services.map(label).join(", ") : sourcePage(incident.path)} />
                    <TimelinePoint label="Root cause" value={incident.confirmed_root_cause || incident.suspected_cause || "Under investigation"} />
                  </div>
                </div>
              ))}
              {!incidents.length ? <Empty text="No incidents have been recorded." /> : null}
            </div>
          </article>

          <article className="rounded border border-zinc-800 bg-zinc-950 p-5">
            <div className="text-sm font-black uppercase text-red-200">Knowledge center</div>
            <h2 className="mt-1 text-2xl font-black">Coverage and reuse</h2>
            <div className="mt-5 grid gap-3">
              <MiniMetric label="Active articles" value={knowledge.filter((item) => item.active).length} detail={`${knowledge.length} total knowledge entries`} />
              <MiniMetric label="Consent signals" value={cookieConsentResult.count ?? 0} detail="Cookie preferences captured" />
              <MiniMetric label="Audit events" value={audits.length} detail="Latest immutable support actions" />
            </div>
            <div className="mt-5 border-t border-zinc-800 pt-4">
              <div className="text-xs font-black uppercase text-zinc-500">Recent audit trail</div>
              <div className="mt-3 grid gap-2">
                {audits.map((audit) => (
                  <div key={audit.id} className="rounded bg-black px-3 py-2">
                    <div className="text-xs font-black uppercase text-zinc-500">{label(audit.action)} - {label(audit.actor_role)}</div>
                    <p className="mt-1 text-xs font-semibold leading-5 text-zinc-300">{audit.summary || dateFormatter.format(new Date(audit.created_at))}</p>
                  </div>
                ))}
                {!audits.length ? <p className="text-sm font-semibold text-zinc-500">No audit events recorded yet.</p> : null}
              </div>
            </div>
          </article>
        </section>

        <section className="mt-6 rounded border border-zinc-800 bg-zinc-950 p-5">
          <div className="flex items-start gap-3">
            <BarChart3 className="mt-1 text-brand" size={24} />
            <div>
              <div className="text-sm font-black uppercase text-red-200">Reporting</div>
              <h2 className="mt-1 text-2xl font-black">Trends, team performance and repeat issues</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-zinc-400">
                These reports use the existing support queue, feedback, assistant sessions, audit trail and incidents. They are read-only for the technical team.
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            {hotTrends.map(([name, count]) => (
              <div key={name} className="rounded border border-zinc-800 bg-black p-4">
                <div className="text-sm font-black">{name}</div>
                <div className="mt-2 text-3xl font-black">{count}</div>
                <p className="mt-2 text-xs font-semibold text-zinc-500">Latest sample volume</p>
              </div>
            ))}
            {!hotTrends.length ? <Empty text="No trend data yet." /> : null}
          </div>
        </section>
      </section>
    </main>
  );
}

function KpiTile({
  label: title,
  value,
  detail,
  icon: Icon,
  tone
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: typeof Activity;
  tone: KpiTone;
}) {
  const toneClass =
    tone === "ok"
      ? "border-emerald-500/70 bg-emerald-200 text-black"
      : tone === "critical"
        ? "border-red-500/70 bg-red-200 text-black"
        : tone === "urgent"
          ? "border-amber-500/70 bg-amber-200 text-black"
          : "border-zinc-200 bg-white text-black";

  return (
    <article className={`rounded border p-5 ${toneClass}`}>
      <Icon size={22} />
      <div className="mt-4 text-xs font-black uppercase">{title}</div>
      <div className="mt-2 min-h-10 text-2xl font-black tracking-normal">{value}</div>
      <p className="mt-2 text-xs font-semibold leading-5 text-black/80">{detail}</p>
    </article>
  );
}

function RunbookCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded border border-zinc-800 bg-black p-4">
      <div className="text-sm font-black text-white">{title}</div>
      <p className="mt-2 text-xs font-semibold leading-5 text-zinc-500">{body}</p>
    </div>
  );
}

function IncomingWorkCard({
  icon: Icon,
  label,
  title,
  detail,
  href
}: {
  icon: typeof Activity;
  label: string;
  title: string;
  detail: string;
  href: string;
}) {
  return (
    <Link href={href} className="group rounded border border-zinc-800 bg-black p-4 transition hover:border-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-300">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <Icon className="mt-1 shrink-0 text-brand" size={20} />
          <div className="min-w-0">
            <div className="text-xs font-black uppercase text-zinc-500">{label}</div>
            <h3 className="mt-2 line-clamp-2 text-base font-black text-white">{title}</h3>
            <p className="mt-2 line-clamp-2 text-xs font-semibold leading-5 text-zinc-400">{detail}</p>
          </div>
        </div>
        <ArrowRight className="mt-1 shrink-0 text-zinc-500 transition group-hover:text-brand" size={16} />
      </div>
    </Link>
  );
}

function HandoverLine({ label: title, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-zinc-800 bg-black p-3">
      <div className="text-xs font-black uppercase text-zinc-500">{title}</div>
      <p className="mt-1 text-sm font-semibold leading-5 text-zinc-300">{value}</p>
    </div>
  );
}

function MiniMetric({ label: title, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <div className="rounded border border-zinc-800 bg-black p-4">
      <div className="text-xs font-black uppercase text-zinc-500">{title}</div>
      <div className="mt-2 text-3xl font-black">{value}</div>
      <p className="mt-2 text-xs font-semibold leading-5 text-zinc-500">{detail}</p>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const className =
    status === "ok"
      ? "bg-emerald-400 shadow-emerald-400/40"
      : status === "degraded"
        ? "bg-amber-400 shadow-amber-400/40"
        : status === "fail"
          ? "bg-red-500 shadow-red-500/40"
          : "bg-zinc-600 shadow-zinc-600/40";
  return <span className={`h-3 w-3 rounded-full shadow-lg ${className}`} aria-label={`Status ${status}`} />;
}

function Insight({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded border border-zinc-800 bg-black p-4">
      <div className="text-sm font-black">{title}</div>
      <p className="mt-2 text-sm font-semibold leading-6 text-zinc-400">{body}</p>
    </div>
  );
}

function PriorityPill({ priority, severity }: { priority: TicketRow["priority"]; severity: string | null }) {
  const urgent = priority !== "standard" || severity === "sev1_critical" || severity === "sev2_high";
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${urgent ? "bg-red-600 text-white" : "border border-zinc-700 text-zinc-300"}`}>
      {priority === "standard" ? label(severity || priority) : priority}
    </span>
  );
}

function TimelinePoint({ label: title, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-black uppercase text-zinc-500">{title}</div>
      <p className="mt-1 text-sm font-semibold leading-5 text-zinc-300">{value}</p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded border border-zinc-800 bg-black p-5 text-sm font-semibold text-zinc-500">{text}</div>;
}
