export type GoogleRoutePoint = {
  lat: number;
  lng: number;
};

export type GoogleDrivingRoute = {
  path: GoogleRoutePoint[];
  distanceText?: string;
  durationText?: string;
};

function normaliseRoutePoint(point: unknown): GoogleRoutePoint | null {
  const candidate = point as { lat?: unknown; lng?: unknown } | null;

  if (typeof candidate?.lat === "function" && typeof candidate?.lng === "function") {
    return {
      lat: Number((candidate.lat as () => number)()),
      lng: Number((candidate.lng as () => number)())
    };
  }

  if (typeof candidate?.lat === "number" && typeof candidate.lng === "number") {
    return {
      lat: candidate.lat,
      lng: candidate.lng
    };
  }

  return null;
}

function clampProgress(progress: number) {
  if (!Number.isFinite(progress)) return 0;
  return Math.min(1, Math.max(0, progress));
}

function distanceMetres(a: GoogleRoutePoint, b: GoogleRoutePoint) {
  const earthMetres = 6371000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * earthMetres * Math.asin(Math.sqrt(h));
}

export function buildFallbackDrivingRoute(origin: GoogleRoutePoint, destination: GoogleRoutePoint): GoogleRoutePoint[] {
  const latDelta = destination.lat - origin.lat;
  const lngDelta = destination.lng - origin.lng;
  const span = Math.max(Math.hypot(latDelta, lngDelta), 0.0001);
  const bend = Math.min(Math.max(span * 0.16, 0.0008), 0.01);
  const direction = latDelta * lngDelta >= 0 ? 1 : -1;

  return [
    origin,
    {
      lat: origin.lat + latDelta * 0.18,
      lng: origin.lng + lngDelta * 0.04
    },
    {
      lat: origin.lat + latDelta * 0.35 + bend * direction,
      lng: origin.lng + lngDelta * 0.3
    },
    {
      lat: origin.lat + latDelta * 0.62 + bend * direction,
      lng: origin.lng + lngDelta * 0.58
    },
    {
      lat: origin.lat + latDelta * 0.84,
      lng: origin.lng + lngDelta * 0.94
    },
    destination
  ];
}

export function pointOnRoutePath(path: GoogleRoutePoint[], progress: number): GoogleRoutePoint {
  if (path.length === 0) {
    return { lat: 0, lng: 0 };
  }

  if (path.length === 1) {
    return path[0];
  }

  const clampedProgress = clampProgress(progress);
  const segments = path.slice(1).map((point, index) => ({
    end: point,
    length: distanceMetres(path[index], point),
    start: path[index]
  }));
  const totalLength = segments.reduce((total, segment) => total + segment.length, 0);

  if (totalLength <= 0) {
    return path[0];
  }

  let distanceAlongRoute = totalLength * clampedProgress;

  for (const segment of segments) {
    if (distanceAlongRoute <= segment.length || segment === segments[segments.length - 1]) {
      const segmentProgress = segment.length > 0 ? distanceAlongRoute / segment.length : 0;

      return {
        lat: segment.start.lat + (segment.end.lat - segment.start.lat) * segmentProgress,
        lng: segment.start.lng + (segment.end.lng - segment.start.lng) * segmentProgress
      };
    }

    distanceAlongRoute -= segment.length;
  }

  return path[path.length - 1];
}

export function requestGoogleDrivingRoute(
  maps: any,
  origin: GoogleRoutePoint,
  destination: GoogleRoutePoint
): Promise<GoogleDrivingRoute | null> {
  if (!maps?.DirectionsService || !maps?.TravelMode?.DRIVING) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const service = new maps.DirectionsService();

    service.route(
      {
        destination,
        origin,
        provideRouteAlternatives: false,
        travelMode: maps.TravelMode.DRIVING
      },
      (response: any, status: string) => {
        if (status !== "OK") {
          resolve(null);
          return;
        }

        const route = response?.routes?.[0];
        const leg = route?.legs?.[0];
        const routePath = Array.isArray(route?.overview_path)
          ? route.overview_path
              .map(normaliseRoutePoint)
              .filter((point: GoogleRoutePoint | null): point is GoogleRoutePoint => Boolean(point))
          : [];

        if (!routePath.length) {
          resolve(null);
          return;
        }

        resolve({
          path: routePath,
          distanceText: leg?.distance?.text,
          durationText: leg?.duration?.text
        });
      }
    );
  });
}
