import Link from "next/link";
import { AlertTriangle, CheckCheck, ClipboardCheck, GitBranch, Link2, Radio, ShieldAlert, TimerReset } from "lucide-react";
import { TechnicalSupportEscalationMatrix } from "@/components/technical-support-escalation-matrix";
import { TechnicalSupportOperatingModel } from "@/components/technical-support-operating-model";
import { TechnicalSupportPageHeader } from "@/components/technical-support-page-header";
import { TechnicalSupportPageSelector } from "@/components/technical-support-page-selector";
import { TechnicalSupportTopBar } from "@/components/technical-support-top-bar";
import { requireTechnicalSupportClient } from "@/lib/technical-support-access";
import { saveIncidentInvestigationPlan, updateIncidentStatus } from "../actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { robots: { index: false, follow: false, nocache: true } };

type IncidentRow = {
  id: string;
  incident_reference: number | null;
  source: "client_error" | "health_monitor" | "manual";
  severity: "info" | "warning" | "critical";
  status: "new" | "reviewing" | "escalated" | "resolved";
  title: string;
  summary: string;
  path: string | null;
  affected_services: string[] | null;
  occurrence_count: number;
  first_seen_at: string;
  last_seen_at: string;
  suspected_cause: string | null;
  confirmed_root_cause: string | null;
  workaround: string | null;
  resolution: string | null;
  corrective_actions: string | null;
  preventative_actions: string | null;
  post_incident_review: string | null;
  resolved_by_name: string | null;
  resolution_signed_at: string | null;
};

const incidentPageSize = 5;

type IncidentsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function pageCount(totalItems: number) {
  return Math.max(1, Math.ceil(totalItems / incidentPageSize));
}

function pageNumber(value: string | string[] | undefined, totalPages: number) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(rawValue || "1", 10);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(Math.max(parsed, 1), totalPages);
}

function pageItems<T>(items: T[], page: number) {
  const start = (page - 1) * incidentPageSize;
  return items.slice(start, start + incidentPageSize);
}

export default async function TechnicalSupportIncidentsPage({ searchParams }: IncidentsPageProps) {
  const { supabase, accessRole } = await requireTechnicalSupportClient();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const [incidentResult, linkedTicketResult] = await Promise.all([
    supabase
      .from("technical_incidents")
      .select("id,incident_reference,source,severity,status,title,summary,path,affected_services,occurrence_count,first_seen_at,last_seen_at,suspected_cause,confirmed_root_cause,workaround,resolution,corrective_actions,preventative_actions,post_incident_review,resolved_by_name,resolution_signed_at")
      .order("last_seen_at", { ascending: false })
      .limit(250),
    supabase
      .from("support_tickets")
      .select("id,related_incident_id,status")
      .not("related_incident_id", "is", null)
      .limit(500)
  ]);
  const incidents = (incidentResult.data as IncidentRow[] | null) ?? [];
  const linkedTickets = (linkedTicketResult.data as Array<{ id: string; related_incident_id: string | null; status: string }> | null) ?? [];
  const active = incidents.filter((item) => item.status !== "resolved");
  const critical = active.filter((item) => item.severity === "critical");
  const repeated = active.filter((item) => item.occurrence_count > 1);
  const incidentPage = pageNumber(resolvedSearchParams.incidentsPage, pageCount(incidents.length));
  const visibleIncidents = pageItems(incidents, incidentPage);
  const ticketCounts = linkedTickets.reduce<Record<string, number>>((counts, ticket) => {
    if (!ticket.related_incident_id) return counts;
    counts[ticket.related_incident_id] = (counts[ticket.related_incident_id] ?? 0) + 1;
    return counts;
  }, {});

  return (
    <main className="min-h-screen bg-black text-white">
      <TechnicalSupportTopBar canAccessAdmin={accessRole === "admin"} />
      <TechnicalSupportPageHeader
        eyebrow="Technical support"
        title="Incident queue"
        description="Browser errors and monitoring failures are grouped by issue so repeated occurrences remain one manageable incident."
        showAdminBack={accessRole === "admin"}
      />

      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid gap-4 sm:grid-cols-3">
          <Metric icon={AlertTriangle} label="Active incidents" value={active.length} />
          <Metric icon={ShieldAlert} label="Critical" value={critical.length} />
          <Metric icon={Radio} label="Recurring" value={repeated.length} />
        </div>

        <TechnicalSupportOperatingModel className="mt-6" />
        <TechnicalSupportEscalationMatrix className="mt-6" />

        {incidentResult.error || linkedTicketResult.error ? <div className="mt-6 rounded border border-red-500/40 bg-red-500/10 p-5 text-sm font-semibold text-red-100">Incidents could not be loaded.</div> : null}
        <div className="mt-6 grid gap-4">
          {visibleIncidents.map((incident) => (
            <article key={incident.id} className={`rounded border p-5 ${incident.severity === "critical" && incident.status !== "resolved" ? "border-red-500/50 bg-red-500/10" : "border-zinc-800 bg-zinc-950"}`}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-black uppercase text-red-200">INC-{String(incident.incident_reference ?? 0).padStart(5, "0")}</div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-black">{incident.title}</h2>
                    <span className="rounded border border-zinc-700 px-2 py-1 text-[11px] font-black uppercase text-zinc-400">{incident.severity}</span>
                  </div>
                  <p className="mt-3 max-w-4xl text-sm font-semibold leading-6 text-zinc-300">{incident.summary}</p>
                </div>
                <span className="rounded-full border border-red-500/35 px-3 py-1 text-xs font-black uppercase text-red-100">{incident.status}</span>
              </div>
              <div className="mt-4 grid gap-3 border-t border-zinc-800 pt-4 sm:grid-cols-2 xl:grid-cols-5">
                <Timeline icon={Radio} label="Source" value={incident.source.replace("_", " ")} />
                <Timeline icon={TimerReset} label="First seen" value={new Date(incident.first_seen_at).toLocaleString("en-GB")} />
                <Timeline icon={TimerReset} label="Last seen" value={new Date(incident.last_seen_at).toLocaleString("en-GB")} />
                <Timeline icon={Link2} label="Affected tickets" value={`${ticketCounts[incident.id] ?? 0}`} />
                <Timeline icon={GitBranch} label="Impact" value={incident.affected_services?.length ? incident.affected_services.join(", ") : incident.path || "Not classified"} />
              </div>
              <div className="mt-4 grid gap-4 border-t border-zinc-800 pt-4 lg:grid-cols-2">
                <IncidentContext title="Suspected cause" text={incident.suspected_cause || "Under investigation."} />
                <IncidentContext title="Confirmed root cause" text={incident.confirmed_root_cause || "Not confirmed yet."} />
                <IncidentContext title="Workaround" text={incident.workaround || "No workaround recorded."} />
                <IncidentContext title="Resolution" text={incident.resolution || "Not resolved yet."} />
                <IncidentContext title="Corrective actions" text={incident.corrective_actions || "No corrective actions recorded yet."} />
                <IncidentContext title="Preventative actions" text={incident.preventative_actions || "No preventative actions recorded yet."} />
              </div>
              <details className="mt-4 rounded border border-zinc-800 bg-black">
                <summary className="cursor-pointer px-4 py-3 text-sm font-black text-zinc-200">
                  Update investigation notes
                </summary>
                <form action={saveIncidentInvestigationPlan} className="grid gap-3 border-t border-zinc-800 p-4">
                  <input type="hidden" name="id" value={incident.id} />
                  <div className="grid gap-3 lg:grid-cols-2">
                    <IncidentTextarea name="suspectedCause" label="Suspected cause" value={incident.suspected_cause} />
                    <IncidentTextarea name="confirmedRootCause" label="Confirmed root cause" value={incident.confirmed_root_cause} />
                    <IncidentTextarea name="workaround" label="Workaround" value={incident.workaround} />
                    <IncidentTextarea name="resolution" label="Resolution" value={incident.resolution} />
                    <IncidentTextarea name="correctiveActions" label="Corrective actions" value={incident.corrective_actions} />
                    <IncidentTextarea name="preventativeActions" label="Preventative actions" value={incident.preventative_actions} />
                  </div>
                  <IncidentTextarea name="postIncidentReview" label="Post-incident review" value={incident.post_incident_review} rows={4} />
                  <div className="rounded border border-zinc-800 bg-zinc-950 p-4">
                    <div className="flex items-start gap-3">
                      <ClipboardCheck className="mt-1 text-brand" size={18} />
                      <p className="text-sm font-semibold leading-6 text-zinc-400">
                        Record what happened, who was affected, what restored service, and what prevents a repeat. Do not include customer personal data in incident notes.
                      </p>
                    </div>
                  </div>
                  <button className="justify-self-start rounded border border-zinc-700 px-4 py-2 text-sm font-black text-zinc-200 hover:border-red-500">
                    Save investigation notes
                  </button>
                </form>
              </details>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 border-t border-zinc-800 pt-3 text-xs font-bold text-zinc-500">
                <span>{incident.source.replace("_", " ")}</span>
                <span>{incident.occurrence_count} occurrence{incident.occurrence_count === 1 ? "" : "s"}</span>
                <span>Last seen {new Date(incident.last_seen_at).toLocaleString("en-GB")}</span>
                {incident.resolved_by_name && incident.resolution_signed_at ? (
                  <span>Resolved by {incident.resolved_by_name} on {new Date(incident.resolution_signed_at).toLocaleString("en-GB")}</span>
                ) : null}
                {incident.path ? <span>{incident.path}</span> : null}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/technical-support/feedback" className="rounded border border-zinc-700 px-3 py-2 text-sm font-black text-zinc-200 hover:border-red-500">
                  View affected tickets
                </Link>
                {incident.status !== "reviewing" && incident.status !== "resolved" ? <IncidentButton id={incident.id} status="reviewing" label="Start review" /> : null}
                {incident.status !== "escalated" && incident.status !== "resolved" ? <IncidentButton id={incident.id} status="escalated" label="Send to admin" emphasis /> : null}
                {incident.status !== "resolved" ? <IncidentButton id={incident.id} status="resolved" label="Resolve" /> : <IncidentButton id={incident.id} status="new" label="Reopen" />}
              </div>
            </article>
          ))}
          {!incidentResult.error && incidents.length === 0 ? <div className="rounded border border-zinc-800 bg-zinc-950 p-6 text-sm font-semibold text-zinc-400">No technical incidents have been recorded.</div> : null}
        </div>
        <TechnicalSupportPageSelector
          basePath="/technical-support/incidents"
          currentPage={incidentPage}
          itemLabel="Incident"
          pageParam="incidentsPage"
          pageSize={incidentPageSize}
          searchParams={resolvedSearchParams}
          totalItems={incidents.length}
        />
      </section>
    </main>
  );
}

function Timeline({ icon: Icon, label, value }: { icon: typeof Radio; label: string; value: string }) {
  return (
    <div className="rounded border border-zinc-800 bg-black p-3">
      <Icon className="text-brand" size={17} />
      <div className="mt-2 text-xs font-black uppercase text-zinc-500">{label}</div>
      <p className="mt-1 text-sm font-semibold leading-5 text-zinc-300">{value}</p>
    </div>
  );
}

function IncidentContext({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded border border-zinc-800 bg-black p-4">
      <div className="text-xs font-black uppercase text-zinc-500">{title}</div>
      <p className="mt-2 text-sm font-semibold leading-6 text-zinc-300">{text}</p>
    </div>
  );
}

function IncidentTextarea({ name, label, value, rows = 3 }: { name: string; label: string; value: string | null; rows?: number }) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-black uppercase text-zinc-500">{label}</span>
      <textarea
        name={name}
        defaultValue={value ?? ""}
        rows={rows}
        maxLength={rows > 3 ? 2500 : 1500}
        className="resize-y rounded border border-zinc-700 bg-black px-3 py-2 text-sm font-semibold leading-6 text-white placeholder:text-zinc-600"
        placeholder={`Add ${label.toLowerCase()}`}
      />
    </label>
  );
}

function IncidentButton({ id, status, label, emphasis = false }: { id: string; status: string; label: string; emphasis?: boolean }) {
  return (
    <form action={updateIncidentStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button className={`rounded px-3 py-2 text-sm font-black ${emphasis ? "bg-red-600 text-white hover:bg-red-500" : "border border-zinc-700 text-zinc-200 hover:border-red-500"}`}>{label}</button>
    </form>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof CheckCheck; label: string; value: number }) {
  return (
    <article className="rounded border border-zinc-800 bg-zinc-950 p-5">
      <Icon className="text-brand" size={22} />
      <div className="mt-3 text-sm font-bold text-zinc-400">{label}</div>
      <div className="mt-2 text-3xl font-black">{value}</div>
    </article>
  );
}
