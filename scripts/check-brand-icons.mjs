#!/usr/bin/env node

const baseUrl = normaliseBaseUrl(process.env.LDA_BRAND_ICON_CHECK_TARGET || process.env.LDA_RELEASE_AUDIT_TARGET || process.env.NEXT_PUBLIC_SITE_URL || "https://ldrivingacademy.co.uk");
const timeoutMs = Math.max(1000, Number(process.env.LDA_BRAND_ICON_TIMEOUT_MS || 8000));

const requiredAssets = [
  { path: "/favicon.ico", typeIncludes: "image/", minBytes: 1000 },
  { path: "/favicon-48x48.png", typeIncludes: "image/png", minBytes: 500 },
  { path: "/icon.png", typeIncludes: "image/png", minBytes: 5000 },
  { path: "/apple-icon.png", typeIncludes: "image/png", minBytes: 5000 },
  { path: "/lda-official-icon-192.png", typeIncludes: "image/png", minBytes: 5000 },
  { path: "/lda-official-icon-512.png", typeIncludes: "image/png", minBytes: 5000 },
  { path: "/site.webmanifest", typeIncludes: "manifest", minBytes: 100 }
];

const failures = [];

for (const asset of requiredAssets) {
  const url = new URL(asset.path, baseUrl).toString();
  const response = await fetchWithTimeout(url);
  const contentType = response.headers?.get("content-type") || "";
  const contentLength = Number(response.headers?.get("content-length") || 0);
  const body = response.ok && !contentLength ? await response.arrayBuffer().catch(() => null) : null;
  const byteLength = contentLength || body?.byteLength || 0;

  if (!response.ok) {
    failures.push({ url, status: response.status, error: response.error || "not ok" });
    continue;
  }

  if (!contentType.toLowerCase().includes(asset.typeIncludes)) {
    failures.push({ url, status: response.status, error: `unexpected content-type ${contentType || "missing"}` });
    continue;
  }

  if (byteLength < asset.minBytes) {
    failures.push({ url, status: response.status, error: `asset too small (${byteLength} bytes)` });
  }
}

const summary = {
  baseUrl,
  checked: requiredAssets.length,
  failures: failures.length,
  firstFailures: failures.slice(0, 20)
};

console.log(JSON.stringify(summary, null, 2));
process.exit(failures.length ? 1 : 0);

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "LDA-BrandIconAudit/1.0"
      }
    });
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : String(error),
      headers: new Headers()
    };
  } finally {
    clearTimeout(timeout);
  }
}

function normaliseBaseUrl(value) {
  try {
    return new URL(value).origin;
  } catch {
    return new URL(`https://${value}`).origin;
  }
}
