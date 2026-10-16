import { AlertTriangle, Bot, CheckCircle2, Clock3, ClipboardCheck, FileText, Mail, Paperclip, Route, ShieldCheck, SlidersHorizontal, TicketCheck, UserCheck, UsersRound } from "lucide-react";
import { TechnicalSupportEscalationMatrix } from "@/components/technical-support-escalation-matrix";
import { TechnicalSupportOperatingModel } from "@/components/technical-support-operating-model";
import { TechnicalSupportPageHeader } from "@/components/technical-support-page-header";
import { TechnicalSupportPageSelector } from "@/components/technical-support-page-selector";
import { TechnicalSupportTopBar } from "@/components/technical-support-top-bar";
import { requireTechnicalSupportClient } from "@/lib/technical-support-access";
import { saveSupportTicketNote, saveSupportTicketSummary, updateFeedbackSupportStatus, updateSupportTicketOwner, updateSupportTicketRouting, updateSupportTicketStatus } from "../actions";
import { supportTicketReference } from "@/lib/support-guidance";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { robots: { index: false, follow: false, nocache: true } };

type TicketStatus = "new" | "reviewing" | "waiting_on_customer" | "triaged" | "assigned" | "in_progress" | "waiting_for_internal_team" | "escalated" | "resolved" | "closed" | "reopened";
type TicketRow = {
  id: string;
  ticket_number: number;
  requester_role: string;
  category: string;
  subcategory: string | null;
  priority: "standard" | "urgent" | "critical";
  severity: string | null;
  assigned_team: string | null;
  assigned_to: string | null;
  status: TicketStatus;
  subject: string;
  message: string;
  ai_summary: string;
  agent_summary: string | null;
  assistant_guidance: string;
  likely_diagnosis: string | null;
  troubleshooting_done: string[] | null;
  suggested_next_steps: string[] | null;
  booking_reference: string | null;
  booking_context: Record<string, unknown> | null;
  conversation: Array<{ role?: string; text?: string }> | null;
  tool_trace: Array<Record<string, unknown>> | null;
  request_context: Record<string, unknown> | null;
  risk_flags: string[] | null;
  source_path: string | null;
  internal_note: string | null;
  first_response_due_at: string | null;
  resolution_due_at: string | null;
  created_at: string;
  resolved_by_name: string | null;
  resolution_signed_at: string | null;
};

type FeedbackRow = {
  id: string;
  issue: string;
  summary: string;
  summary_kind: "short" | "ai" | "fallback";
  support_status: "new" | "reviewing" | "escalated" | "resolved";
  page_url: string | null;
  created_at: string;
  resolved_by_name: string | null;
  resolution_signed_at: string | null;
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/London"
});
const queuePageSize = 5;

const teamOptions = [
  { value: "technical_support", label: "Technical support" },
  { value: "support_management", label: "Support management" },
  { value: "administration", label: "Administration" },
  { value: "finance", label: "Finance" },
  { value: "safeguarding", label: "Safeguarding" },
  { value: "compliance", label: "Compliance" },
  { value: "development", label: "Development" }
];

const severityOptions = [
  { value: "sev1_critical", label: "SEV1 critical" },
  { value: "sev2_high", label: "SEV2 high" },
  { value: "sev3_medium", label: "SEV3 medium" },
  { value: "sev4_low", label: "SEV4 low" }
];

function sourcePage(value: string | null) {
  if (!value) return "Page not recorded";
  try {
    const url = new URL(value, "https://ldrivingacademy.co.uk");
    return `${url.pathname}${url.search}`;
  } catch {
    return value;
  }
}

function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function durationLabel(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / 1440)}d`;
}

function slaState(ticket: TicketRow) {
  const due = ticket.resolution_due_at || ticket.first_response_due_at;
  if (!due || ticket.status === "resolved") return { label: "No SLA timer", tone: "neutral" as const };
  const minutes = Math.round((new Date(due).getTime() - Date.now()) / 60000);
  if (minutes < 0) return { label: `${durationLabel(Math.abs(minutes))} overdue`, tone: "critical" as const };
  if (minutes < 60) return { label: `${minutes}m left`, tone: "urgent" as const };
  return { label: `${durationLabel(minutes)} left`, tone: "ok" as const };
}

type SupportQueuePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function pageCount(totalItems: number) {
  return Math.max(1, Math.ceil(totalItems / queuePageSize));
}

function pageNumber(value: string | string[] | undefined, totalPages: number) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(rawValue || "1", 10);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(Math.max(parsed, 1), totalPages);
}

function pageItems<T>(items: T[], page: number) {
  const start = (page - 1) * queuePageSize;
  return items.slice(start, start + queuePageSize);
}

export default async function TechnicalSupportFeedbackPage({ searchParams }: SupportQueuePageProps) {
  const { supabase, accessRole } = await requireTechnicalSupportClient();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const [ticketResult, feedbackResult] = await Promise.all([
    supabase
      .from("support_tickets")
      .select("id,ticket_number,requester_role,category,subcategory,priority,severity,assigned_team,assigned_to,status,subject,message,ai_summary,agent_summary,assistant_guidance,likely_diagnosis,troubleshooting_done,suggested_next_steps,booking_reference,booking_context,conversation,tool_trace,request_context,risk_flags,source_path,internal_note,first_response_due_at,resolution_due_at,created_at,resolved_by_name,resolution_signed_at")
      .order("created_at", { ascending: false })
      .limit(250),
    supabase
      .from("product_feedback")
      .select("id,issue,summary,summary_kind,support_status,page_url,created_at,resolved_by_name,resolution_signed_at")
      .order("created_at", { ascending: false })
      .limit(250)
  ]);

  const tickets = (ticketResult.data as TicketRow[] | null) ?? [];
  const feedback = (feedbackResult.data as FeedbackRow[] | null) ?? [];
  const activeTickets = tickets.filter((item) => item.status !== "resolved");
  const urgentTickets = activeTickets.filter((item) => item.priority !== "standard");
  const activeFeedback = feedback.filter((item) => item.support_status !== "resolved");
  const overdueTickets = activeTickets.filter((item) => slaState(item).tone === "critical");
  const assignedTickets = activeTickets.filter((item) => item.assigned_to);
  const escalatedCount =
    tickets.filter((item) => item.status === "escalated").length +
    feedback.filter((item) => item.support_status === "escalated").length;
  const workload = activeTickets.reduce<Record<string, number>>((teams, ticket) => {
    const team = label(ticket.assigned_team || "technical_support");
    teams[team] = (teams[team] ?? 0) + 1;
    return teams;
  }, {});
  const loadError = ticketResult.error || feedbackResult.error;
  const ticketPage = pageNumber(resolvedSearchParams.ticketsPage, pageCount(tickets.length));
  const feedbackPage = pageNumber(resolvedSearchParams.feedbackPage, pageCount(feedback.length));
  const visibleTickets = pageItems(tickets, ticketPage);
  const visibleFeedback = pageItems(feedback, feedbackPage);

  return (
    <main className="min-h-screen bg-black text-white">
      <TechnicalSupportTopBar canAccessAdmin={accessRole === "admin"} />
      <TechnicalSupportPageHeader
        eyebrow="Technical support"
        title="Support queue"
        description="Review AI-guided customer tickets and product feedback in one queue. Account names and email addresses are not displayed; the operational context needed to investigate the issue is retained."
        showAdminBack={accessRole === "admin"}
      />

      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric icon={TicketCheck} label="Active tickets" value={activeTickets.length} />
          <Metric icon={AlertTriangle} label="Urgent tickets" value={urgentTickets.length} />
          <Metric icon={Clock3} label="SLA overdue" value={overdueTickets.length} />
          <Metric icon={UsersRound} label="Assigned" value={assignedTickets.length} />
        </div>

        <TechnicalSupportOperatingModel className="mt-6" />
        <TechnicalSupportEscalationMatrix className="mt-6" />

        <section className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <article className="rounded border border-zinc-800 bg-zinc-950 p-5">
            <div className="flex items-start gap-3">
              <SlidersHorizontal className="mt-1 text-brand" size={22} />
              <div>
                <h2 className="text-xl font-black">Queue filters and prioritisation</h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-zinc-400">
                  Use the cards below as the working filter set: critical first, then SLA overdue, unassigned, waiting customer, escalated, and repeat issues.
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
              <QueueFilter label="Critical" value={urgentTickets.length} />
              <QueueFilter label="SLA overdue" value={overdueTickets.length} />
              <QueueFilter label="Unassigned" value={activeTickets.length - assignedTickets.length} />
              <QueueFilter label="Waiting customer" value={activeTickets.filter((item) => item.status.includes("waiting")).length} />
              <QueueFilter label="With admin" value={escalatedCount} />
              <QueueFilter label="Feedback" value={activeFeedback.length} />
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              <OpsCard
                icon={UserCheck}
                title="Ownership rule"
                body="Every active case needs an owner before investigation starts. Use Assign to me, then move the case into review or in progress."
              />
              <OpsCard
                icon={ShieldCheck}
                title="Escalation boundary"
                body="Technical support can diagnose, document, route, and escalate. Account, booking, payment, and business changes stay with admin."
              />
              <OpsCard
                icon={ClipboardCheck}
                title="Handover ready"
                body="Before ending a shift, leave the current diagnosis, what was tried, next action, owner, SLA position, and whether admin is needed."
              />
            </div>
          </article>
          <article className="rounded border border-zinc-800 bg-zinc-950 p-5">
            <div className="text-sm font-black uppercase text-red-200">Workload balance</div>
            <div className="mt-3 grid gap-2">
              {Object.entries(workload).map(([team, count]) => (
                <div key={team} className="flex items-center justify-between gap-3 rounded border border-zinc-800 bg-black px-3 py-2">
                  <span className="text-sm font-black">{team}</span>
                  <span className="text-lg font-black">{count}</span>
                </div>
              ))}
              {!Object.keys(workload).length ? <p className="text-sm font-semibold text-zinc-500">No active team load.</p> : null}
            </div>
          </article>
        </section>

        {loadError ? <LoadError /> : null}

        <section className="mt-8 border-t border-zinc-800 pt-6">
          <div>
            <div className="text-sm font-black uppercase text-red-200">AI-guided cases</div>
            <h2 className="mt-1 text-2xl font-black">Customer support tickets</h2>
          </div>
          <div className="mt-5 grid gap-4">
            {visibleTickets.map((ticket) => (
              <article key={ticket.id} className={`rounded border p-5 ${ticket.status === "resolved" ? "border-zinc-900 bg-zinc-950/50" : ticket.priority === "critical" ? "border-red-500/60 bg-red-950/20" : "border-zinc-800 bg-zinc-950"}`}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-2 text-xs font-black uppercase">
                      <span className="text-red-200">{supportTicketReference(Number(ticket.ticket_number))}</span>
                      <span className="text-zinc-500">{label(ticket.requester_role)}</span>
                      <span className="text-zinc-500">{label(ticket.subcategory || ticket.category)}</span>
                      {ticket.assigned_team ? <span className="text-zinc-500">{label(ticket.assigned_team)}</span> : null}
                    </div>
                    <h3 className="mt-2 text-lg font-black">{ticket.subject}</h3>
                    <p className="mt-3 max-w-4xl text-sm font-semibold leading-6 text-zinc-300">{ticket.agent_summary || ticket.ai_summary}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {ticket.severity ? <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs font-black uppercase text-zinc-300">{label(ticket.severity)}</span> : null}
                    {ticket.priority !== "standard" ? <PriorityPill priority={ticket.priority} /> : null}
                    <SlaPill state={slaState(ticket)} />
                    <TicketStatusPill status={ticket.status} />
                  </div>
                </div>

                <div className="mt-4 grid gap-3 border-t border-zinc-800 pt-3 text-xs font-bold text-zinc-500 sm:grid-cols-2 xl:grid-cols-5">
                  <span>{dateFormatter.format(new Date(ticket.created_at))}</span>
                  <span>{sourcePage(ticket.source_path)}</span>
                  <span>{ticket.booking_reference ? `Booking ${ticket.booking_reference}` : "No booking reference"}</span>
                  <span>{ticket.assigned_to ? "Assigned to current reviewer" : "Unassigned"}</span>
                  <span>{ticket.risk_flags?.length ? ticket.risk_flags.map(label).join(", ") : "No risk flags"}</span>
                </div>
                {ticket.resolved_by_name && ticket.resolution_signed_at ? (
                  <div className="mt-3 rounded border border-emerald-600/30 bg-emerald-500/10 px-4 py-3 text-sm font-black text-emerald-100">
                    Resolved sign-off: {ticket.resolved_by_name} on {dateFormatter.format(new Date(ticket.resolution_signed_at))}
                  </div>
                ) : null}

                <details className="mt-4 rounded border border-zinc-800 bg-black">
                  <summary className="cursor-pointer px-4 py-3 text-sm font-black text-zinc-200">View investigation context</summary>
                  <div className="grid gap-5 border-t border-zinc-800 p-4 text-sm">
                    <ContextBlock title="AI summary" text={ticket.ai_summary} />
                    {ticket.agent_summary ? <ContextBlock title="Agent edited summary" text={ticket.agent_summary} /> : null}
                    {ticket.likely_diagnosis ? <ContextBlock title="Likely diagnosis" text={ticket.likely_diagnosis} /> : null}
                    <Checklist title="Troubleshooting already done" items={ticket.troubleshooting_done ?? []} />
                    <Checklist title="Suggested next steps" items={ticket.suggested_next_steps ?? []} />
                    <ContextBlock title="Customer issue" text={ticket.message} />
                    <ContextBlock title="Assistant guidance" text={ticket.assistant_guidance} />
                    <Conversation messages={ticket.conversation ?? []} />
                    <Attachments context={ticket.request_context ?? {}} />
                    <ToolTrace tools={ticket.tool_trace ?? []} />
                    <BookingContext context={ticket.booking_context ?? {}} />
                    <Diagnostics context={ticket.request_context ?? {}} />
                  </div>
                </details>

                <article className="mt-4 rounded border border-zinc-800 bg-black p-4">
                  <div className="flex items-start gap-3">
                    <Bot className="mt-1 text-brand" size={20} />
                    <div>
                      <div className="text-xs font-black uppercase text-zinc-500">AI ops assistant</div>
                      <p className="mt-1 text-sm font-semibold leading-6 text-zinc-300">
                        Similar cases should be checked by category <strong>{label(ticket.subcategory || ticket.category)}</strong>, source page <strong>{sourcePage(ticket.source_path)}</strong>, and any linked incident before replying. Suggested next step: {(ticket.suggested_next_steps ?? [])[0] || "confirm ownership, review diagnostics, then update the customer or escalate."}
                      </p>
                    </div>
                  </div>
                </article>

                <div className="mt-4 grid gap-3 lg:grid-cols-3">
                  <ResponseTemplate
                    icon={Mail}
                    title="Customer update"
                    body={`Thanks for your patience. We are reviewing ${supportTicketReference(Number(ticket.ticket_number))} and will update you once the next check is complete.`}
                  />
                  <ResponseTemplate
                    icon={Route}
                    title="Internal route"
                    body={`Route: ${label(ticket.assigned_team || "technical_support")}. Priority: ${label(ticket.priority)}. Severity: ${label(ticket.severity || "sev3_medium")}.`}
                  />
                  <ResponseTemplate
                    icon={CheckCircle2}
                    title="Closure check"
                    body="Confirm the customer issue, action taken, evidence checked, customer-safe summary, and whether follow-up email is required before resolving."
                  />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <TicketOwnerButton id={ticket.id} mode="assign" label={ticket.assigned_to ? "Take ownership" : "Assign to me"} />
                  {ticket.assigned_to ? <TicketOwnerButton id={ticket.id} mode="release" label="Release owner" /> : null}
                  {ticket.status !== "reviewing" && ticket.status !== "resolved" ? <TicketStatusButton id={ticket.id} status="reviewing" label="Start review" /> : null}
                  {ticket.status !== "in_progress" && ticket.status !== "resolved" ? <TicketStatusButton id={ticket.id} status="in_progress" label="In progress" /> : null}
                  {ticket.status !== "waiting_on_customer" && ticket.status !== "resolved" ? <TicketStatusButton id={ticket.id} status="waiting_on_customer" label="Waiting for customer" /> : null}
                  {ticket.status !== "waiting_for_internal_team" && ticket.status !== "resolved" ? <TicketStatusButton id={ticket.id} status="waiting_for_internal_team" label="Waiting internal team" /> : null}
                  {ticket.status !== "escalated" && ticket.status !== "resolved" ? <TicketStatusButton id={ticket.id} status="escalated" label="Send to admin" emphasis /> : null}
                  {ticket.status !== "resolved" ? <TicketStatusButton id={ticket.id} status="resolved" label="Resolve" /> : <TicketStatusButton id={ticket.id} status="new" label="Reopen" />}
                </div>

                <form action={updateSupportTicketRouting} className="mt-4 grid gap-3 rounded border border-zinc-800 bg-black p-4 md:grid-cols-[1fr_1fr_1fr_auto]">
                  <input type="hidden" name="id" value={ticket.id} />
                  <label className="grid gap-1">
                    <span className="text-xs font-black uppercase text-zinc-500">Priority</span>
                    <select name="priority" defaultValue={ticket.priority} className="rounded border border-zinc-700 bg-black px-3 py-2 text-sm font-bold text-white">
                      <option value="standard">Standard</option>
                      <option value="urgent">Urgent</option>
                      <option value="critical">Critical</option>
                    </select>
                  </label>
                  <label className="grid gap-1">
                    <span className="text-xs font-black uppercase text-zinc-500">Severity</span>
                    <select name="severity" defaultValue={ticket.severity || "sev3_medium"} className="rounded border border-zinc-700 bg-black px-3 py-2 text-sm font-bold text-white">
                      {severityOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1">
                    <span className="text-xs font-black uppercase text-zinc-500">Team route</span>
                    <select name="assignedTeam" defaultValue={ticket.assigned_team || "technical_support"} className="rounded border border-zinc-700 bg-black px-3 py-2 text-sm font-bold text-white">
                      {teamOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <button className="self-end rounded border border-zinc-700 px-4 py-2 text-sm font-black text-white hover:border-red-500">
                    Update route
                  </button>
                </form>

                <form action={saveSupportTicketSummary} className="mt-4 grid gap-2 border-t border-zinc-800 pt-4 sm:grid-cols-[1fr_auto]">
                  <input type="hidden" name="id" value={ticket.id} />
                  <textarea
                    name="agentSummary"
                    defaultValue={ticket.agent_summary || ticket.ai_summary}
                    rows={2}
                    maxLength={500}
                    placeholder="Agent-edited customer-safe summary"
                    className="resize-y rounded border border-zinc-700 bg-black px-3 py-2 text-sm font-semibold text-white placeholder:text-zinc-600"
                  />
                  <button className="rounded border border-zinc-700 px-4 py-2 text-sm font-black text-white hover:border-red-500">Save summary</button>
                </form>

                <form action={saveSupportTicketNote} className="mt-4 grid gap-2 border-t border-zinc-800 pt-4 sm:grid-cols-[1fr_auto]">
                  <input type="hidden" name="id" value={ticket.id} />
                  <textarea
                    name="internalNote"
                    defaultValue={ticket.internal_note ?? ""}
                    rows={2}
                    maxLength={5000}
                    placeholder="Internal investigation note"
                    className="resize-y rounded border border-zinc-700 bg-black px-3 py-2 text-sm font-semibold text-white placeholder:text-zinc-600"
                  />
                  <button className="rounded border border-zinc-700 px-4 py-2 text-sm font-black text-white hover:border-red-500">Save note</button>
                </form>
              </article>
            ))}
            {!ticketResult.error && tickets.length === 0 ? <Empty text="No customer support tickets have been created yet." /> : null}
          </div>
          <TechnicalSupportPageSelector
            basePath="/technical-support/feedback"
            currentPage={ticketPage}
            itemLabel="Support ticket"
            pageParam="ticketsPage"
            pageSize={queuePageSize}
            searchParams={resolvedSearchParams}
            totalItems={tickets.length}
          />
        </section>

        <section className="mt-10 border-t border-zinc-800 pt-6">
          <div>
            <div className="text-sm font-black uppercase text-red-200">Product signals</div>
            <h2 className="mt-1 text-2xl font-black">Feedback review</h2>
          </div>
          <div className="mt-5 grid gap-4">
            {visibleFeedback.map((item) => (
              <article key={item.id} className={`rounded border p-5 ${item.support_status === "resolved" ? "border-zinc-900 bg-zinc-950/50" : "border-zinc-800 bg-zinc-950"}`}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="text-lg font-black">{item.issue}</h3>
                    <p className="mt-3 max-w-4xl text-sm font-semibold leading-6 text-zinc-300">{item.summary}</p>
                  </div>
                  <FeedbackStatusPill status={item.support_status} />
                </div>
                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 border-t border-zinc-800 pt-3 text-xs font-bold text-zinc-500">
                  <span>{dateFormatter.format(new Date(item.created_at))}</span>
                  <span>{sourcePage(item.page_url)}</span>
                  <span>{item.summary_kind === "short" ? "Original short note" : item.summary_kind === "ai" ? "AI summary" : "Automatic concise summary"}</span>
                  {item.resolved_by_name && item.resolution_signed_at ? (
                    <span>Resolved by {item.resolved_by_name} on {dateFormatter.format(new Date(item.resolution_signed_at))}</span>
                  ) : null}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {item.support_status !== "reviewing" && item.support_status !== "resolved" ? <FeedbackStatusButton id={item.id} status="reviewing" label="Start review" /> : null}
                  {item.support_status !== "escalated" && item.support_status !== "resolved" ? <FeedbackStatusButton id={item.id} status="escalated" label="Send to admin" emphasis /> : null}
                  {item.support_status !== "resolved" ? <FeedbackStatusButton id={item.id} status="resolved" label="Resolve" /> : <FeedbackStatusButton id={item.id} status="new" label="Reopen" />}
                </div>
              </article>
            ))}
            {!feedbackResult.error && feedback.length === 0 ? <Empty text="No product feedback has been submitted yet." /> : null}
          </div>
          <TechnicalSupportPageSelector
            basePath="/technical-support/feedback"
            currentPage={feedbackPage}
            itemLabel="Product feedback"
            pageParam="feedbackPage"
            pageSize={queuePageSize}
            searchParams={resolvedSearchParams}
            totalItems={feedback.length}
          />
        </section>
      </section>
    </main>
  );
}

function ContextBlock({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <div className="text-xs font-black uppercase text-zinc-500">{title}</div>
      <p className="mt-2 whitespace-pre-wrap font-semibold leading-6 text-zinc-300">{text}</p>
    </div>
  );
}

function Checklist({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <div className="text-xs font-black uppercase text-zinc-500">{title}</div>
      <ul className="mt-2 grid gap-2">
        {items.slice(0, 8).map((item) => (
          <li key={item} className="rounded bg-zinc-950 px-3 py-2 font-semibold leading-6 text-zinc-300">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Conversation({ messages }: { messages: Array<{ role?: string; text?: string }> }) {
  if (!messages.length) return null;
  return (
    <div>
      <div className="text-xs font-black uppercase text-zinc-500">Conversation</div>
      <div className="mt-2 grid gap-2">
        {messages.slice(-8).map((message, index) => (
          <p key={`${message.role}-${index}`} className="rounded bg-zinc-950 px-3 py-2 font-semibold leading-6 text-zinc-300">
            <strong className="text-white">{message.role === "assistant" ? "LDA guide" : "Customer"}:</strong> {String(message.text ?? "")}
          </p>
        ))}
      </div>
    </div>
  );
}

function ToolTrace({ tools }: { tools: Array<Record<string, unknown>> }) {
  if (!tools.length) return null;
  return (
    <div>
      <div className="text-xs font-black uppercase text-zinc-500">Assistant tool trace</div>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {tools.slice(0, 6).map((tool, index) => (
          <div key={`${String(tool.tool ?? "tool")}-${index}`} className="rounded bg-zinc-950 px-3 py-2">
            <div className="text-xs font-black uppercase text-zinc-500">{label(String(tool.tool ?? "tool"))}</div>
            <p className="mt-1 text-xs font-semibold leading-5 text-zinc-300">
              {Object.entries(tool)
                .filter(([key]) => key !== "tool")
                .map(([key, value]) => `${label(key)}: ${Array.isArray(value) ? value.join(", ") : String(value)}`)
                .join(" | ")}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Attachments({ context }: { context: Record<string, unknown> }) {
  const attachments = Array.isArray(context.attachments) ? context.attachments : [];
  return (
    <div>
      <div className="flex items-center gap-2 text-xs font-black uppercase text-zinc-500">
        <Paperclip size={14} /> Attachments
      </div>
      {attachments.length ? (
        <ul className="mt-2 grid gap-2">
          {attachments.slice(0, 5).map((attachment, index) => (
            <li key={`${String(attachment)}-${index}`} className="rounded bg-zinc-950 px-3 py-2 font-semibold leading-6 text-zinc-300">
              {String(attachment)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 rounded bg-zinc-950 px-3 py-2 font-semibold leading-6 text-zinc-500">
          No file attachments are linked to this case. The transcript and diagnostics are still stored with the ticket.
        </p>
      )}
    </div>
  );
}

function BookingContext({ context }: { context: Record<string, unknown> }) {
  const entries = Object.entries(context).filter(([, value]) => value !== null && value !== "");
  if (!entries.length) return null;
  return (
    <div>
      <div className="text-xs font-black uppercase text-zinc-500">Case context</div>
      <dl className="mt-2 grid gap-2 sm:grid-cols-2">
        {entries.map(([key, value]) => (
          <div key={key} className="rounded bg-zinc-950 px-3 py-2">
            <dt className="text-xs font-black text-zinc-500">{label(key)}</dt>
            <dd className="mt-1 font-semibold text-zinc-300">{String(value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Diagnostics({ context }: { context: Record<string, unknown> }) {
  const diagnosticEntries = Object.entries(context)
    .filter(([key]) => ["userAgent", "ipHash", "serviceStatus", "knowledgeSlugs", "navigationHrefs", "handoff", "callbackAvailable"].includes(key))
    .slice(0, 8);

  if (!diagnosticEntries.length) return null;

  return (
    <div>
      <div className="text-xs font-black uppercase text-zinc-500">Technical diagnostics</div>
      <dl className="mt-2 grid gap-2 sm:grid-cols-2">
        {diagnosticEntries.map(([key, value]) => (
          <div key={key} className="rounded bg-zinc-950 px-3 py-2">
            <dt className="text-xs font-black text-zinc-500">{label(key)}</dt>
            <dd className="mt-1 break-words font-semibold text-zinc-300">
              {typeof value === "object" ? JSON.stringify(value).slice(0, 420) : String(value)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function OpsCard({ icon: Icon, title, body }: { icon: typeof UserCheck; title: string; body: string }) {
  return (
    <div className="rounded border border-zinc-800 bg-black p-4">
      <Icon className="text-brand" size={20} />
      <div className="mt-3 text-sm font-black">{title}</div>
      <p className="mt-2 text-xs font-semibold leading-5 text-zinc-500">{body}</p>
    </div>
  );
}

function ResponseTemplate({ icon: Icon, title, body }: { icon: typeof Mail; title: string; body: string }) {
  return (
    <div className="rounded border border-zinc-800 bg-black p-4">
      <Icon className="text-brand" size={18} />
      <div className="mt-2 text-xs font-black uppercase text-zinc-500">{title}</div>
      <p className="mt-2 text-sm font-semibold leading-6 text-zinc-300">{body}</p>
    </div>
  );
}

function TicketOwnerButton({ id, mode, label: buttonLabel }: { id: string; mode: "assign" | "release"; label: string }) {
  return (
    <form action={updateSupportTicketOwner}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="mode" value={mode} />
      <button className="rounded border border-zinc-700 px-3 py-2 text-sm font-black text-zinc-200 hover:border-red-500 hover:text-white">{buttonLabel}</button>
    </form>
  );
}

function TicketStatusButton({ id, status, label: buttonLabel, emphasis = false }: { id: string; status: TicketStatus; label: string; emphasis?: boolean }) {
  return (
    <form action={updateSupportTicketStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button className={`rounded px-3 py-2 text-sm font-black ${emphasis ? "bg-red-600 text-white hover:bg-red-500" : "border border-zinc-700 text-zinc-200 hover:border-red-500 hover:text-white"}`}>{buttonLabel}</button>
    </form>
  );
}

function FeedbackStatusButton({ id, status, label: buttonLabel, emphasis = false }: { id: string; status: string; label: string; emphasis?: boolean }) {
  return (
    <form action={updateFeedbackSupportStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button className={`rounded px-3 py-2 text-sm font-black ${emphasis ? "bg-red-600 text-white hover:bg-red-500" : "border border-zinc-700 text-zinc-200 hover:border-red-500 hover:text-white"}`}>{buttonLabel}</button>
    </form>
  );
}

function SlaPill({ state }: { state: ReturnType<typeof slaState> }) {
  const className =
    state.tone === "critical"
      ? "bg-red-600 text-white"
      : state.tone === "urgent"
        ? "bg-amber-400 text-black"
        : state.tone === "ok"
          ? "border border-emerald-600/50 text-emerald-200"
          : "border border-zinc-700 text-zinc-300";
  return <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${className}`}>{state.label}</span>;
}

function TicketStatusPill({ status }: { status: TicketStatus }) {
  return <span className="rounded-full border border-red-500/35 px-3 py-1 text-xs font-black uppercase text-red-100">{label(status)}</span>;
}

function FeedbackStatusPill({ status }: { status: FeedbackRow["support_status"] }) {
  const value = status === "escalated" ? "With admin" : label(status);
  return <span className="rounded-full border border-red-500/35 px-3 py-1 text-xs font-black uppercase text-red-100">{value}</span>;
}

function PriorityPill({ priority }: { priority: TicketRow["priority"] }) {
  return <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-black uppercase text-white">{priority}</span>;
}

function Metric({ icon: Icon, label: metricLabel, value }: { icon: typeof FileText; label: string; value: number }) {
  return (
    <article className="rounded border border-zinc-800 bg-zinc-950 p-5">
      <Icon className="text-brand" size={22} />
      <div className="mt-3 text-sm font-bold text-zinc-400">{metricLabel}</div>
      <div className="mt-2 text-3xl font-black">{value}</div>
    </article>
  );
}

function QueueFilter({ label: filterLabel, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-zinc-800 bg-black px-3 py-3">
      <div className="text-xs font-black uppercase text-zinc-500">{filterLabel}</div>
      <div className="mt-2 text-2xl font-black">{value}</div>
    </div>
  );
}

function LoadError() {
  return <div className="mt-5 rounded border border-red-500/40 bg-red-500/10 p-5 text-sm font-semibold text-red-100">The support queue could not be loaded. Refresh this page.</div>;
}

function Empty({ text }: { text: string }) {
  return <div className="rounded border border-zinc-800 bg-zinc-950 p-6 text-sm font-semibold text-zinc-400">{text}</div>;
}
