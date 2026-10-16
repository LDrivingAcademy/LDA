import { ldaAiGreeting } from "@/lib/lda-ai-conversation-rules";

type ConversationMessage = {
  role: "user" | "assistant";
  text: string;
};

export type HumanConversationViolation =
  | "long_reply"
  | "feature_dump"
  | "repetition"
  | "premature_escalation";

export type HumanConversationValidation = {
  ok: boolean;
  answer: string;
  violations: HumanConversationViolation[];
};

const platformTerms = [
  "Smart Match",
  "Book On Demand",
  "Find Instructor",
  "learner dashboard",
  "instructor dashboard",
  "payment help",
  "technical support",
  "account centre",
  "calendar",
  "booking history"
];

const escalationPattern = /\b(ticket|escalat\w*|technical team|support team will|case reference|human agent|raise this)\b/i;
const unresolvedPattern = /\b(still|tried|didn'?t work|doesn'?t work|not fixed|not working|same issue|failed again|no luck)\b/i;
const greetingPattern = /^\s*(hi|hello|hey|hiya|good morning|good afternoon|good evening)\s*[.!?]*\s*$/i;
const vagueHelpPattern = /^\s*(i'?m\s+)?(stuck|lost|confused|need help|help|not sure)\s*[.!?]*\s*$/i;
const refundPattern = /\b(refund|money back|charged.*back|cancelled.*paid|paid.*cancelled)\b/i;
const newBookingPattern = /\b(where|how|can i|i want|i need|take me|show me|open|start|book|arrange|next lesson|driving lesson|booking page|booking area)\b/i;
const existingBookingProblemPattern = /\b(missing|not showing|not there|wrong|problem|issue|pending|confirmed|changed|cancelled|late|failed|reference|history)\b/i;

function words(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2);
}

function sentenceParts(value: string) {
  return value.split(/[.!?]\s+/).map((part) => part.trim()).filter(Boolean);
}

function countAskedPlatformTerms(answer: string, message: string) {
  const lowerAnswer = answer.toLowerCase();
  const lowerMessage = message.toLowerCase();

  return platformTerms.filter((term) => {
    const lowerTerm = term.toLowerCase();
    return lowerAnswer.includes(lowerTerm) && !lowerMessage.includes(lowerTerm);
  }).length;
}

function repeatsUser(answer: string, latestMessage: string) {
  const answerWords = new Set(words(answer));
  const userWords = words(latestMessage);
  if (userWords.length < 6) return false;

  const repeated = userWords.filter((word) => answerWords.has(word));
  return repeated.length / userWords.length > 0.72;
}

function repeatsAssistant(answer: string, conversation: ConversationMessage[]) {
  const previousAssistantText = conversation
    .filter((message) => message.role === "assistant")
    .slice(-3)
    .map((message) => message.text)
    .join(" ");

  if (!previousAssistantText) return false;

  return sentenceParts(answer).some((sentence) => sentence.length > 35 && previousAssistantText.includes(sentence));
}

export function shouldExposeSupportActions(input: {
  message: string;
  category: string;
  answer: string;
  actionCount: number;
}) {
  if (input.actionCount < 1) return false;
  if (greetingPattern.test(input.message) || vagueHelpPattern.test(input.message)) return false;
  if (input.category !== "general") {
    return /\b(open|go to|click|button|page|process|refund|receipt|invoice|booking|book|lesson|dashboard|payment|calendar|track|report|submit|start)\b/i.test(
      `${input.message} ${input.answer}`
    );
  }

  return /\b(open|go to|where|route|page|dashboard|book|payment|calendar|support|find|smart match|lesson)\b/i.test(
    `${input.message} ${input.answer}`
  );
}

export function selectRelevantSupportActions(input: {
  message: string;
  category: string;
  actions: Array<{ label: string; href: string }>;
}) {
  if (!input.actions.length) return [];
  if (greetingPattern.test(input.message) || vagueHelpPattern.test(input.message)) return [];

  const lowerMessage = input.message.toLowerCase();
  const ranked = [...input.actions].sort((first, second) => {
    const firstValue = `${first.label} ${first.href}`.toLowerCase();
    const secondValue = `${second.label} ${second.href}`.toLowerCase();
    const score = (value: string) => {
      let total = 0;
      const looksLikeNewBooking = newBookingPattern.test(lowerMessage) && !existingBookingProblemPattern.test(lowerMessage);
      if (looksLikeNewBooking && (value.includes("driving-lessons-booking") || value.includes("book a lesson"))) total += 100;
      if (refundPattern.test(lowerMessage) && value.includes("payment-help")) total += 100;
      if (/\b(receipt|invoice|payment|card|charge|refund)\b/i.test(lowerMessage) && value.includes("payment")) total += 70;
      if (/\b(calendar|reschedule|schedule|lesson day|booking)\b/i.test(lowerMessage) && value.includes("calendar")) total += 60;
      if (/\b(history|reference|past|completed)\b/i.test(lowerMessage) && value.includes("booking-history")) total += 55;
      if (/\bsmart match|match\b/i.test(lowerMessage) && value.includes("smart-match")) total += 55;
      if (/\boff[- ]?platform|cash|whatsapp|bank transfer\b/i.test(lowerMessage) && value.includes("off-platform")) total += 80;
      if (input.category === "payment" && value.includes("payment-help")) total += 45;
      if (input.category === "cancellation" && value.includes("cancellation-policy")) total += 35;
      return total;
    };
    return score(secondValue) - score(firstValue);
  });

  const wantsSeveral =
    /\b(options|choices|pages|routes|what can i use|where can i go|show me)\b/i.test(input.message) ||
    input.category === "general";
  return ranked.slice(0, wantsSeveral ? 3 : 1);
}

export function validateHumanConversationResponse(input: {
  answer: string;
  latestMessage: string;
  conversation: ConversationMessage[];
  category: string;
  priority: "standard" | "urgent" | "critical";
}) {
  const answer = input.answer.trim();
  const violations: HumanConversationViolation[] = [];
  const wordCount = words(answer).length;
  const paragraphCount = answer.split(/\n{2,}/).filter((part) => part.trim()).length;

  if (wordCount > 95 || paragraphCount > 3) {
    violations.push("long_reply");
  }

  if (countAskedPlatformTerms(answer, input.latestMessage) > 2 || /\bhere are (all|some) (the )?(options|features|things)\b/i.test(answer)) {
    violations.push("feature_dump");
  }

  if (repeatsUser(answer, input.latestMessage) || repeatsAssistant(answer, input.conversation)) {
    violations.push("repetition");
  }
  if (greetingPattern.test(input.latestMessage) && /\bwelcome to L Driving Academy\b/i.test(answer)) {
    violations.push("repetition");
  }

  const escalationAllowed =
    input.priority === "critical" ||
    input.category === "safety" ||
    input.category === "off_platform" ||
    input.conversation.filter((message) => message.role === "user").length >= 2 ||
    unresolvedPattern.test(input.latestMessage);

  if (escalationPattern.test(answer) && !escalationAllowed) {
    violations.push("premature_escalation");
  }

  return {
    ok: violations.length === 0,
    answer,
    violations
  } satisfies HumanConversationValidation;
}

export function conciseFallbackAnswer(input: {
  fallbackAnswer: string;
  requiredDetails: string[];
  latestMessage?: string;
}) {
  if (input.latestMessage && greetingPattern.test(input.latestMessage)) {
    return "How can I help you?";
  }

  if (input.latestMessage && vagueHelpPattern.test(input.latestMessage)) {
    return "I can help. What are you stuck with?";
  }

  if (input.latestMessage && refundPattern.test(input.latestMessage)) {
    return "Refunds are handled through Payment Help. Open the lesson payment record, choose the refund option, and LDA will show whether it can be processed automatically or needs review.";
  }

  const [firstSentence] = input.fallbackAnswer.split(/(?<=[.!?])\s+/);
  const detail = input.requiredDetails[0];
  const base = firstSentence?.trim() || "I can help with that.";
  const answerBase = /\b(action below|options below|routes below)\b/i.test(base) ? "I can help with that." : base;

  if (!detail) {
    if (
      /\b(use the button below|i can take you|from the booking area|handled through Payment Help|create or sign in|choose a future lesson|continue into lesson booking|after that)\b/i.test(
        input.fallbackAnswer
      )
    ) {
      return input.fallbackAnswer.trim();
    }
    return `${answerBase} Tell me what you need help with.`;
  }

  return `${answerBase} What is the ${detail}?`;
}
