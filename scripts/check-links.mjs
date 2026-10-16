#!/usr/bin/env node

const baseUrl = normaliseBaseUrl(process.env.LINK_CHECK_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:3000");
const maxPages = Math.max(1, Number(process.env.LINK_CHECK_MAX_PAGES || 120));
const timeoutMs = Math.max(1000, Number(process.env.LINK_CHECK_TIMEOUT_MS || 8000));
const linkCheckConcurrency = Math.max(1, Number(process.env.LINK_CHECK_CONCURRENCY || 12));
const verbose = process.env.LINK_CHECK_VERBOSE === "1";
const startPaths = (process.env.LINK_CHECK_START_PATHS || "/,/about,/contact,/learner-plus,/instructor-plus,/smart-match,/lesson-now,/support/learner,/privacy,/terms,/sitemap")
  .split(",")
  .map((path) => path.trim())
  .filter(Boolean);

const pending = startPaths.map((path) => new URL(path, baseUrl).toString());
const visited = new Set();
const links = new Set(pending);
const failures = [];
const authProtected = [];

while (pending.length && visited.size < maxPages) {
  const url = pending.shift();
  if (!url || visited.has(url)) continue;
  visited.add(url);
  if (verbose) console.log(`Crawling ${visited.size}/${maxPages}: ${url}`);

  const response = await fetchWithTimeout(url);
  if (!response.ok) {
    recordFailure(url, response.status, response.error);
    continue;
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) continue;

  const html = await response.text();
  for (const href of extractLinks(html)) {
    const linkedUrl = normaliseInternalUrl(href, url);
    if (!linkedUrl || links.has(linkedUrl)) continue;

    const pathname = new URL(linkedUrl).pathname;
    if (pathname.startsWith("/api/") || pathname.startsWith("/_next/")) continue;
    links.add(linkedUrl);
    pending.push(linkedUrl);
  }
}

const uncheckedLinks = [...links].filter((url) => !visited.has(url));
console.log(`Crawled ${visited.size} page(s); checking ${uncheckedLinks.length} additional internal link(s).`);

await runPool(
  uncheckedLinks,
  linkCheckConcurrency,
  async (url) => {
    const response = await fetchWithTimeout(url, { method: "HEAD", redirect: "manual" });
    const status = response.status;

    if ([401, 403].includes(status)) {
      authProtected.push({ url, status });
      return;
    }

    if (status >= 400 || status === 0) {
      recordFailure(url, status, response.error);
    }
  }
);

const summary = {
  baseUrl,
  crawledPages: visited.size,
  uniqueInternalLinks: links.size,
  authProtected: authProtected.length,
  failures: failures.length,
  firstFailures: failures.slice(0, 20)
};

console.log(JSON.stringify(summary, null, 2));

process.exit(failures.length ? 1 : 0);

function extractLinks(html) {
  const found = [];
  const pattern = /\s(?:href|src)=["']([^"']+)["']/gi;
  let match;

  while ((match = pattern.exec(html))) {
    found.push(match[1]);
  }

  return found;
}

function normaliseInternalUrl(href, currentUrl) {
  if (!href || href.startsWith("#")) return null;
  if (/^(?:mailto|tel|sms|javascript):/i.test(href)) return null;

  try {
    const url = new URL(href, currentUrl);
    if (url.origin !== baseUrl) return null;
    url.hash = "";
    url.searchParams.delete("_rsc");
    return url.toString();
  } catch {
    return null;
  }
}

async function fetchWithTimeout(url, init = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      redirect: init.redirect || "follow",
      ...init,
      headers: {
        "user-agent": "lda-link-check/1.0",
        ...(init.headers || {})
      },
      signal: controller.signal
    });

    if (init.method === "HEAD" && response.status === 405) {
      return fetchWithTimeout(url, {
        ...init,
        method: "GET",
        headers: {
          ...(init.headers || {}),
          Range: "bytes=0-0"
        }
      });
    }

    const bodyText = init.method === "HEAD" ? "" : await readBodyWithTimeout(response, controller);
    return {
      ok: response.ok,
      status: response.status,
      headers: response.headers,
      text: async () => bodyText
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      headers: new Headers(),
      error: error instanceof Error ? error.message : "request failed",
      text: async () => ""
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function readBodyWithTimeout(response, controller) {
  let bodyTimeout;
  try {
    return await Promise.race([
      response.text(),
      new Promise((_, reject) => {
        bodyTimeout = setTimeout(() => {
          controller.abort();
          reject(new Error(`response body timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      })
    ]);
  } finally {
    clearTimeout(bodyTimeout);
  }
}

function recordFailure(url, status, error) {
  failures.push({
    url,
    status,
    error: error || undefined
  });
}

async function runPool(items, concurrency, worker) {
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      await worker(items[index]);
    }
  });
  await Promise.all(workers);
}

function normaliseBaseUrl(value) {
  try {
    return new URL(value).origin;
  } catch {
    return new URL(`https://${value}`).origin;
  }
}
