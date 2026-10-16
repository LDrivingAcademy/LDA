export type LessonLifecycleStatus = "pending" | "scheduled" | "completed" | "cancelled";

const LONDON_TIME_ZONE = "Europe/London";
const DEFAULT_LESSON_MS = 60 * 60 * 1000;

export type LessonLifecycleInput = {
  status?: string | null;
  paymentStatus?: string | null;
  startsAt?: Date | string | null;
  endsAt?: Date | string | null;
  now?: Date;
};

export function parseLessonLifecycleDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatLondonLessonDate(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: LONDON_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(value);
}

export function getLessonLifecycleStatus(input: LessonLifecycleInput): LessonLifecycleStatus {
  const value = `${input.status ?? ""} ${input.paymentStatus ?? ""}`.toLowerCase();

  if (value.includes("cancel")) return "cancelled";
  if (value.includes("complete")) return "completed";

  const now = input.now ?? new Date();
  const startsAt = parseLessonLifecycleDate(input.startsAt);
  const endsAt = parseLessonLifecycleDate(input.endsAt);

  if (endsAt && endsAt.getTime() <= now.getTime()) return "completed";
  if (!endsAt && startsAt && startsAt.getTime() + DEFAULT_LESSON_MS <= now.getTime()) return "completed";

  if (startsAt) {
    if (startsAt.getTime() <= now.getTime()) return "pending";
    if (formatLondonLessonDate(startsAt) === formatLondonLessonDate(now)) return "pending";
    return "scheduled";
  }

  return "pending";
}
