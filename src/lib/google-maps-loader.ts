"use client";

declare global {
  interface Window {
    google?: any;
    __ldaGoogleMapsPromise?: Promise<void>;
  }
}

function resolveGoogleMapsKey(apiKey?: string) {
  return apiKey || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
}

async function ensureGoogleMapLibraries(libraries?: string[]) {
  if (!libraries?.length || !window.google?.maps) {
    return;
  }

  await Promise.all(
    libraries.map(async (library) => {
      if (library === "places" && window.google?.maps?.places) {
        return;
      }

      if (typeof window.google?.maps?.importLibrary === "function") {
        await window.google.maps.importLibrary(library);
      }
    })
  );
}

export function loadGoogleMaps(apiKey?: string, libraries?: string[]) {
  const key = resolveGoogleMapsKey(apiKey);

  if (!key) {
    return Promise.reject(new Error("Google Maps API key is missing."));
  }

  if (window.google?.maps) {
    return ensureGoogleMapLibraries(libraries);
  }

  if (window.__ldaGoogleMapsPromise) {
    return window.__ldaGoogleMapsPromise.then(() => ensureGoogleMapLibraries(libraries));
  }

  window.__ldaGoogleMapsPromise = new Promise<void>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => reject(new Error("Google Maps took too long to load.")), 8000);
    const resolveLoaded = () => {
      window.clearTimeout(timeoutId);
      resolve();
    };
    const rejectLoad = () => {
      window.clearTimeout(timeoutId);
      reject(new Error("Google Maps could not load."));
    };
    const existingScript = document.querySelector<HTMLScriptElement>("script[data-lda-google-maps], script[src*='maps.googleapis.com/maps/api/js']");

    if (existingScript) {
      if (window.google?.maps) {
        resolveLoaded();
        return;
      }

      existingScript.addEventListener("load", resolveLoaded, { once: true });
      existingScript.addEventListener("error", rejectLoad, { once: true });
      return;
    }

    const script = document.createElement("script");
    const params = new URLSearchParams({
      key,
      v: "weekly"
    });

    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.defer = true;
    script.dataset.ldaGoogleMaps = "true";
    script.onload = resolveLoaded;
    script.onerror = rejectLoad;
    document.head.appendChild(script);
  });

  return window.__ldaGoogleMapsPromise.then(() => ensureGoogleMapLibraries(libraries));
}
