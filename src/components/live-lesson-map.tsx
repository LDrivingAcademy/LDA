"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CarFront, LocateFixed, MapPin, Navigation, RadioTower, ShieldCheck } from "lucide-react";
import { LDA_GOOGLE_MAP_STYLES } from "@/lib/google-map-style";
import { getResponsiveWorldMinZoom, watchResponsiveWorldViewport } from "@/lib/google-map-viewport";
import { buildFallbackDrivingRoute, pointOnRoutePath, requestGoogleDrivingRoute } from "@/lib/google-driving-route";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import { animateMarkerTo } from "@/lib/google-map-smooth-marker";
import { loadGoogleMaps } from "@/lib/google-maps-loader";
import { readCachedLiveLocation, writeCachedLiveLocation } from "@/lib/live-location-client-cache";
import type { LiveGpsPoint } from "@/lib/live-gps-utils";
import { getCachedGpsPoint, requestFreshGpsPoint } from "@/lib/live-gps-watch-manager";

type Point = {
  lat: number;
  lng: number;
  label: string;
};

type TrackingMode = "demo" | "live";

export type LiveLessonDetails = {
  bookingReference?: string | null;
  instructorName: string;
  pickupLabel: string;
  pickupPostcode: string;
  startsAt?: string | null;
  status?: string | null;
  pickupPoint?: Pick<Point, "lat" | "lng"> | null;
  instructorPoint?: Pick<Point, "lat" | "lng"> | null;
  instructorLocationRecordedAt?: string | null;
  instructorAccuracyMeters?: number | null;
  instructorHeadingDegrees?: number | null;
  instructorSpeedMps?: number | null;
};

declare global {
  interface Window {
    google?: any;
    __ldaGoogleMapsPromise?: Promise<void>;
  }
}

type GoogleMap = {
  fitBounds: (bounds: GoogleLatLngBounds, padding?: number) => void;
};

type GoogleMarker = {
  setPosition: (position: Pick<Point, "lat" | "lng">) => void;
  setTitle?: (title: string) => void;
  setMap?: (map: GoogleMap | null) => void;
};

type GooglePolyline = {
  setPath: (path: Pick<Point, "lat" | "lng">[]) => void;
};

type GoogleLatLngBounds = {
  extend: (position: Pick<Point, "lat" | "lng">) => void;
};

const learnerPickup: Point = {
  lat: 51.6523,
  lng: -0.1995,
  label: "Learner pickup - Barnet"
};

const instructorStart: Point = {
  lat: 51.6152,
  lng: -0.1765,
  label: "Instructor - Finchley"
};

const demoLesson: LiveLessonDetails = {
  bookingReference: "demo",
  instructorName: "Amelia Khan",
  pickupLabel: "Barnet EN5",
  pickupPostcode: "EN5 5XY",
  pickupPoint: learnerPickup,
  instructorPoint: instructorStart,
  status: "demo"
};

function distanceMiles(a: Pick<Point, "lat" | "lng">, b: Pick<Point, "lat" | "lng">) {
  const earthMiles = 3958.8;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * earthMiles * Math.asin(Math.sqrt(h));
}

function isUuidReference(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isEnRouteStatus(status?: string | null) {
  return status === "instructor_en_route" || status === "en_route" || status === "in_progress";
}

function normaliseRealtimeNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function formatLiveGpsTime(value?: string | null) {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return null;
  const ageSeconds = Math.max(0, Math.round((Date.now() - time) / 1000));
  if (ageSeconds < 5) return "just now";
  if (ageSeconds < 60) return `${ageSeconds}s ago`;
  return `${Math.round(ageSeconds / 60)}m ago`;
}

function liveGpsPointFromLesson(lesson: LiveLessonDetails | null): LiveGpsPoint | null {
  if (!lesson?.instructorPoint) return null;

  return {
    lat: lesson.instructorPoint.lat,
    lng: lesson.instructorPoint.lng,
    accuracy: lesson.instructorAccuracyMeters ?? null,
    heading: lesson.instructorHeadingDegrees ?? null,
    speed: lesson.instructorSpeedMps ?? null,
    recordedAt: lesson.instructorLocationRecordedAt ?? new Date().toISOString(),
    source: "lesson_tracking"
  };
}

function FallbackMap({
  progress,
  mode,
  hasInstructorLocation,
  allowDemoRoute
}: {
  progress: number;
  mode: TrackingMode;
  hasInstructorLocation: boolean;
  allowDemoRoute: boolean;
}) {
  const isLive = mode === "live";
  const carX = 18 + progress * 58;
  const carY = 70 - progress * 38;

  return (
    <div className="relative h-[360px] overflow-hidden rounded border border-zinc-200 bg-zinc-100">
      <div className="absolute inset-0 opacity-40">
        <div className="absolute left-10 top-12 h-72 w-px rotate-45 bg-zinc-400" />
        <div className="absolute left-40 top-0 h-96 w-px rotate-12 bg-zinc-300" />
        <div className="absolute left-0 top-44 h-px w-full bg-zinc-300" />
        <div className="absolute left-0 top-24 h-px w-full -rotate-6 bg-zinc-300" />
        <div className="absolute left-0 top-72 h-px w-full rotate-3 bg-zinc-300" />
      </div>
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
        {allowDemoRoute ? (
          <path
            d="M18 70 C30 58, 40 55, 50 47 S66 34, 76 32"
            fill="none"
            stroke="#e30613"
            strokeDasharray="3 3"
            strokeLinecap="round"
            strokeWidth="2"
          />
        ) : null}
        <circle cx="76" cy="32" fill="#ffffff" r="5" />
        <circle cx="76" cy="32" fill="#e30613" r="3" />
        {allowDemoRoute && hasInstructorLocation ? (
          <>
            <circle cx={carX} cy={carY} fill="#e30613" r="4.5" />
            <circle cx={carX} cy={carY} fill="#ffffff" r="1.6" />
          </>
        ) : null}
      </svg>
      <div className="absolute left-4 top-4 rounded bg-white px-3 py-2 text-sm font-black text-black shadow-sm">
        {isLive ? (hasInstructorLocation ? "Google route unavailable" : "Waiting for instructor ping") : "Demo live map"}
      </div>
      <div className="absolute bottom-4 left-4 right-4 rounded border border-red-200 bg-white/90 p-3 text-black backdrop-blur">
        <div className="flex items-center gap-2 text-sm font-bold">
          <RadioTower size={16} className="text-brand" />{" "}
          {allowDemoRoute
            ? "Demo location refreshes every second"
            : "Real tracking appears when the instructor GPS feed and Google route are available"}
        </div>
      </div>
    </div>
  );
}

export function LiveLessonMap({ mode = "demo", lesson = demoLesson }: { mode?: TrackingMode; lesson?: LiveLessonDetails | null }) {
  const isLive = mode === "live";
  const [trackedLesson, setTrackedLesson] = useState<LiveLessonDetails | null>(lesson ?? null);
  const hasLesson = Boolean(trackedLesson);
  const activeLesson = useMemo(() => trackedLesson ?? demoLesson, [trackedLesson]);
  const activePickup: Point = useMemo(
    () => ({
      ...(activeLesson.pickupPoint ?? learnerPickup),
      label: activeLesson.pickupLabel || activeLesson.pickupPostcode || learnerPickup.label
    }),
    [activeLesson]
  );
  const activeInstructorStart: Point | null = useMemo(
    () =>
      activeLesson.instructorPoint
        ? {
            ...activeLesson.instructorPoint,
            label: `${activeLesson.instructorName} live location`
          }
        : isLive
          ? null
          : instructorStart,
    [activeLesson, isLive]
  );
  const hasInstructorLocation = Boolean(activeInstructorStart);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<GoogleMap | null>(null);
  const instructorMarker = useRef<GoogleMarker | null>(null);
  const routeLine = useRef<GooglePolyline | null>(null);
  const lastRouteRequestRef = useRef<{ key: string; time: number } | null>(null);
  const userInteractedRef = useRef(false);
  const googleMapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const [progress, setProgress] = useState(0.18);
  const [useFallback, setUseFallback] = useState(!googleMapsKey);
  const [hasUserMovedMap, setHasUserMovedMap] = useState(false);
  const [routeEstimate, setRouteEstimate] = useState<{ distanceText: string; durationText: string } | null>(null);
  const [routePath, setRoutePath] = useState<Array<Pick<Point, "lat" | "lng">>>([]);
  const [learnerLocationStatus, setLearnerLocationStatus] = useState<string | null>(null);
  const allowDemoRouteFallback = !isLive;
  const fallbackRoutePath = useMemo(
    () => (allowDemoRouteFallback && activeInstructorStart ? buildFallbackDrivingRoute(activeInstructorStart, activePickup) : []),
    [activeInstructorStart, activePickup.lat, activePickup.lng, allowDemoRouteFallback]
  );
  const displayRoutePath = routePath.length > 1 ? routePath : fallbackRoutePath;
  const instructorLastUpdatedDisplay = formatLiveGpsTime(activeLesson.instructorLocationRecordedAt);
  const instructorAccuracyDisplay =
    typeof activeLesson.instructorAccuracyMeters === "number" ? `${Math.round(activeLesson.instructorAccuracyMeters)}m accuracy` : null;
  const instructorHeadingDisplay =
    typeof activeLesson.instructorHeadingDegrees === "number" ? `${Math.round(activeLesson.instructorHeadingDegrees)} deg heading` : null;

  const instructorLocation: Point | null = useMemo(() => {
    if (!activeInstructorStart) {
      return null;
    }

    if (isLive) {
      return activeInstructorStart;
    }

    return {
      ...pointOnRoutePath(displayRoutePath, progress),
      label: "Instructor live location"
    };
  }, [activeInstructorStart, displayRoutePath, isLive, progress]);
  const milesAway = instructorLocation ? distanceMiles(instructorLocation, activePickup) : null;
  const etaMinutes = milesAway === null ? null : Math.max(2, Math.round((milesAway / 18) * 60));
  const instructorDistanceText = routeEstimate?.distanceText ?? (milesAway === null ? "Waiting" : `${milesAway.toFixed(1)} miles`);
  const instructorEtaDisplay = routeEstimate?.durationText ?? (milesAway === null ? "Pending" : `${etaMinutes} min`);
  const routeRequestKey = activeInstructorStart
    ? `${activeInstructorStart.lat.toFixed(4)},${activeInstructorStart.lng.toFixed(4)}:${activePickup.lat.toFixed(4)},${activePickup.lng.toFixed(4)}`
    : "";

  useEffect(() => {
    const bookingReference = lesson?.bookingReference ?? "";
    const cachedPoint = isLive && bookingReference && bookingReference !== "demo"
      ? readCachedLiveLocation("lesson", bookingReference)
      : null;

    setTrackedLesson(() => {
      if (!lesson || !cachedPoint || lesson.instructorPoint) {
        return lesson ?? null;
      }

      return {
        ...lesson,
        instructorPoint: { lat: cachedPoint.lat, lng: cachedPoint.lng },
        instructorLocationRecordedAt: cachedPoint.recordedAt,
        instructorAccuracyMeters: cachedPoint.accuracy,
        instructorHeadingDegrees: cachedPoint.heading,
        instructorSpeedMps: cachedPoint.speed
      };
    });
  }, [isLive, lesson]);

  useEffect(() => {
    const bookingReference = activeLesson.bookingReference ?? "";
    if (!isLive || !bookingReference || bookingReference === "demo") return;

    writeCachedLiveLocation("lesson", bookingReference, liveGpsPointFromLesson(activeLesson));
  }, [activeLesson, isLive]);

  useEffect(() => {
    if (!isLive || !hasLesson) {
      setLearnerLocationStatus(null);
      return;
    }

    if (!navigator.geolocation) {
      setLearnerLocationStatus("This device does not support browser location, so live learner tracking may be limited.");
      return;
    }

    if (getCachedGpsPoint("learner_tracking_presence", 120000)) {
      setLearnerLocationStatus("Live learner location is active for this booking.");
      return;
    }

    setLearnerLocationStatus("Checking learner live location for this booking.");
    let cancelled = false;
    void requestFreshGpsPoint({
      source: "learner_tracking_presence",
      enableHighAccuracy: false,
      maximumAge: 60000,
      timeout: 10000
    }).then((point) => {
      if (cancelled) return;
      setLearnerLocationStatus(point
        ? "Live learner location is active for this booking."
        : "Allow browser location for live tracking while this booking is active.");
    });

    return () => {
      cancelled = true;
    };
  }, [hasLesson, isLive]);

  useEffect(() => {
    const bookingReference = activeLesson.bookingReference ?? "";

    if (!isLive || !bookingReference || bookingReference === "demo") {
      return;
    }

    let cancelled = false;
    let timeoutId: number | undefined;

    async function refreshLiveLesson() {
      try {
        const useInstantStatus = !isUuidReference(bookingReference);
        const response = await fetch(useInstantStatus
          ? `/api/instant-lessons/status?reference=${encodeURIComponent(bookingReference)}`
          : `/api/tracking/live?booking=${encodeURIComponent(bookingReference)}`, {
          cache: "no-store"
        });

        if (!cancelled && response.ok) {
          const result = (await response.json()) as { lesson?: LiveLessonDetails } & Partial<LiveLessonDetails>;

          if (useInstantStatus) {
            setTrackedLesson((current) => {
              const nextStatus = String(result.status ?? current?.status ?? activeLesson.status ?? "");
              const enRoute = isEnRouteStatus(nextStatus);

              return {
                ...(current ?? activeLesson),
                bookingReference,
                instructorName: result.instructorName ?? current?.instructorName ?? activeLesson.instructorName,
                pickupLabel: result.pickupLabel ?? current?.pickupLabel ?? activeLesson.pickupLabel,
                pickupPostcode: result.pickupPostcode ?? current?.pickupPostcode ?? activeLesson.pickupPostcode,
                status: nextStatus,
                pickupPoint: result.pickupPoint ?? current?.pickupPoint ?? activeLesson.pickupPoint ?? null,
                instructorPoint: enRoute ? result.instructorPoint ?? current?.instructorPoint ?? activeLesson.instructorPoint ?? null : null,
                instructorLocationRecordedAt: enRoute
                  ? result.instructorLocationRecordedAt ??
                    current?.instructorLocationRecordedAt ??
                    activeLesson.instructorLocationRecordedAt ??
                    new Date().toISOString()
                  : null,
                instructorAccuracyMeters: enRoute
                  ? result.instructorAccuracyMeters ?? current?.instructorAccuracyMeters ?? activeLesson.instructorAccuracyMeters ?? null
                  : null,
                instructorHeadingDegrees: enRoute
                  ? result.instructorHeadingDegrees ?? current?.instructorHeadingDegrees ?? activeLesson.instructorHeadingDegrees ?? null
                  : null,
                instructorSpeedMps: enRoute
                  ? result.instructorSpeedMps ?? current?.instructorSpeedMps ?? activeLesson.instructorSpeedMps ?? null
                  : null
              };
            });
          } else if (result.lesson) {
            const nextLesson = result.lesson;
            setTrackedLesson((current) => ({
              ...(current ?? nextLesson),
              ...nextLesson
            }));
          }
        }
      } catch {
        // Keep the last known location on screen if a refresh misses.
      }

      if (!cancelled) {
        timeoutId = window.setTimeout(refreshLiveLesson, isUuidReference(bookingReference) ? 15000 : 5000);
      }
    }

    void refreshLiveLesson();

    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [activeLesson, isLive]);

  useEffect(() => {
    const bookingReference = activeLesson.bookingReference ?? "";
    if (!isLive || !bookingReference || bookingReference === "demo" || !isUuidReference(bookingReference)) {
      return;
    }

    const supabase = createBrowserSupabaseClient();
    if (!supabase) return;

    const channel = supabase
      .channel(`lda-location-shares-${bookingReference}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "location_shares", filter: `booking_id=eq.${bookingReference}` },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          const lat = normaliseRealtimeNumber(row.latitude);
          const lng = normaliseRealtimeNumber(row.longitude);
          if (lat === null || lng === null) return;

          setTrackedLesson((current) => ({
            ...(current ?? activeLesson),
            bookingReference,
            status: "instructor_en_route",
            instructorPoint: { lat, lng },
            instructorLocationRecordedAt: String(row.client_recorded_at ?? row.recorded_at ?? new Date().toISOString()),
            instructorAccuracyMeters: normaliseRealtimeNumber(row.accuracy_meters),
            instructorHeadingDegrees: normaliseRealtimeNumber(row.heading_degrees),
            instructorSpeedMps: normaliseRealtimeNumber(row.speed_mps)
          }));
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeLesson, isLive]);

  function fitMapToRoute() {
    if (!mapInstance.current || !window.google?.maps) return;

    const bounds = new window.google.maps.LatLngBounds();
    bounds.extend(activePickup);
    if (instructorLocation) {
      bounds.extend(instructorLocation);
    }
    mapInstance.current.fitBounds(bounds, 80);
  }

  useEffect(() => {
    if (isLive || !hasLesson) {
      return;
    }

    const interval = window.setInterval(() => {
      setProgress((current) => (current >= 0.92 ? 0.18 : current + 0.014));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [hasLesson, isLive]);

  useEffect(() => {
    if (!googleMapsKey || !mapRef.current) {
      setUseFallback(true);
      return;
    }

    let cancelled = false;
    let mapElement: HTMLDivElement | null = null;
    let cleanupResponsiveViewport: (() => void) | null = null;
    const markUserInteraction = () => {
      userInteractedRef.current = true;
      setHasUserMovedMap(true);
    };

    loadGoogleMaps(googleMapsKey)
      .then(() => {
        if (cancelled || !mapRef.current || !window.google?.maps) {
          return;
        }

        const maps = window.google.maps;
        const bounds = new maps.LatLngBounds();
        if (activeInstructorStart) {
          bounds.extend(activeInstructorStart);
        }
        bounds.extend(activePickup);

        const map = new maps.Map(mapRef.current, {
          center: activePickup,
          clickableIcons: false,
          disableDefaultUI: true,
          backgroundColor: "#eef2ef",
          mapTypeControl: false,
          minZoom: getResponsiveWorldMinZoom(mapRef.current),
          streetViewControl: false,
          styles: LDA_GOOGLE_MAP_STYLES,
          zoom: 13
        });
        mapInstance.current = map;
        map.fitBounds(bounds, 80);
        cleanupResponsiveViewport = watchResponsiveWorldViewport(map, mapRef.current, maps);
        map.addListener("dragstart", markUserInteraction);
        mapElement = mapRef.current;
        mapElement.addEventListener("pointerdown", markUserInteraction, { passive: true });
        mapElement.addEventListener("wheel", markUserInteraction, { passive: true });
        mapElement.addEventListener("touchstart", markUserInteraction, { passive: true });

        routeLine.current = new maps.Polyline({
          geodesic: false,
          map,
          path: [],
          strokeColor: "#e30613",
          strokeOpacity: 0.9,
          strokeWeight: 4
        });

        instructorMarker.current = activeInstructorStart
          ? new maps.Marker({
              label: "I",
              map,
              position: instructorLocation ?? activeInstructorStart,
              title: activeInstructorStart.label
            })
          : null;

        new maps.Marker({
          label: "S",
          map,
          position: activePickup,
          title: activePickup.label
        });

        setUseFallback(false);
      })
      .catch(() => {
        setUseFallback(true);
      });

    return () => {
      cancelled = true;
      cleanupResponsiveViewport?.();
      mapElement?.removeEventListener("pointerdown", markUserInteraction);
      mapElement?.removeEventListener("wheel", markUserInteraction);
      mapElement?.removeEventListener("touchstart", markUserInteraction);
    };
  }, [
    activePickup.lat,
    activePickup.lng,
    googleMapsKey,
    isLive
  ]);

  useEffect(() => {
    if (!mapInstance.current || !window.google?.maps) {
      return;
    }

    if (!instructorLocation) {
      instructorMarker.current?.setMap?.(null);
      instructorMarker.current = null;
      return;
    }

    if (!instructorMarker.current) {
      instructorMarker.current = new window.google.maps.Marker({
        label: "I",
        map: mapInstance.current,
        position: instructorLocation,
        title: instructorLocation.label
      });
      return;
    }

    animateMarkerTo(instructorMarker.current, instructorLocation);
    instructorMarker.current?.setTitle?.(instructorLocation.label);
  }, [instructorLocation]);

  useEffect(() => {
    if (!routeLine.current) {
      return;
    }

    if (!activeInstructorStart || !routeRequestKey) {
      routeLine.current.setPath([]);
      setRoutePath([]);
      setRouteEstimate(null);
      return;
    }

    if (useFallback || !window.google?.maps) {
      const nextPath = allowDemoRouteFallback ? fallbackRoutePath : [];
      routeLine.current.setPath(nextPath);
      setRoutePath(nextPath);
      setRouteEstimate(null);
      return;
    }

    let cancelled = false;
    const maps = window.google.maps;
    const now = Date.now();
    const previousRequest = lastRouteRequestRef.current;

    if (previousRequest?.key === routeRequestKey || (previousRequest && now - previousRequest.time < 5000)) {
      return;
    }

    lastRouteRequestRef.current = { key: routeRequestKey, time: now };

    requestGoogleDrivingRoute(maps, activeInstructorStart, activePickup).then((route) => {
      if (cancelled) return;

      if (route?.path.length) {
        routeLine.current?.setPath(route.path);
        setRoutePath(route.path);
        setRouteEstimate(
          route.distanceText && route.durationText
            ? {
                distanceText: route.distanceText,
                durationText: route.durationText
              }
            : null
        );
        return;
      }

      const nextPath = allowDemoRouteFallback ? fallbackRoutePath : [];
      routeLine.current?.setPath(nextPath);
      setRoutePath(nextPath);
      setRouteEstimate(null);
    });

    return () => {
      cancelled = true;
    };
  }, [
    activePickup.lat,
    activePickup.lng,
    activeInstructorStart?.lat,
    activeInstructorStart?.lng,
    allowDemoRouteFallback,
    fallbackRoutePath,
    routeRequestKey,
    useFallback
  ]);

  function recenterMap() {
    userInteractedRef.current = false;
    setHasUserMovedMap(false);
    fitMapToRoute();
  }

  if (isLive && !hasLesson) {
    return (
      <section id="tracking" className="bg-white py-8 text-black">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <article className="rounded border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="inline-flex items-center gap-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm font-black text-brand">
              <Navigation size={16} /> No active lesson tracking
            </div>
            <h2 className="mt-4 text-3xl font-black tracking-normal">No accepted lesson is ready to track yet.</h2>
            <p className="mt-3 max-w-3xl text-base leading-7 text-zinc-700">
              Once you have an accepted booking close to lesson time, this page will show the real pickup point, instructor live location, ETA, and route progress.
            </p>
          </article>
        </div>
      </section>
    );
  }

  return (
    <section id="tracking" className="bg-white py-8 text-black">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[420px_1fr] lg:px-8">
        <div>
          <div className="inline-flex items-center gap-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm font-black text-brand">
            <Navigation size={16} /> {isLive ? "Active lesson tracking" : "Live lesson tracking demo"}
          </div>
          <h2 className="mt-4 text-3xl font-black tracking-normal sm:text-4xl">
            {isLive ? "See your instructor approaching your pickup point." : "Show how far the instructor is from the learner."}
          </h2>
          <p className="mt-3 text-base leading-7 text-zinc-700">
            {isLive
              ? hasInstructorLocation
                ? "This page shows your accepted booking pickup point, the instructor's latest live location, estimated arrival time, and distance remaining when the lesson is close to starting."
                : "This page is linked to your accepted booking. The pickup point is ready and the instructor live location will appear when their lesson ping starts."
              : "Learners can see the instructor approach the pickup postcode, estimated arrival time, and distance remaining. In production this connects to instructor GPS, booking status, and consent controls."}
          </p>
          <div className="mt-6 grid gap-3">
            <div className="rounded border border-zinc-200 bg-zinc-100 p-4">
              <div className="text-sm font-bold text-zinc-500">Instructor distance</div>
              <div className="mt-1 text-3xl font-black">{hasInstructorLocation ? instructorDistanceText : "Waiting"}</div>
            </div>
            <div className="rounded border border-zinc-200 bg-zinc-100 p-4">
              <div className="text-sm font-bold text-zinc-500">Estimated arrival</div>
              <div className="mt-1 text-3xl font-black">{hasInstructorLocation ? instructorEtaDisplay : "Pending"}</div>
            </div>
            <div className="rounded border border-zinc-200 bg-zinc-100 p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 shrink-0 text-brand" size={20} />
                <p className="text-sm leading-6 text-zinc-700">
                  Tracking will only be enabled for accepted bookings near lesson time and with clear consent. We will only store the minimum location data needed for safety and support.
                </p>
              </div>
              {learnerLocationStatus ? (
                <p className="mt-3 rounded border border-red-200 bg-white p-3 text-sm font-black leading-6 text-red-950">
                  {learnerLocationStatus}
                </p>
              ) : null}
              {isLive && instructorLastUpdatedDisplay ? (
                <p className="mt-3 rounded border border-zinc-200 bg-white p-3 text-xs font-black leading-5 text-zinc-600">
                  Instructor GPS updated {instructorLastUpdatedDisplay}
                  {instructorAccuracyDisplay ? ` - ${instructorAccuracyDisplay}` : ""}
                  {instructorHeadingDisplay ? ` - ${instructorHeadingDisplay}` : ""}.
                </p>
              ) : null}
            </div>
          </div>
        </div>
        <div className="rounded border border-zinc-200 bg-white p-4 shadow-2xl">
          <div className="mb-4">
            <div>
              <div className="text-sm font-bold uppercase text-brand">Current lesson</div>
              <div className="text-xl font-black">
                {activeLesson.instructorName} on route
              </div>
            </div>
          </div>
          <div className="relative">
            <div
              ref={mapRef}
              className={`lda-polished-map lda-responsive-map ${useFallback ? "hidden" : "block"} h-[360px] overflow-hidden rounded border border-zinc-200 bg-zinc-100`}
            />
            {useFallback ? (
              <FallbackMap
                progress={progress}
                mode={mode}
                hasInstructorLocation={hasInstructorLocation}
                allowDemoRoute={allowDemoRouteFallback}
              />
            ) : null}
            {!useFallback && hasUserMovedMap ? (
              <button
                type="button"
                onClick={recenterMap}
                className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-3 py-2 text-xs font-black text-zinc-700 shadow-sm hover:ring-2 hover:ring-brand"
              >
                <LocateFixed size={15} /> Re-centre map
              </button>
            ) : null}
          </div>
          <div className="mt-4 grid gap-3">
            <div className="flex items-center justify-between gap-4 rounded border border-zinc-200 bg-zinc-100 p-3">
              <div className="flex min-w-[120px] items-center justify-center gap-2 text-center text-sm font-bold text-zinc-500">
                <CarFront size={16} /> Instructor
              </div>
              <div className="text-right font-black">{activeLesson.instructorName}</div>
            </div>
            <div className="flex items-center justify-between gap-4 rounded border border-zinc-200 bg-zinc-100 p-3">
              <div className="flex min-w-[120px] items-center justify-center gap-2 text-center text-sm font-bold text-zinc-500">
                <MapPin size={16} /> Pickup
              </div>
              <div className="text-right font-black">{activeLesson.pickupLabel}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
