"use client";

type LatLng = {
  lat: number;
  lng: number;
};

type SmoothMarker = {
  getPosition?: () => { lat?: () => number; lng?: () => number } | null;
  setPosition: (position: LatLng) => void;
};

const markerAnimations = new WeakMap<SmoothMarker, number>();

function currentMarkerPosition(marker: SmoothMarker): LatLng | null {
  const position = marker.getPosition?.();
  const lat = position?.lat?.();
  const lng = position?.lng?.();
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  return { lat, lng };
}

export function animateMarkerTo(marker: SmoothMarker | null | undefined, next: LatLng, durationMs = 650) {
  if (!marker || typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
    marker?.setPosition(next);
    return;
  }

  const start = currentMarkerPosition(marker);
  if (!start) {
    marker.setPosition(next);
    return;
  }

  const previousFrame = markerAnimations.get(marker);
  if (previousFrame) {
    window.cancelAnimationFrame(previousFrame);
  }

  const startedAt = performance.now();
  const step = (now: number) => {
    const progress = Math.min(1, (now - startedAt) / durationMs);
    const eased = 1 - Math.pow(1 - progress, 3);
    marker.setPosition({
      lat: start.lat + (next.lat - start.lat) * eased,
      lng: start.lng + (next.lng - start.lng) * eased
    });

    if (progress < 1) {
      markerAnimations.set(marker, window.requestAnimationFrame(step));
    } else {
      markerAnimations.delete(marker);
    }
  };

  markerAnimations.set(marker, window.requestAnimationFrame(step));
}
