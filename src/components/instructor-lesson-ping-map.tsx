"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CarFront, Clock3, MapPin, Navigation, RadioTower, XCircle } from "lucide-react";

type Point = {
  lat: number;
  lng: number;
  label: string;
};

declare global {
  interface Window {
    google?: any;
    __ldaGoogleMapsPromise?: Promise<void>;
  }
}

const PING_WINDOW_MINUTES = 20;
const MIN_PROFESSIONAL_MAP_ZOOM = 3;
const learnerPickup: Point = {
  lat: 51.6523,
  lng: -0.1995,
  label: "Learner pickup - EN5 5XY"
};
const instructorBase: Point = {
  lat: 51.6152,
  lng: -0.1765,
  label: "Your instructor location"
};

function loadGoogleMaps() {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!key) {
    return Promise.reject(new Error("Google Maps API key is missing."));
  }

  if (window.google?.maps) {
    return Promise.resolve();
  }

  if (window.__ldaGoogleMapsPromise) {
    return window.__ldaGoogleMapsPromise;
  }

  window.__ldaGoogleMapsPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>("script[data-lda-google-maps], script[src*='maps.googleapis.com/maps/api/js']");

    if (existingScript) {
      if (window.google?.maps) {
        resolve();
        return;
      }

      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Google Maps could not load.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly`;
    script.async = true;
    script.defer = true;
    script.dataset.ldaGoogleMaps = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Maps could not load."));
    document.head.appendChild(script);
  });

  return window.__ldaGoogleMapsPromise;
}

function interpolate(start: Point, end: Point, progress: number): Point {
  return {
    lat: start.lat + (end.lat - start.lat) * progress,
    lng: start.lng + (end.lng - start.lng) * progress,
    label: "Instructor en route"
  };
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

function FallbackMap({ isPingActive, progress }: { isPingActive: boolean; progress: number }) {
  const carX = 18 + progress * 58;
  const carY = 70 - progress * 38;

  return (
    <div className="relative h-[390px] overflow-hidden rounded border border-zinc-200 bg-zinc-100">
      <div className="absolute inset-0 opacity-40">
        <div className="absolute left-10 top-12 h-72 w-px rotate-45 bg-zinc-400" />
        <div className="absolute left-40 top-0 h-96 w-px rotate-12 bg-zinc-300" />
        <div className="absolute left-0 top-44 h-px w-full bg-zinc-300" />
        <div className="absolute left-0 top-24 h-px w-full -rotate-6 bg-zinc-300" />
        <div className="absolute left-0 top-72 h-px w-full rotate-3 bg-zinc-300" />
      </div>
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
        <path d="M18 70 C30 58, 40 55, 50 47 S66 34, 76 32" fill="none" stroke="#e50914" strokeDasharray="3 3" strokeLinecap="round" strokeWidth="2" />
        <circle cx="76" cy="32" fill={isPingActive ? "#e50914" : "#71717a"} opacity=".2" r="10" />
        <circle cx="76" cy="32" fill="#ffffff" r="5" />
        <circle cx="76" cy="32" fill={isPingActive ? "#e50914" : "#71717a"} r="3" />
        <circle cx={carX} cy={carY} fill="#111111" r="4.5" />
        <circle cx={carX} cy={carY} fill="#ffffff" r="1.6" />
      </svg>
      <div className="absolute left-4 top-4 rounded bg-white px-3 py-2 text-sm font-black text-black shadow-sm">
        {isPingActive ? "Learner location ping active" : "Ping unlocks 20 minutes before lesson"}
      </div>
    </div>
  );
}

export function InstructorLessonPingMap() {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const learnerMarkerRef = useRef<any>(null);
  const instructorMarkerRef = useRef<any>(null);
  const routeLineRef = useRef<any>(null);
  const [progress, setProgress] = useState(0.08);
  const [isEnRoute, setIsEnRoute] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);
  const [mapStatus, setMapStatus] = useState<"loading" | "ready" | "fallback">("loading");

  const lessonStartsAt = useMemo(() => new Date(Date.now() + 18 * 60 * 1000), []);
  const [minutesUntilLesson, setMinutesUntilLesson] = useState(() =>
    Math.max(0, Math.ceil((lessonStartsAt.getTime() - Date.now()) / 60000))
  );
  const isPingActive = !isCancelled && minutesUntilLesson <= PING_WINDOW_MINUTES;
  const instructorLocation = useMemo(
    () => (isEnRoute ? interpolate(instructorBase, learnerPickup, progress) : instructorBase),
    [isEnRoute, progress]
  );
  const milesAway = distanceMiles(instructorLocation, learnerPickup);
  const etaMinutes = Math.max(2, Math.round((milesAway / 18) * 60));

  useEffect(() => {
    const interval = window.setInterval(() => {
      setMinutesUntilLesson(Math.max(0, Math.ceil((lessonStartsAt.getTime() - Date.now()) / 60000)));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [lessonStartsAt]);

  useEffect(() => {
    if (!isEnRoute || isCancelled) return;

    const interval = window.setInterval(() => {
      setProgress((current) => Math.min(0.94, current + 0.012));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isCancelled, isEnRoute]);

  useEffect(() => {
    let cancelled = false;

    loadGoogleMaps()
      .then(() => {
        if (cancelled || !mapElementRef.current || !window.google?.maps) return;

        const maps = window.google.maps;
        const bounds = new maps.LatLngBounds();
        bounds.extend(instructorBase);
        bounds.extend(learnerPickup);

        const map = new maps.Map(mapElementRef.current, {
          center: learnerPickup,
          zoom: 13,
          minZoom: MIN_PROFESSIONAL_MAP_ZOOM,
          disableDefaultUI: false,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          clickableIcons: false,
          gestureHandling: "greedy",
          styles: [
            {
              featureType: "poi.business",
              stylers: [{ visibility: "off" }]
            }
          ]
        });

        routeLineRef.current = new maps.Polyline({
          geodesic: true,
          map,
          path: [instructorBase, learnerPickup],
          strokeColor: "#e50914",
          strokeOpacity: 0.85,
          strokeWeight: 4
        });
        instructorMarkerRef.current = new maps.Marker({
          map,
          position: instructorBase,
          title: instructorBase.label,
          icon: instructorIcon(),
          zIndex: 5
        });
        learnerMarkerRef.current = new maps.Marker({
          map,
          position: learnerPickup,
          title: learnerPickup.label,
          icon: learnerPingIcon(isPingActive),
          zIndex: 10
        });

        map.fitBounds(bounds, 72);
        mapRef.current = map;
        setMapStatus("ready");
      })
      .catch(() => setMapStatus("fallback"));

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    instructorMarkerRef.current?.setPosition(instructorLocation);
    routeLineRef.current?.setPath([instructorLocation, learnerPickup]);
  }, [instructorLocation]);

  useEffect(() => {
    if (!window.google?.maps) return;
    learnerMarkerRef.current?.setIcon(learnerPingIcon(isPingActive));
  }, [isPingActive]);

  return (
    <article className="rounded border border-zinc-200 bg-white p-5 text-black shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-black uppercase text-brand">
            <RadioTower size={16} /> Learner pickup ping
          </div>
          <h2 className="mt-4 text-2xl font-black">Next lesson location alert.</h2>
          <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-zinc-600">
            The learner pickup ping unlocks {PING_WINDOW_MINUTES} minutes before the lesson. Start route tracking when you are heading out, or cancel from here if you cannot attend.
          </p>
        </div>
        <div className="rounded border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-black text-zinc-800">
          Lesson starts in {minutesUntilLesson} min
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_320px]">
        <div className="relative overflow-hidden rounded border border-zinc-200 bg-zinc-100">
          <div ref={mapElementRef} className={`${mapStatus === "ready" ? "block" : "hidden"} h-[390px] w-full`} aria-label="Instructor map showing learner pickup ping and route" />
          {mapStatus !== "ready" ? <FallbackMap isPingActive={isPingActive} progress={isEnRoute ? progress : 0.08} /> : null}
          <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-zinc-300 bg-white px-3 py-2 text-xs font-black text-zinc-700 shadow-sm">
            {isPingActive ? "Red learner ping active" : "Pickup hidden until 20 min window"}
          </div>
        </div>

        <div className="grid content-start gap-3">
          <div className="rounded border border-zinc-200 bg-zinc-50 p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-zinc-500"><Clock3 size={16} /> Time window</div>
            <div className="mt-1 text-2xl font-black">{isPingActive ? "Ping active" : "Locked"}</div>
          </div>
          <div className="rounded border border-zinc-200 bg-zinc-50 p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-zinc-500"><MapPin size={16} /> Learner pickup</div>
            <div className="mt-1 font-black">EN5 5XY, Barnet</div>
          </div>
          <div className="rounded border border-zinc-200 bg-zinc-50 p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-zinc-500"><CarFront size={16} /> Route estimate</div>
            <div className="mt-1 font-black">{milesAway.toFixed(1)} miles · {etaMinutes} min</div>
          </div>
          <button
            type="button"
            disabled={!isPingActive || isCancelled}
            onClick={() => setIsEnRoute(true)}
            className="lda-pill w-full justify-center disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Navigation size={18} /> {isEnRoute ? "Tracking en route" : "Start heading to learner"}
          </button>
          <button
            type="button"
            disabled={isCancelled}
            onClick={() => {
              setIsCancelled(true);
              setIsEnRoute(false);
            }}
            className="inline-flex w-full items-center justify-center gap-2 rounded border border-zinc-300 bg-white px-4 py-3 text-sm font-black text-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <XCircle size={18} /> Cancel lesson
          </button>
          {isCancelled ? (
            <div className="rounded border border-red-200 bg-red-50 p-3 text-sm font-bold leading-6 text-brand">
              <AlertTriangle className="mb-2" size={18} /> Cancellation marked for support review. Late cancellation rules may apply.
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
