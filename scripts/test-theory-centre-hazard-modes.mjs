import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const suite = readFileSync(new URL("../src/components/theory-test-suite.tsx", import.meta.url), "utf8");
const legacy = readFileSync(new URL("../src/components/legacy-hazard-practice.tsx", import.meta.url), "utf8");
const source = `${suite}\n${legacy}`;
const theoryPage = readFileSync(new URL("../src/app/theory-test/page.tsx", import.meta.url), "utf8");

assert.match(suite, /dynamic\(\(\) => import\("@\/components\/legacy-hazard-practice"\)/);
assert.match(suite, /!hazardVideoEnabled\s*\?\s*<LegacyHazardPractice active=\{activeView === "hazard"\}/);
assert.doesNotMatch(suite, /const hazardScenarios|function getWindowScore|function getHazardScores|function hasClickPattern/);
assert.match(legacy, /export function LegacyHazardPractice/);
assert.match(legacy, /const activeView = active \? "hazard" : "prepare"/);

assert.match(
  suite,
  /key:\s*"hazard", label:\s*"Mock Hazard Perception"/,
  "Theory Centre navigation must label the hazard tab as Mock Hazard Perception."
);

assert.match(
  source,
  /label:\s*"Mock theory test"/,
  "Theory Centre navigation must label the multiple-choice mock tab as Mock theory test."
);

assert.match(
  source,
  /Mock Test Mode/,
  "Hazard awareness must include a clear Mock Test Mode section."
);

assert.match(
  source,
  /Mock Hazard Awareness Test/,
  "The 14-clip route must be presented as a Mock Hazard Awareness Test."
);

assert.match(
  source,
  /Practice Mode/,
  "Hazard awareness must include Practice Mode for individual clip-bank practice."
);

assert.match(
  source,
  /Clip Bank lets learners practise one clip at a time/,
  "Practice Mode must explain the individual clip-bank flow."
);

assert.match(
  source,
  /Weak Area Mode/,
  "Hazard awareness must include Weak Area Mode."
);

assert.match(
  source,
  /buildWeakAreaRecommendations/,
  "Weak Area Mode must be backed by score-based recommendations, not static copy only."
);

assert.match(
  source,
  /xl:grid-cols-\[280px_minmax\(0,1fr\)\]/,
  "Hazard awareness must prioritise a larger practice video area over side panels on desktop."
);

assert.match(
  source,
  /isHazardClipComplete \? \([\s\S]*Show answer/,
  "Show answer must only be offered after the practice clip has completed."
);

assert.match(
  source,
  /isHazardClipComplete \? \([\s\S]*Next clip/,
  "Next clip must only be offered after the practice clip has completed."
);

assert.doesNotMatch(
  source,
  />\s*Pause\s*</,
  "Practice clips must not expose a pause control."
);

assert.match(
  theoryPage,
  /<PageTopBar[\s\S]*account=\{account\}/,
  "Theory Centre must use the shared account-aware menu header."
);

assert.doesNotMatch(
  source,
  /> DVSA-style test/,
  "The visible hazard mode card must not use the old DVSA-style test heading."
);

assert.doesNotMatch(
  source,
  /Start full hazard test/,
  "The visible full-test button must not use the old Start full hazard test wording."
);

console.log("Theory Centre hazard mode checks passed.");
