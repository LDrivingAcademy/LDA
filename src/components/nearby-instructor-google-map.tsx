"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LocateFixed } from "lucide-react";
import { LDA_GOOGLE_MAP_STYLES } from "@/lib/google-map-style";
import { getResponsiveWorldMinZoom, watchResponsiveWorldViewport } from "@/lib/google-map-viewport";
import { buildFallbackDrivingRoute, requestGoogleDrivingRoute } from "@/lib/google-driving-route";
import { loadGoogleMaps } from "@/lib/google-maps-loader";

type LatLng = {
  lat: number;
  lng: number;
};

type MapInstructor = {
  id: string;
  name: string;
  distanceMiles: number;
  rating: string;
  car: string;
  transmission: string;
  price: number;
};

type NearbyInstructorGoogleMapProps = {
  postcode: string;
  instructors: MapInstructor[];
  selectedInstructorId: string;
  userPosition: LatLng | null;
  positionSource?: "live" | "pickup";
  onSelectInstructor: (instructorId: string) => void;
};

const FALLBACK_CENTER = { lat: 51.6538, lng: -0.1997 };
const INSTRUCTOR_BEARINGS = [210, 52, 126, 300, 15];
const DEFAULT_MAP_ZOOM = 13;
const PICKUP_ONLY_ZOOM = 15;
const MAX_AUTO_FIT_ZOOM = 15;

function googleWindow() {
  if (typeof window === "undefined") {
    return {} as Record<string, any>;
  }

  return window as unknown as Record<string, any>;
}

function formatMoney(pence: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP"
  }).format(pence / 100);
}

function pointFromDistance(center: LatLng, distanceMiles: number, bearingDegrees: number) {
  const distanceKm = distanceMiles * 1.609344;
  const earthRadiusKm = 6371;
  const bearing = (bearingDegrees * Math.PI) / 180;
  const lat1 = (center.lat * Math.PI) / 180;
  const lng1 = (center.lng * Math.PI) / 180;
  const angularDistance = distanceKm / earthRadiusKm;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
      Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing)
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2)
    );

  return {
    lat: (lat2 * 180) / Math.PI,
    lng: (lng2 * 180) / Math.PI
  };
}

function markerIcon(label: string, isSelected: boolean, isLearner = false) {
  const google = googleWindow().google;

  if (isLearner) {
    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="128" height="72" viewBox="0 0 128 72">
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#000" flood-opacity=".25"/>
          </filter>
          <circle cx="32" cy="34" r="24" fill="#2563eb" fill-opacity=".18"/>
          <circle filter="url(#shadow)" cx="32" cy="34" r="13" fill="#2563eb" stroke="#fff" stroke-width="5"/>
          <circle cx="32" cy="34" r="5" fill="#bfdbfe"/>
          <rect filter="url(#shadow)" x="54" y="17" width="66" height="34" rx="17" fill="#fff" stroke="#bfdbfe" stroke-width="2"/>
          <text x="87" y="39" text-anchor="middle" font-family="Arial, sans-serif" font-size="15" font-weight="900" fill="#1d4ed8">You</text>
        </svg>
      `)}`,
      scaledSize: new google.maps.Size(104, 58),
      anchor: new google.maps.Point(26, 34)
    };
  }

  if (isLearner) {
    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="128" height="72" viewBox="0 0 128 72">
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#000" flood-opacity=".25"/>
          </filter>
          <path filter="url(#shadow)" d="M30 4c14.4 0 26 11.6 26 26 0 18.5-26 38-26 38S4 48.5 4 30C4 15.6 15.6 4 30 4Z" fill="#e50914" stroke="#fff" stroke-width="5"/>
          <rect filter="url(#shadow)" x="48" y="14" width="60" height="34" rx="17" fill="#fff" stroke="#e5e7eb" stroke-width="2"/>
          <text x="30" y="38" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="900" fill="#fff">•</text>
          <text x="78" y="37" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="900" fill="#111">You</text>
        </svg>
      `)}`,
      scaledSize: new google.maps.Size(92, 58),
      anchor: new google.maps.Point(24, 56)
    };
  }

  const fill = isSelected ? "#e50914" : "#111111";

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="60" height="72" viewBox="0 0 60 72">
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="5" stdDeviation="4" flood-color="#000" flood-opacity=".28"/>
        </filter>
        <path filter="url(#shadow)" d="M30 4c14.4 0 26 11.6 26 26 0 18.5-26 38-26 38S4 48.5 4 30C4 15.6 15.6 4 30 4Z" fill="${fill}" stroke="#fff" stroke-width="5"/>
        <text x="30" y="38" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="900" fill="#fff">${label}</text>
      </svg>
    `)}`,
    scaledSize: new google.maps.Size(48, 58),
    anchor: new google.maps.Point(24, 56)
  };
}

export function NearbyInstructorGoogleMap({
  postcode,
  instructors,
  selectedInstructorId,
  userPosition,
  positionSource,
  onSelectInstructor
}: NearbyInstructorGoogleMapProps) {
  const mapElementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const learnerMarkerRef = useRef<any>(null);
  const instructorMarkersRef = useRef<Array<{ id: string; marker: any; line: any }>>([]);
  const infoWindowRef = useRef<any>(null);
  const userInteractedRef = useRef(false);
  const onSelectInstructorRef = useRef(onSelectInstructor);
  const [mapState, setMapState] = useState<"loading" | "ready" | "missing-key" | "error">("loading");
  const [hasUserMovedMap, setHasUserMovedMap] = useState(false);
  const center = userPosition ?? FALLBACK_CENTER;
  const isLivePosition = Boolean(userPosition && positionSource === "live");
  const learnerMarkerTitle = userPosition ? (isLivePosition ? "Your live location" : "Your pickup location") : "Your pickup area";
  const instructorSignature = useMemo(
    () =>
      instructors
        .map(
          (instructor) =>
            `${instructor.id}:${instructor.name}:${instructor.distanceMiles}:${instructor.rating}:${instructor.car}:${instructor.transmission}:${instructor.price}`
        )
        .join("|"),
    [instructors]
  );
  const instructorPositions = useMemo(
    () =>
      instructors.map((instructor, index) => ({
        instructor,
        position: pointFromDistance(center, instructor.distanceMiles, INSTRUCTOR_BEARINGS[index % INSTRUCTOR_BEARINGS.length])
      })),
    [center.lat, center.lng, instructorSignature]
  );
  const fallbackMapUrl = `https://www.google.com/maps?q=${encodeURIComponent(`${center.lat},${center.lng}`)}&z=13&output=embed`;

  useEffect(() => {
    onSelectInstructorRef.current = onSelectInstructor;
  }, [onSelectInstructor]);

  const fitMapToLearnerAndInstructors = useCallback(() => {
    const google = googleWindow().google;

    if (!mapRef.current || !google?.maps) return;

    mapRef.current.setMapTypeId(google.maps.MapTypeId.ROADMAP);
    mapRef.current.setTilt(0);
    mapRef.current.setHeading(0);

    if (!instructorPositions.length) {
      mapRef.current.setCenter(center);
      mapRef.current.setZoom(PICKUP_ONLY_ZOOM);
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    bounds.extend(center);
    instructorPositions.forEach(({ position }) => bounds.extend(position));

    const hasBounds = typeof bounds.isEmpty === "function" ? !bounds.isEmpty() : true;
    if (hasBounds) {
      mapRef.current.fitBounds(bounds, 72);
      google.maps.event.addListenerOnce(mapRef.current, "idle", () => {
        if (mapRef.current && mapRef.current.getZoom() > MAX_AUTO_FIT_ZOOM) {
          mapRef.current.setZoom(MAX_AUTO_FIT_ZOOM);
        }
      });
    }
  }, [center, instructorPositions]);

  useEffect(() => {
    let cancelled = false;
    let mapElement: HTMLDivElement | null = null;
    let cleanupResponsiveViewport: (() => void) | null = null;
    const markUserInteraction = () => {
      userInteractedRef.current = true;
      setHasUserMovedMap(true);
    };

    loadGoogleMaps()
      .then(() => {
        const google = googleWindow().google;

        if (cancelled || !mapElementRef.current || !google?.maps) return;

        mapRef.current = new google.maps.Map(mapElementRef.current, {
          center,
          zoom: DEFAULT_MAP_ZOOM,
          minZoom: getResponsiveWorldMinZoom(mapElementRef.current),
          backgroundColor: "#eef2ef",
          disableDefaultUI: false,
          mapTypeControl: false,
          mapTypeId: google.maps.MapTypeId.ROADMAP,
          streetViewControl: false,
          fullscreenControl: true,
          clickableIcons: true,
          gestureHandling: "greedy",
          tilt: 0,
          heading: 0,
          styles: LDA_GOOGLE_MAP_STYLES
        });
        infoWindowRef.current = new google.maps.InfoWindow();
        cleanupResponsiveViewport = watchResponsiveWorldViewport(mapRef.current, mapElementRef.current, google.maps);
        mapRef.current.addListener("dragstart", markUserInteraction);
        mapElement = mapElementRef.current;
        mapElement.addEventListener("pointerdown", markUserInteraction, { passive: true });
        mapElement.addEventListener("wheel", markUserInteraction, { passive: true });
        mapElement.addEventListener("touchstart", markUserInteraction, { passive: true });
        setMapState("ready");
        window.setTimeout(() => {
          if (!cancelled && !userInteractedRef.current) {
            fitMapToLearnerAndInstructors();
          }
        }, 0);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setMapState(error instanceof Error && error.message.includes("API key") ? "missing-key" : "error");
      });

    return () => {
      cancelled = true;
      cleanupResponsiveViewport?.();
      mapElement?.removeEventListener("pointerdown", markUserInteraction);
      mapElement?.removeEventListener("wheel", markUserInteraction);
      mapElement?.removeEventListener("touchstart", markUserInteraction);
    };
  }, []);

  useEffect(() => {
    const google = googleWindow().google;

    if (!mapRef.current || !google?.maps) return;

    mapRef.current.setMapTypeId(google.maps.MapTypeId.ROADMAP);
    mapRef.current.setTilt(0);
    mapRef.current.setHeading(0);

    if (!userInteractedRef.current) {
      mapRef.current.panTo(center);
    }

    if (!learnerMarkerRef.current) {
      learnerMarkerRef.current = new google.maps.Marker({
        map: mapRef.current,
        position: center,
        title: learnerMarkerTitle,
        icon: markerIcon("You", true, true),
        zIndex: 100
      });
    } else {
      learnerMarkerRef.current.setPosition(center);
      learnerMarkerRef.current.setTitle(learnerMarkerTitle);
    }

  }, [center.lat, center.lng, isLivePosition, learnerMarkerTitle, mapState, userPosition]);

  useEffect(() => {
    const google = googleWindow().google;

    if (!mapRef.current || !google?.maps) return;

    instructorMarkersRef.current.forEach(({ marker, line }) => {
      marker.setMap(null);
      line.setMap(null);
    });
    instructorMarkersRef.current = [];

    const bounds = new google.maps.LatLngBounds();
    bounds.extend(center);

    instructorMarkersRef.current = instructorPositions.map(({ instructor, position }) => {
      bounds.extend(position);

      const line = new google.maps.Polyline({
        geodesic: false,
        map: mapRef.current,
        path: [],
        strokeColor: "#e50914",
        strokeOpacity: 0.55,
        strokeWeight: 3,
        zIndex: 1
      });

      if (instructor.id === selectedInstructorId) {
        requestGoogleDrivingRoute(google.maps, center, position).then((route) => {
          if (route?.path.length) {
            line.setPath(route.path);
            return;
          }

          line.setPath(buildFallbackDrivingRoute(center, position));
        });
      }

      const marker = new google.maps.Marker({
        map: mapRef.current,
        position,
        title: `${instructor.name} is ${instructor.distanceMiles} miles away`,
        icon: markerIcon(instructor.name.slice(0, 1), false),
        zIndex: 10
      });

      marker.addListener("click", () => {
        onSelectInstructorRef.current(instructor.id);
        infoWindowRef.current?.setContent(`
          <div style="font-family: Arial, sans-serif; max-width: 220px;">
            <strong style="font-size: 16px;">${instructor.name}</strong>
            <div style="margin-top: 6px;">${instructor.distanceMiles} miles away</div>
            <div>${instructor.rating} rating · ${formatMoney(instructor.price)}/hr</div>
            <div>${instructor.car} · ${instructor.transmission}</div>
          </div>
        `);
        infoWindowRef.current?.open({ map: mapRef.current, anchor: marker });
      });

      return { id: instructor.id, marker, line };
    });

    const hasBounds = typeof bounds.isEmpty === "function" ? !bounds.isEmpty() : true;
    if (hasBounds && !userInteractedRef.current) {
      if (!instructorPositions.length) {
        mapRef.current.setCenter(center);
        mapRef.current.setZoom(PICKUP_ONLY_ZOOM);
      } else {
        mapRef.current.fitBounds(bounds, 72);
        google.maps.event.addListenerOnce(mapRef.current, "idle", () => {
          if (mapRef.current && mapRef.current.getZoom() > MAX_AUTO_FIT_ZOOM) {
            mapRef.current.setZoom(MAX_AUTO_FIT_ZOOM);
          }
        });
      }
    }
  }, [center.lat, center.lng, instructorPositions, mapState, selectedInstructorId]);

  function recenterMap() {
    userInteractedRef.current = false;
    setHasUserMovedMap(false);
    fitMapToLearnerAndInstructors();
  }

  useEffect(() => {
    instructorMarkersRef.current.forEach(({ id, marker, line }) => {
      const isSelected = id === selectedInstructorId;
      const label = instructors.find((instructor) => instructor.id === id)?.name.slice(0, 1) ?? "";

      marker.setIcon(markerIcon(label, isSelected));
      marker.setZIndex(isSelected ? 15 : 10);
      line.setOptions({
        strokeColor: "#e50914",
        strokeOpacity: isSelected ? 0.55 : 0,
        strokeWeight: 3,
        zIndex: isSelected ? 5 : 1
      });
    });
  }, [instructors, selectedInstructorId]);

  return (
    <div className="lda-polished-map lda-responsive-map relative mt-5 h-[420px] overflow-hidden rounded border border-zinc-200 bg-[#eef2ef] shadow-inner">
      <div ref={mapElementRef} className="h-full w-full" aria-label="Google map showing your live location and nearby demo instructors" />
      {mapState !== "ready" ? (
        <div className="absolute inset-0 bg-white">
          <iframe
            title="Pickup area map"
            src={fallbackMapUrl}
            className="h-full w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          <div className="absolute inset-x-4 bottom-4 rounded border border-zinc-200 bg-white/95 p-4 text-center shadow-sm">
            <p className="text-xl font-black">
              {mapState === "loading" ? "Loading live map..." : "Map fallback active"}
            </p>
            <p className="mt-2 max-w-md text-sm font-bold leading-6 text-zinc-600">
              {mapState === "missing-key"
                ? "The pickup area is still shown. The full interactive map is temporarily unavailable."
                : "The pickup area is still shown while LDA reconnects the full interactive Google map."}
            </p>
          </div>
        </div>
      ) : null}
      <div className="hidden">
        Nearby demo instructor locations
      </div>
      <div className="hidden">
        {userPosition ? `${isLivePosition ? "Live" : "Pickup"}: ${userPosition.lat.toFixed(4)}, ${userPosition.lng.toFixed(4)}` : postcode || "Pickup not set"}
      </div>
      <div className="hidden">
        Instructor pins around the selected pickup point
      </div>
      {hasUserMovedMap ? (
      <button
        type="button"
        onClick={recenterMap}
        className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-3 py-2 text-xs font-black text-zinc-700 shadow-sm hover:ring-2 hover:ring-brand"
      >
        <LocateFixed size={15} /> Re-centre map
      </button>
      ) : null}
    </div>
  );
}
