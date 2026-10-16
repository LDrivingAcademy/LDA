import { sendAdminNoticeEmail, sendSiteHealthAlertEmail } from "@/lib/email";
import { jsonNoStore } from "@/lib/security";
import { evaluateSiteHealthAlert, runSiteHealthMonitor } from "@/lib/site-health-monitor";
import { persistSiteHealthReport } from "@/lib/technical-support";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET?.trim();

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return jsonNoStore({ error: "Unauthorized" }, { status: 401 });
  }

  const target = normaliseTarget(
    process.env.LDA_MONITOR_TARGET ||
      process.env.APP_WEBSITE_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      new URL(request.url).origin
  );
  const alertEmails = getAlertEmails();
  const threshold = toPositiveNumber(process.env.LDA_HEALTH_MIN_SUCCESS_RATE, 98);
  const report = await runSiteHealthMonitor({
    target,
    threshold,
    timeoutMs: toPositiveInt(process.env.LDA_HEALTH_TIMEOUT_MS, 8000),
    concurrency: toPositiveInt(process.env.LDA_HEALTH_CONCURRENCY, 4),
    retries: toPositiveInt(process.env.LDA_HEALTH_RETRIES, 2),
    slowMs: toPositiveInt(process.env.LDA_HEALTH_SLOW_MS, 6000),
    includeApi: process.env.LDA_HEALTH_INCLUDE_API !== "false",
    includeSecurity: process.env.LDA_HEALTH_INCLUDE_SECURITY !== "false"
  });

  let finalReport = report;
  let alertDecision = evaluateSiteHealthAlert(report, {
    baselineSuccessRate: threshold,
    criticalSuccessRate: toPositiveNumber(process.env.LDA_HEALTH_CRITICAL_SUCCESS_RATE, 95),
    criticalFailedChecks: toPositiveInt(process.env.LDA_HEALTH_CRITICAL_FAILED_CHECKS, 3),
    alertOnSlowOnly: process.env.LDA_HEALTH_ALERT_ON_SLOW === "true"
  });
  let confirmationReport: typeof report | null = null;
  let confirmationDecision: typeof alertDecision | null = null;
  const confirmBeforeAlert = process.env.LDA_HEALTH_CONFIRM_BEFORE_ALERT !== "false";

  if (alertDecision.shouldAlert && confirmBeforeAlert) {
    const confirmationDelayMs = Math.min(toPositiveInt(process.env.LDA_HEALTH_CONFIRM_DELAY_MS, 1500), 10000);
    await delay(confirmationDelayMs);
    confirmationReport = await runSiteHealthMonitor({
      target,
      threshold,
      timeoutMs: toPositiveInt(process.env.LDA_HEALTH_TIMEOUT_MS, 8000),
      concurrency: Math.max(1, Math.min(toPositiveInt(process.env.LDA_HEALTH_CONCURRENCY, 4), 3)),
      retries: Math.max(toPositiveInt(process.env.LDA_HEALTH_RETRIES, 2), 2),
      slowMs: toPositiveInt(process.env.LDA_HEALTH_SLOW_MS, 6000),
      includeApi: process.env.LDA_HEALTH_INCLUDE_API !== "false",
      includeSecurity: process.env.LDA_HEALTH_INCLUDE_SECURITY !== "false"
    });
    confirmationDecision = evaluateSiteHealthAlert(confirmationReport, {
      baselineSuccessRate: threshold,
      criticalSuccessRate: toPositiveNumber(process.env.LDA_HEALTH_CRITICAL_SUCCESS_RATE, 95),
      criticalFailedChecks: toPositiveInt(process.env.LDA_HEALTH_CRITICAL_FAILED_CHECKS, 3),
      alertOnSlowOnly: process.env.LDA_HEALTH_ALERT_ON_SLOW === "true"
    });

    if (confirmationDecision.shouldAlert) {
      finalReport = confirmationReport;
      alertDecision = {
        ...confirmationDecision,
        reason: `Persistent after confirmation check: ${confirmationDecision.reason}`
      };
    } else {
      alertDecision = {
        ...confirmationDecision,
        shouldAlert: false,
        severity: "none",
        reason: `Initial health dip recovered on confirmation check. Initial reason: ${alertDecision.reason}`
      };
    }
  }

  const shouldAlert = alertDecision.shouldAlert;
  const alertResults = [];

  try {
    await persistSiteHealthReport(finalReport, alertDecision);
  } catch (error) {
    console.error("[site-health] report persistence failed", error);
  }

  if (shouldAlert) {
    for (const to of alertEmails) {
      try {
        alertResults.push({
          to,
          result: await sendSiteHealthAlertEmail({
            to,
            status: alertDecision.severity === "critical" ? "fail" : "degraded",
            target: finalReport.target,
            checkedAt: finalReport.checkedAt,
            successRate: finalReport.successRate,
            threshold: finalReport.threshold,
            total: finalReport.total,
            ok: finalReport.ok,
            failed: finalReport.failed,
            slow: finalReport.slow,
            p50Ms: finalReport.p50Ms,
            p95Ms: finalReport.p95Ms,
            p99Ms: finalReport.p99Ms,
            maxMs: finalReport.maxMs,
            failures: finalReport.failures,
            slowChecks: finalReport.slowChecks,
            reason: alertDecision.reason,
            idempotencyKey: healthAlertIdempotencyKey(finalReport)
          })
        });
      } catch (error) {
        alertResults.push({
          to,
          error: error instanceof Error ? error.message : "Alert email failed."
        });
      }
    }
  }

  const tokenCredentialReminder = await sendTokenCredentialReminderIfDue(
    alertEmails,
    new URL(request.url).searchParams.get("token-reminder-test") === "1"
  );

  return jsonNoStore({
    ok: finalReport.status === "ok" || (!shouldAlert && Boolean(confirmationReport)),
    alerted: shouldAlert,
    alertDecision,
    alertRecipients: alertEmails.length,
    alertResults,
    tokenCredentialReminder,
    confirmation: confirmationReport
      ? {
          recovered: !shouldAlert,
          report: summariseReport(confirmationReport),
          alertDecision: confirmationDecision
        }
      : null,
    report: {
      ...summariseReport(finalReport),
      initial: finalReport === report ? undefined : summariseReport(report)
    }
  }, { status: shouldAlert && alertDecision.severity === "critical" ? 503 : 200 });
}

async function sendTokenCredentialReminderIfDue(alertEmails: string[], manualTest = false) {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const day = now.getUTCDate();

  if (year < 2027) {
    return { due: false, results: [] };
  }

  const reminder = manualTest
    ? {
        key: `test-${now.toISOString().slice(0, 10)}`,
        subject: "Test: LDA Vercel authentication email alert",
        title: "Your cloud credential email alerts are active",
        body: "This is a one-time test confirming that L Driving Academy will receive email warnings when the Vercel cloud redeploy token approaches its annual renewal date. GitHub also raises an assigned alert if a monthly redeploy fails because authentication or attention is required. No action is required for this test."
      }
    : month === 8 && day === 1
      ? {
          key: `${year}-08-01`,
          subject: "Action required: renew the LDA Vercel token",
          title: "Vercel authentication renewal is due",
          body: "The credential used by the cloud-based Monthly LDA Production Redeploy Keepalive is approaching its annual expiry. Sign in to the L Driving Academy Vercel account, create a replacement token scoped to the lda project, replace the encrypted VERCEL_TOKEN secret in GitHub, test the workflow, and revoke the old token only after the test succeeds."
        }
      : month === 9 && day === 1
        ? {
            key: `${year}-09-01`,
            subject: "Urgent: LDA Vercel token expires this month",
            title: "Vercel re-authentication is required",
            body: "The annual Vercel credential renewal has reached its final reminder window. Re-authenticate the L Driving Academy Vercel login and rotate the GitHub VERCEL_TOKEN secret now so the monthly cloud redeploy continues without interruption."
          }
        : month === 9 && day === 7
          ? {
              key: `${year}-09-07`,
              subject: "LDA Vercel token expiry alert",
              title: "The cloud redeploy token must be replaced",
              body: "The Vercel credential is at its scheduled annual expiry date. Re-authenticate the L Driving Academy Vercel account, replace the encrypted GitHub VERCEL_TOKEN secret, and run the cloud redeploy workflow immediately."
            }
          : null;

  if (!reminder) {
    return { due: false, results: [] };
  }

  const results = [];
  for (const to of alertEmails) {
    try {
      results.push({
        to,
        result: await sendAdminNoticeEmail({
          to,
          subject: reminder.subject,
          title: reminder.title,
          body: reminder.body,
          idempotencyKey: `lda-vercel-token-renewal:${reminder.key}:${to}`.slice(0, 180)
        })
      });
    } catch (error) {
      results.push({
        to,
        error: error instanceof Error ? error.message : "Token-renewal email failed."
      });
    }
  }

  return { due: true, key: reminder.key, results };
}

function getAlertEmails() {
  const configured =
    process.env.LDA_HEALTH_ALERT_EMAILS ||
    process.env.ADMIN_ALERT_EMAILS ||
    process.env.APP_SUPPORT_EMAIL ||
    "info@ldrivingacademy.co.uk";

  return configured
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
}

function healthAlertIdempotencyKey(report: {
  checkedAt: string;
  status: string;
  target: string;
  failures: Array<{ name: string }>;
  slowChecks: Array<{ name: string }>;
}) {
  const bucket = report.checkedAt.slice(0, 13);
  const firstIssue = report.failures[0]?.name || report.slowChecks[0]?.name || "unknown";
  return `lda-site-health:${bucket}:${report.status}:${report.target}:${firstIssue}`.slice(0, 180);
}

function normaliseTarget(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return new URL(`https://${value}`).origin;
  }
}

function toPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function toPositiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function summariseReport(report: Awaited<ReturnType<typeof runSiteHealthMonitor>>) {
  return {
    ...report,
    successRate: Number(report.successRate.toFixed(3)),
    baselineLabel: report.baselineLabel,
    failures: report.failures.slice(0, 10),
    slowChecks: report.slowChecks.slice(0, 10),
    results: report.results.slice(0, 30)
  };
}
