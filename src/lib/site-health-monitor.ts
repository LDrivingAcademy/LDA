export type SiteHealthCheck = {
  name: string;
  method: "GET" | "POST";
  path: string;
  body?: string;
  headers?: Record<string, string>;
  expectedStatuses?: number[];
  requiredHeaders?: string[];
  critical?: boolean;
};

export type SiteHealthCheckResult = {
  ok: boolean;
  slow: boolean;
  name: string;
  status: number;
  durationMs: number;
  message: string;
  attempts: number;
};

export type SiteHealthReport = {
  target: string;
  status: "ok" | "degraded" | "fail";
  checkedAt: string;
  durationMs: number;
  total: number;
  ok: number;
  failed: number;
  slow: number;
  successRate: number;
  threshold: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
  failures: SiteHealthCheckResult[];
  slowChecks: SiteHealthCheckResult[];
  results: SiteHealthCheckResult[];
  baselineLabel: string;
};

export type SiteHealthAlertDecision = {
  shouldAlert: boolean;
  severity: "none" | "warning" | "critical";
  reason: string;
  baselineSuccessRate: number;
  criticalSuccessRate: number;
  criticalFailedChecks: number;
  criticalPathFailures: string[];
};

type RunSiteHealthMonitorOptions = {
  target: string;
  timeoutMs?: number;
  concurrency?: number;
  retries?: number;
  slowMs?: number;
  threshold?: number;
  includeApi?: boolean;
  includeSecurity?: boolean;
};

type EvaluateSiteHealthAlertOptions = {
  baselineSuccessRate?: number;
  criticalSuccessRate?: number;
  criticalFailedChecks?: number;
  alertOnSlowOnly?: boolean;
};

const pageChecks = [
  "/",
  "/about",
  "/contact",
  "/learner-dashboard",
  "/instructor-dashboard",
  "/account/change-password",
  "/lesson-now",
  "/learner-plus",
  "/instructor-plus",
  "/smart-match",
  "/support/learner",
  "/privacy",
  "/terms",
  "/cancellation-policy",
  "/accessibility",
  "/sitemap"
].map((path) => ({
  name: `GET ${path}`,
  method: "GET" as const,
  path,
  expectedStatuses: [200, 307, 308],
  critical: ["/", "/learner-dashboard", "/instructor-dashboard", "/lesson-now"].includes(path)
}));

const apiChecks: SiteHealthCheck[] = [
  badJsonCheck("/api/smart-match"),
  badJsonCheck("/api/feedback"),
  badJsonCheck("/api/progress-feedback"),
  badJsonCheck("/api/support/assistant"),
  badJsonCheck("/api/dvla/verify"),
  badJsonCheck("/api/bookings/checkout"),
  badJsonCheck("/api/bookings/confirm"),
  badJsonCheck("/api/bookings/cancel"),
  badJsonCheck("/api/instant-lessons/checkout"),
  badJsonCheck("/api/instant-lessons/confirm"),
  badJsonCheck("/api/learner-packages/checkout"),
  badJsonCheck("/api/instructor-packages/checkout"),
  badJsonCheck("/api/devices/remember"),
  {
    name: "POST /api/translate invalid target",
    method: "POST",
    path: "/api/translate",
    body: JSON.stringify({ target: "not-a-language", texts: ["hello"] }),
    headers: { "Content-Type": "application/json" },
    expectedStatuses: [400, 429]
  }
];

const securityChecks: SiteHealthCheck[] = [
  {
    name: "SECURITY root response headers",
    method: "GET",
    path: "/",
    expectedStatuses: [200],
    requiredHeaders: [
      "content-security-policy",
      "strict-transport-security",
      "x-frame-options",
      "x-content-type-options",
      "referrer-policy"
    ],
    critical: true
  },
  {
    name: "SECURITY admin requires private entry",
    method: "GET",
    path: "/admin",
    expectedStatuses: [307, 308],
    requiredHeaders: ["x-robots-tag"]
  },
  {
    name: "SECURITY technical support requires private entry",
    method: "GET",
    path: "/technical-support",
    expectedStatuses: [307, 308],
    requiredHeaders: ["x-robots-tag"]
  },
  {
    name: "SECURITY suspicious admin user-agent blocked",
    method: "GET",
    path: "/admin",
    headers: { "user-agent": "sqlmap/1.7" },
    expectedStatuses: [403]
  },
  {
    name: "SECURITY env scanner path blocked",
    method: "GET",
    path: "/.env",
    expectedStatuses: [403]
  },
  {
    name: "SECURITY WordPress scanner path blocked",
    method: "GET",
    path: "/wp-login.php",
    expectedStatuses: [403]
  },
  {
    name: "SECURITY protected cron rejects missing secret",
    method: "GET",
    path: "/api/cron/site-health",
    expectedStatuses: [401],
    critical: true
  }
];

export function getSiteHealthChecks(includeApi = true, includeSecurity = true) {
  return [
    ...pageChecks,
    ...(includeApi ? apiChecks : []),
    ...(includeSecurity ? securityChecks : [])
  ];
}

export async function runSiteHealthMonitor({
  target,
  timeoutMs = 8000,
  concurrency = 4,
  retries = 1,
  slowMs = 6000,
  threshold = 98,
  includeApi = true,
  includeSecurity = true
}: RunSiteHealthMonitorOptions): Promise<SiteHealthReport> {
  const startedAt = Date.now();
  const checks = getSiteHealthChecks(includeApi, includeSecurity);
  const results = await runPool(checks, concurrency, (check) =>
    runCheck({
      check,
      target,
      timeoutMs,
      retries,
      slowMs
    })
  );
  const failedResults = results.filter((result) => !result.ok);
  const slowResults = results.filter((result) => result.ok && result.slow);
  const securityFailures = failedResults.filter((result) => result.name.startsWith("SECURITY "));
  const successRate = results.length ? ((results.length - failedResults.length) / results.length) * 100 : 0;
  const latencies = results.map((result) => result.durationMs);
  const criticalFailures = failedResults.filter((result) =>
    checks.some((check) => check.critical && check.name === result.name)
  );
  const status = securityFailures.length || criticalFailures.length
    ? "fail"
    : successRate < threshold
      ? "degraded"
      : slowResults.length
        ? "degraded"
        : "ok";

  return {
    target,
    status,
    checkedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    total: results.length,
    ok: results.length - failedResults.length,
    failed: failedResults.length,
    slow: slowResults.length,
    successRate,
    threshold,
    p50Ms: Math.round(percentile(latencies, 50)),
    p95Ms: Math.round(percentile(latencies, 95)),
    p99Ms: Math.round(percentile(latencies, 99)),
    maxMs: Math.round(Math.max(...latencies, 0)),
    failures: failedResults,
    slowChecks: slowResults,
    results,
    baselineLabel:
      successRate >= threshold && slowResults.length === 0
        ? "healthy"
        : successRate >= threshold
          ? "healthy but slower than normal"
          : "below baseline"
  };
}

export function evaluateSiteHealthAlert(
  report: SiteHealthReport,
  {
    baselineSuccessRate = 98,
    criticalSuccessRate = 95,
    criticalFailedChecks = 3,
    alertOnSlowOnly = false
  }: EvaluateSiteHealthAlertOptions = {}
): SiteHealthAlertDecision {
  const securityFailures = report.failures.filter((result) => result.name.startsWith("SECURITY "));
  const hardFailures = report.failures.filter((result) => result.status === 0 || result.status >= 500);
  const criticalPathFailures = report.failures
    .filter((result) =>
      getSiteHealthChecks().some((check) => check.critical && check.name === result.name)
    )
    .map((result) => result.name);

  if (securityFailures.length > 0) {
    return {
      shouldAlert: true,
      severity: "critical",
      reason: `${securityFailures.length} security control check${securityFailures.length === 1 ? "" : "s"} failed.`,
      baselineSuccessRate,
      criticalSuccessRate,
      criticalFailedChecks,
      criticalPathFailures
    };
  }

  if (criticalPathFailures.length > 0) {
    return {
      shouldAlert: true,
      severity: "critical",
      reason: `${criticalPathFailures.length} critical user journey check${criticalPathFailures.length === 1 ? "" : "s"} failed.`,
      baselineSuccessRate,
      criticalSuccessRate,
      criticalFailedChecks,
      criticalPathFailures
    };
  }

  if (report.successRate < criticalSuccessRate) {
    return {
      shouldAlert: true,
      severity: "critical",
      reason: `Success rate ${report.successRate.toFixed(3)}% is below the critical alert line of ${criticalSuccessRate}%.`,
      baselineSuccessRate,
      criticalSuccessRate,
      criticalFailedChecks,
      criticalPathFailures
    };
  }

  if (hardFailures.length >= criticalFailedChecks) {
    return {
      shouldAlert: true,
      severity: "critical",
      reason: `${hardFailures.length} hard failure${hardFailures.length === 1 ? "" : "s"} recorded.`,
      baselineSuccessRate,
      criticalSuccessRate,
      criticalFailedChecks,
      criticalPathFailures
    };
  }

  if (alertOnSlowOnly && report.failed === 0 && report.slow > 0) {
    return {
      shouldAlert: true,
      severity: "warning",
      reason: `${report.slow} slow check${report.slow === 1 ? "" : "s"} recorded and slow-only alerts are enabled.`,
      baselineSuccessRate,
      criticalSuccessRate,
      criticalFailedChecks,
      criticalPathFailures
    };
  }

  return {
    shouldAlert: false,
    severity: "none",
    reason:
      report.status === "ok"
        ? "Site health is within baseline."
        : `Site health is below the ${baselineSuccessRate}% baseline but above the ${criticalSuccessRate}% email concern line.`,
    baselineSuccessRate,
    criticalSuccessRate,
    criticalFailedChecks,
    criticalPathFailures
  };
}

function badJsonCheck(path: string): SiteHealthCheck {
  return {
    name: `POST ${path} malformed JSON`,
    method: "POST",
    path,
    body: "{",
    headers: { "Content-Type": "application/json" },
    expectedStatuses: [400, 429]
  };
}

async function runCheck({
  check,
  target,
  timeoutMs,
  retries,
  slowMs
}: {
  check: SiteHealthCheck;
  target: string;
  timeoutMs: number;
  retries: number;
  slowMs: number;
}): Promise<SiteHealthCheckResult> {
  let lastResult: SiteHealthCheckResult | null = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const started = Date.now();

    try {
      const response = await fetch(new URL(check.path, target).toString(), {
        method: check.method,
        headers: {
          "user-agent": "lda-site-health-bot/1.0",
          ...check.headers
        },
        body: check.body,
        redirect: "manual",
        cache: "no-store",
        signal: controller.signal
      });
      const durationMs = Date.now() - started;
      const expectedStatuses = check.expectedStatuses ?? [200];
      const expected = expectedStatuses.includes(response.status);
      const missingHeaders = (check.requiredHeaders ?? []).filter((headerName) => !response.headers.get(headerName));
      const ok = expected && response.status < 500 && missingHeaders.length === 0;
      lastResult = {
        ok,
        slow: ok && durationMs > slowMs,
        name: check.name,
        status: response.status,
        durationMs,
        attempts: attempt + 1,
        message: !expected
          ? `expected ${expectedStatuses.join("/")} but got ${response.status} in ${durationMs}ms`
          : missingHeaders.length
            ? `status ${response.status} but missing headers: ${missingHeaders.join(", ")}`
            : `status ${response.status} in ${durationMs}ms`
      };

      if (ok || response.status < 500 || attempt === retries) {
        return lastResult;
      }
    } catch (error) {
      const durationMs = Date.now() - started;
      lastResult = {
        ok: false,
        slow: false,
        name: check.name,
        status: 0,
        durationMs,
        attempts: attempt + 1,
        message: error instanceof Error ? error.message : "request failed"
      };

      if (attempt === retries) {
        return lastResult;
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  return lastResult ?? {
    ok: false,
    slow: false,
    name: check.name,
    status: 0,
    durationMs: 0,
    attempts: retries + 1,
    message: "Health check did not run."
  };
}

async function runPool<Item, Result>(items: Item[], poolSize: number, worker: (item: Item) => Promise<Result>) {
  const results: Result[] = [];
  let index = 0;

  async function runNext() {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      results[currentIndex] = await worker(items[currentIndex]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(poolSize, items.length) }, runNext));
  return results;
}

function percentile(values: number[], percent: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((first, second) => first - second);
  const index = Math.min(sorted.length - 1, Math.ceil((percent / 100) * sorted.length) - 1);
  return sorted[index];
}
