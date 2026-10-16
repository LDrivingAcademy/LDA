import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveUnderstandingActions, understandSupportMessage } from "../src/lib/support-message-understanding";

const bookingQuestions = [
  "Where do I book lessons?",
  "How do I book a lesson?",
  "Can I arrange another driving lesson?",
  "I want to book my next lesson.",
  "Where is the booking page?",
  "Can you take me to the lesson booking area?",
  "How can I find an instructor and book?",
  "wher do i bok lesons"
];

for (const message of bookingQuestions) {
  const understanding = understandSupportMessage({ message, role: "learner" });

  assert.notEqual(
    understanding.intent,
    "booking_problem",
    `${message} must not be treated as an existing-booking problem.`
  );
  assert.equal(understanding.requiredDetails?.length ?? 0, 0, `${message} must not request a booking reference.`);

  const actions = resolveUnderstandingActions({ understanding, role: "learner" });
  assert.ok(actions.length >= 1, `${message} should offer a useful booking route.`);
  assert.ok(
    actions[0].href.includes("driving-lessons-booking") || actions[0].href.includes("sign-up"),
    `${message} should route to lesson booking or learner sign-up.`
  );
}

const bookingProblem = understandSupportMessage({
  message: "My booking is missing from my dashboard",
  role: "learner"
});
assert.equal(bookingProblem.intent, "booking_problem");

const visitorBookingProblem = understandSupportMessage({
  message: "My booking is missing from my dashboard",
  role: "visitor"
});
assert.equal(visitorBookingProblem.intent, "booking_problem");
assert.match(visitorBookingProblem.fallbackAnswer ?? "", /sign in/i);
assert.deepEqual(
  resolveUnderstandingActions({ understanding: visitorBookingProblem, role: "visitor" }).map((action) => action.label),
  ["Log in", "Create an account"]
);

const guestBooking = understandSupportMessage({
  message: "Where do I book lessons?",
  role: "visitor"
});
assert.equal(guestBooking.intent, "new_lesson_booking");
assert.match(guestBooking.fallbackAnswer ?? "", /learner account/i);

const contextualFollowUp = understandSupportMessage({
  message: "How about after that?",
  role: "learner",
  conversation: [
    { role: "user", text: "Where do I book lessons?" },
    {
      role: "assistant",
      text: "You can book a lesson from the booking area in your learner dashboard."
    }
  ]
});
assert.equal(contextualFollowUp.intent, "new_lesson_booking");
assert.match(contextualFollowUp.fallbackAnswer ?? "", /checkout/i);
assert.equal(contextualFollowUp.requiredDetails?.length ?? 0, 0);

const assistantRouteSource = readFileSync("src/app/api/support/assistant/route.ts", "utf8");
assert.match(
  assistantRouteSource,
  /LDA_SUPPORT_AI_PROVIDER\s*===\s*"openai"/,
  "Paid AI providers must stay opt-in so the free local assistant remains the default."
);
assert.match(
  assistantRouteSource,
  /semanticRouteMatch[\s\S]+candidateActions\s*=\s*semanticRouteMatch\s*\?\s*understandingActions/,
  "Confident semantic matches must own their action buttons instead of mixing in generic route suggestions."
);

console.log("Support message understanding tests passed.");
