import assert from "node:assert/strict";
import {
  buildKnowledgeLinks,
  buildNavigationIndex,
  buildSupportHandoff,
  summariseAssistantMemory,
  suggestSupportNavigation,
  supportTicketOps,
  type SupportKnowledgeArticle
} from "../src/lib/support-assistant-tools";

const articles: SupportKnowledgeArticle[] = [
  {
    slug: "payment-help",
    title: "Payment help",
    summary: "Payment guidance",
    body: "Open payment help.",
    category: "payment",
    routeHref: "/support/learner/payment-help",
    actionLabel: "Open payment help"
  },
  {
    slug: "restricted-admin",
    title: "Restricted admin",
    summary: "Should never be shown",
    body: "Admin only.",
    category: "technical",
    routeHref: "/admin",
    actionLabel: "Open admin"
  }
];

const links = buildKnowledgeLinks(articles, [
  { label: "Payment help", href: "/support/learner/payment-help" }
]);

assert.deepEqual(links, [{ label: "Open payment help", href: "/support/learner/payment-help" }]);

const learnerNavigation = suggestSupportNavigation({
  message: "I need payment help and my booking is missing",
  role: "learner",
  existingActions: []
});
assert.ok(learnerNavigation.some((link) => link.href === "/support/learner/payment-help" || link.href === "/support/learner"));
assert.ok(!learnerNavigation.some((link) => link.href.startsWith("/admin")));

const adminNavigation = buildNavigationIndex("admin");
assert.ok(adminNavigation.some((route) => route.href === "/technical-support"));
assert.ok(!adminNavigation.some((route) => route.href === "/learner-dashboard?from=chat"));
assert.ok(!adminNavigation.some((route) => route.href.startsWith("/admin")));

const paymentOps = supportTicketOps({
  category: "payment",
  priority: "urgent",
  serviceStatus: { available: true, status: "ok", summary: "OK" }
});
assert.equal(paymentOps.category, "payments");
assert.equal(paymentOps.severity, "sev2_high");
assert.equal(paymentOps.assignedTeam, "finance");

const serviceOps = supportTicketOps({
  category: "technical",
  priority: "standard",
  serviceStatus: { available: true, status: "degraded", summary: "Degraded" }
});
assert.equal(serviceOps.category, "website_error");
assert.equal(serviceOps.severity, "sev3_medium");
assert.equal(serviceOps.assignedTeam, "technical_support");

const safetyOps = supportTicketOps({
  category: "safety",
  priority: "critical",
  serviceStatus: { available: false, status: "unknown", summary: "Unknown" }
});
assert.equal(safetyOps.category, "safeguarding");
assert.equal(safetyOps.severity, "sev1_critical");
assert.equal(safetyOps.assignedTeam, "safeguarding");

const summary = summariseAssistantMemory({
  previousSummary: "Previous booking issue.",
  latestUserMessage: "My payment went through but the lesson is missing.",
  latestAnswer: "Open payment help and check the booking reference.",
  category: "payment",
  priority: "urgent"
});
assert.match(summary, /Previous booking issue/);
assert.match(summary, /payment\/urgent/);
assert.ok(summary.length <= 1000);

const handoff = buildSupportHandoff({
  category: "payment",
  priority: "urgent",
  categoryLabel: "Payment help",
  userMessage: "My card was charged but the lesson is missing.",
  assistantAnswer: "Open payment help, check the reference, and do not share full card details.",
  requiredDetails: ["booking reference", "payment date"],
  knowledge: [articles[0]],
  serviceStatus: { available: true, status: "ok", summary: "Latest LDA service health is OK." },
  ops: paymentOps
});
assert.equal(handoff.intent, "payment");
assert.equal(handoff.category, "payments");
assert.equal(handoff.severity, "sev2_high");
assert.match(handoff.likelyDiagnosis, /payment/i);
assert.ok(handoff.troubleshootingDone.some((item) => item.includes("Searched knowledge base")));
assert.ok(handoff.suggestedNextSteps.some((item) => item.includes("transcript")));
assert.match(handoff.summary, /Payment help/);

console.log("Support assistant tool tests passed.");
