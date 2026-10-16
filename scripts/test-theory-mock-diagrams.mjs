import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/components/theory-test-suite.tsx", import.meta.url), "utf8");
const visualQuestionCount = (source.match(/visual:\s*"/g) ?? []).length;

assert.ok(
  visualQuestionCount >= 25,
  `Mock theory bank must keep broad visual-question coverage. Found ${visualQuestionCount} visual questions.`
);

assert.match(
  source,
  /question:\s*"Look at the diagram\. Which vehicle has priority\?"/,
  "Priority diagram question must use priority wording, not informal go-first wording."
);

assert.doesNotMatch(
  source,
  /normally go first|should normally go first/i,
  "Mock theory questions must not use informal normally-go-first wording."
);

assert.doesNotMatch(
  source,
  />\s*(Road sign|Instruction sign|Restriction sign|Maximum speed)\s*</,
  "Road-sign diagrams must not include fake placeholder labels under the sign."
);

assert.match(
  source,
  /circle cx="193" cy="42" r="18" fill="#facc15"/,
  "Zebra crossing diagram must include Belisha beacon styling."
);

assert.match(
  source,
  /polygon points="320,300 170,64 470,64" fill="#dc2626"/,
  "Give-way diagram must use a crisp standard inverted-triangle sign shape."
);

assert.match(
  source,
  /M382 96 L260 218/,
  "Keep-left sign must use a clear diagonal down-left mandatory arrow."
);

assert.match(
  source,
  /M334 181 h16 l18 -30 h50 l22 30 h16 v35 H334 Z" fill="#dc2626"/,
  "No-overtaking sign must show the standard black and red vehicle pairing."
);

assert.match(
  source,
  /circle cx="266" cy="151" r="23" fill="none" stroke="#111827" strokeWidth="11"/,
  "No-motor-vehicles sign must include a recognisable motorcycle symbol."
);

assert.match(
  source,
  /const MOCK_TEST_DIAGRAM_COUNT = 12;/,
  "Every 50-question mock must reserve a substantial number of diagram questions."
);

assert.match(
  source,
  /const diagramBank = uniqueByQuestionId\(mockQuestionBank\.filter\(\(question\) => question\.visual\)\);/,
  "Mock session builder must draw from the visual question bank deliberately."
);

assert.match(
  source,
  /interleaveDiagramQuestions\(textQuestions, diagramQuestions\)/,
  "Diagram questions must be spread through the mock instead of left to random chance."
);

assert.doesNotMatch(
  source,
  />\s*Diagram question\s*<|UK road sign and road-marking practice diagram|LDA-original question|Original LDA practice artwork/i,
  "Mock question diagrams must not show practice/source labels inside the active test surface."
);

assert.doesNotMatch(
  source,
  /Theory preparation:|Learner practice:|Practice scenario:|Safe-driving check:/i,
  "Generated mock question variants must not expose prep/training labels in question wording."
);

assert.doesNotMatch(
  source,
  /\{currentMockQuestion\.topic\}|\{reviewQuestion\.topic\}/,
  "Internal question topics must not be printed below mock questions."
);

console.log("Theory mock diagram checks passed.");
