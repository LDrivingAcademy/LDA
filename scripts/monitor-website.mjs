#!/usr/bin/env node

import { appendFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const args = new Set(process.argv.slice(2));
const target = normaliseTarget(process.env.LDA_MONITOR_TARGET || "http://localhost:3000");
const intervalMs = toPositiveInt(process.env.LDA_MONITOR_INTERVAL_MS, args.has("--stress") ? 5_000 : 15_000);
const timeoutMs = toPositiveInt(process.env.LDA_MONITOR_TIMEOUT_MS, 8_000);
const concurrency = toPositiveInt(process.env.LDA_MONITOR_CONCURRENCY, args.has("--stress") ? 8 : 3);
const logFile = resolve(process.env.LDA_MONITOR_LOG_FILE || ".monitor/website-monitor.log");
const runOnce = args.has("--once");
const includeApi = !args.has("--pages-only");
const includeSecurity = !args.has("--no-security");
const stressMode = args.has("--stress");
const stopAfterMs = toPositiveInt(process.env.LDA_MONITOR_DURATION_MS, 0);
const startedAt = Date.now();

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
  "/support",
  "/support/learner",
  "/privacy",
  "/terms",
  "/cancellation-policy",
  "/accessibility",
  "/sitemap"
].map((path) => ({
  name: `GET ${path}`,
  method: "GET",
  path,
  expectedStatuses: [200, 307, 308]
}));

const apiChecks = [
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

const securityChecks = [
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
    ]
  },
  {
    name: "SECURITY admin requires private entry",
    method: "GET",
    path: "/admin",
    expectedStatuses: [307, 308],
    requiredHeaders: ["x-robots-tag"]
  },
  {
    name: "SECURITY technical support requires approved entry",
    method: "GET",
    path: "/technical-support",
    expectedStatuses: [307, 308],
    requiredHeaders: ["x-robots-tag"]
  },
  {
    name: "SECURITY technical team gateway is hidden without launcher",
    method: "GET",
    path: "/technical-support-access",
    expectedStatuses: [307, 308],
    requiredHeaders: ["x-robots-tag"]
  },
  {
    name: "SECURITY suspicious admin user-agent blocked",
    method: "GET",
    path: "/admin",
    headers: { "User-Agent": "sqlmap/1.7" },
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
    expectedStatuses: [401]
  }
];

const checks = [
  ...pageChecks,
  ...(includeApi ? apiChecks : []),
  ...(includeSecurity ? securityChecks : [])
];

await mkdir(dirname(logFile), { recursive: true });
await writeLog({
  type: "monitor_started",
  target,
  intervalMs,
  timeoutMs,
  concurrency,
  includeApi,
  includeSecurity,
  stressMode,
  checks: checks.length
});

console.log(`LDA monitor watching ${target}`);
console.log(`Checks: ${checks.length}. Interval: ${intervalMs}ms. Log: ${logFile}`);
console.log("Press Ctrl+C to stop.");

let cycle = 0;
let exitCode = 0;

do {
  cycle += 1;
  const cycleStartedAt = Date.now();
  const results = await runPool(stressMode ? multiplyChecks(checks, 3) : checks, concurrency, runCheck);
  const failures = results.filter((result) => !result.ok);
  const slow = results.filter((result) => result.ok && result.durationMs > timeoutMs * 0.75);

  await writeLog({
    type: "cycle_completed",
    cycle,
    target,
    durationMs: Date.now() - cycleStartedAt,
    total: results.length,
    failures: failures.length,
    slow: slow.length,
    failedChecks: failures
  });

  const status = failures.length ? "FAIL" : slow.length ? "SLOW" : "OK";
  console.log(
    `[${new Date().toLocaleTimeString()}] ${status} cycle=${cycle} checks=${results.length} failures=${failures.length} slow=${slow.length}`
  );

  failures.slice(0, 8).forEach((failure) => {
    console.log(`  - ${failure.name}: ${failure.message}`);
  });

  if (failures.length && runOnce) {
    exitCode = 1;
  }

  if (runOnce || (stopAfterMs > 0 && Date.now() - startedAt >= stopAfterMs)) {
    break;
  }

  await delay(Math.max(0, intervalMs - (Date.now() - cycleStartedAt)));
} while (true);

process.exitCode = exitCode;

function badJsonCheck(path) {
  return {
    name: `POST ${path} malformed JSON`,
    method: "POST",
    path,
    body: "{",
    headers: { "Content-Type": "application/json" },
    expectedStatuses: [400, 429]
  };
}

async function runCheck(check) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const url = new URL(check.path, target).toString();
  const started = Date.now();

  try {
    const response = await fetch(url, {
      method: check.method,
      headers: check.headers,
      body: check.body,
      redirect: "manual",
      signal: controller.signal
    });
    const durationMs = Date.now() - started;
    const expectedStatuses = check.expectedStatuses || [200];
    const missingHeaders = (check.requiredHeaders || []).filter((headerName) => !response.headers.get(headerName));
    const ok = expectedStatuses.includes(response.status) && missingHeaders.length === 0;
    const serverError = response.status >= 500;

    return {
      ok: ok && !serverError,
      name: check.name,
      status: response.status,
      durationMs,
      message: ok
        ? `status ${response.status} in ${durationMs}ms`
        : missingHeaders.length
          ? `status ${response.status} missing headers: ${missingHeaders.join(", ")}`
        : `expected ${expectedStatuses.join("/")} but got ${response.status} in ${durationMs}ms`
    };
  } catch (error) {
    return {
      ok: false,
      name: check.name,
      status: 0,
      durationMs: Date.now() - started,
      message: error instanceof Error ? error.message : "request failed"
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function runPool(items, poolSize, worker) {
  const results = [];
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

function multiplyChecks(items, count) {
  return Array.from({ length: count }).flatMap((_, round) =>
    items.map((item) => ({ ...item, name: `${item.name} #${round + 1}` }))
  );
}

function normaliseTarget(value) {
  try {
    return new URL(value).origin;
  } catch {
    return new URL(`https://${value}`).origin;
  }
}

function toPositiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

async function writeLog(entry) {
  await appendFile(logFile, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`, "utf8");
}
