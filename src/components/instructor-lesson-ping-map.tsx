"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CarFront, Clock3, LocateFixed, MapPin, Navigation, RadioTower } from "lucide-react";
import { useLiveGpsTracker } from "@/hooks/use-live-gps-tracker";
import { LDA_GOOGLE_MAP_STYLES } from "@/lib/google-map-style";
import { getResponsiveWorldMinZoom, watchResponsiveWorldViewport } from "@/lib/google-map-viewport";
import { buildFallbackDrivingRoute, pointOnRoutePath, requestGoogleDrivingRoute } from "@/lib/google-driving-route";
import type { LiveGpsPoint } from "@/lib/live-gps-utils";
import { instructorWorkLocationEvent, instructorWorkStatusEvent } from "@/lib/instructor-work-live-events";
import { animateMarkerTo } from "@/lib/google-map-smooth-marker";
import { loadGoogleMaps } from "@/lib/google-maps-loader";
import { readCachedLiveLocation, writeCachedLiveLocation } from "@/lib/live-location-client-cache";

type Point = {
  lat: number;
  lng: number;
  label: string;
};

export type InstructorRouteLesson = {
  bookingReference?: string | null;
  learnerName?: string | null;
  pickupAddress: string;
  startsAt?: string | null;
  pickupPoint?: Pick<Point, "lat" | "lng"> | null;
};

declare global {
  interface Window {
    google?: any;
    __ldaGoogleMapsPromise?: Promise<void>;
  }
}

const PING_WINDOW_MINUTES = 20;
const instructorBase: Point = {
  lat: 51.6152,
  lng: -0.1765,
  label: "Waiting for your live instructor GPS"
};

type InstructorLivePosition = {
  lat: number;
  lng: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  recordedAt: string;
  source: string;
};

function liveGpsToInstructorPosition(point: LiveGpsPoint): InstructorLivePosition {
  return {
    lat: point.lat,
    lng: point.lng,
    accuracy: point.accuracy,
    heading: point.heading,
    speed: point.speed,
    recordedAt: point.recordedAt,
    source: point.source ?? "lesson_en_route"
  };
}

function gpsStatusLabel(status: string) {
  switch (status) {
    case "active":
      return "sharing live";
    case "requesting":
      return "requesting permission";
    case "permission_denied":
      return "permission blocked";
    case "unavailable":
      return "unavailable";
    case "gps_lost":
      return "GPS signal lost";
    case "offline":
      return "offline, queued";
    case "stopped":
      return "stopped";
    default:
      return "ready";
  }
}

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

function mapsHandoffUrls(destination: string) {
  const encodedDestination = encodeURIComponent(destination);

  return {
    apple: `https://maps.apple.com/?daddr=${encodedDestination}&dirflg=d`,
    google: `https://www.google.com/maps/dir/?api=1&destination=${encodedDestination}&travelmode=driving`,
    android: `geo:0,0?q=${encodedDestination}`
  };
}

function preferredMapsUrl(destination: string) {
  const urls = mapsHandoffUrls(destination);
  const userAgent = window.navigator.userAgent;
  const isAndroid = /Android/i.test(userAgent);
  const isAppleMobile = /iPhone|iPad|iPod/i.test(userAgent);
  const isTouchMac = /Macintosh/i.test(userAgent) && window.navigator.maxTouchPoints > 1;

  if (isAndroid) return urls.android;
  if (isAppleMobile || isTouchMac) return urls.apple;
  return urls.google;
}

function learnerPingIcon(isActive: boolean) {
  const google = window.google as any;
  const fill = isActive ? "#e50914" : "#71717a";

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="82" height="82" viewBox="0 0 82 82">
        <circle cx="41" cy="41" r="30" fill="${fill}" opacity=".18"/>
        <circle cx="41" cy="41" r="21" fill="${fill}" opacity=".32"/>
        <path d="M41 14c12.7 0 23 10.3 23 23 0 16.3-23 32-23 32S18 53.3 18 37c0-12.7 10.3-23 23-23Z" fill="${fill}" stroke="#fff" stroke-width="5"/>
        <text x="41" y="44" text-anchor="middle" font-family="Arial, sans-serif" font-size="15" font-weight="900" fill="#fff">L</text>
      </svg>
    `)}`,
    scaledSize: new google.maps.Size(64, 64),
    anchor: new google.maps.Point(32, 58)
  };
}

function instructorIcon() {
  const google = window.google as any;

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="24" fill="#111" stroke="#fff" stroke-width="5"/>
        <text x="32" y="38" text-anchor="middle" font-family="Arial, sans-serif" font-size="17" font-weight="900" fill="#fff">I</text>
      </svg>
    `)}`,
    scaledSize: new google.maps.Size(46, 46),
    anchor: new google.maps.Point(23, 23)
  };
}

function FallbackMap({
  isWorking,
  hasLesson,
  isPingActive,
  progress
}: {
  isWorking: boolean;
  hasLesson: boolean;
  isPingActive: boolean;
  progress: number;
}) {
  const carX = 18 + progress * 58;
  const carY = 70 - progress * 38;

  return (
    <div className="lda-responsive-map relative h-[390px] overflow-hidden rounded border border-zinc-200 bg-zinc-100">
      <div className="absolute inset-0 opacity-40">
        <div className="absolute left-10 top-12 h-72 w-px rotate-45 bg-zinc-400" />
        <div className="absolute left-40 top-0 h-96 w-px rotate-12 bg-zinc-300" />
        <div className="absolute left-0 top-44 h-px w-full bg-zinc-300" />
        <div className="absolute left-0 top-24 h-px w-full -rotate-6 bg-zinc-300" />
        <div className="absolute left-0 top-72 h-px w-full rotate-3 bg-zinc-300" />
      </div>
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
        {isWorking && hasLesson ? (
          <>
            <path d="M18 70 C30 58, 40 55, 50 47 S66 34, 76 32" fill="none" stroke="#e50914" strokeDasharray="3 3" strokeLinecap="round" strokeWidth="2" />
            <circle cx="76" cy="32" fill={isPingActive ? "#e50914" : "#71717a"} opacity=".2" r="10" />
            <circle cx="76" cy="32" fill="#ffffff" r="5" />
            <circle cx="76" cy="32" fill={isPingActive ? "#e50914" : "#71717a"} r="3" />
          </>
        ) : null}
        {isWorking ? (
          <>
            <circle cx={hasLesson ? carX : 50} cy={hasLesson ? carY : 52} fill="#111111" r="4.5" />
            <circle cx={hasLesson ? carX : 50} cy={hasLesson ? carY : 52} fill="#ffffff" r="1.6" />
          </>
        ) : null}
      </svg>
      <div className="absolute left-4 top-4 rounded bg-white px-3 py-2 text-sm font-black text-black shadow-sm">
        {!isWorking
          ? "Map standby - Log On to activate"
          : !hasLesson
            ? "Live work map - waiting for a booking"
            : isPingActive
              ? "Learner location ping active"
              : "Ping unlocks 20 minutes before lesson"}
      </div>
    </div>
  );
}

export function InstructorLessonPingMap({
  lesson = null,
  autoStartRoute = false,
  initiallyWorking = false
}: {
  lesson?: InstructorRouteLesson | null;
  autoStartRoute?: boolean;
  initiallyWorking?: boolean;
}) {
  const hasLesson = Boolean(lesson);
  const activePickup: Point = useMemo(
    () => ({
      ...(lesson?.pickupPoint ?? instructorBase),
      label: lesson?.pickupAddress ? `Learner pickup - ${lesson.pickupAddress}` : "No learner pickup assigned"
    }),
    [lesson]
  );
  const activePickupAddress = lesson?.pickupAddress ?? "Waiting for an accepted booking";
  const lessonStartSeed = lesson?.startsAt ? new Date(lesson.startsAt) : new Date(Date.now() + 18 * 60 * 1000);
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const learnerMarkerRef = useRef<any>(null);
  const instructorMarkerRef = useRef<any>(null);
  const routeLineRef = useRef<any>(null);
  const lastRouteRequestRef = useRef<{ key: string; time: number } | null>(null);
  const autoStartAttemptedRef = useRef(false);
  const [progress, setProgress] = useState(0.08);
  const [isEnRoute, setIsEnRoute] = useState(false);
  const [isWorking, setIsWorking] = useState(initiallyWorking);
  const [mapStatus, setMapStatus] = useState<"standby" | "loading" | "ready" | "fallback">(
    initiallyWorking ? "loading" : "standby"
  );
  const [alertStatus, setAlertStatus] = useState("");
  const [routeEstimate, setRouteEstimate] = useState<{ distanceText: string; durationText: string } | null>(null);
  const [routePath, setRoutePath] = useState<Array<Pick<Point, "lat" | "lng">>>([]);
  const [instructorLivePosition, setInstructorLivePosition] = useState<InstructorLivePosition | null>(null);
  const [hasUserMovedMap, setHasUserMovedMap] = useState(false);
  const userInteractedRef = useRef(false);

  const lessonStartsAt = useMemo(() => lessonStartSeed, [lessonStartSeed.getTime()]);
  const [minutesUntilLesson, setMinutesUntilLesson] = useState(() =>
    Math.max(0, Math.ceil((lessonStartsAt.getTime() - Date.now()) / 60000))
  );
  const isPingActive = hasLesson && minutesUntilLesson <= PING_WINDOW_MINUTES;
  const instructorStartPoint: Point = useMemo(
    () =>
      instructorLivePosition
        ? {
            lat: instructorLivePosition.lat,
            lng: instructorLivePosition.lng,
            label: "Your live instructor GPS pin"
          }
        : instructorBase,
    [instructorLivePosition]
  );
  const fallbackRoutePath = useMemo(
    () => buildFallbackDrivingRoute(instructorStartPoint, activePickup),
    [activePickup.lat, activePickup.lng, instructorStartPoint.lat, instructorStartPoint.lng]
  );
  const displayRoutePath = routePath;
  const instructorLocation = useMemo(() => {
    if (instructorLivePosition) {
      return instructorStartPoint;
    }

    if (isEnRoute && displayRoutePath.length > 1) {
      return {
        ...pointOnRoutePath(displayRoutePath, progress),
        label: "Instructor en route"
      };
    }

    return instructorBase;
  }, [displayRoutePath, instructorLivePosition, instructorStartPoint, isEnRoute, progress]);
  const milesAway = distanceMiles(instructorLocation, activePickup);
  const etaMinutes = Math.max(2, Math.round((milesAway / 18) * 60));
  const routeDistanceText = routeEstimate?.distanceText ?? `${milesAway.toFixed(1)} miles`;
  const routeEtaText = routeEstimate?.durationText ?? `${etaMinutes} min`;
  const routeRequestKey = `${instructorStartPoint.lat.toFixed(4)},${instructorStartPoint.lng.toFixed(4)}:${activePickup.lat.toFixed(4)},${activePickup.lng.toFixed(4)}`;
  const liveLocationCacheId = lesson?.bookingReference ?? "working-day";
  const {
    status: gpsStatus,
    error: gpsError,
    lastSentAt: gpsLastSentAt,
    requestCurrentPosition
  } = useLiveGpsTracker({
    enabled: isWorking && hasLesson && isEnRoute && isPingActive,
    source: "lesson_en_route",
    minIntervalMs: 3000,
    minDistanceMeters: 10,
    onMeaningfulPoint: async (point) => {
      const nextPosition = liveGpsToInstructorPosition(point);
      writeCachedLiveLocation("instructor-route", liveLocationCacheId, point);
      writeCachedLiveLocation("instructor-work", "working-day", point);
      setInstructorLivePosition(nextPosition);
      await sendEnRouteAlert(nextPosition, { silent: true });
    }
  });
  const gpsLastSentDisplay = gpsLastSentAt
    ? new Date(gpsLastSentAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : null;

  useEffect(() => {
    setIsWorking(initiallyWorking);
  }, [initiallyWorking]);

  useEffect(() => {
    if (!isWorking) return;

    const cachedPoint =
      readCachedLiveLocation("instructor-route", liveLocationCacheId) ??
      readCachedLiveLocation("instructor-work", "working-day");

    if (cachedPoint) {
      setInstructorLivePosition(liveGpsToInstructorPosition(cachedPoint));
    }
  }, [isWorking, liveLocationCacheId]);

  useEffect(() => {
    const handleWorkStatus = (event: Event) => {
      const detail = (event as CustomEvent<{ isWorking?: boolean }>).detail;
      setIsWorking(detail?.isWorking === true);
    };
    const handleWorkLocation = (event: Event) => {
      const detail = (event as CustomEvent<{ point?: LiveGpsPoint }>).detail;
      if (!detail?.point) return;
      writeCachedLiveLocation("instructor-work", "working-day", detail.point);
      writeCachedLiveLocation("instructor-route", liveLocationCacheId, detail.point);
      setInstructorLivePosition(liveGpsToInstructorPosition(detail.point));
    };

    window.addEventListener(instructorWorkStatusEvent, handleWorkStatus);
    window.addEventListener(instructorWorkLocationEvent, handleWorkLocation);
    return () => {
      window.removeEventListener(instructorWorkStatusEvent, handleWorkStatus);
      window.removeEventListener(instructorWorkLocationEvent, handleWorkLocation);
    };
  }, [liveLocationCacheId]);

  useEffect(() => {
    if (isWorking) return;

    setIsEnRoute(false);
    setProgress(0.08);
    setInstructorLivePosition(null);
    setRoutePath([]);
    setRouteEstimate(null);
    setAlertStatus("");
    setHasUserMovedMap(false);
    userInteractedRef.current = false;
  }, [isWorking]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setMinutesUntilLesson(Math.max(0, Math.ceil((lessonStartsAt.getTime() - Date.now()) / 60000)));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [lessonStartsAt]);

  useEffect(() => {
    if (!isEnRoute) return;

    const interval = window.setInterval(() => {
      setProgress((current) => Math.min(0.94, current + 0.012));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isEnRoute]);

  async function requestInstructorPosition() {
    const point = await requestCurrentPosition();
    if (!point) return null;
    const livePosition = liveGpsToInstructorPosition(point);
    writeCachedLiveLocation("instructor-route", liveLocationCacheId, point);
    writeCachedLiveLocation("instructor-work", "working-day", point);
    setInstructorLivePosition(livePosition);
    return livePosition;
  }

  useEffect(() => {
    if (!isWorking) {
      setMapStatus("standby");
      mapRef.current = null;
      learnerMarkerRef.current = null;
      instructorMarkerRef.current = null;
      routeLineRef.current = null;
      return;
    }

    let cancelled = false;
    let mapElement: HTMLDivElement | null = null;
    let cleanupResponsiveViewport: (() => void) | null = null;
    const markUserInteraction = () => {
      userInteractedRef.current = true;
      setHasUserMovedMap(true);
    };

    setMapStatus("loading");
    loadGoogleMaps()
      .then(() => {
        if (cancelled || !mapElementRef.current || !window.google?.maps) return;

        const maps = window.google.maps;
        const bounds = new maps.LatLngBounds();
        bounds.extend(instructorStartPoint);
        if (hasLesson) {
          bounds.extend(activePickup);
        }

        const map = new maps.Map(mapElementRef.current, {
          center: hasLesson ? activePickup : instructorStartPoint,
          zoom: 13,
          minZoom: getResponsiveWorldMinZoom(mapElementRef.current),
          backgroundColor: "#eef2ef",
          disableDefaultUI: false,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          clickableIcons: false,
          gestureHandling: "greedy",
          styles: LDA_GOOGLE_MAP_STYLES
        });

        routeLineRef.current = new maps.Polyline({
          geodesic: false,
          map,
          path: [],
          strokeColor: "#e50914",
          strokeOpacity: 0.85,
          strokeWeight: 4
        });
        instructorMarkerRef.current = new maps.Marker({
          map,
          position: instructorStartPoint,
          title: instructorStartPoint.label,
          icon: instructorIcon(),
          zIndex: 5
        });
        learnerMarkerRef.current = hasLesson
          ? new maps.Marker({
              map,
              position: activePickup,
              title: activePickup.label,
              icon: learnerPingIcon(isPingActive),
              zIndex: 10
            })
          : null;

        if (hasLesson) {
          map.fitBounds(bounds, 72);
        } else {
          map.setCenter(instructorStartPoint);
          map.setZoom(13);
        }
        cleanupResponsiveViewport = watchResponsiveWorldViewport(map, mapElementRef.current, maps);
        map.addListener("dragstart", markUserInteraction);
        mapElement = mapElementRef.current;
        mapElement.addEventListener("pointerdown", markUserInteraction, { passive: true });
        mapElement.addEventListener("wheel", markUserInteraction, { passive: true });
        mapElement.addEventListener("touchstart", markUserInteraction, { passive: true });
        mapRef.current = map;
        setMapStatus("ready");
      })
      .catch(() => setMapStatus("fallback"));

    return () => {
      cancelled = true;
      cleanupResponsiveViewport?.();
      mapElement?.removeEventListener("pointerdown", markUserInteraction);
      mapElement?.removeEventListener("wheel", markUserInteraction);
      mapElement?.removeEventListener("touchstart", markUserInteraction);
    };
  }, [activePickup.lat, activePickup.lng, hasLesson, isWorking]);

  useEffect(() => {
    animateMarkerTo(instructorMarkerRef.current, instructorLocation);
    instructorMarkerRef.current?.setTitle(instructorLocation.label);
  }, [instructorLocation]);

  useEffect(() => {
    if (!routeLineRef.current) {
      return;
    }

    if (!isWorking || !hasLesson || mapStatus !== "ready" || !window.google?.maps) {
      routeLineRef.current.setPath([]);
      setRoutePath([]);
      setRouteEstimate(null);
      return;
    }

    let cancelled = false;
    const now = Date.now();
    const previousRequest = lastRouteRequestRef.current;

    if (previousRequest?.key === routeRequestKey || (previousRequest && now - previousRequest.time < 5000)) {
      return;
    }

    lastRouteRequestRef.current = { key: routeRequestKey, time: now };

    requestGoogleDrivingRoute(window.google.maps, instructorStartPoint, activePickup).then((route) => {
      if (cancelled) return;

      if (route?.path.length) {
        routeLineRef.current?.setPath(route.path);
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

      routeLineRef.current?.setPath([]);
      setRoutePath([]);
      setRouteEstimate(null);
    });

    return () => {
      cancelled = true;
    };
  }, [
    activePickup.lat,
    activePickup.lng,
    fallbackRoutePath,
    hasLesson,
    instructorStartPoint.lat,
    instructorStartPoint.lng,
    isWorking,
    mapStatus,
    routeRequestKey
  ]);

  useEffect(() => {
    if (!window.google?.maps) return;
    learnerMarkerRef.current?.setIcon(learnerPingIcon(isPingActive));
  }, [isPingActive]);

  function recenterMap() {
    if (!mapRef.current || !window.google?.maps) return;

    userInteractedRef.current = false;
    setHasUserMovedMap(false);
    if (!hasLesson) {
      mapRef.current.setCenter(instructorLocation);
      mapRef.current.setZoom(13);
      return;
    }

    const bounds = new window.google.maps.LatLngBounds();
    bounds.extend(instructorLocation);
    bounds.extend(activePickup);
    mapRef.current.fitBounds(bounds, 72);
  }

  async function sendEnRouteAlert(position: InstructorLivePosition | null, options?: { silent?: boolean }) {
    if (!lesson?.bookingReference) {
      return;
    }

    const silent = options?.silent === true;
    if (!silent) {
      setAlertStatus("Sending learner en-route alert...");
    }

    try {
      const response = await fetch("/api/bookings/en-route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          bookingId: lesson.bookingReference,
          latitude: position?.lat,
          longitude: position?.lng,
          accuracy: position?.accuracy,
          heading: position?.heading,
          speed: position?.speed,
          source: position?.source ?? "lesson_en_route",
          clientRecordedAt: position?.recordedAt,
          silent
        })
      });
      const result = (await response.json().catch(() => ({}))) as { message?: string; error?: string };

      if (!response.ok) {
        throw new Error(result.error || "Learner alert could not be sent.");
      }

      if (!silent) {
        setAlertStatus(result.message || "Learner en-route alert sent.");
      }
    } catch (error) {
      if (silent) {
        console.warn("[instructor-ping] live location refresh failed", error);
        return;
      }

      setAlertStatus(error instanceof Error ? error.message : "Learner alert could not be sent.");
    }
  }

  async function startRouteToLearner() {
    if (!isWorking || !isPingActive) return;

    const latestPosition = await requestInstructorPosition();
    const positionForTracking = latestPosition ?? instructorLivePosition;

    if (!positionForTracking) {
      setAlertStatus("Turn on location permission before starting route tracking so the learner can see your real instructor pin.");
      return;
    }

    setIsEnRoute(true);
    await sendEnRouteAlert(positionForTracking);

    const urls = mapsHandoffUrls(activePickupAddress);
    const url = preferredMapsUrl(activePickupAddress);
    window.location.href = url;

    window.setTimeout(() => {
      if (document.visibilityState === "visible" && url !== urls.google) {
        window.open(urls.google, "_blank", "noopener,noreferrer");
      }
    }, 900);
  }

  useEffect(() => {
    if (!autoStartRoute || !isWorking || !hasLesson || !isPingActive || autoStartAttemptedRef.current) {
      return;
    }

    autoStartAttemptedRef.current = true;
    void startRouteToLearner();
  }, [autoStartRoute, hasLesson, isPingActive, isWorking]);

  return (
    <article className="rounded border border-zinc-200 bg-white p-5 text-black shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div
            className={`inline-flex items-center gap-2 rounded border px-3 py-2 text-sm font-black uppercase ${
              isWorking
                ? "border-emerald-600/40 bg-emerald-50 text-emerald-800"
                : "border-zinc-300 bg-zinc-100 text-zinc-700"
            }`}
          >
            <RadioTower size={16} /> {isWorking ? "Live work map" : "Map standby"}
          </div>
          <h2 className="mt-4 text-2xl font-black">
            {!isWorking ? "Your instructor map is on standby." : hasLesson ? "Next lesson location alert." : "Live map ready for work."}
          </h2>
          <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-zinc-600">
            {!isWorking
              ? "Log On for work to activate live location on this map. While you are logged off, LDA stops working-session GPS updates and keeps the map on standby."
              : hasLesson
                ? `The learner pickup ping unlocks ${PING_WINDOW_MINUTES} minutes before the lesson. Start route tracking when you are heading out, and LDA will open your map app with the learner pickup ready for driving directions.`
                : "Your working location is live. A learner pickup and route will appear only when a real accepted booking is linked to your instructor account."}
          </p>
        </div>
        <div
          className={`rounded border px-4 py-3 text-sm font-black ${
            isWorking ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-zinc-200 bg-zinc-50 text-zinc-800"
          }`}
        >
          {!isWorking ? "Standby" : hasLesson ? `Lesson starts in ${minutesUntilLesson} min` : "Working - no active booking"}
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_320px]">
        <div className="lda-polished-map relative overflow-hidden rounded border border-zinc-200 bg-zinc-100">
          <div
            ref={mapElementRef}
            className={`lda-responsive-map ${isWorking && mapStatus === "ready" ? "block" : "hidden"} h-[390px] w-full`}
            aria-label={isWorking ? "Live instructor work map" : "Instructor map on standby"}
          />
          {!isWorking || mapStatus !== "ready" ? (
            <FallbackMap
              isWorking={isWorking}
              hasLesson={hasLesson}
              isPingActive={isPingActive}
              progress={isEnRoute ? progress : 0.08}
            />
          ) : null}
          {isWorking && hasUserMovedMap ? (
            <button
              type="button"
              onClick={recenterMap}
              className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-3 py-2 text-xs font-black text-zinc-700 shadow-sm hover:ring-2 hover:ring-brand"
            >
              <LocateFixed size={15} /> Re-centre map
            </button>
          ) : null}
        </div>

        <div className="grid content-start gap-3">
          <div className="rounded border border-zinc-200 bg-zinc-50 p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-zinc-500">
              <Clock3 size={16} /> {isWorking ? "Time window" : "Map status"}
            </div>
            <div className="mt-1 text-2xl font-black">
              {!isWorking ? "Standby" : isPingActive ? "Ping active" : hasLesson ? "Locked" : "Live"}
            </div>
          </div>
          <div className="rounded border border-zinc-200 bg-zinc-50 p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-zinc-500"><MapPin size={16} /> Learner pickup</div>
            <div className="mt-1 font-black">{isWorking ? activePickupAddress : "Available after Log On and an accepted booking"}</div>
          </div>
          <div className="rounded border border-zinc-200 bg-zinc-50 p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-zinc-500"><CarFront size={16} /> Route estimate</div>
            <div className="mt-1 font-black">
              {!isWorking ? "Standby" : hasLesson ? `${routeDistanceText} - ${routeEtaText}` : "Waiting for an accepted booking"}
            </div>
          </div>
          <button
            type="button"
            disabled={!isWorking || !isPingActive}
            onClick={startRouteToLearner}
            className={
              isEnRoute
                ? "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded bg-black px-5 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
                : "lda-pill w-full justify-center disabled:cursor-not-allowed disabled:opacity-60"
            }
          >
            <Navigation size={18} /> {isEnRoute ? "Route" : "Start route to learner"}
          </button>
          <p className="text-xs font-bold leading-5 text-zinc-500">
            Opens Apple Maps, Google Maps, or your device map chooser when available. The pickup address is passed in automatically.
          </p>
          <p className="text-xs font-bold leading-5 text-zinc-500">
            Browser GPS: {isWorking ? gpsStatusLabel(gpsStatus) : "standby"}{isWorking && gpsLastSentDisplay ? ` - last shared ${gpsLastSentDisplay}` : ""}
          </p>
          {isWorking && gpsError ? (
            <p className="rounded border border-red-200 bg-red-50 p-3 text-xs font-black leading-5 text-red-950">
              {gpsError}
            </p>
          ) : null}
          {alertStatus ? (
            <p className="rounded border border-zinc-200 bg-zinc-50 p-3 text-xs font-black leading-5 text-zinc-700">
              {alertStatus}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
