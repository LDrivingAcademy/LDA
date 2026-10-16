const activeRouteStatuses = new Set([
  "accepted",
  "pending",
  "pending_assignment",
  "waiting_for_instructor",
  "scheduled",
  "upcoming",
  "instructor_en_route",
  "en_route",
  "in_progress"
]);

const terminalRouteStatuses = new Set([
  "cancelled",
  "canceled",
  "completed",
  "declined",
  "disputed",
  "refunded",
  "refund_pending",
  "refund_requested"
]);

const fallbackOnDemandRouteWindowMs = 2 * 60 * 60 * 1000;

type RouteAccessInput = {
  status?: unknown;
  startsAt?: unknown;
  endsAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  now?: Date;
};

function parseTime(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function normaliseStatus(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

export function getLessonRouteExpiryTime(input: RouteAccessInput) {
  const explicitEnd = parseTime(input.endsAt);
  if (explicitEnd !== null) {
    return explicitEnd;
  }

  const fallbackStart = parseTime(input.startsAt) ?? parseTime(input.createdAt) ?? parseTime(input.updatedAt);
  return fallbackStart === null ? null : fallbackStart + fallbackOnDemandRouteWindowMs;
}

export function isLessonRouteAccessActive(input: RouteAccessInput) {
  const status = normaliseStatus(input.status);
  if (terminalRouteStatuses.has(status)) {
    return false;
  }

  if (status && !activeRouteStatuses.has(status)) {
    return false;
  }

  const expiresAt = getLessonRouteExpiryTime(input);
  if (expiresAt === null) {
    return false;
  }

  return expiresAt > (input.now ?? new Date()).getTime();
}

export function lessonRouteExpiredResponseMessage() {
  return "This route has expired because the booked lesson time has ended.";
}
