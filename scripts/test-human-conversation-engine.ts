import assert from "node:assert/strict";
import { ldaAiGreeting } from "../src/lib/lda-ai-conversation-rules";
import {
  conciseFallbackAnswer,
  selectRelevantSupportActions,
  shouldExposeSupportActions,
  validateHumanConversationResponse
} from "../src/lib/lda-human-conversation-engine";

assert.equal(ldaAiGreeting, "Hi, welcome to L Driving Academy. How can I help today?");

const verboseAnswer = Array.from({ length: 105 }, (_, index) => `word${index}`).join(" ");
const verbose = validateHumanConversationResponse({
  answer: verboseAnswer,
  latestMessage: "How do I book?",
  conversation: [],
  category: "booking",
  priority: "standard"
});
assert.ok(verbose.violations.includes("long_reply"), "Overly long replies must be blocked.");

const featureDump = validateHumanConversationResponse({
  answer: "You can use Smart Match, Book On Demand, Find Instructor, the learner dashboard, payment help, and booking history.",
  latestMessage: "I need help logging in.",
  conversation: [],
  category: "account",
  priority: "standard"
});
assert.ok(featureDump.violations.includes("feature_dump"), "Unasked route lists must be blocked.");

const repeatedUser = validateHumanConversationResponse({
  answer: "Your payment went through but your lesson is missing and the booking is not showing.",
  latestMessage: "My payment went through but my lesson is missing and the booking is not showing.",
  conversation: [],
  category: "payment",
  priority: "standard"
});
assert.ok(repeatedUser.violations.includes("repetition"), "Repeating the user's wording must be blocked.");

const repeatedAssistant = validateHumanConversationResponse({
  answer: "Open payment help and check whether the payment is attached to a booking.",
  latestMessage: "Still stuck",
  conversation: [
    { role: "assistant", text: "Open payment help and check whether the payment is attached to a booking." }
  ],
  category: "payment",
  priority: "standard"
});
assert.ok(repeatedAssistant.violations.includes("repetition"), "Repeating the assistant's last answer must be blocked.");

const prematureEscalation = validateHumanConversationResponse({
  answer: "I will create a ticket for the technical team now.",
  latestMessage: "How do I find my dashboard?",
  conversation: [],
  category: "general",
  priority: "standard"
});
assert.ok(prematureEscalation.violations.includes("premature_escalation"), "Tickets must not be offered before real failure.");

const earnedEscalation = validateHumanConversationResponse({
  answer: "I can create a ticket for the technical team now.",
  latestMessage: "I tried that and it still does not work.",
  conversation: [
    { role: "user", text: "My payment is missing" },
    { role: "assistant", text: "Please check payment help first." }
  ],
  category: "payment",
  priority: "standard"
});
assert.ok(!earnedEscalation.violations.includes("premature_escalation"), "Escalation should be allowed after a failed self-service step.");

const repeatedGreeting = validateHumanConversationResponse({
  answer: "Hi, welcome to L Driving Academy. How can I help today?",
  latestMessage: "Hi",
  conversation: [],
  category: "general",
  priority: "standard"
});
assert.ok(repeatedGreeting.violations.includes("repetition"), "The assistant must not repeat the welcome line after a user greeting.");

assert.equal(
  shouldExposeSupportActions({ message: "hello", category: "general", answer: "How can I help?", actionCount: 3 }),
  false,
  "General chat should not show action cards by default."
);
assert.equal(
  shouldExposeSupportActions({ message: "where do I book a lesson?", category: "general", answer: "Open the booking route.", actionCount: 1 }),
  true,
  "Relevant route questions can show action cards."
);

const fallback = conciseFallbackAnswer({
  fallbackAnswer: "Open payment help first and check the booking status. If the platform route does not solve it, LDA can review the context.",
  requiredDetails: ["booking reference, if one exists"],
  latestMessage: "My payment is missing"
});
assert.match(fallback, /What is the booking reference/);
assert.ok(fallback.split(/\s+/).length < 35, "Fallbacks must stay concise.");

assert.equal(
  conciseFallbackAnswer({
    fallbackAnswer: "Use the most relevant action below.",
    requiredDetails: [],
    latestMessage: "Hi"
  }),
  "How can I help you?",
  "A simple greeting after the visible welcome must not repeat the full welcome."
);

assert.equal(
  conciseFallbackAnswer({
    fallbackAnswer: "Use the most relevant action below.",
    requiredDetails: [],
    latestMessage: "I need help"
  }),
  "I can help with that. Tell me what you need help with.",
  "Fallbacks must not refer to hidden action cards."
);

assert.equal(
  conciseFallbackAnswer({
    fallbackAnswer: "Use the most relevant action below.",
    requiredDetails: [],
    latestMessage: "I'm stuck"
  }),
  "I can help. What are you stuck with?",
  "Vague help messages should ask one natural follow-up."
);

assert.match(
  conciseFallbackAnswer({
    fallbackAnswer: "Review the booking and cancellation policy before changing the lesson.",
    requiredDetails: ["booking reference, if one exists"],
    latestMessage: "How do I get a refund for a lesson?"
  }),
  /Refunds are handled through Payment Help/,
  "Refund fallbacks must explain the refund route instead of asking for a reference first."
);

assert.equal(
  conciseFallbackAnswer({
    fallbackAnswer: "You can book a lesson from the booking area in your learner dashboard. Use the button below and I will take you there.",
    requiredDetails: [],
    latestMessage: "Where do I book lessons?"
  }),
  "You can book a lesson from the booking area in your learner dashboard. Use the button below and I will take you there.",
  "Direct booking answers must not append a generic follow-up."
);

assert.equal(
  conciseFallbackAnswer({
    fallbackAnswer: "After that, choose the instructor or slot that suits you, check the lesson details, then continue to secure checkout.",
    requiredDetails: [],
    latestMessage: "How about after that?"
  }),
  "After that, choose the instructor or slot that suits you, check the lesson details, then continue to secure checkout.",
  "Contextual follow-up answers must not append a generic follow-up."
);

assert.deepEqual(
  selectRelevantSupportActions({
    message: "How do I get a refund for a lesson?",
    category: "payment",
    actions: [
      { label: "Learner calendar", href: "/learner-calendar?from=chat" },
      { label: "Booking history", href: "/booking-history?from=dashboard" },
      { label: "Payment help", href: "/support/learner/payment-help" }
    ]
  }),
  [{ label: "Payment help", href: "/support/learner/payment-help" }],
  "Refund questions should show only the Payment Help action."
);

assert.deepEqual(
  selectRelevantSupportActions({
    message: "Where do I book lessons?",
    category: "booking",
    actions: [
      { label: "Learner calendar", href: "/learner-calendar?from=chat" },
      { label: "Book a lesson", href: "/learner-dashboard?section=driving-lessons&from=chat#driving-lessons-booking" },
      { label: "Booking history", href: "/booking-history?from=dashboard" }
    ]
  }),
  [{ label: "Book a lesson", href: "/learner-dashboard?section=driving-lessons&from=chat#driving-lessons-booking" }],
  "New lesson booking questions should show only the booking action."
);

console.log("Human Conversation Engine tests passed.");
