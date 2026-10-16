import { createAdminClient } from "@/lib/supabase/admin";
import { readConsentFromCookieHeader } from "@/lib/cookie-consent";
import { getClientIp, isRateLimited, jsonNoStore, rateLimitResponse, readJsonBody, safeText } from "@/lib/security";
import { createHmac } from "node:crypto";

type AnalyticsPayload = {
  eventType?: string;
  visitorId?: string;
  sessionId?: string;
  path?: string;
  section?: string;
  title?: string;
  referrer?: string;
  targetLabel?: string;
  targetType?: string;
  targetHref?: string;
  durationMs?: number;
  viewportWidth?: number;
  viewportHeight?: number;
};

const allowedEventTypes = new Set(["pageview", "click", "engagement"]);
const privatePathPrefixes = [
  "/admin",
  "/admin-access",
  "/admin-mfa",
  "/admin-preview",
  "/owner-dashboard",
  "/director-master-key-lda-admin-9f4e7c2b6a",
  "/technical-support",
  "/technical-support-access",
  "/technical-support-mfa",
  "/technical-support-private-entry-cf6d99a438285f152bf5d2425b0b5a50"
];

function safeId(value: unknown) {
  const id = safeText(value, "", 80);
  return /^[a-zA-Z0-9._:-]+$/.test(id) ? id : "";
}

function safePath(value: unknown) {
  const path = safeText(value, "/", 240);
  return path.startsWith("/") && !path.startsWith("//") ? path : "/";
}

function safeNumber(value: unknown, min: number, max: number) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    return null;
  }

  return Math.round(number);
}

function isPrivatePath(path: string) {
  return privatePathPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function analyticsHashSecret() {
  return (
    process.env.ANALYTICS_IP_HASH_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXTAUTH_SECRET ||
    process.env.VERCEL_PROJECT_ID ||
    "lda-analytics-local-development"
  );
}

function hashVisitorIp(ip: string) {
  const normalisedIp = ip.trim().toLowerCase();
  if (!normalisedIp || normalisedIp === "unknown") {
    return null;
  }

  return createHmac("sha256", analyticsHashSecret()).update(normalisedIp).digest("hex");
}

async function recordIpVisitor(adminClient: NonNullable<ReturnType<typeof createAdminClient>>, visitorIpHash: string, path: string, sessionId: string, userAgent: string | null) {
  const { error } = await adminClient.rpc("record_site_analytics_visitor", {
    p_visitor_ip_hash: visitorIpHash,
    p_path: path,
    p_session_id: sessionId,
    p_user_agent: userAgent,
    p_seen_at: new Date().toISOString()
  });

  if (error) {
    console.error(JSON.stringify({
      level: "error",
      msg: "analytics visitor upsert failed",
      route: "/api/analytics/track",
      error: error.message
    }));
  }
}

export async function POST(request: Request) {
  if (isRateLimited(request, "analytics-track", 240)) {
    return rateLimitResponse();
  }

  const body = await readJsonBody<AnalyticsPayload>(request);
  const consent = readConsentFromCookieHeader(request.headers.get("cookie"));

  if (!body || !consent?.analytics) {
    return jsonNoStore({ ok: false }, { status: 400 });
  }

  const eventType = safeText(body.eventType, "", 24);
  const visitorId = safeId(body.visitorId);
  const sessionId = safeId(body.sessionId);
  const path = safePath(body.path);

  if (!allowedEventTypes.has(eventType) || !visitorId || !sessionId || isPrivatePath(path)) {
    return jsonNoStore({ ok: false }, { status: 200 });
  }

  const adminClient = createAdminClient();
  if (!adminClient) {
    console.warn(JSON.stringify({ level: "warn", msg: "analytics skipped, service role missing", route: "/api/analytics/track" }));
    return jsonNoStore({ ok: false }, { status: 202 });
  }

  const clientIp = getClientIp(request);
  const visitorIpHash = hashVisitorIp(clientIp);
  const userAgent = safeText(request.headers.get("user-agent"), "", 240) || null;

  if (visitorIpHash && eventType === "pageview") {
    await recordIpVisitor(adminClient, visitorIpHash, path, sessionId, userAgent);
  }

  const row = {
    event_type: eventType,
    visitor_id: visitorId,
    session_id: sessionId,
    visitor_ip_hash: visitorIpHash,
    path,
    section: safeText(body.section, "", 80) || null,
    title: safeText(body.title, "", 180) || null,
    referrer: safeText(body.referrer, "", 240) || null,
    target_label: safeText(body.targetLabel, "", 160) || null,
    target_type: safeText(body.targetType, "", 40) || null,
    target_href: safeText(body.targetHref, "", 240) || null,
    duration_ms: safeNumber(body.durationMs, 0, 24 * 60 * 60 * 1000),
    viewport_width: safeNumber(body.viewportWidth, 0, 10000),
    viewport_height: safeNumber(body.viewportHeight, 0, 10000),
    user_agent: userAgent
  };

  const { error } = await adminClient.from("site_analytics_events").insert(row);

  if (error) {
    const missingIpColumn = error.code === "42703" || error.message.toLowerCase().includes("visitor_ip_hash");

    if (missingIpColumn) {
      const { visitor_ip_hash: _visitorIpHash, ...legacyRow } = row;
      const { error: legacyError } = await adminClient.from("site_analytics_events").insert(legacyRow);

      if (!legacyError) {
        return jsonNoStore({ ok: true, mode: "legacy" });
      }
    }

    console.error(JSON.stringify({
      level: "error",
      msg: "analytics insert failed",
      route: "/api/analytics/track",
      error: error.message,
      hasVisitorIpHash: Boolean(visitorIpHash)
    }));
    return jsonNoStore({ ok: false }, { status: 202 });
  }

  return jsonNoStore({ ok: true });
}
