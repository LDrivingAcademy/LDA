export type SmartMatchHandoffContext = {
  source?: string;
  selectedPath?: "on-demand" | "book-lesson" | "schedule-lesson";
  postcode?: string;
  budgetPence?: number;
  transmission?: "automatic" | "manual";
  availability?: "book-now" | "today" | "later" | "asap" | "weekdays" | "evenings" | "weekends" | "flexible";
  bookingPath?: "on-demand" | "book-lesson" | "schedule-lesson";
  confidence?: "nervous" | "some" | "confident";
  lessonStage?: "new" | "test-soon" | "refresher" | "post-pass" | "returning";
  instructorId?: string;
  instructorName?: string;
  matchScore?: number;
  reasons?: string[];
  accessibilityNeeds?: string[];
  learningPreferences?: string[];
  communicationPreferences?: string[];
  environmentPreferences?: string[];
  lessonSupport?: string[];
  goals?: string[];
  privateNote?: string;
  disclosureConsent?: boolean;
  savedAt?: string;
};

function cleanText(value: unknown, maxLength = 180) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function cleanList(values: unknown, limit = 8) {
  if (!Array.isArray(values)) return [];

  return values
    .map((value) => cleanText(value, 80))
    .filter(Boolean)
    .slice(0, limit);
}

export function normaliseSmartMatchHandoff(value: unknown): SmartMatchHandoffContext | null {
  if (!value || typeof value !== "object") return null;
  const input = value as SmartMatchHandoffContext;
  const selectedPath =
    input.selectedPath === "on-demand" || input.selectedPath === "book-lesson" || input.selectedPath === "schedule-lesson"
      ? input.selectedPath
      : undefined;
  const transmission = input.transmission === "manual" || input.transmission === "automatic" ? input.transmission : undefined;
  const availability =
    input.availability === "book-now" ||
    input.availability === "today" ||
    input.availability === "later" ||
    input.availability === "asap" ||
    input.availability === "weekdays" ||
    input.availability === "evenings" ||
    input.availability === "weekends" ||
    input.availability === "flexible"
      ? input.availability
      : undefined;
  const confidence =
    input.confidence === "nervous" || input.confidence === "some" || input.confidence === "confident"
      ? input.confidence
      : undefined;
  const lessonStage =
    input.lessonStage === "new" ||
    input.lessonStage === "test-soon" ||
    input.lessonStage === "refresher" ||
    input.lessonStage === "post-pass" ||
    input.lessonStage === "returning"
      ? input.lessonStage
      : undefined;

  const context: SmartMatchHandoffContext = {
    source: cleanText(input.source, 40) || "smart-match",
    selectedPath,
    postcode: cleanText(input.postcode, 20),
    budgetPence: Number.isFinite(Number(input.budgetPence)) ? Math.min(Math.max(Math.round(Number(input.budgetPence)), 3000), 6000) : undefined,
    transmission,
    availability,
    bookingPath: selectedPath,
    confidence,
    lessonStage,
    instructorId: cleanText(input.instructorId, 100),
    instructorName: cleanText(input.instructorName, 100),
    matchScore: Number.isFinite(Number(input.matchScore)) ? Math.max(0, Math.min(100, Math.round(Number(input.matchScore)))) : undefined,
    reasons: cleanList(input.reasons, 5),
    accessibilityNeeds: cleanList(input.accessibilityNeeds, 10),
    learningPreferences: cleanList(input.learningPreferences, 10),
    communicationPreferences: cleanList(input.communicationPreferences, 8),
    environmentPreferences: cleanList(input.environmentPreferences, 8),
    lessonSupport: cleanList(input.lessonSupport, 8),
    goals: cleanList(input.goals, 8),
    privateNote: input.disclosureConsent ? cleanText(input.privateNote, 500) : "",
    disclosureConsent: Boolean(input.disclosureConsent),
    savedAt: cleanText(input.savedAt, 40)
  };

  return context.source === "smart-match" ? context : null;
}

export function summariseSmartMatchRequirements(context?: SmartMatchHandoffContext | null) {
  if (!context) return "";

  const selected = [
    ...(context.accessibilityNeeds ?? []),
    ...(context.learningPreferences ?? []),
    ...(context.communicationPreferences ?? []),
    ...(context.environmentPreferences ?? []),
    ...(context.lessonSupport ?? [])
  ];

  return Array.from(new Set(selected)).slice(0, 10).join(", ");
}

export function buildSmartMatchLessonNote(context?: SmartMatchHandoffContext | null) {
  if (!context) return "";

  const requirements = summariseSmartMatchRequirements(context);
  const noteParts = [];

  if (context.selectedPath) {
    noteParts.push(`Smart Match path: ${context.selectedPath}.`);
  }

  if (requirements) {
    noteParts.push(`Accessibility and learning preferences attached: ${requirements}.`);
  }

  if (context.disclosureConsent && context.privateNote) {
    noteParts.push(`Learner private note for booked instructor: ${context.privateNote}`);
  }

  return noteParts.join(" ");
}

export function preserveSmartMatchLessonNote(nextSummary: string, existingSummary?: unknown) {
  const cleanNextSummary = cleanText(nextSummary, 600);
  const existing = cleanText(existingSummary, 1200);
  const markers = [
    "Smart Match path:",
    "Accessibility and learning preferences attached:",
    "Learner private note for booked instructor:"
  ];
  const markerIndexes = markers
    .map((marker) => existing.indexOf(marker))
    .filter((index) => index >= 0);

  if (!markerIndexes.length) return cleanNextSummary;

  const smartMatchDetails = existing.slice(Math.min(...markerIndexes)).trim();
  if (!smartMatchDetails || cleanNextSummary.includes(smartMatchDetails)) return cleanNextSummary;

  return `${cleanNextSummary} ${smartMatchDetails}`.slice(0, 1200).trim();
}

export function smartMatchStripeMetadata(context?: SmartMatchHandoffContext | null) {
  if (!context) return {};

  const requirements = summariseSmartMatchRequirements(context);
  const metadata: Record<string, string> = {
    smart_match_source: "smart-match",
    smart_match_path: context.selectedPath ?? "",
    smart_match_requirements: requirements.slice(0, 480),
    smart_match_score: context.matchScore ? String(context.matchScore) : "",
    smart_match_reasons: (context.reasons ?? []).join(" | ").slice(0, 480),
    smart_match_private_note_shared: context.disclosureConsent && context.privateNote ? "true" : ""
  };

  if (context.instructorId) metadata.smart_match_instructor_id = context.instructorId;
  if (context.instructorName) metadata.smart_match_instructor_name = context.instructorName;

  return Object.fromEntries(Object.entries(metadata).filter(([, value]) => Boolean(value)));
}
