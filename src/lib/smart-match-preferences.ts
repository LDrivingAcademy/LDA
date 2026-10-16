import type { SmartMatchInput } from "@/lib/smart-match";

export const SMART_MATCH_SESSION_DRAFT_KEY = "lda:smart-match-draft:v3";
export const SMART_MATCH_LEGACY_DRAFT_KEY = "lda:smart-match-draft:v2";
export const SMART_MATCH_HANDOFF_KEY = "lda:smart-match-context:v1";

const allowedTransmissions = new Set(["automatic", "manual"]);
const allowedAvailability = new Set(["book-now", "today", "later", "asap", "weekdays", "evenings", "weekends", "flexible"]);
const allowedBookingPaths = new Set(["on-demand", "book-lesson", "schedule-lesson"]);
const allowedConfidence = new Set(["nervous", "some", "confident"]);
const allowedLessonStages = new Set(["new", "test-soon", "refresher", "post-pass", "returning"]);

function safeText(value: unknown, fallback = "", maxLength = 160) {
  const text = typeof value === "string" ? value.trim() : fallback;
  return text.slice(0, maxLength);
}

function cleanList(value: unknown, limit: number) {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map((item) => safeText(item, "", 80))
        .filter(Boolean)
        .slice(0, limit)
    )
  );
}

function cleanEnum<T extends string>(value: unknown, allowed: Set<string>, fallback: T): T {
  const text = safeText(value, "", 40);
  return (allowed.has(text) ? text : fallback) as T;
}

function cleanBudget(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 4200;
  return Math.min(Math.max(Math.round(parsed), 3000), 6000);
}

export function defaultSmartMatchPreferences(): SmartMatchInput {
  return {
    postcode: "",
    budgetPence: 4200,
    transmission: "automatic",
    availability: "today",
    bookingPath: "book-lesson",
    confidence: "nervous",
    lessonStage: "new",
    accessibilityNeeds: [],
    learningPreferences: [],
    communicationPreferences: [],
    environmentPreferences: [],
    lessonSupport: [],
    goals: [],
    disclosureConsent: true,
    privateNote: ""
  };
}

export function normaliseSmartMatchPreferences(value: unknown): SmartMatchInput {
  const input = typeof value === "object" && value ? (value as SmartMatchInput) : {};
  const defaults = defaultSmartMatchPreferences();
  const transmissionFallback: NonNullable<SmartMatchInput["transmission"]> = defaults.transmission ?? "automatic";
  const availabilityFallback: NonNullable<SmartMatchInput["availability"]> = defaults.availability ?? "today";
  const bookingPathFallback: NonNullable<SmartMatchInput["bookingPath"]> = defaults.bookingPath ?? "book-lesson";
  const confidenceFallback: NonNullable<SmartMatchInput["confidence"]> = defaults.confidence ?? "nervous";
  const lessonStageFallback: NonNullable<SmartMatchInput["lessonStage"]> = defaults.lessonStage ?? "new";

  return {
    postcode: safeText(input.postcode, defaults.postcode, 16).toUpperCase(),
    budgetPence: cleanBudget(input.budgetPence),
    transmission: cleanEnum(input.transmission, allowedTransmissions, transmissionFallback),
    availability: cleanEnum(input.availability, allowedAvailability, availabilityFallback),
    bookingPath: cleanEnum(input.bookingPath, allowedBookingPaths, bookingPathFallback),
    confidence: cleanEnum(input.confidence, allowedConfidence, confidenceFallback),
    lessonStage: cleanEnum(input.lessonStage, allowedLessonStages, lessonStageFallback),
    accessibilityNeeds: cleanList(input.accessibilityNeeds, 12),
    communicationPreferences: cleanList(input.communicationPreferences, 10),
    environmentPreferences: cleanList(input.environmentPreferences, 10),
    learningSupport: cleanList(input.learningSupport, 10),
    learningPreferences: cleanList(input.learningPreferences, 12),
    lessonPreferences: cleanList(input.lessonPreferences, 10),
    lessonSupport: cleanList(input.lessonSupport, 10),
    goals: cleanList(input.goals, 10),
    disclosureConsent: Boolean(input.disclosureConsent),
    privateNote: safeText(input.privateNote, "", 700),
    notes: safeText(input.notes, "", 700)
  };
}

export function availabilityForSmartMatchPath(path: SmartMatchInput["bookingPath"]): SmartMatchInput["availability"] {
  if (path === "on-demand") return "book-now";
  if (path === "schedule-lesson") return "later";
  return "today";
}
