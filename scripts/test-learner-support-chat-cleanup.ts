import assert from "assert";
import { readFileSync } from "fs";
import { join } from "path";
import { isNaturalUnresolvedSupportMessage } from "../src/lib/support-conversation-signals";

const root = process.cwd();

function read(relativePath: string) {
  return readFileSync(join(root, relativePath), "utf8");
}

const supportAssistant = read("src/components/support-assistant.tsx");
const supportRoute = read("src/app/api/support/assistant/route.ts");
const supportTools = read("src/lib/support-assistant-tools.ts");

for (const forbidden of [
  "LDA knowledge used",
  "Learner progress and lesson notes",
  "LDA policies, privacy and cookie choices",
  "I tried that and it did not solve it"
]) {
  assert(!supportAssistant.includes(forbidden), `Support chat must not render "${forbidden}"`);
  assert(!supportRoute.includes(forbidden), `Support API must not send "${forbidden}"`);
  assert(!supportTools.includes(forbidden), `Support tools must not expose "${forbidden}"`);
}

assert(
  !/knowledge:\s*knowledge\.map/.test(supportRoute),
  "Support API must not return retrieved knowledge metadata to the browser"
);
assert(!supportAssistant.includes("Platform status:"), "Support chat must not render platform status details.");

for (const phrase of [
  "That did not solve the problem",
  "That didn't work",
  "I've already tried that and it is still broken",
  "The problem still isn't fixed",
  "I still need help"
]) {
  assert(isNaturalUnresolvedSupportMessage(phrase), `Natural unresolved message was not recognised: ${phrase}`);
}

assert(!isNaturalUnresolvedSupportMessage("How do I open my learner dashboard?"));

console.log("Learner support chat cleanup tests passed.");
