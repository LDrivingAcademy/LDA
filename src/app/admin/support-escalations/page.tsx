import Link from "next/link";
import { Activity, AlertTriangle, MessageSquareText, TicketCheck } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";
import { AdminTopBar } from "@/components/admin-top-bar";
import { requireAdminDashboardClient } from "@/lib/admin-dashboard";
import { supportTicketReference } from "@/lib/support-guidance";
import { updateSupportTicketStatus } from "../../technical-support/actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { robots: { index: false, follow: false, nocache: true } };

type TicketRow = {
  id: string;
  ticket_number: number;
  requester_role: string;
  category: string;
  priority: "standard" | "urgent" | "critical";
  subject: string;
  ai_summary: string;
  agent_summary: string | null;
  likely_diagnosis: string | null;
  troubleshooting_done: string[] | null;
  suggested_next_steps: string[] | null;
  booking_context: Record<string, unknown> | null;
  booking_reference: string | null;
  source_path: string | null;
  created_at: string;
};

function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

export default async function AdminSupportEscalationsPage() {
  const { supabase } = await requireAdminDashboardClient();
  const [ticketResult, feedbackResult, incidentResult, healthResult] = await Promise.all([
    supabase
      .from("support_tickets")
      .select("id,ticket_number,requester_role,category,priority,subject,ai_summary,agent_summary,likely_diagnosis,troubleshooting_done,suggested_next_steps,booking_reference,booking_context,source_path,created_at")
      .eq("status", "escalated")
      .order("escalated_at", { ascending: false })
      .limit(100),
    supabase.from("product_feedback").select("id,issue,summary,escalated_at,created_at").eq("support_status", "escalated").order("escalated_at", { ascending: false }).limit(100),
    supabase.from("technical_incidents").select("id,title,summary,severity,occurrence_count,path,escalated_at,last_seen_at").eq("status", "escalated").order("escalated_at", { ascending: false }).limit(100),
    supabase.from("site_health_reports").select("id,status,success_rate,failed_checks,slow_checks_count,alert_reason,checked_at,escalated_at").not("escalated_at", "is", null).order("escalated_at", { ascending: false }).limit(50)
  ]);
  const tickets = (ticketResult.data as TicketRow[] | null) ?? [];
  const feedback = feedbackResult.data ?? [];
  const incidents = incidentResult.data ?? [];
  const health = healthResult.data ?? [];

  return (
    <main className="min-h-screen bg-black text-white">
      <AdminTopBar autoSignOutOnLeave />
      <AdminPageHeader
        eyebrow="Admin decisions"
        title="Technical support escalations"
        description="Only issues deliberately sent forward by technical support appear here. Review the concise context, then return the item for investigation or mark the decision complete."
        right={(
          <Link href="/technical-support" className="inline-flex rounded border border-zinc-700 px-4 py-2 text-sm font-black text-white hover:border-red-500">
            Open technical support
          </Link>
        )}
      />
      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-8">
        <EscalationSection icon={TicketCheck} title="Customer support decisions" empty="No customer support tickets have been escalated.">
          {tickets.map((ticket) => (
            <article key={ticket.id} className="rounded border border-red-500/30 bg-zinc-950 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-black uppercase text-red-200">
                    {supportTicketReference(Number(ticket.ticket_number))} | {label(ticket.requester_role)} | {label(ticket.category)}
                  </div>
                  <h3 className="mt-2 text-lg font-black">{ticket.subject}</h3>
                </div>
                {ticket.priority !== "standard" ? <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-black uppercase text-white">{ticket.priority}</span> : null}
              </div>
              <p className="mt-3 text-sm font-semibold leading-6 text-zinc-300">{ticket.agent_summary || ticket.ai_summary}</p>
              {ticket.likely_diagnosis ? (
                <div className="mt-4 rounded border border-zinc-800 bg-black px-3 py-2">
                  <div className="text-xs font-black uppercase text-zinc-500">Likely diagnosis</div>
                  <p className="mt-1 text-sm font-semibold leading-6 text-zinc-300">{ticket.likely_diagnosis}</p>
                </div>
              ) : null}
              <SupportList title="Already tried" items={ticket.troubleshooting_done ?? []} />
              <SupportList title="Suggested next steps" items={ticket.suggested_next_steps ?? []} />
              {ticket.category === "off_platform" && ticket.booking_context ? (
                <dl className="mt-4 grid gap-2 border-t border-zinc-800 pt-4 sm:grid-cols-2">
                  {Object.entries(ticket.booking_context)
                    .filter(([, value]) => value !== null && value !== "")
                    .map(([key, value]) => (
                      <div key={key} className="rounded bg-black px-3 py-2">
                        <dt className="text-xs font-black uppercase text-zinc-500">{label(key)}</dt>
                        <dd className="mt-1 text-sm font-semibold text-zinc-300">{String(value)}</dd>
                      </div>
                    ))}
                </dl>
              ) : null}
              <p className="mt-3 text-xs font-bold text-zinc-500">
                {new Date(ticket.created_at).toLocaleString("en-GB")}
                {ticket.booking_reference ? ` | Booking ${ticket.booking_reference}` : ""}
                {ticket.source_path ? ` | ${ticket.source_path}` : ""}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <TicketDecisionButton id={ticket.id} status="reviewing" label="Return to support review" />
                <TicketDecisionButton id={ticket.id} status="resolved" label="Mark decision complete" emphasis />
              </div>
            </article>
          ))}
        </EscalationSection>
        <EscalationSection icon={MessageSquareText} title="Feedback decisions" empty="No feedback has been escalated.">
          {feedback.map((item) => <Escalation key={item.id} title={item.issue} summary={item.summary} detail={`Submitted ${new Date(item.created_at).toLocaleString("en-GB")}`} />)}
        </EscalationSection>
        <EscalationSection icon={AlertTriangle} title="Technical incidents" empty="No incidents have been escalated.">
          {incidents.map((item) => <Escalation key={item.id} title={item.title} summary={item.summary} detail={`${item.severity} | ${item.occurrence_count} occurrence${item.occurrence_count === 1 ? "" : "s"}${item.path ? ` | ${item.path}` : ""}`} />)}
        </EscalationSection>
        <EscalationSection icon={Activity} title="Health alerts" empty="No health reports have been escalated.">
          {health.map((item) => <Escalation key={item.id} title={`${item.status} health report`} summary={item.alert_reason || `${item.failed_checks} failed and ${item.slow_checks_count} slow checks.`} detail={`${Number(item.success_rate).toFixed(1)}% successful | ${new Date(item.checked_at).toLocaleString("en-GB")}`} />)}
        </EscalationSection>
      </section>
    </main>
  );
}

function SupportList({ title, items }: { title: string; items: string[] }) {
  const cleanItems = items.filter(Boolean).slice(0, 5);
  if (!cleanItems.length) return null;

  return (
    <div className="mt-4 rounded border border-zinc-800 bg-black px-3 py-3">
      <div className="text-xs font-black uppercase text-zinc-500">{title}</div>
      <ul className="mt-2 grid gap-2">
        {cleanItems.map((item) => (
          <li key={item} className="text-sm font-semibold leading-6 text-zinc-300">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function TicketDecisionButton({ id, status, label: buttonLabel, emphasis = false }: { id: string; status: "reviewing" | "resolved"; label: string; emphasis?: boolean }) {
  return (
    <form action={updateSupportTicketStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button className={`rounded px-3 py-2 text-sm font-black ${emphasis ? "bg-red-600 text-white hover:bg-red-500" : "border border-zinc-700 text-zinc-200 hover:border-red-500"}`}>
        {buttonLabel}
      </button>
    </form>
  );
}

function EscalationSection({ icon: Icon, title, empty, children }: { icon: typeof Activity; title: string; empty: string; children: React.ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <section className="border-t border-zinc-800 pt-6">
      <div className="flex items-center gap-3">
        <Icon className="text-brand" size={22} />
        <h2 className="text-2xl font-black">{title}</h2>
      </div>
      <div className="mt-4 grid gap-3">{hasChildren ? children : <div className="rounded border border-zinc-800 bg-zinc-950 p-5 text-sm font-semibold text-zinc-400">{empty}</div>}</div>
    </section>
  );
}

function Escalation({ title, summary, detail }: { title: string; summary: string; detail: string }) {
  return (
    <article className="rounded border border-red-500/30 bg-zinc-950 p-5">
      <h3 className="text-lg font-black">{title}</h3>
      <p className="mt-2 text-sm font-semibold leading-6 text-zinc-300">{summary}</p>
      <p className="mt-3 text-xs font-bold text-zinc-500">{detail}</p>
    </article>
  );
}
