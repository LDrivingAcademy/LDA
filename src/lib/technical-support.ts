import { createHash } from "crypto";
import { evaluateSiteHealthAlert, runSiteHealthMonitor, type SiteHealthAlertDecision, type SiteHealthReport } from "@/lib/site-health-monitor";
import { createAdminClient } from "@/lib/supabase/admin";

function normaliseTarget(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return new URL(`https://${value}`).origin;
  }
}

export async function persistSiteHealthReport(report: SiteHealthReport, decision: SiteHealthAlertDecision) {
  const adminClient = createAdminClient();
  if (!adminClient) {
    throw new Error("Supabase service access is not configured.");
  }

  const { error } = await adminClient.from("site_health_reports").upsert({
    target: report.target,
    status: report.status,
    checked_at: report.checkedAt,
    duration_ms: report.durationMs,
    total_checks: report.total,
    passed_checks: report.ok,
    failed_checks: report.failed,
    slow_checks_count: report.slow,
    success_rate: Number(report.successRate.toFixed(3)),
    threshold: report.threshold,
    p50_ms: report.p50Ms,
    p95_ms: report.p95Ms,
    p99_ms: report.p99Ms,
    max_ms: report.maxMs,
    failures: report.failures,
    slow_checks: report.slowChecks,
    results: report.results,
    alert_severity: decision.severity,
    alert_reason: decision.reason
  }, { onConflict: "checked_at,target" });

  if (error) {
    throw new Error(error.message);
  }

  for (const failure of report.failures) {
    const fingerprint = createHash("sha256").update(`health:${failure.name}`).digest("hex");
    await adminClient.rpc("record_technical_incident", {
      p_fingerprint: fingerprint,
      p_source: "health_monitor",
      p_severity: failure.name.startsWith("SECURITY ") || failure.status >= 500 || failure.status === 0 ? "critical" : "warning",
      p_title: failure.name,
      p_summary: failure.message,
      p_path: null,
      p_technical_context: {
        status: failure.status,
        durationMs: failure.durationMs,
        attempts: failure.attempts,
        checkedAt: report.checkedAt
      }
    });
  }
}

export async function runLiveTechnicalHealthCheck(origin?: string) {
  const target = normaliseTarget(
    process.env.LDA_MONITOR_TARGET ||
      process.env.APP_WEBSITE_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      origin ||
      "https://ldrivingacademy.co.uk"
  );
  const threshold = Number(process.env.LDA_HEALTH_MIN_SUCCESS_RATE || 98);
  const report = await runSiteHealthMonitor({
    target,
    threshold,
    timeoutMs: 8000,
    concurrency: 6,
    retries: 1,
    slowMs: 6000,
    includeApi: true,
    includeSecurity: true
  });
  const decision = evaluateSiteHealthAlert(report, {
    baselineSuccessRate: threshold,
    criticalSuccessRate: Number(process.env.LDA_HEALTH_CRITICAL_SUCCESS_RATE || 95),
    criticalFailedChecks: Number(process.env.LDA_HEALTH_CRITICAL_FAILED_CHECKS || 3),
    alertOnSlowOnly: process.env.LDA_HEALTH_ALERT_ON_SLOW === "true"
  });

  await persistSiteHealthReport(report, decision);
  return { report, decision };
}
