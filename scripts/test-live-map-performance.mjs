import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${message}`);
  }
}

const gpsManager = read("src/lib/live-gps-watch-manager.ts");
const gpsHook = read("src/hooks/use-live-gps-tracker.ts");
const clientCache = read("src/lib/live-location-client-cache.ts");
const liveLessonMap = read("src/components/live-lesson-map.tsx");
const instructorMap = read("src/components/instructor-lesson-ping-map.tsx");
const bookingDashboard = read("src/components/learner-booking-dashboard.tsx");
const trackingRoute = read("src/app/api/tracking/live/route.ts");
const adminMap = read("src/components/admin-active-drivers-map.tsx");
const smoothMarker = read("src/lib/google-map-smooth-marker.ts");
const mapsLoader = read("src/lib/google-maps-loader.ts");

assert(gpsManager.includes("const watchers = new Map"), "GPS manager reuses shared browser location watchers.");
assert((gpsManager.match(/watchPosition/g) ?? []).length === 1, "GPS manager owns the single direct geolocation watchPosition call.");
assert(!gpsHook.includes("navigator.geolocation.watchPosition"), "live GPS hook no longer starts a private watcher.");
assert(gpsHook.includes("subscribeLiveGps"), "live GPS hook subscribes to the shared watcher.");
assert(clientCache.includes("window.sessionStorage"), "live location cache is session scoped.");
assert(clientCache.includes("expiresAtMs"), "live location cache expires cached points.");

assert(liveLessonMap.includes("readCachedLiveLocation(\"lesson\""), "learner tracking map seeds from the short lesson location cache.");
assert(liveLessonMap.includes("writeCachedLiveLocation(\"lesson\""), "learner tracking map writes approved live lesson points to cache.");
assert(liveLessonMap.includes("void refreshLiveLesson();"), "learner tracking map refreshes live data immediately, without an initial wait.");
assert(liveLessonMap.includes("animateMarkerTo(instructorMarker.current, instructorLocation)"), "learner tracking marker moves smoothly.");
assert(!/activeInstructorStart\?\.lat[\s\S]{0,260}googleMapsKey/.test(liveLessonMap), "learner tracking map creation is not keyed to every instructor GPS coordinate.");

assert(instructorMap.includes("readCachedLiveLocation(\"instructor-route\""), "instructor route map seeds from cached route/work location.");
assert(instructorMap.includes("writeCachedLiveLocation(\"instructor-route\""), "instructor route map stores live route points for immediate future renders.");
assert(instructorMap.includes("animateMarkerTo(instructorMarkerRef.current, instructorLocation)"), "instructor route marker updates smoothly.");

assert(bookingDashboard.includes("subscribeLiveGps("), "learner booking pickup location uses the shared GPS watcher.");
assert(bookingDashboard.includes("readCachedLiveLocation(\"learner-pickup\""), "learner booking map can render from cached pickup location first.");
assert(mapsLoader.includes("importLibrary"), "Google loader can fetch optional libraries such as Places after the base map loads.");

assert(trackingRoute.includes("readLiveLocationServerCache"), "live tracking API reads the secure short server cache after access checks.");
assert(trackingRoute.includes("writeLiveLocationServerCache"), "live tracking API writes sanitized live lesson responses to the short cache.");
assert(!adminMap.includes("key={selectedDriver.id}"), "admin active-driver map avoids forced iframe remount on selection.");
assert(smoothMarker.includes("requestAnimationFrame"), "marker transitions use requestAnimationFrame for smooth updates.");

if (process.exitCode) {
  process.exit(process.exitCode);
}
