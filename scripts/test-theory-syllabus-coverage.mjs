import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/components/theory-test-suite.tsx", import.meta.url), "utf8");

const expectedTopics = [
  "Safety and your vehicle",
  "Alertness",
  "Vehicle loading",
  "Road and traffic signs",
  "Vehicle handling",
  "Safety margins",
  "Attitude",
  "Hazard awareness",
  "Rules of the road",
  "Vulnerable road users",
  "Other types of vehicle",
  "Motorway rules",
  "Incidents, accidents and emergencies",
  "Documents",
];

let previousTopicIndex = -1;

for (const topic of expectedTopics) {
  const topicIndex = source.indexOf(`title: "${topic}"`);

  assert.ok(
    topicIndex > previousTopicIndex,
    `${topic} must appear in learner study order based on the first relevant official Highway Code rule/reference.`
  );

  previousTopicIndex = topicIndex;

  assert.match(
    source,
    new RegExp(`title:\\s*"${topic.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`),
    `Theory Centre preparation coverage must include ${topic}.`
  );

  const sectionPattern = new RegExp(
    `title:\\s*"${topic.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[\\s\\S]*?officialSources:\\s*\\[[\\s\\S]*?quizTopics:\\s*\\[`,
    "m"
  );
  assert.match(
    source,
    sectionPattern,
    `${topic} must include an official reading source and topic quiz mapping.`
  );
}

const baseQuestions = Array.from(source.matchAll(/\{ topic: "([^"]+)", question: "([^"]+)"/g)).map(
  (match) => ({ topic: match[1], question: match[2] })
);
const knowledgeSections = Array.from(
  source.matchAll(/title: "([^"]+)",[\s\S]*?quizTopics: \[([^\]]+)\]/g)
).map((match) => ({
  title: match[1],
  quizTopics: Array.from(match[2].matchAll(/"([^"]+)"/g)).map((topicMatch) => topicMatch[1]),
}));

for (const section of knowledgeSections) {
  const quizTopicNames = section.quizTopics.map((topic) => topic.toLowerCase());
  const matchingQuestions = baseQuestions.filter((question) => {
    const questionTopic = question.topic.toLowerCase();
    return quizTopicNames.some(
      (quizTopic) => questionTopic === quizTopic || questionTopic.includes(quizTopic) || quizTopic.includes(questionTopic)
    );
  });
  const uniqueLearningPoints = new Set(matchingQuestions.map((question) => `${question.topic}::${question.question}`));

  assert.ok(
    uniqueLearningPoints.size >= 20,
    `${section.title} must have at least 20 unique topic quiz learning points before generated variants are used.`
  );
}

assert.match(
  source,
  /full 14-topic DVSA-style syllabus/,
  "Theory mock standard copy must state that coverage is the full 14-topic syllabus."
);

assert.doesNotMatch(
  source,
  /const knowledgeSections = \[[\s\S]*Highway Code essentials[\s\S]*Traffic lights[\s\S]*Dangers on the road[\s\S]*Vehicle handling and safety/,
  "Theory preparation must not present the old six-card summary as the full syllabus."
);

assert.match(
  source,
  /Start learning/,
  "Each theory topic card must expose a Start learning action."
);

assert.match(
  source,
  /Take quiz/,
  "Each theory topic card must expose a Take quiz action."
);

assert.match(
  source,
  /DfT Know Your Traffic Signs PDF/,
  "Road and traffic signs must point learners to the official DfT traffic signs source."
);

assert.match(
  source,
  /getPrimaryOfficialSource\(section\)\.url/,
  "Start learning must send learners directly to one official topic source, not an intermediate link list."
);

assert.match(
  source,
  /setActiveView\("topic-quiz"\)/,
  "Take quiz must open the separate Get Ready topic quiz experience instead of the Mock Theory Test view."
);

assert.doesNotMatch(
  source,
  /function startTopicPractice[\s\S]*setActiveView\("mock"\)/,
  "Topic quizzes must not send learners into the Mock Theory Test tab."
);

assert.match(
  source,
  /activeView === "topic-quiz" && key === "prepare"/,
  "The Get Ready for Theory tab must remain active while a topic quiz is running."
);

assert.match(
  source,
  /buildTopicPracticeQuestions/,
  "Theory Centre must support focused topic practice quizzes."
);

assert.match(
  source,
  /const TOPIC_PRACTICE_SIZE = 10;/,
  "Topic quizzes may use up to 10 questions per attempt."
);

assert.match(
  source,
  /const TOPIC_PRACTICE_MIN_SIZE = 5;/,
  "Topic quizzes must have a five-question base size when enough unique topic questions exist."
);

assert.match(
  source,
  /uniqueByLearningPoint/,
  "Topic quizzes must remove rewritten variants of the same underlying learning point."
);

assert.match(
  source,
  /TOPIC_HISTORY_KEY_PREFIX/,
  "Topic quizzes must keep per-topic question history so repeated attempts rotate through unused questions first."
);

assert.match(
  source,
  /restartCycle/,
  "Topic quiz history must restart cleanly when a topic's unused question pool is exhausted."
);

assert.match(
  source,
  /function getTopicPracticeSize\(topicBankSize: number\)/,
  "Topic quizzes must choose a dynamic quiz size based on each topic's unique question bank."
);

assert.doesNotMatch(
  source,
  /function buildTopicPracticeQuestions[\s\S]*return spreadQuestionsByTopic\(uniqueByQuestionId\(mockQuestionBank\)\)\.slice\(0, TOPIC_PRACTICE_SIZE\);/,
  "Topic quizzes must not pad weak topics with fallback full-bank questions."
);

assert.match(
  source,
  /const TOPIC_PRACTICE_SECONDS = 5 \* 60;/,
  "Topic quizzes must use a short five-minute timer, not the full mock theory test timer."
);

assert.match(
  source,
  /setTimer\(options\?\.topicTitle \? TOPIC_PRACTICE_SECONDS : MOCK_TEST_SECONDS\)/,
  "Topic quizzes and full mock tests must use separate timers."
);

assert.match(
  source,
  /Math\.ceil\(mockQuestionCount \* 0\.75\)/,
  "Topic quizzes must use a 75% confidence threshold before moving on."
);

assert.match(
  source,
  /Review before moving on/,
  "Topic quiz results must show targeted review guidance for missed questions."
);

console.log("Theory syllabus coverage checks passed.");
