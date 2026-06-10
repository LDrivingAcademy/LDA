const BASE_WORLD_MIN_ZOOM = 2;
const WORLD_TILE_SIZE = 256;
const MAX_AUTO_WORLD_ZOOM = 5;
const WORLD_RESTRICTION_BOUNDS = {
  north: 85,
  south: -85,
  west: -180,
  east: 180
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function getResponsiveWorldMinZoom(element: HTMLElement | null) {
  const height = element?.getBoundingClientRect().height ?? 0;

  if (!height) {
    return BASE_WORLD_MIN_ZOOM;
  }

  return clamp(Math.ceil(Math.log2((height + 8) / WORLD_TILE_SIZE)), BASE_WORLD_MIN_ZOOM, MAX_AUTO_WORLD_ZOOM);
}

export function applyResponsiveWorldViewport(map: any, element: HTMLElement | null, maps: any) {
  if (!map || !element || !maps) {
    return;
  }

  const minZoom = getResponsiveWorldMinZoom(element);
  const currentCenter = typeof map.getCenter === "function" ? map.getCenter() : null;
  const currentZoom = typeof map.getZoom === "function" ? map.getZoom() : minZoom;

  map.setOptions({
    minZoom,
    restriction: {
      latLngBounds: WORLD_RESTRICTION_BOUNDS,
      strictBounds: false
    }
  });

  maps.event?.trigger?.(map, "resize");

  if (currentZoom < minZoom) {
    map.setZoom(minZoom);
  }

  if (currentCenter && typeof map.setCenter === "function") {
    map.setCenter(currentCenter);
  }
}

export function watchResponsiveWorldViewport(map: any, element: HTMLElement | null, maps: any) {
  if (!element) {
    return () => undefined;
  }

  let frame = 0;
  const refresh = () => {
    window.cancelAnimationFrame(frame);
    frame = window.requestAnimationFrame(() => applyResponsiveWorldViewport(map, element, maps));
  };
  const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(refresh) : null;

  applyResponsiveWorldViewport(map, element, maps);
  observer?.observe(element);
  window.addEventListener("resize", refresh);
  document.addEventListener("fullscreenchange", refresh);

  return () => {
    window.cancelAnimationFrame(frame);
    observer?.disconnect();
    window.removeEventListener("resize", refresh);
    document.removeEventListener("fullscreenchange", refresh);
  };
}
