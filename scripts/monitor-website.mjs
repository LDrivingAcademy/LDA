import { pathToFileURL } from "node:url";

export const publicChecks = [
  { path: "/", marker: "Book Driving Lessons Near You | LDA" },
  { path: "/auth/login", marker: "Secure Login" },
  { path: "/robots.txt", marker: "User-Agent:" }
];

// Read-only public availability checks. Never submits forms or exercises payments.
export async function checkWebsite(origin = "https://ldrivingacademy.co.uk", checks = publicChecks) {
  const results = [];
  for (const check of checks) {
    try {
      const response = await fetch(new URL(check.path, origin), {
        signal: AbortSignal.timeout(15000),
        redirect: "follow"
      });
      const body = await response.text();
      results.push({ path: check.path, status: response.status, ok: response.ok && body.includes(check.marker) });
    } catch {
      // Do not print response bodies, credentials, query strings or provider errors.
      results.push({ path: check.path, status: null, ok: false });
    }
  }
  return results;
}

export async function runMonitor(args = process.argv.slice(2)) {
  if (args.some((arg) => arg !== "--once")) {
    console.error("Only read-only checks are supported. Use --once; load/stress tests require a separate approved plan.");
    process.exitCode = 1;
    return;
  }
  do {
    const results = await checkWebsite();
    for (const result of results) {
      console.log(`${result.ok ? "PASS" : "FAIL"} ${result.path} HTTP ${result.status ?? "unavailable"}`);
    }
    if (args.includes("--once")) {
      process.exitCode = results.every((result) => result.ok) ? 0 : 1;
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 30 * 60 * 1000));
  } while (true);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runMonitor();
}
