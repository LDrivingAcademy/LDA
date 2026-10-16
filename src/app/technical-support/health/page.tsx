import { Activity, AlertTriangle, CheckCircle2, Clock3, Send, ShieldCheck } from "lucide-react";
import { TechnicalSupportEscalationMatrix } from "@/components/technical-support-escalation-matrix";
import { TechnicalSupportPageHeader } from "@/components/technical-support-page-header";
import { TechnicalSupportTopBar } from "@/components/technical-support-top-bar";
import { requireTechnicalSupportClient } from "@/lib/technical-support-access";
import { escalateHealthReport, runLiveHealthCheck } from "../actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { robots: { index: false, follow: false, nocache: true } };

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
  results: CheckResult[];
  alert_reason: string | null;
  escalated_at: string | null;
};

export default async function TechnicalSupportHealthPage() {
  const { supabase, accessRole } = await requireTechnicalSupportClient();
  const { data, error } = await supabase
    .from("site_health_reports")
    .select("id,target,status,checked_at,success_rate,total_checks,passed_checks,failed_checks,slow_checks_count,p50_ms,p95_ms,p99_ms,max_ms,results,alert_reason,escalated_at")
    .order("checked_at", { ascending: false })
    .limit(20);
  const reports = (data as HealthRow[] | null) ?? [];
  const latest = reports[0];

  return (
    <main className="min-h-screen bg-black text-white">
      <TechnicalSupportTopBar canAccessAdmin={accessRole === "admin"} />
      <TechnicalSupportPageHeader
        eyebrow="Technical support"
        title="Website health"
        description="Live checks cover public pages, dashboards, APIs, security headers, protected admin access, and common scanner paths."
        showAdminBack={accessRole === "admin"}
        right={(
          <form action={runLiveHealthCheck}>
            <button className="rounded bg-red-600 px-4 py-3 text-sm font-black text-white hover:bg-red-500">Run live check</button>
          </form>
        )}
      />

      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid gap-4 sm:grid-cols-4">
          <Metric icon={Activity} label="Success rate" value={latest ? `${Number(latest.success_rate).toFixed(1)}%` : "-"} />
          <Metric icon={ShieldCheck} label="Passed checks" value={latest ? `${latest.passed_checks}/${latest.total_checks}` : "-"} />
          <Metric icon={Clock3} label="p95 response" value={latest ? `${latest.p95_ms}ms` : "-"} />
          <Metric icon={Clock3} label="Slow checks" value={latest?.slow_checks_count ?? "-"} />
        </div>
        {error ? <div className="mt-6 rounded border border-red-500/40 bg-red-500/10 p-5 text-sm font-semibold text-red-100">Health history could not be loaded.</div> : null}
        <section className="mt-6 grid gap-4 lg:grid-cols-3">
          <HealthRunbook
            icon={Activity}
            title="Normal checks"
            body="If all checks pass, keep monitoring new support tickets, repeat customer reports, and any slow response trend before the next shift handover."
          />
          <HealthRunbook
            icon={AlertTriangle}
            title="Degraded service"
            body="If checks slow down or partially fail, rerun the live check, compare affected routes, link related tickets, and record the current customer impact."
          />
          <HealthRunbook
            icon={CheckCircle2}
            title="Escalation threshold"
            body="Send to admin when a service is repeatedly failing, payment/auth/booking routes are affected, or a code, database, or supplier action is required."
          />
        </section>
        <TechnicalSupportEscalationMatrix className="mt-6" />
        <div className="mt-6 grid gap-6">
          {reports.map((report, index) => (
            <article key={report.id} className="rounded border border-zinc-800 bg-zinc-950 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-black">{index === 0 ? "Latest health report" : "Previous health report"}</h2>
                    <span className={`rounded border px-2 py-1 text-xs font-black uppercase ${report.status === "ok" ? "border-emerald-500/40 text-emerald-300" : "border-red-500/40 text-red-200"}`}>{report.status}</span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-zinc-400">{new Date(report.checked_at).toLocaleString("en-GB")} · {Number(report.success_rate).toFixed(1)}% successful · p95 {report.p95_ms}ms</p>
                  {report.alert_reason ? <p className="mt-2 text-sm font-semibold leading-6 text-zinc-300">{report.alert_reason}</p> : null}
                </div>
                {report.status !== "ok" && !report.escalated_at ? (
                  <form action={escalateHealthReport}>
                    <input type="hidden" name="id" value={report.id} />
                    <button className="inline-flex items-center gap-2 rounded bg-red-600 px-3 py-2 text-sm font-black text-white hover:bg-red-500"><Send size={16} /> Send to admin</button>
                  </form>
                ) : report.escalated_at ? <span className="text-sm font-black text-red-100">Sent to admin</span> : null}
              </div>
              {index === 0 ? (
                <div className="mt-5 overflow-x-auto rounded border border-zinc-800">
                  <div className="min-w-[680px]">
                    <div className="grid grid-cols-[minmax(240px,1fr)_100px_100px_minmax(220px,1fr)] bg-black px-4 py-3 text-xs font-black uppercase text-zinc-500">
                      <div>Check</div><div>Status</div><div>Time</div><div>Result</div>
                    </div>
                    {report.results.map((result) => (
                      <div key={result.name} className="grid grid-cols-[minmax(240px,1fr)_100px_100px_minmax(220px,1fr)] border-t border-zinc-800 px-4 py-3 text-sm">
                        <div className="font-black">{result.name}</div>
                        <div className={result.ok ? "text-emerald-300" : "text-red-200"}>{result.ok ? "Pass" : "Fail"}</div>
                        <div>{result.durationMs}ms</div>
                        <div className="text-zinc-400">{result.message}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </article>
          ))}
          {!error && reports.length === 0 ? <div className="rounded border border-zinc-800 bg-zinc-950 p-6 text-sm font-semibold text-zinc-400">No health report exists yet. Run the first live check.</div> : null}
        </div>
      </section>
    </main>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Activity; label: string; value: string | number }) {
  return (
    <article className="rounded border border-zinc-800 bg-zinc-950 p-5">
      <Icon className="text-brand" size={22} />
      <div className="mt-3 text-sm font-bold text-zinc-400">{label}</div>
      <div className="mt-2 text-3xl font-black">{value}</div>
    </article>
  );
}

function HealthRunbook({ icon: Icon, title, body }: { icon: typeof Activity; title: string; body: string }) {
  return (
    <article className="rounded border border-zinc-800 bg-zinc-950 p-5">
      <Icon className="text-brand" size={22} />
      <div className="mt-3 text-sm font-black">{title}</div>
      <p className="mt-2 text-xs font-semibold leading-5 text-zinc-500">{body}</p>
    </article>
  );
}
