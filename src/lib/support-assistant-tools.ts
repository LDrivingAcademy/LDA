import { createHash, randomUUID } from "crypto";
import {
  getNavigationIndexForRole,
  hrefAllowedForAccount,
  suggestNavigationRoutes,
  type AccountAccessRole,
  type ChatNavigationRoute,
  type SafeChatLink
} from "@/lib/chat-permissions";
import supportKnowledge from "@/lib/lda-support-knowledge.json";
import type { SupportCategory, SupportPriority } from "@/lib/support-guidance";

type SupabaseAdminClient = {
  from: (table: string) => any;
};

export type SupportKnowledgeArticle = {
  id?: string;
  slug: string;
  title: string;
  summary: string;
  body: string;
  category: string;
  audience?: AccountAccessRole[];
  routeHref?: string | null;
  actionLabel?: string | null;
};

export type SupportServiceStatus = {
  available: boolean;
  status: "ok" | "degraded" | "fail" | "unknown";
  summary: string;
  checkedAt?: string | null;
  p95Ms?: number | null;
};

export type SupportAssistantSession = {
  id: string | null;
  publicId: string;
  summary: string;
  memory: Record<string, unknown>;
  resumed: boolean;
  expiresAt?: string | null;
};

export type SupportAssistantMessage = {
  role: "user" | "assistant";
  text: string;
  category?: string | null;
  priority?: string | null;
  createdAt?: string | null;
};

export type SupportHandoffContext = {
  intent: SupportCategory;
  category: string;
  severity: string;
  likelyDiagnosis: string;
  troubleshootingDone: string[];
  suggestedNextSteps: string[];
  summary: string;
};

const localKnowledge = supportKnowledge.articles as SupportKnowledgeArticle[];

function ignoreMissingSupportUpgrade(error: { code?: string; message?: string } | null | undefined) {
  return Boolean(error && ["42P01", "42703", "42883", "PGRST204", "PGRST205"].includes(String(error.code)));
}

function textIncludesAny(article: SupportKnowledgeArticle, terms: string[]) {
  const haystack = `${article.title} ${article.summary} ${article.body} ${article.category}`.toLowerCase();
  return terms.some((term) => term.length > 2 && haystack.includes(term));
}

function searchTerms(message: string, category: string) {
  return [...new Set(`${category} ${message}`.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean))].slice(0, 18);
}

function websearchQuery(message: string, category: string) {
  return searchTerms(message, category).slice(0, 10).join(" | ");
}

function publicSessionId(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return /^[0-9a-f-]{36}$/i.test(text) ? text : randomUUID();
}

function isPublicSessionId(value: unknown) {
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value.trim());
}

function sessionHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function supportAssistantFeatureMissing(error: unknown) {
  if (!error || typeof error !== "object") return false;
  return ignoreMissingSupportUpgrade(error as { code?: string; message?: string });
}

export async function loadSupportAssistantSession(input: {
  adminClient: SupabaseAdminClient | null;
  requestedSessionId: unknown;
  accountRole: AccountAccessRole;
  userId: string | null;
  contactEmail: string;
  currentPath: string;
}): Promise<SupportAssistantSession> {
  let publicId = publicSessionId(input.requestedSessionId);
  const fallback = { id: null, publicId, summary: "", memory: {}, resumed: false, expiresAt: null };

  if (!input.adminClient) return fallback;

  const now = new Date();
  const expiresAt = input.userId
    ? new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString()
    : new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

  if (isPublicSessionId(input.requestedSessionId)) {
    const { data: existingSession, error: existingError } = await input.adminClient
      .from("support_assistant_sessions")
      .select("id,last_summary,memory,requester_user_id,expires_at")
      .eq("session_key_hash", sessionHash(publicId))
      .maybeSingle();

    if (!ignoreMissingSupportUpgrade(existingError) && !existingError && existingSession?.id) {
      const ownerId = typeof existingSession.requester_user_id === "string" ? existingSession.requester_user_id : null;
      const expired =
        typeof existingSession.expires_at === "string" &&
        new Date(existingSession.expires_at).getTime() < now.getTime();
      const ownedByDifferentUser = Boolean(ownerId && ownerId !== input.userId);
      const signedOutTryingOwnedSession = Boolean(ownerId && !input.userId);

      if (expired || ownedByDifferentUser || signedOutTryingOwnedSession) {
        publicId = randomUUID();
      } else {
        const { error: updateError } = await input.adminClient
          .from("support_assistant_sessions")
          .update({
            requester_user_id: input.userId,
            requester_role: input.accountRole,
            contact_email: input.contactEmail || null,
            last_seen_path: input.currentPath || null,
            anonymous_session: !input.userId,
            expires_at: expiresAt,
            last_message_at: now.toISOString()
          })
          .eq("id", existingSession.id);

        if (!updateError) {
          return {
            id: existingSession.id,
            publicId,
            summary: typeof existingSession.last_summary === "string" ? existingSession.last_summary : "",
            memory: existingSession.memory && typeof existingSession.memory === "object" ? existingSession.memory : {},
            resumed: true,
            expiresAt
          };
        }
      }
    }
  }

  const row = {
    session_key_hash: sessionHash(publicId),
    requester_user_id: input.userId,
    requester_role: input.accountRole,
    contact_email: input.contactEmail || null,
    last_seen_path: input.currentPath || null,
    anonymous_session: !input.userId,
    expires_at: expiresAt,
    last_message_at: now.toISOString()
  };

  const { data, error } = await input.adminClient
    .from("support_assistant_sessions")
    .upsert(row, { onConflict: "session_key_hash" })
    .select("id,last_summary,memory")
    .maybeSingle();

  if (ignoreMissingSupportUpgrade(error)) return fallback;
  if (error || !data) return fallback;

  return {
    id: data.id,
    publicId,
    summary: typeof data.last_summary === "string" ? data.last_summary : "",
    memory: data.memory && typeof data.memory === "object" ? data.memory : {},
    resumed: false,
    expiresAt
  };
}

export async function loadSupportAssistantMessages(input: {
  adminClient: SupabaseAdminClient | null;
  sessionId: string | null;
  limit?: number;
}): Promise<SupportAssistantMessage[]> {
  if (!input.adminClient || !input.sessionId) return [];

  const { data, error } = await input.adminClient
    .from("support_assistant_messages")
    .select("role,text,category,priority,created_at")
    .eq("session_id", input.sessionId)
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(input.limit ?? 12, 30)));

  if (ignoreMissingSupportUpgrade(error) || error || !Array.isArray(data)) return [];

  return data
    .reverse()
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => ({
      role: message.role,
      text: String(message.text ?? "").slice(0, 4000),
      category: message.category,
      priority: message.priority,
      createdAt: message.created_at
    }));
}

export async function saveSupportAssistantMessages(input: {
  adminClient: SupabaseAdminClient | null;
  sessionId: string | null;
  userMessage: string;
  assistantMessage: string;
  category: string;
  priority: string;
  summary: string;
  memory: Record<string, unknown>;
}) {
  if (!input.adminClient || !input.sessionId) return;

  await Promise.allSettled([
    input.adminClient.from("support_assistant_messages").insert([
      {
        session_id: input.sessionId,
        role: "user",
        text: input.userMessage,
        category: input.category,
        priority: input.priority
      },
      {
        session_id: input.sessionId,
        role: "assistant",
        text: input.assistantMessage,
        category: input.category,
        priority: input.priority
      }
    ]),
    input.adminClient
      .from("support_assistant_sessions")
      .update({
        current_category: input.category,
        current_priority: input.priority,
        last_summary: input.summary || null,
        memory: input.memory,
        last_message_at: new Date().toISOString()
      })
      .eq("id", input.sessionId)
  ]);
}

export async function markSupportAssistantTicketCreated(input: {
  adminClient: SupabaseAdminClient | null;
  sessionId: string | null;
}) {
  if (!input.adminClient || !input.sessionId) return;
  await input.adminClient
    .from("support_assistant_sessions")
    .update({ status: "ticket_created", last_message_at: new Date().toISOString() })
    .eq("id", input.sessionId);
}

export async function searchSupportKnowledge(input: {
  adminClient: SupabaseAdminClient | null;
  role: AccountAccessRole;
  category: SupportCategory;
  message: string;
}): Promise<SupportKnowledgeArticle[]> {
  const terms = searchTerms(input.message, input.category);
  const fallback = localKnowledge
    .filter((article) => (!article.audience || article.audience.includes(input.role)) && (article.category === input.category || textIncludesAny(article, terms)))
    .slice(0, 4);

  if (!input.adminClient) return fallback;

  const query = websearchQuery(input.message, input.category);
  if (!query) return fallback;

  const { data, error } = await input.adminClient
    .from("support_knowledge_articles")
    .select("id,slug,title,summary,body,category,route_href,action_label")
    .eq("active", true)
    .contains("audience", [input.role])
    .textSearch("search_document", query, { type: "websearch", config: "english" })
    .order("priority", { ascending: false })
    .limit(4);

  if (ignoreMissingSupportUpgrade(error) || error || !Array.isArray(data) || data.length === 0) {
    return fallback;
  }

  return data.map((article) => ({
    id: article.id,
    slug: article.slug,
    title: article.title,
    summary: article.summary,
    body: article.body,
    category: article.category,
    routeHref: article.route_href,
    actionLabel: article.action_label
  }));
}

export async function loadSupportServiceStatus(adminClient: SupabaseAdminClient | null): Promise<SupportServiceStatus> {
  if (!adminClient) {
    return { available: false, status: "unknown", summary: "Service availability could not be checked." };
  }

  const { data, error } = await adminClient
    .from("site_health_reports")
    .select("status,checked_at,success_rate,failed_checks,slow_checks_count,p95_ms")
    .order("checked_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return { available: false, status: "unknown", summary: "Service availability could not be checked." };
  }

  const status = data.status === "fail" || data.status === "degraded" || data.status === "ok" ? data.status : "unknown";
  const successRate = Number(data.success_rate ?? 0);
  const failed = Number(data.failed_checks ?? 0);
  const slow = Number(data.slow_checks_count ?? 0);

  return {
    available: true,
    status,
    checkedAt: data.checked_at,
    p95Ms: Number(data.p95_ms ?? 0),
    summary:
      status === "ok"
        ? "LDA services appear available for normal customer actions."
        : "Some customer actions may need retry guidance before escalation."
  };
}

export async function recordSupportAssistantToolEvent(input: {
  adminClient: SupabaseAdminClient | null;
  sessionId?: string | null;
  ticketId?: string | null;
  userId?: string | null;
  actorRole: AccountAccessRole | "system";
  toolName: string;
  allowed?: boolean;
  inputSummary?: string;
  resultSummary?: string;
  metadata?: Record<string, unknown>;
}) {
  if (!input.adminClient) return;

  const { error } = await input.adminClient.from("support_assistant_tool_events").insert({
    session_id: input.sessionId ?? null,
    ticket_id: input.ticketId ?? null,
    actor_user_id: input.userId ?? null,
    actor_role: input.actorRole,
    tool_name: input.toolName,
    allowed: input.allowed ?? true,
    input_summary: input.inputSummary ?? null,
    result_summary: input.resultSummary ?? null,
    metadata: input.metadata ?? {}
  });

  if (ignoreMissingSupportUpgrade(error)) return;
  if (error) console.warn("[support.assistant.tool] audit write failed", error.message);
}

export function buildKnowledgeLinks(articles: SupportKnowledgeArticle[], allowedActions: SafeChatLink[], role?: AccountAccessRole) {
  const allowedHrefs = new Set(allowedActions.map((action) => action.href));
  return articles.reduce<SafeChatLink[]>((links, article) => {
    if (!article.routeHref || !article.actionLabel) return links;
    const allowed = role ? hrefAllowedForAccount(article.routeHref, role) : allowedHrefs.has(article.routeHref);
    if (!allowed) return links;
    if (links.some((link) => link.href === article.routeHref)) return links;
    links.push({ href: article.routeHref, label: article.actionLabel });
    return links;
  }, []);
}

export function buildNavigationIndex(role: AccountAccessRole): ChatNavigationRoute[] {
  return getNavigationIndexForRole(role);
}

export function suggestSupportNavigation(input: {
  message: string;
  role: AccountAccessRole;
  existingActions: SafeChatLink[];
  limit?: number;
}) {
  const seen = new Set(input.existingActions.map((action) => action.href));
  return suggestNavigationRoutes(input.message, input.role, input.limit ?? 4).filter((action) => {
    if (seen.has(action.href)) return false;
    seen.add(action.href);
    return true;
  });
}

export function supportTicketOps(input: {
  category: SupportCategory;
  priority: SupportPriority;
  serviceStatus: SupportServiceStatus;
}) {
  const categoryMap: Partial<Record<SupportCategory, string>> = {
    payment: "payments",
    payout: "payments",
    off_platform: "safeguarding",
    safety: "safeguarding",
    technical: "website_error",
    verification: "document_verification",
    booking: "lesson_booking",
    arrival: "lesson_booking",
    account: "account_access"
  };
  const category = categoryMap[input.category] ?? input.category;
  const severity =
    input.priority === "critical"
      ? "sev1_critical"
      : input.priority === "urgent"
        ? "sev2_high"
        : input.serviceStatus.status === "degraded" || input.serviceStatus.status === "fail"
          ? "sev3_medium"
          : "sev4_low";
  const assignedTeam =
    category === "payments"
      ? "finance"
      : category === "safeguarding"
        ? "safeguarding"
        : category === "document_verification"
          ? "compliance"
          : "technical_support";

  return { category, severity, assignedTeam };
}

export function summariseAssistantMemory(input: {
  previousSummary: string;
  latestUserMessage: string;
  latestAnswer: string;
  category: string;
  priority: string;
}) {
  return [
    input.previousSummary,
    `Latest ${input.category}/${input.priority}: user said "${input.latestUserMessage.slice(0, 180)}"; assistant guided "${input.latestAnswer.slice(0, 180)}".`
  ]
    .filter(Boolean)
    .join(" ")
    .slice(-1000);
}

export function buildSupportHandoff(input: {
  category: SupportCategory;
  priority: SupportPriority;
  categoryLabel: string;
  userMessage: string;
  assistantAnswer: string;
  requiredDetails: string[];
  knowledge: SupportKnowledgeArticle[];
  serviceStatus: SupportServiceStatus;
  ops: ReturnType<typeof supportTicketOps>;
}): SupportHandoffContext {
  const likelyDiagnosis =
    input.category === "technical"
      ? "Website or device flow issue requiring page, browser, and error context review."
      : input.category === "payment"
        ? "Learner payment, receipt, duplicate charge, refund, or booking/payment matching issue."
        : input.category === "payout"
          ? "Instructor finance or payout status issue requiring payment reference review."
          : input.category === "verification"
            ? "Instructor verification or document review issue."
            : input.category === "off_platform"
              ? "Possible off-platform payment or private-booking request requiring safeguarding review."
              : input.category === "arrival"
                ? "Live lesson arrival or booking attendance issue."
                : `${input.categoryLabel} issue requiring support review.`;
  const troubleshootingDone = [
    "Classified the support intent and urgency.",
    input.serviceStatus.available
      ? `Checked service availability: ${input.serviceStatus.summary}`
      : "Service availability was not available at handoff time.",
    input.knowledge.length
      ? `Searched knowledge base: ${input.knowledge.map((article) => article.slug).join(", ")}.`
      : "No matching knowledge article was found.",
    input.requiredDetails.length
      ? `Asked for missing details: ${input.requiredDetails.join(", ")}.`
      : "No obvious required details were missing.",
    `Gave assistant guidance: ${input.assistantAnswer.slice(0, 220)}`
  ];
  const suggestedNextSteps = [
    input.ops.assignedTeam === "finance" ? "Check payment or payout records against the booking/account." : "",
    input.ops.assignedTeam === "safeguarding" ? "Review off-platform/safety context before contacting the customer." : "",
    input.ops.assignedTeam === "compliance" ? "Review verification document status and approval history." : "",
    input.ops.assignedTeam === "technical_support" ? "Review source page, browser/device details, and recent incidents." : "",
    "Use the transcript before asking the customer any repeat questions."
  ].filter(Boolean);

  return {
    intent: input.category,
    category: input.ops.category,
    severity: input.ops.severity,
    likelyDiagnosis,
    troubleshootingDone,
    suggestedNextSteps,
    summary: `${input.categoryLabel}: ${input.userMessage.replace(/\s+/g, " ").trim().slice(0, 360)}`
  };
}
