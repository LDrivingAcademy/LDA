import { createHash } from "crypto";
import { sendSupportEscalationEmail, sendSupportTicketConfirmationEmail } from "@/lib/email";
import { getMarketplaceRoleState } from "@/lib/account-route-guard";
import { describeLocale, getLocaleFromRequest } from "@/lib/i18n/config";
import { getEnglishMessage } from "@/lib/i18n/messages";
import { humaniseFallbackAnswer, humaniseRequiredDetails, ldaAiHumanFirstInstructions } from "@/lib/lda-ai-conversation-rules";
import {
  conciseFallbackAnswer,
  selectRelevantSupportActions,
  shouldExposeSupportActions,
  validateHumanConversationResponse
} from "@/lib/lda-human-conversation-engine";
import { classifySupportRequest, supportTicketReference, type SupportPriority } from "@/lib/support-guidance";
import {
  filterPresentationActions,
  publicSafeErrorMessage,
  sanitizePresentationObject,
  sanitizePresentationText
} from "@/lib/presentation-policy";
import { csrfResponse, getClientIp, hasTrustedPostOrigin, isRateLimited, jsonNoStore, rateLimitResponse, readJsonBody, safeEmail, safeText } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  resolveUnderstandingActions,
  understandSupportMessage,
  type SupportMessageUnderstanding
} from "@/lib/support-message-understanding";
import type { AccountAccessRole } from "@/lib/chat-permissions";
import {
  buildKnowledgeLinks,
  buildNavigationIndex,
  buildSupportHandoff,
  loadSupportAssistantSession,
  loadSupportServiceStatus,
  markSupportAssistantTicketCreated,
  recordSupportAssistantToolEvent,
  saveSupportAssistantMessages,
  searchSupportKnowledge,
  suggestSupportNavigation,
  summariseAssistantMemory,
  supportTicketOps,
  type SupportKnowledgeArticle,
  type SupportServiceStatus
} from "@/lib/support-assistant-tools";

type ConversationMessage = {
  role?: "user" | "assistant";
  text?: string;
};

type SupportAssistantRequest = {
  action?: "guide" | "escalate" | "resume";
  sessionId?: string;
  message?: string;
  email?: string;
  emailUpdates?: "accepted" | "declined" | "unknown";
  bookingReference?: string;
  currentPath?: string;
  conversation?: ConversationMessage[];
};

type SupportAccountContext = {
  role: AccountAccessRole;
  userId: string | null;
  email: string;
  verificationStatus: string | null;
};

function extractOutputText(payload: unknown) {
  if (payload && typeof payload === "object" && "output_text" in payload && typeof payload.output_text === "string") {
    return payload.output_text.trim();
  }
  return "";
}

function sanitiseConversation(value: SupportAssistantRequest["conversation"]) {
  if (!Array.isArray(value)) return [];

  return value.slice(-12).reduce<Array<{ role: "user" | "assistant"; text: string }>>((messages, item) => {
    if (item?.role !== "user" && item?.role !== "assistant") return messages;
    const text = safeText(item.text, "", 1000);
    if (text) messages.push({ role: item.role, text });
    return messages;
  }, []);
}

function recentUserFacts(conversation: Array<{ role: "user" | "assistant"; text: string }>) {
  return conversation
    .filter((message) => message.role === "user")
    .slice(-4)
    .map((message) => message.text)
    .join(" | ")
    .slice(0, 1200);
}

async function resolveAccountContext(): Promise<SupportAccountContext> {
  const supabase = await createClient();
  if (!supabase) return { role: "visitor", userId: null, email: "", verificationStatus: null };

  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { role: "visitor", userId: null, email: "", verificationStatus: null };

  const roleState = await getMarketplaceRoleState(supabase, user.id);
  const role: AccountAccessRole =
    roleState.isAdmin
      ? "admin"
      : roleState.isSupport
        ? "support"
        : roleState.effectiveRole === "instructor"
        ? roleState.isApprovedInstructor
          ? "instructor"
          : "in_progress"
        : roleState.effectiveRole === "learner"
          ? "learner"
          : "visitor";

  return {
    role,
    userId: user.id,
    email: safeEmail(user.email),
    verificationStatus: roleState.verificationStatus
  };
}

async function loadBookingContext(
  adminClient: NonNullable<ReturnType<typeof createAdminClient>>,
  account: SupportAccountContext,
  bookingReference: string
) {
  if (!account.userId || !bookingReference) return {};

  const { data } = await adminClient
    .from("lesson_booking_records")
    .select("booking_reference,learner_id,instructor_id,instructor_name,lesson_summary,starts_at,ends_at,status,payment_status")
    .eq("booking_reference", bookingReference)
    .maybeSingle();

  if (!data) return {};
  const isParticipant = data.learner_id === account.userId || String(data.instructor_id ?? "") === account.userId;
  if (!isParticipant && account.role !== "admin") return {};

  return {
    bookingReference: data.booking_reference,
    instructorName: data.instructor_name,
    lessonSummary: data.lesson_summary,
    startsAt: data.starts_at,
    endsAt: data.ends_at,
    status: data.status,
    paymentStatus: data.payment_status
  };
}

async function createAiGuidance(input: {
  message: string;
  role: AccountAccessRole;
  category: string;
  categoryLabel: string;
  priority: SupportPriority;
  requiredDetails: string[];
  fallbackAnswer: string;
  conversation: Array<{ role: "user" | "assistant"; text: string }>;
  sessionSummary: string;
  knowledge: SupportKnowledgeArticle[];
  serviceStatus: SupportServiceStatus;
  navigation: Array<{ label: string; href: string; description?: string }>;
  understanding: SupportMessageUnderstanding;
  safetyIdentifier: string;
  language: ReturnType<typeof describeLocale>;
}) {
  const usePaidProvider = process.env.LDA_SUPPORT_AI_PROVIDER === "openai";
  const apiKey = usePaidProvider ? process.env.OPENAI_API_KEY : "";
  if (!apiKey) {
    return {
      answer: conciseFallbackAnswer({
        fallbackAnswer: input.fallbackAnswer,
        requiredDetails: input.requiredDetails,
        latestMessage: input.message
      }),
      mode: "guided" as const,
      validation: { ok: true, answer: input.fallbackAnswer, violations: [] }
    };
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_SUPPORT_MODEL || "gpt-5.6-luna",
        store: false,
        safety_identifier: input.safetyIdentifier,
        reasoning: { effort: "low" },
        text: { verbosity: "low" },
        max_output_tokens: 220,
        instructions:
          `${ldaAiHumanFirstInstructions} You are the unified L Driving Academy support assistant across the public site and support centre. The chat UI already shows the opening welcome message before the user types. If the user only says hi, hello, hey, or similar, reply exactly: How can I help you? Reply in the user's language: ${input.language.label} (${input.language.locale}, ${input.language.direction}). If the latest user message clearly asks for a different language, use that language. Keep the same calm, professional LDA tone in every language. Use only the provided LDA knowledge, private service availability context, navigation options, and current-session conversation. Keep replies under 80 words unless safety requires more. If the provided knowledge does not cover the issue, say what context is missing and ask one useful follow-up rather than inventing facts. Do not list every possible feature or route. Always try to resolve the issue through LDA platform routes first using concise steps and only relevant action buttons. For refund questions, briefly explain that refunds are handled through Payment Help, that the user should open the lesson/payment record and use the refund option, and that LDA will show whether it can be processed automatically or reviewed. Ask for a booking reference only after that explanation if it is needed. If the user says advice did not work, do not repeat the same advice; acknowledge it and ask one useful follow-up or offer a different practical next step. Do not tell users to click a failure or unresolved button. Do not offer manual ticket creation. Do not mention permissions, role locks, internal policy, model names, service status, uptime, platform health, technical tooling, or architecture. Never claim a ticket was created unless the request says it was. Never auto-execute sensitive actions, payments, refunds, account edits, booking changes, document changes, admin actions, or language preference changes. Never request full card, bank, driving licence, password, authentication code, or identity-document details. LDA has no public support phone number. Callback support is not currently available. For immediate danger, tell the user to contact emergency services first. Off-platform payment requests must be refused and reported through LDA.`,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: [
                  `Account type: ${input.role}`,
                  `Support category: ${input.categoryLabel}`,
                  `Priority: ${input.priority}`,
                  `Semantic understanding: ${JSON.stringify({
                    intent: input.understanding.intent,
                    confidence: input.understanding.confidence,
                    learnerGoal: input.understanding.learnerGoal,
                    responseGuidance: input.understanding.responseGuidance
                  })}`,
                  `One follow-up allowed if needed: ${input.requiredDetails[0] || "none"}`,
                  `Remembered context: ${input.sessionSummary || "none"}`,
                  `User details already provided this session: ${recentUserFacts(input.conversation) || "none"}`,
                  `Private service availability context: use this only to decide whether to suggest trying again later. Do not reveal checks, status names, percentages, timestamps, tools, or internal systems. ${input.serviceStatus.summary}`,
                  `Allowed navigation options: ${JSON.stringify(input.navigation.slice(0, 8))}`,
                  `Knowledge base matches: ${JSON.stringify(input.knowledge.map((article) => ({
                    title: article.title,
                    summary: article.summary,
                    body: article.body.slice(0, 700),
                    routeHref: article.routeHref,
                    actionLabel: article.actionLabel
                  })))}`,
                  `Recent conversation: ${JSON.stringify(input.conversation)}`,
                  `Latest message: ${input.message}`
                ].join("\n")
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      return {
        answer: conciseFallbackAnswer({
          fallbackAnswer: input.fallbackAnswer,
          requiredDetails: input.requiredDetails,
          latestMessage: input.message
        }),
        mode: "guided" as const,
        validation: { ok: true, answer: input.fallbackAnswer, violations: [] }
      };
    }
    const answer = sanitizePresentationText(extractOutputText(await response.json()), input.role);
    const rawAnswer =
      answer ||
      conciseFallbackAnswer({
        fallbackAnswer: input.fallbackAnswer,
        requiredDetails: input.requiredDetails,
        latestMessage: input.message
      });
    const validation = validateHumanConversationResponse({
      answer: rawAnswer,
      latestMessage: input.message,
      conversation: input.conversation,
      category: input.category,
      priority: input.priority
    });
    return validation.ok
      ? { answer: validation.answer, mode: answer ? "ai" as const : "guided" as const, validation }
      : {
          answer: conciseFallbackAnswer({
            fallbackAnswer: input.fallbackAnswer,
            requiredDetails: input.requiredDetails,
            latestMessage: input.message
          }),
          mode: "guided" as const,
          validation
        };
  } catch {
    return {
      answer: conciseFallbackAnswer({
        fallbackAnswer: input.fallbackAnswer,
        requiredDetails: input.requiredDetails,
        latestMessage: input.message
      }),
      mode: "guided" as const,
      validation: { ok: true, answer: input.fallbackAnswer, violations: [] }
    };
  }
}

export async function POST(request: Request) {
  if (!hasTrustedPostOrigin(request)) return csrfResponse();
  if (isRateLimited(request, "support-assistant", 30)) return rateLimitResponse();

  const input = await readJsonBody<SupportAssistantRequest>(request);
  if (!input) return jsonNoStore({ error: "Invalid support request." }, { status: 400 });

  const language = describeLocale(getLocaleFromRequest(request));
  const account = await resolveAccountContext();
  const inputEmail = safeEmail(input.email);
  const emailUpdates = input.emailUpdates === "accepted" || input.emailUpdates === "declined" ? input.emailUpdates : "unknown";
  const contactEmail =
    emailUpdates === "declined"
      ? ""
      : emailUpdates === "accepted"
        ? account.email || inputEmail
        : account.email || inputEmail;
  const currentPath = safeText(input.currentPath, "", 240);
  const adminClient = createAdminClient();

  const session = await loadSupportAssistantSession({
    adminClient,
    requestedSessionId: input.sessionId,
    accountRole: account.role,
    userId: account.userId,
    contactEmail,
    currentPath
  });

  const message = safeText(input.message, "", 4000);
  if (message.length < 1) return jsonNoStore({ error: "Tell LDA what you need help with." }, { status: 400 });

  const bookingReference = safeText(input.bookingReference, "", 80).toUpperCase();
  const conversation = sanitiseConversation(input.conversation);
  const understanding = understandSupportMessage({
    message,
    role: account.role,
    currentPath,
    conversation
  });
  const classification = classifySupportRequest({
    message,
    role: account.role,
    hasBookingReference: Boolean(bookingReference),
    hasContactEmail: Boolean(contactEmail)
  });
  const humanRequiredDetails = understanding.requiredDetails ?? humaniseRequiredDetails(classification.requiredDetails);
  const humanFallbackAnswer = understanding.fallbackAnswer ?? humaniseFallbackAnswer(classification.fallbackAnswer, humanRequiredDetails);
  const [knowledge, serviceStatus] = await Promise.all([
    searchSupportKnowledge({
      adminClient,
      role: account.role,
      category: classification.category,
      message
    }),
    loadSupportServiceStatus(adminClient)
  ]);
  const knowledgeLinks = buildKnowledgeLinks(knowledge, classification.actions, account.role);
  const navigationLinks = suggestSupportNavigation({
    message,
    role: account.role,
    existingActions: classification.actions,
    limit: 4
  });
  const understandingActions = resolveUnderstandingActions({ understanding, role: account.role });
  const semanticRouteMatch = understanding.intent !== "unknown" && understanding.confidence >= 0.5 && understandingActions.length > 0;
  const candidateActions = semanticRouteMatch
    ? understandingActions
    : [...understandingActions, ...classification.actions, ...knowledgeLinks, ...navigationLinks];
  const actions = candidateActions.filter(
    (action, index, links) => links.findIndex((candidate) => candidate.href === action.href) === index
  );
  const navigationIndex = buildNavigationIndex(account.role);
  const ops = supportTicketOps({
    category: classification.category,
    priority: classification.priority,
    serviceStatus
  });
  const ipHash = createHash("sha256").update(getClientIp(request)).digest("hex");
  const safetyIdentifier = createHash("sha256")
    .update(account.userId || ipHash)
    .digest("hex");
  const guidance = await createAiGuidance({
    message,
    role: account.role,
    category: classification.category,
    categoryLabel: classification.categoryLabel,
    priority: classification.priority,
    requiredDetails: humanRequiredDetails,
    fallbackAnswer: humanFallbackAnswer,
    conversation,
    sessionSummary: session.summary,
    knowledge,
    serviceStatus,
    understanding,
    navigation: navigationIndex
      .filter((route) => actions.some((action) => action.href === route.href))
      .map(({ label, href, description }) => ({ label, href, description })),
    safetyIdentifier,
    language
  });
  const allowedPresentationActions = filterPresentationActions(
    shouldExposeSupportActions({
      message,
      category: classification.category,
      answer: guidance.answer,
      actionCount: actions.length
    })
      ? actions
      : [],
    account.role
  );
  const visibleActions = selectRelevantSupportActions({
    message,
    category: classification.category,
    actions: allowedPresentationActions
  });
  const nextSummary = summariseAssistantMemory({
    previousSummary: session.summary,
    latestUserMessage: message,
    latestAnswer: guidance.answer,
    category: classification.category,
    priority: classification.priority
  });
  const handoff = buildSupportHandoff({
    category: classification.category,
    priority: classification.priority,
    categoryLabel: classification.categoryLabel,
    userMessage: message,
    assistantAnswer: guidance.answer,
    requiredDetails: classification.requiredDetails,
    knowledge,
    serviceStatus,
    ops
  });

  await Promise.allSettled([
    saveSupportAssistantMessages({
      adminClient,
      sessionId: session.id,
      userMessage: message,
      assistantMessage: guidance.answer,
      category: classification.category,
      priority: classification.priority,
      summary: nextSummary,
      memory: {
        role: account.role,
        category: classification.category,
        priority: classification.priority,
        requiredDetails: humanRequiredDetails,
        supportIntent: understanding.intent,
        supportGoal: understanding.learnerGoal,
        serviceStatus: serviceStatus.status,
        knowledgeSlugs: knowledge.map((article) => article.slug).slice(0, 6)
      }
    }),
    recordSupportAssistantToolEvent({
      adminClient,
      sessionId: session.id,
      userId: account.userId,
      actorRole: account.role,
      toolName: "support_guidance",
      inputSummary: classification.summary,
      resultSummary: guidance.answer.slice(0, 500),
      metadata: {
        mode: guidance.mode,
        category: classification.category,
        priority: classification.priority,
        supportIntent: understanding.intent,
        supportGoal: understanding.learnerGoal,
        serviceStatus: serviceStatus.status,
        knowledgeSlugs: knowledge.map((article) => article.slug),
        navigationHrefs: actions.map((action) => action.href),
        shownNavigationHrefs: visibleActions.map((action) => action.href),
        responseValidation: guidance.validation,
        locale: language.locale,
        languageDirection: language.direction,
        unresolvedHandoffReady: true
      }
    })
  ]);

  if (input.action !== "escalate") {
    return jsonNoStore(sanitizePresentationObject({
      sessionId: session.publicId,
      answer: guidance.answer,
      mode: guidance.mode,
      category: classification.category,
      categoryLabel: classification.categoryLabel,
      priority: classification.priority,
      requiredDetails: humanRequiredDetails,
      actions: visibleActions,
      navigation: visibleActions.map((action) => ({
        label: action.label,
        href: action.href
      })),
      suggestedReplies: [],
      language,
      continueInSupportCenter: {
        label: "Continue in support centre",
        available: true,
        needsEmail: false
      },
      canCreateTicket: true,
      needsEmail: false,
      callbackAvailable: false
    }, account.role));
  }

  if (!adminClient) {
    return jsonNoStore({ error: publicSafeErrorMessage("Ticket creation is temporarily unavailable. Please try again shortly.", account.role) }, { status: 503 });
  }

  const bookingContext = await loadBookingContext(adminClient, account, bookingReference);
  const ticketConversation = [...conversation];
  const finalAssistantIndex = ticketConversation.length - 1;
  const finalUserIndex = ticketConversation.length - 2;
  const conversationAlreadyIncludesMessage =
    ticketConversation[finalUserIndex]?.role === "user" &&
    ticketConversation[finalUserIndex]?.text === message &&
    ticketConversation[finalAssistantIndex]?.role === "assistant";

  if (conversationAlreadyIncludesMessage) {
    ticketConversation[finalAssistantIndex] = { role: "assistant", text: guidance.answer };
  } else {
    ticketConversation.push(
      { role: "user", text: message },
      { role: "assistant", text: guidance.answer }
    );
  }

  const ticketInsert = {
    requester_user_id: account.userId,
    requester_role: account.role,
    contact_email: contactEmail || null,
    category: classification.category,
    subcategory: ops.category,
    priority: classification.priority,
    severity: ops.severity,
    assigned_team: ops.assignedTeam,
    status: "new",
    subject: classification.categoryLabel,
    message,
    ai_summary: (nextSummary || classification.summary).slice(0, 500),
    assistant_guidance: guidance.answer,
    booking_reference: bookingReference || null,
    booking_context: bookingContext,
    conversation: ticketConversation.slice(-14),
    risk_flags: classification.riskFlags,
    source_path: currentPath || null,
    request_context: {
      accountRole: account.role,
      verificationStatus: account.verificationStatus,
      userAgent: safeText(request.headers.get("user-agent"), "", 300),
      ipHash,
      callbackAvailable: false,
      emailUpdates,
      updatesByEmail: Boolean(contactEmail),
      serviceStatus,
      knowledgeSlugs: knowledge.map((article) => article.slug).slice(0, 8),
      navigationHrefs: actions.map((action) => action.href).slice(0, 8),
      handoff
    },
    preferred_contact_method: "email",
    callback_requested: false,
    callback_status: "not_requested",
    assistant_session_id: session.id,
    knowledge_article_ids: knowledge.map((article) => article.id).filter(Boolean),
    likely_diagnosis: handoff.likelyDiagnosis,
    troubleshooting_done: handoff.troubleshootingDone,
    suggested_next_steps: handoff.suggestedNextSteps,
    tool_trace: [
      {
        tool: "classify_support_request",
        category: classification.category,
        priority: classification.priority
      },
      {
        tool: "search_knowledge_base",
        matches: knowledge.map((article) => article.slug)
      },
      {
        tool: "check_service_status",
        status: serviceStatus.status
      },
      {
        tool: "build_navigation_index",
        matches: actions.map((action) => action.href)
      },
      {
        tool: "prepare_handoff",
        severity: handoff.severity,
        assignedTeam: ops.assignedTeam
      }
    ],
    tags: [...new Set([classification.category, ops.category, ...classification.riskFlags].filter(Boolean))]
  };
  const { data: ticket, error } = await adminClient
    .from("support_tickets")
    .insert(ticketInsert)
    .select("id,ticket_number")
    .single();

  if (error || !ticket) {
    console.error("[support.ticket] create failed", error?.message);
    return jsonNoStore({ error: publicSafeErrorMessage("The support ticket could not be created. Please try again.", account.role) }, { status: 503 });
  }

  const reference = supportTicketReference(Number(ticket.ticket_number));
  await Promise.allSettled([
    markSupportAssistantTicketCreated({ adminClient, sessionId: session.id }),
    recordSupportAssistantToolEvent({
      adminClient,
      sessionId: session.id,
      ticketId: ticket.id,
      userId: account.userId,
      actorRole: account.role,
      toolName: "create_support_ticket",
      inputSummary: classification.summary,
      resultSummary: reference,
      metadata: {
        category: classification.category,
        subcategory: ops.category,
        priority: classification.priority,
        severity: ops.severity,
        assignedTeam: ops.assignedTeam
      }
    })
  ]);
  await Promise.allSettled([
    sendSupportEscalationEmail({
      role: account.role === "visitor" ? "guest" : account.role === "in_progress" ? "instructor" : account.role,
      email: contactEmail,
      bookingReference: bookingReference || reference,
      subject: `${reference}: ${classification.categoryLabel}`,
      message,
      assistantSummary: guidance.answer,
      urgent: classification.priority !== "standard"
    })
  ]);
  if (contactEmail) {
    await Promise.allSettled([
      sendSupportTicketConfirmationEmail({
        to: contactEmail,
        reference,
        categoryLabel: classification.categoryLabel,
        priority: classification.priority,
        idempotencyKey: `support-ticket-${ticket.id}`
      })
    ]);
  }

  return jsonNoStore(sanitizePresentationObject({
    ok: true,
    sessionId: session.publicId,
    ticket: {
      id: ticket.id,
      reference,
      status: "new"
    },
    answer: contactEmail
      ? getEnglishMessage("ai.support.ticketCreated", { reference })
      : `I have escalated this to LDA support with the chat context attached. Your reference is ${reference}. No email updates will be sent.`,
    language,
    callbackAvailable: false
  }, account.role));
}
