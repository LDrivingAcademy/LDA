import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { recordAuthAudit } from "@/lib/auth-sessions";
import { applyAdminSecurityHeaders } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function internalAuditSecret() {
  return (
    process.env.LDA_INTERNAL_AUDIT_SECRET?.trim() ||
    process.env.LDA_ADMIN_ENTRY_SECRET?.trim() ||
    null
  );
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function validInternalSecret(request: Request) {
  const expected = internalAuditSecret();
  const provided = request.headers.get("x-lda-internal-audit") ?? "";
  return Boolean(expected && provided && safeEqual(provided, expected));
}

function safePath(value: unknown) {
  const path = typeof value === "string" ? value : "";
  if (!path.startsWith("/") || path.includes("?") || path.includes("#")) {
    return "/";
  }

  if (/^\/director-master-key-[^/]*(?:\/|$)/i.test(path)) {
    return "/privileged-launcher/admin";
  }

  if (/^\/technical-support-private-entry-[^/]*(?:\/|$)/i.test(path)) {
    return "/privileged-launcher/support";
  }

  return path.slice(0, 160);
}

function safeAction(value: unknown) {
  const action = typeof value === "string" ? value : "";
  return /^auth\.privileged_[a-z_.]+$/.test(action) ? action.slice(0, 96) : "auth.privileged_route.blocked";
}

export async function POST(request: Request) {
  if (!validInternalSecret(request)) {
    return applyAdminSecurityHeaders(new NextResponse(null, { status: 404 }));
  }

  let body: {
    action?: unknown;
    path?: unknown;
    method?: unknown;
    metadata?: unknown;
  } = {};

  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const metadata = typeof body.metadata === "object" && body.metadata !== null ? body.metadata : {};

  await recordAuthAudit({
    adminClient: createAdminClient(),
    action: safeAction(body.action),
    targetType: "privileged_route",
    targetId: safePath(body.path),
    headers: request.headers,
    metadata: {
      method: typeof body.method === "string" ? body.method.slice(0, 12) : "GET",
      ...metadata
    }
  });

  return applyAdminSecurityHeaders(new NextResponse(null, { status: 204 }));
}
