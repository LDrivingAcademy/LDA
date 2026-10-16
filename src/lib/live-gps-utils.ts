export type LiveGpsPoint = {
  lat: number;
  lng: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  recordedAt: string;
  source?: string;
};

export type SentLiveGpsPoint = LiveGpsPoint & {
  sentAtMs: number;
};

export function normaliseGpsCoordinate(value: unknown, axis: "lat" | "lng"): number | null {
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue)) return null;

  if (axis === "lat" && (numberValue < -90 || numberValue > 90)) return null;
  if (axis === "lng" && (numberValue < -180 || numberValue > 180)) return null;

  return Number(numberValue.toFixed(7));
}

export function normaliseGpsAccuracy(value: unknown): number | null {
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 0) return null;
  return Number(numberValue.toFixed(2));
}

export function normaliseGpsHeading(value: unknown): number | null {
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue)) return null;
  return ((numberValue % 360) + 360) % 360;
}

export function normaliseGpsSpeed(value: unknown): number | null {
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 0) return null;
  return Number(numberValue.toFixed(2));
}

export function parseGpsRecordedAt(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }

  if (typeof value === "string") {
    const date = new Date(value);
    if (Number.isFinite(date.getTime())) return date.toISOString();
  }

  return new Date().toISOString();
}

export function distanceInMetersBetweenPoints(
  start: Pick<LiveGpsPoint, "lat" | "lng">,
  end: Pick<LiveGpsPoint, "lat" | "lng">,
): number {
  const earthRadiusMeters = 6371000;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const startLat = toRadians(start.lat);
  const endLat = toRadians(end.lat);
  const deltaLat = toRadians(end.lat - start.lat);
  const deltaLng = toRadians(end.lng - start.lng);

  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(startLat) * Math.cos(endLat) * Math.sin(deltaLng / 2) ** 2;

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function bearingDegrees(
  start: Pick<LiveGpsPoint, "lat" | "lng">,
  end: Pick<LiveGpsPoint, "lat" | "lng">,
): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const toDegrees = (radians: number) => (radians * 180) / Math.PI;
  const startLat = toRadians(start.lat);
  const endLat = toRadians(end.lat);
  const deltaLng = toRadians(end.lng - start.lng);

  const y = Math.sin(deltaLng) * Math.cos(endLat);
  const x =
    Math.cos(startLat) * Math.sin(endLat) -
    Math.sin(startLat) * Math.cos(endLat) * Math.cos(deltaLng);

  return ((toDegrees(Math.atan2(y, x)) % 360) + 360) % 360;
}

export function smoothGpsPoint(previous: LiveGpsPoint | null, next: LiveGpsPoint): LiveGpsPoint {
  if (!previous) return next;

  const movementMeters = distanceInMetersBetweenPoints(previous, next);
  if (movementMeters < 3 && previous.accuracy !== null && next.accuracy !== null && previous.accuracy <= next.accuracy) {
    return {
      ...next,
      lat: previous.lat,
      lng: previous.lng,
      heading: next.heading ?? previous.heading,
    };
  }

  const nextAccuracy = next.accuracy ?? 25;
  const alpha = nextAccuracy > 50 ? 0.35 : nextAccuracy > 20 ? 0.55 : 0.75;
  const inferredHeading = movementMeters >= 5 ? bearingDegrees(previous, next) : previous.heading;

  return {
    ...next,
    lat: Number((previous.lat + (next.lat - previous.lat) * alpha).toFixed(7)),
    lng: Number((previous.lng + (next.lng - previous.lng) * alpha).toFixed(7)),
    heading: next.heading ?? inferredHeading ?? null,
  };
}

export function shouldSendLiveGpsUpdate({
  previousSent,
  current,
  nowMs = Date.now(),
  minIntervalMs = 3000,
  minDistanceMeters = 10,
  maxIntervalMs = 15000,
  minHeadingChangeDegrees = 20,
}: {
  previousSent: SentLiveGpsPoint | null;
  current: LiveGpsPoint;
  nowMs?: number;
  minIntervalMs?: number;
  minDistanceMeters?: number;
  maxIntervalMs?: number;
  minHeadingChangeDegrees?: number;
}): boolean {
  if (!previousSent) return true;

  const elapsedMs = nowMs - previousSent.sentAtMs;
  if (elapsedMs >= maxIntervalMs) return true;
  if (elapsedMs < minIntervalMs) return false;

  if (distanceInMetersBetweenPoints(previousSent, current) >= minDistanceMeters) return true;

  if (previousSent.heading !== null && current.heading !== null) {
    const headingDelta = Math.abs(previousSent.heading - current.heading);
    const shortestDelta = Math.min(headingDelta, 360 - headingDelta);
    if (shortestDelta >= minHeadingChangeDegrees) return true;
  }

  return false;
}
