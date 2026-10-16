import type { AccountAccessRole } from "@/lib/chat-permissions";

export type PresentationAudience = AccountAccessRole | "guest" | "technical_support" | "system";

const internalAudiences = new Set<PresentationAudience>(["admin", "system"]);

const internalKeyPattern =
  /^(debug|diagnostic|diagnostics|toolTrace|tool_trace|requestContext|request_context|serviceStatus|service_status|platformHealth|platform_health|uptime|latency|checkedAt|checked_at|handoff|api|endpoint|webhook|stack|trace)$/i;

const internalRoutePattern =
  /(^|\/)(admin|admin-access|admin-mfa|admin-preview|owner-dashboard|technical-support|technical-support-access|technical-support-mfa|director-master-key|private-entry|api|debug|health)(\/|$)/i;

const sensitiveTextReplacements: Array<[RegExp, string]> = [
  [/\bSupabase\b/gi, "LDA secure systems"],
  [/\bVercel\b/gi, "LDA hosting"],
  [/\bOpenAI\b/gi, "LDA AI"],
  [/\bStripe(?:\s+Connect|\s+Checkout)?\b/gi, "secure payment provider"],
  [/\bRESEND_API_KEY\b/gi, "email service configuration"],
  [/\bOPENAI_API_KEY\b/gi, "AI service configuration"],
  [/\bSUPABASE_[A-Z0-9_]+\b/gi, "secure system configuration"],
  [/\bservice role\b/gi, "secure service access"],
  [/\bplatform health\b/gi, "service availability"],
  [/\buptime\b/gi, "service availability"],
  [/\b(p50|p90|p95|p99)\b/gi, "response time"],
  [/\blatency\b/gi, "response time"],
  [/\bserver response time\b/gi, "response time"],
  [/\binternal APIs?\b/gi, "LDA systems"],
  [/\bAPIs?\b/g, "systems"],
  [/\bwebhooks?\b/gi, "secure updates"],
  [/\bdatabase\b/gi, "secure records"],
  [/\bmigrations?\b/gi, "system update"],
  [/\bschema cache\b/gi, "system update"],
  [/\bRBAC\b/g, "account access controls"],
  [/\bRLS\b/g, "data access controls"],
  [/\baudit logs?\b/gi, "secure records"],
  [/\bdebug(?:ging)?\b/gi, "support"],
  [/\bdiagnostics?\b/gi, "support details"],
  [/\bmalformed JSON\b/gi, "invalid request"],
  [/\bstatus\s+(?:200|201|204|300|301|302|303|307|308|400|401|403|404|409|429|500|503)\b/gi, "request status"],
  [/\bmodel names?\b/gi, "AI details"],
  [/\btechnical support\b/gi, "LDA support"],
  [/\badmin approval\b/gi, "LDA review"],
  [/\badmin must approve\b/gi, "LDA must review"],
  [/\badmin\b/gi, "LDA"],
  [/\bsandbox\b/gi, "test environment"]
];

const leakPatterns: RegExp[] = [
  /\bSupabase\b/i,
  /\bVercel\b/i,
  /\bOpenAI\b/i,
  /\bStripe(?:\s+Connect|\s+Checkout)?\b/i,
  /\b[A-Z0-9_]*(?:SECRET|TOKEN|API_KEY|SERVICE_ROLE)[A-Z0-9_]*\b/,
  /\bplatform health\b/i,
  /\buptime\b/i,
  /\b(p50|p90|p95|p99)\b/i,
  /\blatency\b/i,
  /\binternal APIs?\b/i,
  /\bwebhooks?\b/i,
  /\bdatabase\b/i,
  /\bmigrations?\b/i,
  /\bschema cache\b/i,
  /\bRBAC\b/,
  /\bRLS\b/,
  /\baudit logs?\b/i,
  /\bdebug(?:ging)?\b/i,
  /\bdiagnostics?\b/i,
  /\bmalformed JSON\b/i,
  /\bstatus\s+(?:200|201|204|300|301|302|303|307|308|400|401|403|404|409|429|500|503)\b/i,
  /\btechnical tooling\b/i,
  /\bmodel names?\b/i,
  /\bservice status\b/i,
  /\bsandbox\b/i
];

export const friendlyPresentationError =
  "Something went wrong. Please try again. If it keeps happening, contact LDA support.";

export function isInternalPresentationAudience(audience: PresentationAudience | null | undefined) {
  return internalAudiences.has((audience ?? "guest") as PresentationAudience);
}

export function sanitizePresentationText(value: string, audience: PresentationAudience | null | undefined = "guest") {
  if (isInternalPresentationAudience(audience)) return value;

  return sensitiveTextReplacements.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    value
  );
}

export function containsInformationExposure(value: string, audience: PresentationAudience | null | undefined = "guest") {
  if (isInternalPresentationAudience(audience)) return false;
  return leakPatterns.some((pattern) => pattern.test(value));
}

export function filterPresentationActions<T extends { label: string; href: string }>(
  actions: T[],
  audience: PresentationAudience | null | undefined = "guest"
) {
  if (isInternalPresentationAudience(audience)) return actions;

  return actions
    .filter((action) => !internalRoutePattern.test(action.href))
    .map((action) => ({
      ...action,
      label: sanitizePresentationText(action.label, audience),
      href: action.href
    }));
}

export function sanitizePresentationObject<T>(value: T, audience: PresentationAudience | null | undefined = "guest"): T {
  if (isInternalPresentationAudience(audience)) return value;

  if (typeof value === "string") {
    return sanitizePresentationText(value, audience) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizePresentationObject(item, audience)) as T;
  }

  if (!value || typeof value !== "object") return value;

  const output: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (internalKeyPattern.test(key)) continue;

    if (key === "ticket" && raw && typeof raw === "object") {
      const ticket = raw as Record<string, unknown>;
      output.ticket = {
        reference: sanitizePresentationObject(ticket.reference ?? "", audience),
        status: sanitizePresentationObject(ticket.status ?? "new", audience)
      };
      continue;
    }

    output[key] = sanitizePresentationObject(raw, audience);
  }

  return output as T;
}

export function publicSafeErrorMessage(message?: string | null, audience: PresentationAudience | null | undefined = "guest") {
  if (!message) return friendlyPresentationError;
  if (containsInformationExposure(message, audience)) return friendlyPresentationError;
  const clean = sanitizePresentationText(message, audience);
  return containsInformationExposure(clean, audience) ? friendlyPresentationError : clean;
}
