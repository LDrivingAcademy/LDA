import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const rules = read("src/lib/lda-ai-conversation-rules.ts");
const supportComponent = read("src/components/support-assistant.tsx");
const homepageComponent = read("src/components/homepage-ai-assistant.tsx");
const supportRoute = read("src/app/api/support/assistant/route.ts");
const englishMessages = read("src/lib/i18n/messages/en-GB.ts");

assert.match(englishMessages, /Hi, welcome to L Driving Academy\. How can I help today\?/);
assert.match(rules, /getEnglishMessage\("ai\.greeting"\)/);
assert.match(rules, /Do not list every possible feature or route|Do not list features, routes, policies, or support options/);
assert.match(rules, /Ask at most one follow-up question/);
assert.match(rules, /Remember details already provided/);
assert.match(rules, /Surface action buttons only when they directly match the user's need/);
assert.match(rules, /Do not mention tickets or escalation in normal guidance/);
assert.match(rules, /progressive disclosure/i);
assert.match(rules, /humaniseRequiredDetails/);
assert.match(rules, /humaniseFallbackAnswer/);

assert.match(supportComponent, /ldaAiGreeting/);
assert.doesNotMatch(supportComponent, /Tell me what happened with your lesson/);
assert.doesNotMatch(supportComponent, /Useful starting points[\s\S]{0,260}quickActionsByAudience/);
assert.match(supportComponent, /const source = guide \? \[\.\.\.guide\.actions, \.\.\.\(guide\.navigation \?\? \[\]\)\] : \[\]/);

assert.match(homepageComponent, /ldaAiGreeting/);
assert.doesNotMatch(homepageComponent, /I can point you to the right LDA route/);
assert.doesNotMatch(homepageComponent, /starterMessage[\s\S]{0,120}actions: primaryActions/);

assert.match(supportRoute, /ldaAiHumanFirstInstructions/);
assert.match(supportRoute, /recentUserFacts/);
assert.match(supportRoute, /One follow-up allowed if needed/);
assert.match(supportRoute, /humanRequiredDetails/);
assert.match(supportRoute, /humaniseFallbackAnswer/);
assert.match(supportRoute, /validateHumanConversationResponse/);
assert.match(supportRoute, /shouldExposeSupportActions/);
assert.doesNotMatch(supportRoute, /Details still useful/);
assert.doesNotMatch(supportRoute, /\.\.\.classification\.requiredDetails\.slice\(0,\s*2\)/);

console.log("Human-first AI behaviour checks passed.");
