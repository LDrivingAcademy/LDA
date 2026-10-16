import assert from "node:assert/strict";
import { hrefAllowedForAccount } from "../src/lib/chat-permissions";
import { classifySupportRequest, supportTicketReference } from "../src/lib/support-guidance";

const guest = classifySupportRequest({
  message: "I need help before I sign in",
  role: "visitor",
  hasBookingReference: false,
  hasContactEmail: false
});
assert.equal(guest.category, "account");
assert.equal(guest.priority, "standard");
assert.ok(!guest.requiredDetails.includes("email address for ticket updates"));
assert.ok(guest.actions.some((action) => action.href === "/auth/login?from=chat"));
assert.ok(guest.actions.some((action) => action.href === "/auth/sign-up?from=chat"));
assert.ok(guest.actions.every((action) => hrefAllowedForAccount(action.href, "visitor")));

const learnerPayment = classifySupportRequest({
  message: "My card payment went through but the lesson is missing",
  role: "learner",
  hasBookingReference: false,
  hasContactEmail: true
});
assert.equal(learnerPayment.category, "payment");
assert.ok(learnerPayment.requiredDetails.some((detail) => detail.includes("booking reference")));
assert.ok(learnerPayment.actions.every((action) => hrefAllowedForAccount(action.href, "learner")));

const learnerNewBooking = classifySupportRequest({
  message: "Where do I book lessons?",
  role: "learner",
  hasBookingReference: false,
  hasContactEmail: true
});
assert.equal(learnerNewBooking.category, "booking");
assert.equal(learnerNewBooking.requiredDetails.length, 0);
assert.equal(learnerNewBooking.actions[0]?.href, "/learner-dashboard?section=driving-lessons&from=chat#driving-lessons-booking");

const learnerRefund = classifySupportRequest({
  message: "How do I get a refund for a lesson?",
  role: "learner",
  hasBookingReference: false,
  hasContactEmail: true
});
assert.equal(learnerRefund.category, "payment");
assert.equal(learnerRefund.actions[0]?.href, "/support/learner/payment-help");

const instructorPayout = classifySupportRequest({
  message: "My Stripe payout is missing",
  role: "instructor",
  hasBookingReference: true,
  hasContactEmail: true
});
assert.equal(instructorPayout.category, "payout");
assert.ok(instructorPayout.actions.some((action) => action.href === "/instructor-finance"));
assert.ok(instructorPayout.actions.every((action) => hrefAllowedForAccount(action.href, "instructor")));

const offPlatform = classifySupportRequest({
  message: "The instructor asked me to pay cash over WhatsApp",
  role: "learner",
  hasBookingReference: true,
  hasContactEmail: true
});
assert.equal(offPlatform.category, "off_platform");
assert.equal(offPlatform.priority, "urgent");
assert.ok(offPlatform.riskFlags.includes("off_platform_payment"));

const criticalSafety = classifySupportRequest({
  message: "I have crashed and someone is injured now",
  role: "learner",
  hasBookingReference: true,
  hasContactEmail: true
});
assert.equal(criticalSafety.category, "safety");
assert.equal(criticalSafety.priority, "critical");
assert.match(criticalSafety.fallbackAnswer, /emergency services/i);

assert.equal(supportTicketReference(42), "LDA-S-000042");

console.log("Support guidance tests passed.");
