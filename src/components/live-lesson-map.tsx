"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CarFront, Clock3, MapPin, Navigation, RadioTower, ShieldCheck } from "lucide-react";

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

type GoogleMap = {
  fitBounds: (bounds: GoogleLatLngBounds, padding?: number) => void;
};

type GoogleMarker = {
  setPosition: (position: Pick<Point, "lat" | "lng">) => void;
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
const initialInstructorLocation = interpolate(instructorStart, learnerPickup, 0.18);

function interpolate(start: Point, end: Point, progress: number): Point {
  return {
    lat: start.lat + (end.lat - start.lat) * progress,
    lng: start.lng + (end.lng - start.lng) * progress,
    label: "Instructor live location"
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

function loadGoogleMaps(apiKey: string) {
  if (window.google?.maps) {
    return Promise.resolve();
  }

  if (!window.__ldaGoogleMapsPromise) {
    window.__ldaGoogleMapsPromise = new Promise<void>((resolve, reject) => {
      const existing = document.getElementById("lda-google-maps-script");
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.id = "lda-google-maps-script";
      script.async = true;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`;
      script.addEventListener("load", () => resolve(), { once: true });
      script.addEventListener("error", reject, { once: true });
      document.head.appendChild(script);
    });
  }

  return window.__ldaGoogleMapsPromise;
}

function FallbackMap({ progress }: { progress: number }) {
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
        <path
          d="M18 70 C30 58, 40 55, 50 47 S66 34, 76 32"
          fill="none"
          stroke="#e30613"
          strokeDasharray="3 3"
          strokeLinecap="round"
          strokeWidth="2"
        />
        <circle cx="76" cy="32" fill="#ffffff" r="5" />
        <circle cx="76" cy="32" fill="#e30613" r="3" />
        <circle cx={carX} cy={carY} fill="#e30613" r="4.5" />
        <circle cx={carX} cy={carY} fill="#ffffff" r="1.6" />
      </svg>
      <div className="absolute left-4 top-4 rounded bg-white px-3 py-2 text-sm font-black text-black shadow-sm">
        Demo live map
      </div>
      <div className="absolute bottom-4 left-4 right-4 rounded border border-red-200 bg-white/90 p-3 text-black backdrop-blur">
        <div className="flex items-center gap-2 text-sm font-bold">
          <RadioTower size={16} className="text-brand" /> Live location refreshes every second
        </div>
      </div>
    </div>
  );
}

export function LiveLessonMap() {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<GoogleMap | null>(null);
  const instructorMarker = useRef<GoogleMarker | null>(null);
  const routeLine = useRef<GooglePolyline | null>(null);
  const googleMapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const [progress, setProgress] = useState(0.18);
  const [mapStatus, setMapStatus] = useState("Demo tracking active");
  const [useFallback, setUseFallback] = useState(!googleMapsKey);

  const instructorLocation = useMemo(
    () => interpolate(instructorStart, learnerPickup, progress),
    [progress]
  );
  const milesAway = distanceMiles(instructorLocation, learnerPickup);
  const etaMinutes = Math.max(2, Math.round((milesAway / 18) * 60));

  useEffect(() => {
    const interval = window.setInterval(() => {
      setProgress((current) => (current >= 0.92 ? 0.18 : current + 0.014));
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!googleMapsKey || !mapRef.current) {
      setMapStatus("Demo tracking active - add Google Maps key for real map tiles");
      setUseFallback(true);
      return;
    }

    let cancelled = false;

    loadGoogleMaps(googleMapsKey)
      .then(() => {
        if (cancelled || !mapRef.current || !window.google?.maps) {
          return;
        }

        const maps = window.google.maps;
        const bounds = new maps.LatLngBounds();
        bounds.extend(instructorStart);
        bounds.extend(learnerPickup);

        const map = new maps.Map(mapRef.current, {
          center: learnerPickup,
          clickableIcons: false,
          disableDefaultUI: true,
          mapTypeControl: false,
          streetViewControl: false,
          zoom: 13
        });
        mapInstance.current = map;
        map.fitBounds(bounds, 80);

        routeLine.current = new maps.Polyline({
          geodesic: true,
          map,
          path: [initialInstructorLocation, learnerPickup],
          strokeColor: "#e30613",
          strokeOpacity: 0.9,
          strokeWeight: 4
        });

        instructorMarker.current = new maps.Marker({
          label: "I",
          map,
          position: initialInstructorLocation,
          title: "Instructor live location"
        });

        new maps.Marker({
          label: "S",
          map,
          position: learnerPickup,
          title: learnerPickup.label
        });

        setMapStatus("Google Maps live tracking preview");
        setUseFallback(false);
      })
      .catch(() => {
        setMapStatus("Demo tracking active - Google Maps could not load");
        setUseFallback(true);
      });

    return () => {
      cancelled = true;
    };
  }, [googleMapsKey]);

  useEffect(() => {
    instructorMarker.current?.setPosition(instructorLocation);
    routeLine.current?.setPath([instructorLocation, learnerPickup]);
  }, [instructorLocation]);

  return (
    <section id="tracking" className="bg-white py-8 text-black">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[420px_1fr] lg:px-8">
        <div>
          <div className="inline-flex items-center gap-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm font-black text-brand">
            <Navigation size={16} /> Live lesson tracking
          </div>
          <h2 className="mt-4 text-3xl font-black tracking-normal sm:text-4xl">
            Show how far the instructor is from the learner.
          </h2>
          <p className="mt-3 text-base leading-7 text-zinc-700">
            Learners can see the instructor approach the pickup postcode, estimated arrival time, and distance remaining. In production this connects to instructor GPS, booking status, and consent controls.
          </p>
          <div className="mt-6 grid gap-3">
            <div className="rounded border border-zinc-200 bg-zinc-100 p-4">
              <div className="text-sm font-bold text-zinc-500">Instructor distance</div>
              <div className="mt-1 text-3xl font-black">{milesAway.toFixed(1)} miles</div>
            </div>
            <div className="rounded border border-zinc-200 bg-zinc-100 p-4">
              <div className="text-sm font-bold text-zinc-500">Estimated arrival</div>
              <div className="mt-1 text-3xl font-black">{etaMinutes} min</div>
            </div>
            <div className="rounded border border-zinc-200 bg-zinc-100 p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 shrink-0 text-brand" size={20} />
                <p className="text-sm leading-6 text-zinc-700">
                  Tracking should only be enabled for accepted bookings, near lesson time, and with clear consent. Store only the minimum location data needed for safety and support.
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="rounded border border-zinc-200 bg-white p-4 shadow-2xl">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-bold uppercase text-brand">Current lesson</div>
              <div className="text-xl font-black">Amelia to EN5 5XY pickup</div>
            </div>
            <div className="rounded bg-red-50 px-3 py-2 text-sm font-black text-brand">{mapStatus}</div>
          </div>
          <div
            ref={mapRef}
            className={`${useFallback ? "hidden" : "block"} h-[360px] overflow-hidden rounded border border-zinc-200 bg-zinc-100`}
          />
          {useFallback ? <FallbackMap progress={progress} /> : null}
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded border border-zinc-200 bg-zinc-100 p-3">
              <div className="flex items-center gap-2 text-sm font-bold text-zinc-500"><CarFront size={16} /> Instructor</div>
              <div className="mt-1 font-black">Amelia Khan</div>
            </div>
            <div className="rounded border border-zinc-200 bg-zinc-100 p-3">
              <div className="flex items-center gap-2 text-sm font-bold text-zinc-500"><MapPin size={16} /> Pickup</div>
              <div className="mt-1 font-black">Barnet EN5</div>
            </div>
            <div className="rounded border border-zinc-200 bg-zinc-100 p-3">
              <div className="flex items-center gap-2 text-sm font-bold text-zinc-500"><Clock3 size={16} /> Refresh</div>
              <div className="mt-1 font-black">1 sec</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
