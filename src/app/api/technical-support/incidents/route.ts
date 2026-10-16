import { createHash } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { isRateLimited, jsonNoStore, rateLimitResponse, readJsonBody, safeText } from "@/lib/security";

type IncidentRequest = {
  title?: string;
  message?: string;
  digest?: string;
  path?: string;
  source?: string;
};

export async function POST(request: Request) {
  if (isRateLimited(request, "technical-incident", 20)) {
    return rateLimitResponse();
  }

  const input = await readJsonBody<IncidentRequest>(request);
  if (!input) {
    return jsonNoStore({ error: "Invalid incident report." }, { status: 400 });
  }

  const title = safeText(input.title, "Website error", 180);
  const message = safeText(input.message, "The page could not complete normally.", 1000);
  const digest = safeText(input.digest, "", 160);
  const path = safeText(input.path, "", 300);
  const source = safeText(input.source, "client_error", 40);
  const fingerprint = createHash("sha256")
    .update(`${title}|${message}|${digest}|${path}`)
    .digest("hex");
  const adminClient = createAdminClient();

  if (!adminClient) {
    return jsonNoStore({ error: "Incident reporting is temporarily unavailable." }, { status: 503 });
  }

  const { error } = await adminClient.rpc("record_technical_incident", {
    p_fingerprint: fingerprint,
    p_source: "client_error",
    p_severity: "warning",
    p_title: title,
    p_summary: message,
    p_path: path || null,
    p_technical_context: {
      digest: digest || null,
      source,
      reportedAt: new Date().toISOString()
    }
  });

  if (error) {
    return jsonNoStore({ error: "Incident could not be recorded." }, { status: 503 });
  }

  return jsonNoStore({ ok: true });
}
