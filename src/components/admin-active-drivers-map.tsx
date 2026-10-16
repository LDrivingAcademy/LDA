"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, LocateFixed, MapPinned, RefreshCcw } from "lucide-react";

import {
  activeDriverRefreshMs,
  type AdminActiveDriver,
  type AdminStaleSignedOnInstructor
} from "@/lib/admin-active-driver-locations";
import { LDA_GOOGLE_MAP_STYLES } from "@/lib/google-map-style";
import { getResponsiveWorldMinZoom, watchResponsiveWorldViewport } from "@/lib/google-map-viewport";
import { animateMarkerTo } from "@/lib/google-map-smooth-marker";
import { loadGoogleMaps } from "@/lib/google-maps-loader";

type DriverLocationResponse = {
  ok?: boolean;
  drivers?: AdminActiveDriver[];
  staleSignedOnInstructors?: AdminStaleSignedOnInstructor[];
  generatedAt?: string;
  liveWindowSeconds?: number;
};

const DEFAULT_CENTER = { lat: 52.3555, lng: -1.1743 };
const DEFAULT_ZOOM = 6;
const SINGLE_DRIVER_ZOOM = 16;
const MAX_AUTO_FIT_ZOOM = 16;

function googleWindow() {
  if (typeof window === "undefined") {
    return {} as Record<string, any>;
  }

  return window as unknown as Record<string, any>;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDateTime(value?: string | null) {
  if (!value) return "Not recorded";

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Europe/London"
  }).format(new Date(value));
}

function formatAccuracy(value: number | null) {
  if (typeof value !== "number") return "Accuracy not shared";
  return value < 1000 ? `${value}m` : `${(value / 1000).toFixed(2)}km`;
}

function accuracyStatus(driver: AdminActiveDriver) {
  if (driver.emergencyGrade) return "Emergency-grade";
  if (typeof driver.accuracyMeters === "number") return "Low accuracy - not emergency-grade";
  return "Not emergency-grade";
}

function formatSpeed(value: number | null) {
  if (typeof value !== "number") return "Not shared";
  return `${(value * 2.236936).toFixed(1)} mph`;
}

function formatHeading(value: number | null) {
  if (typeof value !== "number") return "Not shared";
  return `${Math.round(value)} degrees`;
}

function sourceLabel(value: string | null) {
  if (!value) return "Browser GPS";
  return value.replace(/_/g, " ");
}

function staleReasonLabel(reason: AdminStaleSignedOnInstructor["reason"]) {
  switch (reason) {
    case "missing_ping":
      return "No live GPS ping received";
    case "expired_ping":
      return "Last ping expired";
    case "low_accuracy":
      return "Accuracy needs review";
    default:
      return "Live GPS ping is stale";
  }
}

function googleMapUrl(driver: AdminActiveDriver) {
  return `https://www.google.com/maps/search/?api=1&query=${driver.latitude},${driver.longitude}`;
}

function fallbackMapUrl(driver?: AdminActiveDriver) {
  const center = driver ? `${driver.latitude},${driver.longitude}` : `${DEFAULT_CENTER.lat},${DEFAULT_CENTER.lng}`;
  return `https://www.google.com/maps?q=${encodeURIComponent(center)}&z=${driver ? 15 : DEFAULT_ZOOM}&output=embed`;
}

function liveMarkerIcon() {
  const google = googleWindow().google;

  return {
    path: google.maps.SymbolPath.CIRCLE,
    fillColor: "#e50914",
    fillOpacity: 1,
    strokeColor: "#ffffff",
    strokeWeight: 3,
    scale: 8
  };
}

function popupHtml(driver: AdminActiveDriver, nearestRoad: string) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 310px; color: #111;">
      <strong style="display:block;font-size:16px;margin-bottom:8px;">${escapeHtml(driver.name)}</strong>
      <div style="line-height:1.55;font-size:13px;">
        <div><strong>Latitude:</strong> ${driver.latitude.toFixed(7)}</div>
        <div><strong>Longitude:</strong> ${driver.longitude.toFixed(7)}</div>
        <div><strong>Nearest road/address:</strong> ${escapeHtml(nearestRoad)}</div>
        <div><strong>Last update:</strong> ${escapeHtml(formatDateTime(driver.recordedAt))}</div>
        <div><strong>Accuracy:</strong> ${escapeHtml(formatAccuracy(driver.accuracyMeters))}</div>
        <div><strong>Status:</strong> ${escapeHtml(accuracyStatus(driver))}</div>
        <div><strong>Speed:</strong> ${escapeHtml(formatSpeed(driver.speedMps))}</div>
        <div><strong>Heading:</strong> ${escapeHtml(formatHeading(driver.headingDegrees))}</div>
        <div><strong>Device/source:</strong> ${escapeHtml(sourceLabel(driver.source))}</div>
        <div><strong>Safety alert:</strong> ${escapeHtml(driver.emergencyStatus ?? "None active")}</div>
      </div>
    </div>
  `;
}

export function AdminActiveDriversMap({
  initialDrivers,
  initialStaleSignedOnInstructors,
  liveWindowSeconds
}: {
  initialDrivers: AdminActiveDriver[];
  initialStaleSignedOnInstructors: AdminStaleSignedOnInstructor[];
  liveWindowSeconds: number;
}) {
  const mapElementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRefs = useRef<Map<string, any>>(new Map());
  const infoWindowRef = useRef<any>(null);
  const geocoderRef = useRef<any>(null);
  const userInteractedRef = useRef(false);
  const [drivers, setDrivers] = useState(initialDrivers);
  const [staleSignedOnInstructors, setStaleSignedOnInstructors] = useState(initialStaleSignedOnInstructors);
  const [selectedDriverId, setSelectedDriverId] = useState(initialDrivers[0]?.id ?? "");
  const [mapState, setMapState] = useState<"loading" | "ready" | "missing-key" | "error">("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const [hasUserMovedMap, setHasUserMovedMap] = useState(false);
  const selectedDriver = useMemo(
    () => drivers.find((driver) => driver.id === selectedDriverId) ?? drivers[0] ?? null,
    [drivers, selectedDriverId]
  );

  const fitMapToLiveDrivers = useCallback((force = false) => {
    const google = googleWindow().google;

    if (!mapRef.current || !google?.maps || (!force && userInteractedRef.current)) return;

    if (!drivers.length) {
      mapRef.current.setCenter(DEFAULT_CENTER);
      mapRef.current.setZoom(DEFAULT_ZOOM);
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    drivers.forEach((driver) => bounds.extend({ lat: driver.latitude, lng: driver.longitude }));

    if (drivers.length === 1) {
      mapRef.current.setCenter({ lat: drivers[0].latitude, lng: drivers[0].longitude });
      mapRef.current.setZoom(SINGLE_DRIVER_ZOOM);
      return;
    }

    mapRef.current.fitBounds(bounds, 80);
    google.maps.event.addListenerOnce(mapRef.current, "idle", () => {
      if (mapRef.current && mapRef.current.getZoom() > MAX_AUTO_FIT_ZOOM) {
        mapRef.current.setZoom(MAX_AUTO_FIT_ZOOM);
      }
    });
  }, [drivers]);

  const openDriverPopup = useCallback((driver: AdminActiveDriver, marker: any) => {
    const google = googleWindow().google;
    const fallbackNearestRoad = "Reverse geocoding not available";

    infoWindowRef.current?.setContent(popupHtml(driver, "Looking up nearest road..."));
    infoWindowRef.current?.open({ map: mapRef.current, anchor: marker });

    if (!google?.maps || !geocoderRef.current) {
      infoWindowRef.current?.setContent(popupHtml(driver, fallbackNearestRoad));
      return;
    }

    geocoderRef.current.geocode({ location: { lat: driver.latitude, lng: driver.longitude } }, (results: any[] | null, status: string) => {
      const nearestRoad = status === "OK" && results?.[0]?.formatted_address
        ? String(results[0].formatted_address)
        : fallbackNearestRoad;
      infoWindowRef.current?.setContent(popupHtml(driver, nearestRoad));
    });
  }, []);

  const refreshLocations = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await fetch("/api/admin/active-driver-locations", {
        headers: { accept: "application/json" },
        cache: "no-store"
      });
      const payload = (await response.json().catch(() => ({}))) as DriverLocationResponse;

      if (!response.ok || !payload.ok) return;

      const nextDrivers = payload.drivers ?? [];
      setDrivers(nextDrivers);
      setStaleSignedOnInstructors(payload.staleSignedOnInstructors ?? []);
      setLastRefresh(payload.generatedAt ?? new Date().toISOString());
      setSelectedDriverId((current) => {
        if (nextDrivers.some((driver) => driver.id === current)) return current;
        return nextDrivers[0]?.id ?? "";
      });
    } finally {
      setRefreshing(false);
    }
  }, []);

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
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          minZoom: getResponsiveWorldMinZoom(mapElementRef.current),
          backgroundColor: "#eef2ef",
          disableDefaultUI: false,
          fullscreenControl: true,
          gestureHandling: "greedy",
          mapTypeControl: false,
          mapTypeId: google.maps.MapTypeId.ROADMAP,
          streetViewControl: false,
          styles: LDA_GOOGLE_MAP_STYLES
        });
        infoWindowRef.current = new google.maps.InfoWindow();
        geocoderRef.current = new google.maps.Geocoder();
        cleanupResponsiveViewport = watchResponsiveWorldViewport(mapRef.current, mapElementRef.current, google.maps);
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
      cleanupResponsiveViewport?.();
      markerRefs.current.forEach((marker) => marker.setMap(null));
      markerRefs.current.clear();
      mapElement?.removeEventListener("pointerdown", markUserInteraction);
      mapElement?.removeEventListener("wheel", markUserInteraction);
      mapElement?.removeEventListener("touchstart", markUserInteraction);
    };
  }, []);

  useEffect(() => {
    if (mapState !== "ready") return;
    fitMapToLiveDrivers();
  }, [fitMapToLiveDrivers, mapState]);

  useEffect(() => {
    if (mapState !== "ready") return;

    const interval = window.setInterval(() => {
      void refreshLocations();
    }, activeDriverRefreshMs);

    void refreshLocations();
    return () => window.clearInterval(interval);
  }, [mapState, refreshLocations]);

  useEffect(() => {
    const google = googleWindow().google;
    if (!mapRef.current || !google?.maps) return;

    const liveIds = new Set(drivers.map((driver) => driver.id));
    markerRefs.current.forEach((marker, id) => {
      if (!liveIds.has(id)) {
        marker.setMap(null);
        markerRefs.current.delete(id);
      }
    });

    drivers.forEach((driver) => {
      const position = { lat: driver.latitude, lng: driver.longitude };
      const existing = markerRefs.current.get(driver.id);

      if (existing) {
        animateMarkerTo(existing, position);
        existing.setTitle(`${driver.name} live location`);
        existing.__ldaDriver = driver;
        return;
      }

      const marker = new google.maps.Marker({
        map: mapRef.current,
        position,
        title: `${driver.name} live location`,
        icon: liveMarkerIcon(),
        zIndex: 20
      });
      marker.__ldaDriver = driver;
      marker.addListener("click", () => {
        setSelectedDriverId(driver.id);
        openDriverPopup(marker.__ldaDriver ?? driver, marker);
      });
      markerRefs.current.set(driver.id, marker);
    });
  }, [drivers, mapState, openDriverPopup]);

  useEffect(() => {
    if (!selectedDriver || !mapRef.current) return;
    const marker = markerRefs.current.get(selectedDriver.id);
    if (marker) marker.setIcon(liveMarkerIcon());
  }, [selectedDriver]);

  function recenterMap() {
    userInteractedRef.current = false;
    setHasUserMovedMap(false);
    fitMapToLiveDrivers(true);
  }

  return (
    <section className="grid gap-5">
      <section className="rounded border border-zinc-800 bg-zinc-950 p-5 text-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-black uppercase text-red-200">
              <MapPinned size={17} /> Live safety map
            </div>
            <h2 className="mt-1 text-2xl font-black">Active Driver Safety Map</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-zinc-400">
              Map remains visible at all times. Location accuracy is the real device-reported radius; LDA does not claim pinpoint accuracy when the device cannot provide it.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <div className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm font-black text-emerald-100">
              {liveWindowSeconds}s live window
            </div>
            <button
              type="button"
              onClick={() => void refreshLocations()}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-full border border-zinc-700 px-4 py-3 text-sm font-black text-zinc-100 transition hover:border-red-500 hover:text-white disabled:cursor-wait disabled:opacity-70"
            >
              <RefreshCcw size={16} /> {refreshing ? "Refreshing..." : "Refresh live map"}
            </button>
            {selectedDriver ? (
              <a
                href={googleMapUrl(selectedDriver)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-red-600 px-5 py-3 text-sm font-black text-white transition hover:bg-red-500"
              >
                Open in Google Maps <ExternalLink size={16} />
              </a>
            ) : null}
          </div>
        </div>

        <div className="lda-polished-map lda-responsive-map relative mt-5 h-[560px] overflow-hidden rounded border border-zinc-800 bg-[#eef2ef] shadow-inner">
          <div ref={mapElementRef} className="h-full w-full" aria-label="Admin-only Google map showing live signed-on instructor locations" />
          {mapState !== "ready" ? (
            <div className="absolute inset-0 bg-white">
              <iframe
                title="Active driver safety map fallback"
                src={fallbackMapUrl(selectedDriver ?? undefined)}
                className="h-full w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-x-4 bottom-4 rounded border border-zinc-200 bg-white/95 p-4 text-center text-black shadow-sm">
                <p className="text-xl font-black">
                  {mapState === "loading" ? "Loading live map..." : "Map fallback active"}
                </p>
                <p className="mt-2 text-sm font-bold leading-6 text-zinc-600">
                  {mapState === "missing-key"
                    ? "The Google Maps key is not available to this browser session."
                    : "LDA is reconnecting the full interactive Google map."}
                </p>
              </div>
            </div>
          ) : null}
          {!drivers.length && mapState === "ready" ? (
            <div className="absolute inset-x-4 bottom-4 rounded border border-zinc-200 bg-white/95 p-4 text-center text-black shadow-sm">
              <p className="text-xl font-black">No active instructor locations today</p>
              <p className="mt-2 text-sm font-bold leading-6 text-zinc-600">
                Red dots will appear here when signed-on instructors send fresh location pings.
              </p>
            </div>
          ) : null}
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

        {selectedDriver ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Detail label="Coordinates" value={`${selectedDriver.latitude.toFixed(7)}, ${selectedDriver.longitude.toFixed(7)}`} />
            <Detail label="Accuracy" value={`${formatAccuracy(selectedDriver.accuracyMeters)} - ${accuracyStatus(selectedDriver)}`} />
            <Detail label="Last update" value={formatDateTime(selectedDriver.recordedAt)} />
            <Detail label="Source" value={sourceLabel(selectedDriver.source)} />
            <Detail label="Speed" value={formatSpeed(selectedDriver.speedMps)} />
            <Detail label="Heading" value={formatHeading(selectedDriver.headingDegrees)} />
            <Detail label="Phone" value={selectedDriver.phone ?? "Not recorded"} />
            <Detail label="Safety alert" value={selectedDriver.emergencyStatus ?? "None active"} />
          </div>
        ) : null}

        {drivers.length ? (
          <div className="mt-5 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {drivers.map((driver) => {
              const selected = selectedDriver?.id === driver.id;

              return (
                <button
                  key={driver.id}
                  type="button"
                  onClick={() => {
                    setSelectedDriverId(driver.id);
                    mapRef.current?.panTo({ lat: driver.latitude, lng: driver.longitude });
                  }}
                  className={`rounded border p-4 text-left transition ${
                    selected
                      ? "border-red-500 bg-red-500/10 text-white"
                      : "border-zinc-800 bg-black text-zinc-100 hover:border-red-500 hover:bg-zinc-950"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-lg font-black">{driver.name}</div>
                      <div className="mt-1 truncate text-xs font-semibold text-zinc-400">{driver.email ?? "Email not recorded"}</div>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-1 text-xs font-black ${driver.emergencyGrade ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100" : "border-amber-500/40 bg-amber-500/10 text-amber-100"}`}>
                      {driver.emergencyGrade ? "Emergency-grade" : "Low accuracy"}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-1 text-sm font-semibold text-zinc-300">
                    <span>Last update: {formatDateTime(driver.recordedAt)}</span>
                    <span>Accuracy: {formatAccuracy(driver.accuracyMeters)}</span>
                    <span>Vehicle: {driver.vehicle ?? "Not recorded"}</span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : null}

        {staleSignedOnInstructors.length ? (
          <div className="mt-5 rounded border border-amber-500/30 bg-amber-500/10 p-4">
            <div className="text-sm font-black uppercase text-amber-100">Signed on but not live</div>
            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              {staleSignedOnInstructors.slice(0, 8).map((driver) => (
                <div key={driver.id} className="rounded border border-amber-500/20 bg-black/40 p-3 text-sm font-semibold leading-5 text-amber-50">
                  <div className="font-black">{driver.name}</div>
                  <div>{staleReasonLabel(driver.reason)}</div>
                  <div>Last update: {formatDateTime(driver.lastUpdate)}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {lastRefresh ? (
          <p className="mt-4 text-xs font-bold text-zinc-500">Last refreshed {formatDateTime(lastRefresh)}</p>
        ) : null}
      </section>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-zinc-800 bg-black p-3">
      <div className="text-xs font-black uppercase text-zinc-500">{label}</div>
      <div className="mt-1 break-words text-sm font-black text-zinc-100">{value}</div>
    </div>
  );
}
