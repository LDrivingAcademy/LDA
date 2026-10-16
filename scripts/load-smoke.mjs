const baseUrl = process.env.LOAD_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:3000";
const concurrency = Math.max(1, Number(process.env.CONCURRENCY || 50));
const requests = Math.max(concurrency, Number(process.env.REQUESTS || 500));
const timeoutMs = Math.max(1000, Number(process.env.TIMEOUT_MS || 8000));
const retries = Math.max(0, Number(process.env.RETRIES || 2));
const retryDelayMs = Math.max(0, Number(process.env.RETRY_DELAY_MS || 150));
const slowResponseMs = Math.max(1, Number(process.env.SLOW_RESPONSE_MS || 300));
const enforceServerTargets = parseBoolean(process.env.ENFORCE_SERVER_TARGETS || process.env.LDA_ENFORCE_SERVER_TARGETS);
const serverTargets = {
  p50: Math.max(1, Number(process.env.SERVER_P50_MS || 100)),
  p90: Math.max(1, Number(process.env.SERVER_P90_MS || 200)),
  p95: Math.max(1, Number(process.env.SERVER_P95_MS || 300)),
  p99: Math.max(1, Number(process.env.SERVER_P99_MS || 500))
};

const paths = (process.env.PATHS || "/,/about,/learner-plus,/instructor-plus,/smart-match,/lesson-now")
  .split(",")
  .map((path) => path.trim())
  .filter(Boolean);

const results = [];
let nextIndex = 0;

function percentile(values, percent) {
  if (!values.length) return 0;
  const sorted = [...values].sort((first, second) => first - second);
  const index = Math.min(sorted.length - 1, Math.ceil((percent / 100) * sorted.length) - 1);
  return sorted[index];
}

function summarise(values) {
  if (!values.length) {
    return {
      min: 0,
      avg: 0,
      p50: 0,
      p90: 0,
      p95: 0,
      p99: 0,
      max: 0
    };
  }

  return {
    min: Math.round(Math.min(...values)),
    avg: Math.round(values.reduce((total, value) => total + value, 0) / values.length),
    p50: Math.round(percentile(values, 50)),
    p90: Math.round(percentile(values, 90)),
    p95: Math.round(percentile(values, 95)),
    p99: Math.round(percentile(values, 99)),
    max: Math.round(Math.max(...values))
  };
}

function parseBoolean(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").toLowerCase());
}

async function requestOnce(index) {
  const path = paths[index % paths.length];
  const url = new URL(path, baseUrl);
  const attempts = [];

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const attemptStart = performance.now();

    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": "lda-load-smoke/1.0"
        },
        signal: controller.signal
      });
      const serverMs = performance.now() - attemptStart;

      await response.arrayBuffer();
      const attemptResult = {
        status: response.status,
        ok: response.ok,
        serverMs,
        ms: performance.now() - attemptStart
      };
      attempts.push(attemptResult);

      if (response.ok || attempt === retries || response.status < 500) {
        results.push({
          path,
          ...attemptResult,
          attempts: attempt + 1,
          recovered: attempt > 0 && response.ok,
          firstError: attempts[0]?.error,
          firstStatus: attempts[0]?.status
        });
        return;
      }
    } catch (error) {
      const attemptResult = {
        status: 0,
        ok: false,
        serverMs: performance.now() - attemptStart,
        ms: performance.now() - attemptStart,
        error: error instanceof Error ? error.name : "UnknownError"
      };
      attempts.push(attemptResult);

      if (attempt === retries) {
        results.push({
          path,
          ...attemptResult,
          attempts: attempt + 1,
          firstError: attempts[0]?.error,
          firstStatus: attempts[0]?.status
        });
        return;
      }
    } finally {
      clearTimeout(timeout);
    }

    if (retryDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs * (attempt + 1)));
    }
  }
}

async function worker() {
  while (nextIndex < requests) {
    const index = nextIndex;
    nextIndex += 1;
    await requestOnce(index);
  }
}

const startedAt = performance.now();
await Promise.all(Array.from({ length: concurrency }, () => worker()));
const totalMs = performance.now() - startedAt;
const successfulResults = results.filter((result) => result.ok);
const fullBodyLatencies = successfulResults.map((result) => result.ms);
const serverLatencies = successfulResults.map((result) => result.serverMs);
const failures = results.filter((result) => !result.ok);
const recovered = results.filter((result) => result.recovered);
const byStatus = results.reduce((summary, result) => {
  const key = String(result.status);
  summary[key] = (summary[key] || 0) + 1;
  return summary;
}, {});
const serverLatencyMs = summarise(serverLatencies);
const fullBodyLatencyMs = summarise(fullBodyLatencies);
const targetFailures = Object.entries(serverTargets)
  .filter(([metric, target]) => serverLatencyMs[metric] > target)
  .map(([metric, target]) => ({
    metric,
    target,
    actual: serverLatencyMs[metric]
  }));
const byPath = paths.reduce((summary, path) => {
  const pathResults = results.filter((result) => result.path === path);
  const pathSuccesses = pathResults.filter((result) => result.ok);

  summary[path] = {
    requests: pathResults.length,
    ok: pathSuccesses.length,
    failed: pathResults.length - pathSuccesses.length,
    serverLatencyMs: summarise(pathSuccesses.map((result) => result.serverMs)),
    fullBodyLatencyMs: summarise(pathSuccesses.map((result) => result.ms))
  };

  return summary;
}, {});
const slowServerResponses = successfulResults
  .filter((result) => result.serverMs > slowResponseMs)
  .sort((first, second) => second.serverMs - first.serverMs)
  .slice(0, 10)
  .map((result) => ({
    path: result.path,
    status: result.status,
    serverMs: Math.round(result.serverMs),
    fullBodyMs: Math.round(result.ms)
  }));

console.log(JSON.stringify({
  baseUrl,
  paths,
  requests,
  concurrency,
  retries,
  retryDelayMs,
  totalMs: Math.round(totalMs),
  requestsPerSecond: Number((results.length / (totalMs / 1000)).toFixed(2)),
  ok: results.length - failures.length,
  failed: failures.length,
  recovered: recovered.length,
  successRate: `${(((results.length - failures.length) / results.length) * 100).toFixed(3)}%`,
  byStatus,
  performanceTargets: {
    serverResponseMs: serverTargets,
    slowResponseMs,
    enforced: enforceServerTargets
  },
  serverLatencyMs,
  latencyMs: fullBodyLatencyMs,
  fullBodyLatencyMs,
  byPath,
  slowServerResponses,
  targetFailures,
  firstFailures: failures.slice(0, 10)
}, null, 2));

if (failures.length || (enforceServerTargets && targetFailures.length)) {
  process.exitCode = 1;
}
