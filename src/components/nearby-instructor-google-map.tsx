"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
  onSelectInstructor: (instructorId: string) => void;
};

const FALLBACK_CENTER = { lat: 51.6538, lng: -0.1997 };
const FIVE_MILES_IN_METRES = 8047;
const INSTRUCTOR_BEARINGS = [210, 52, 126, 300, 15];
const MIN_PROFESSIONAL_MAP_ZOOM = 10;
const LOCAL_MAP_RESTRICTION = {
  north: 52.25,
  south: 51.1,
  west: -0.8,
  east: 0.35
};

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

function loadGoogleMaps() {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!key) {
    return Promise.reject(new Error("Google Maps API key is missing."));
  }

  const globalWindow = googleWindow();

  if (globalWindow.google?.maps) {
    return Promise.resolve();
  }

  if (globalWindow.__ldaGoogleMapsPromise) {
    return globalWindow.__ldaGoogleMapsPromise;
  }

  globalWindow.__ldaGoogleMapsPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>("script[data-lda-google-maps], script[src*='maps.googleapis.com/maps/api/js']");

    if (existingScript) {
      if (googleWindow().google?.maps) {
        resolve();
        return;
      }

      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Google Maps could not load.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.dataset.ldaGoogleMaps = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Maps could not load."));
    document.head.appendChild(script);
  });

  return globalWindow.__ldaGoogleMapsPromise;
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
        <svg xmlns="http://www.w3.org/2000/svg" width="116" height="72" viewBox="0 0 116 72">
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="5" stdDeviation="4" flood-color="#000" flood-opacity=".28"/>
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
  onSelectInstructor
}: NearbyInstructorGoogleMapProps) {
  const mapElementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const learnerMarkerRef = useRef<any>(null);
  const instructorMarkersRef = useRef<Array<{ id: string; marker: any; line: any }>>([]);
  const radiusRef = useRef<any>(null);
  const infoWindowRef = useRef<any>(null);
  const hasFittedBoundsRef = useRef(false);
  const userInteractedRef = useRef(false);
  const onSelectInstructorRef = useRef(onSelectInstructor);
  const [mapState, setMapState] = useState<"loading" | "ready" | "missing-key" | "error">("loading");
  const center = userPosition ?? FALLBACK_CENTER;
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

  useEffect(() => {
    onSelectInstructorRef.current = onSelectInstructor;
  }, [onSelectInstructor]);

  useEffect(() => {
    let cancelled = false;
    let mapElement: HTMLDivElement | null = null;
    const markUserInteraction = () => {
      userInteractedRef.current = true;
    };

    loadGoogleMaps()
      .then(() => {
        const google = googleWindow().google;

        if (cancelled || !mapElementRef.current || !google?.maps) return;

        mapRef.current = new google.maps.Map(mapElementRef.current, {
          center,
          zoom: 13,
          minZoom: MIN_PROFESSIONAL_MAP_ZOOM,
          backgroundColor: "#eef2ef",
          disableDefaultUI: false,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          clickableIcons: true,
          gestureHandling: "greedy",
          restriction: {
            latLngBounds: LOCAL_MAP_RESTRICTION,
            strictBounds: false
          },
          styles: [
            {
              featureType: "poi.business",
              stylers: [{ visibility: "off" }]
            }
          ]
        });
        infoWindowRef.current = new google.maps.InfoWindow();
        mapRef.current.addListener("dragstart", markUserInteraction);
        mapElement = mapElementRef.current;
        mapElement.addEventListener("pointerdown", markUserInteraction, { passive: true });
        mapElement.addEventListener("wheel", markUserInteraction, { passive: true });
        mapElement.addEventListener("touchstart", markUserInteraction, { passive: true });
        setMapState("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setMapState(error instanceof Error && error.message.includes("API key") ? "missing-key" : "error");
      });

    return () => {
      cancelled = true;
      mapElement?.removeEventListener("pointerdown", markUserInteraction);
      mapElement?.removeEventListener("wheel", markUserInteraction);
      mapElement?.removeEventListener("touchstart", markUserInteraction);
    };
  }, []);

  useEffect(() => {
    const google = googleWindow().google;

    if (!mapRef.current || !google?.maps) return;

    if (!userInteractedRef.current) {
      mapRef.current.panTo(center);
    }

    if (!learnerMarkerRef.current) {
      learnerMarkerRef.current = new google.maps.Marker({
        map: mapRef.current,
        position: center,
        title: "You / pickup point",
        icon: markerIcon("You", true, true),
        zIndex: 100
      });
    } else {
      learnerMarkerRef.current.setPosition(center);
    }

    if (!radiusRef.current) {
      radiusRef.current = new google.maps.Circle({
        map: mapRef.current,
        center,
        radius: FIVE_MILES_IN_METRES,
        strokeColor: "#e50914",
        strokeOpacity: 0.55,
        strokeWeight: 2,
        fillColor: "#e50914",
        fillOpacity: 0.05
      });
    } else {
      radiusRef.current.setCenter(center);
    }
  }, [center.lat, center.lng]);

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
        map: mapRef.current,
        path: [center, position],
        strokeColor: "#111111",
        strokeOpacity: 0.18,
        strokeWeight: 2,
        zIndex: 1
      });

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
    if (!hasFittedBoundsRef.current && hasBounds) {
      mapRef.current.fitBounds(bounds, 72);
      if (mapRef.current.getZoom?.() < MIN_PROFESSIONAL_MAP_ZOOM) {
        mapRef.current.setZoom(MIN_PROFESSIONAL_MAP_ZOOM);
      }
      hasFittedBoundsRef.current = true;
    }
  }, [center.lat, center.lng, instructorPositions]);

  useEffect(() => {
    instructorMarkersRef.current.forEach(({ id, marker, line }) => {
      const isSelected = id === selectedInstructorId;
      const label = instructors.find((instructor) => instructor.id === id)?.name.slice(0, 1) ?? "";

      marker.setIcon(markerIcon(label, isSelected));
      marker.setZIndex(isSelected ? 15 : 10);
      line.setOptions({
        strokeColor: isSelected ? "#e50914" : "#111111",
        strokeOpacity: isSelected ? 0.55 : 0.18,
        strokeWeight: isSelected ? 3 : 2,
        zIndex: isSelected ? 5 : 1
      });
    });
  }, [instructors, selectedInstructorId]);

  return (
    <div className="lda-polished-map relative mt-5 h-[420px] overflow-hidden rounded border border-zinc-200 bg-[#eef2ef] shadow-inner">
      <div ref={mapElementRef} className="h-full w-full" aria-label="Google map showing your live location and nearby demo instructors" />
      {mapState !== "ready" ? (
        <div className="absolute inset-0 grid place-items-center bg-white/95 p-6 text-center">
          <div>
            <p className="text-xl font-black">
              {mapState === "loading" ? "Loading Google Maps..." : "Google Maps needs setup"}
            </p>
            <p className="mt-2 max-w-md text-sm font-bold leading-6 text-zinc-600">
              {mapState === "missing-key"
                ? "Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in Vercel to show the live Google map."
                : "The map could not load just now. The instructor list below still works."}
            </p>
          </div>
        </div>
      ) : null}
      <div className="pointer-events-none absolute bottom-4 right-4 rounded border border-zinc-300 bg-white/95 px-3 py-2 text-xs font-black text-zinc-700 shadow-sm">
        5 mile local radius · demo instructor locations
      </div>
      <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-zinc-300 bg-white px-3 py-2 text-xs font-black text-zinc-700 shadow-sm">
        {userPosition ? `Live: ${userPosition.lat.toFixed(4)}, ${userPosition.lng.toFixed(4)}` : postcode}
      </div>
    </div>
  );
}
