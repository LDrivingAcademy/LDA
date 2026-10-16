import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  defaultSmartMatchPreferences,
  normaliseSmartMatchPreferences
} from "../src/lib/smart-match-preferences";

const defaults = defaultSmartMatchPreferences();

assert.deepEqual(defaults.learningPreferences, [], "Smart Match learning preferences must start empty.");
assert.deepEqual(defaults.accessibilityNeeds, [], "Smart Match support/accessibility preferences must start empty.");

const emptySelections = normaliseSmartMatchPreferences({
  ...defaults,
  learningPreferences: [],
  accessibilityNeeds: []
});

assert.deepEqual(emptySelections.learningPreferences, [], "Normalising must preserve no learning preferences.");
assert.deepEqual(emptySelections.accessibilityNeeds, [], "Normalising must preserve no support preferences.");

const selectedPreferences = normaliseSmartMatchPreferences({
  ...defaults,
  learningPreferences: ["step-by-step", "step-by-step", "visual examples"],
  accessibilityNeeds: ["calm support", "calm support", "low distraction"]
});

assert.deepEqual(selectedPreferences.learningPreferences, ["step-by-step", "visual examples"], "Normalising should keep chosen learning preferences without duplicates.");
assert.deepEqual(selectedPreferences.accessibilityNeeds, ["calm support", "low distraction"], "Normalising should keep chosen support preferences without duplicates.");

const accountEditor = readFileSync(new URL("../src/components/account-smart-match-preferences.tsx", import.meta.url), "utf8");
const smartMatchWizard = readFileSync(new URL("../src/components/smart-match-experience.tsx", import.meta.url), "utf8");

assert.match(accountEditor, /setPreferences\(defaultSmartMatchPreferences\(\)\)/, "Account Centre reset must use the blank Smart Match defaults.");
assert.match(accountEditor, /isSelected \? "border-brand bg-brand text-white"/, "Account Centre selected preference pills must render as red.");
assert.match(smartMatchWizard, /useState<SmartMatchInput>\(\(\) => defaultSmartMatchPreferences\(\)\)/, "Smart Match wizard must start from the shared blank preference defaults.");

console.log("Smart Match preference defaults and empty selections verified.");
