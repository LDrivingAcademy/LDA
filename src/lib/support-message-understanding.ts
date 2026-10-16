import supportKnowledge from "@/lib/lda-support-knowledge.json";
import {
  getAllowedChatRoutes,
  type AccountAccessRole,
  type SafeChatLink
} from "@/lib/chat-permissions";

export type SupportMessageIntent =
  | "greeting"
  | "vague_help"
  | "new_lesson_booking"
  | "book_on_demand"
  | "schedule_lesson"
  | "find_instructor"
  | "booking_problem"
  | "refund_request"
  | "unknown";

export type SupportMessageUnderstanding = {
  intent: SupportMessageIntent;
  confidence: number;
  learnerGoal: string;
  responseGuidance: string;
  primaryRouteIds: string[];
  requiredDetails: string[] | null;
  fallbackAnswer: string | null;
};

type KnowledgeIntent = {
  id: SupportMessageIntent;
  category: string;
  goal: string;
  examples: string[];
  responseTemplates: string[];
  visitorResponseTemplates?: string[];
  routeIds: string[];
  visitorRouteIds?: string[];
  requiredDetails: string[];
};

const knowledgeIntents = supportKnowledge.intents as KnowledgeIntent[];
const directExistingIssueWords = new Set([
  "missing",
  "wrong",
  "problem",
  "issue",
  "pending",
  "confirmed",
  "changed",
  "cancelled",
  "late",
  "failed",
  "reference",
  "history",
  "disappeared"
]);
const stopWords = new Set(["the", "and", "for", "with", "from", "that", "this", "you", "your", "can", "how", "where", "what", "when", "does"]);

function normalise(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s'-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function singularise(token: string) {
  if (token.endsWith("ies") && token.length > 4) return `${token.slice(0, -3)}y`;
  if (token.endsWith("s") && token.length > 3) return token.slice(0, -1);
  return token;
}

function tokens(value: string) {
  return normalise(value)
    .split(" ")
    .map((token) => singularise(token))
    .filter((token) => token.length > 1 && !stopWords.has(token));
}

function editDistance(a: string, b: string) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = Array.from({ length: b.length + 1 }, () => 0);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j += 1) previous[j] = current[j];
  }

  return previous[b.length];
}

function tokenMatches(first: string, second: string) {
  if (first === second) return true;
  if (first.length < 4 || second.length < 4) return false;
  const distance = editDistance(first, second);
  return distance <= 1 || (Math.max(first.length, second.length) > 7 && distance <= 2);
}

function tokenSimilarity(messageTokens: string[], exampleTokens: string[]) {
  if (!messageTokens.length || !exampleTokens.length) return 0;
  let matches = 0;

  for (const exampleToken of exampleTokens) {
    if (messageTokens.some((messageToken) => tokenMatches(messageToken, exampleToken))) {
      matches += 1;
    }
  }

  const recall = matches / exampleTokens.length;
  const precision = matches / messageTokens.length;
  return recall * 0.68 + precision * 0.32;
}

function phraseSimilarity(message: string, example: string) {
  const normalMessage = normalise(message);
  const normalExample = normalise(example);
  if (normalMessage === normalExample) return 1;
  if (normalMessage.includes(normalExample) || normalExample.includes(normalMessage)) return 0.92;
  return tokenSimilarity(tokens(message), tokens(example));
}

function scoreIntent(message: string, intent: KnowledgeIntent) {
  const bestExampleScore = Math.max(...intent.examples.map((example) => phraseSimilarity(message, example)));
  const messageTokens = new Set(tokens(message));
  const categoryBoost =
    intent.id === "new_lesson_booking" && messageTokens.has("book") && messageTokens.has("lesson")
      ? 0.12
      : intent.id === "refund_request" && messageTokens.has("refund")
        ? 0.18
        : 0;
  return Math.min(1, bestExampleScore + categoryBoost);
}

function latestUsefulIntent(conversation: Array<{ role: "user" | "assistant"; text: string }> = []) {
  const previousUserMessage = [...conversation].reverse().find((message) => message.role === "user")?.text;
  if (!previousUserMessage) return null;

  const scored = knowledgeIntents
    .map((intent) => ({ intent, score: scoreIntent(previousUserMessage, intent) }))
    .sort((first, second) => second.score - first.score);

  return scored[0]?.score >= 0.48 ? scored[0].intent : null;
}

function isContextualFollowUp(message: string) {
  const normalMessage = normalise(message);
  return [
    "after that",
    "what after that",
    "how about after that",
    "then what",
    "what next",
    "and then",
    "afterwards"
  ].some((phrase) => normalMessage.includes(phrase));
}

function hasDirectExistingIssueLanguage(message: string) {
  const messageTokens = tokens(message);
  return messageTokens.some((token) => directExistingIssueWords.has(token));
}

function pickIntent(input: {
  message: string;
  conversation?: Array<{ role: "user" | "assistant"; text: string }>;
}) {
  const contextualIntent = isContextualFollowUp(input.message) ? latestUsefulIntent(input.conversation) : null;
  if (contextualIntent) return { intent: contextualIntent, score: 0.82, fromContext: true };

  const scored = knowledgeIntents
    .map((intent) => ({ intent, score: scoreIntent(input.message, intent), fromContext: false }))
    .sort((first, second) => second.score - first.score);

  const best = scored[0];
  if (!best || best.score < 0.42) return null;

  if (
    best.intent.id !== "booking_problem" &&
    ["new_lesson_booking", "book_on_demand", "schedule_lesson", "find_instructor"].includes(best.intent.id) &&
    hasDirectExistingIssueLanguage(input.message)
  ) {
    const bookingProblem = knowledgeIntents.find((intent) => intent.id === "booking_problem");
    if (bookingProblem) return { intent: bookingProblem, score: 0.82, fromContext: false };
  }

  return best;
}

function routeLinks(role: AccountAccessRole, routeIds: string[]) {
  const allowedRoutes = getAllowedChatRoutes(role);

  return routeIds
    .map((routeId) => allowedRoutes.find((route) => route.id === routeId))
    .filter((route): route is NonNullable<typeof route> => Boolean(route))
    .map(({ label, href }) => ({ label, href }));
}

function followUpResponseFor(intent: KnowledgeIntent) {
  const responses: Partial<Record<SupportMessageIntent, string>> = {
    new_lesson_booking: "After that, choose the instructor or slot that suits you, check the lesson details, then continue to secure checkout.",
    schedule_lesson: "After that, pick the date and time that works for you, confirm the instructor and lesson details, then continue to checkout.",
    find_instructor: "After that, choose the instructor that feels like the best fit, select an available lesson time, then continue to checkout.",
    book_on_demand: "After that, LDA sends the request to available instructors. When one accepts, you will see the confirmed lesson and tracking route.",
    refund_request: "After that, Payment Help will show whether the refund can be processed automatically or whether LDA needs to review it.",
    booking_problem: "After that, if the booking still looks wrong, keep the booking reference ready if one exists so LDA can review the exact lesson."
  };

  return responses[intent.id] ?? intent.responseTemplates[0] ?? "I can help with the next step.";
}

function responseFor(intent: KnowledgeIntent, role: AccountAccessRole, fromContext: boolean) {
  if (fromContext) return followUpResponseFor(intent);

  const templates =
    role === "visitor" && intent.visitorResponseTemplates?.length
      ? intent.visitorResponseTemplates
      : intent.responseTemplates;
  return templates[0] ?? "I can help with that. What would you like to do next?";
}

function routeIdsFor(intent: KnowledgeIntent, role: AccountAccessRole) {
  return role === "visitor" && intent.visitorRouteIds?.length ? intent.visitorRouteIds : intent.routeIds;
}

export function understandSupportMessage(input: {
  message: string;
  role: AccountAccessRole;
  currentPath?: string;
  conversation?: Array<{ role: "user" | "assistant"; text: string }>;
}): SupportMessageUnderstanding {
  const picked = pickIntent(input);

  if (!picked) {
    return {
      intent: "unknown",
      confidence: 0.3,
      learnerGoal: "The learner's message needs normal support interpretation.",
      responseGuidance: "Use the full message and conversation context; do not react to one isolated keyword.",
      primaryRouteIds: [],
      requiredDetails: null,
      fallbackAnswer: null
    };
  }

  const { intent, score, fromContext } = picked;
  return {
    intent: intent.id,
    confidence: Number(score.toFixed(2)),
    learnerGoal: fromContext ? `Follow-up to previous topic: ${intent.goal}` : intent.goal,
    responseGuidance: fromContext
      ? "Answer as a continuation of the previous topic without restarting the conversation."
      : "Answer the learner's actual goal, not isolated words.",
    primaryRouteIds: routeIdsFor(intent, input.role),
    requiredDetails: intent.requiredDetails,
    fallbackAnswer: responseFor(intent, input.role, picked.fromContext)
  };
}

export function resolveUnderstandingActions(input: {
  understanding: SupportMessageUnderstanding;
  role: AccountAccessRole;
}): SafeChatLink[] {
  return routeLinks(input.role, input.understanding.primaryRouteIds);
}
