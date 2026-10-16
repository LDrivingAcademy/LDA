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

const page = read("src/app/admin/active-drivers/page.tsx");
const map = read("src/components/admin-active-drivers-map.tsx");
const reader = read("src/lib/admin-active-driver-locations.ts");
const adminApi = read("src/app/api/admin/active-driver-locations/route.ts");
const instructorLocationApi = read("src/app/api/instructor-location/live/route.ts");
const availabilityApi = read("src/app/api/instructor-availability/route.ts");
const gpsHook = read("src/hooks/use-live-gps-tracker.ts");
const gpsUtils = read("src/lib/live-gps-utils.ts");
const cache = read("src/lib/live-location-client-cache.ts");
const instructorPanel = read("src/components/instructor-start-work-panel.tsx");
const migration = read("supabase/migrations/20260906233000_active_driver_safety_map_hardening.sql");

assert(page.includes("readAdminActiveDriverLocations"), "active driver page uses the shared safety map reader.");
assert(page.includes("admin.live_location.read"), "admin page records a live location audit event.");
assert(page.includes("AdminActiveDriversMap"), "active driver page still renders the existing map component slot.");

assert(!/if \(!drivers\.length\)[\s\S]{0,500}return \(/.test(map), "admin map no longer hides when there are zero live drivers.");
assert(map.includes("No active instructor locations today"), "admin map keeps a clean empty state over the visible map.");
assert(map.includes("new google.maps.Map"), "admin map renders an interactive Google map.");
assert(!map.includes("Live signed-on instructors"), "admin map removes the redundant left live-instructor summary panel.");
assert(!map.includes("lg:grid-cols-[390px_minmax(0,1fr)]"), "admin safety map spans the full available width instead of reserving a sidebar column.");
assert(map.includes("Refresh live map"), "admin map keeps manual refresh in the full-width map header.");
assert(map.includes("google.maps.SymbolPath.CIRCLE"), "live instructors use circular red-dot Google markers.");
assert(map.includes("fillColor: \"#e50914\""), "live instructor marker colour is LDA red.");
assert(map.includes("animateMarkerTo"), "live marker updates are smoothed without rebuilding the map.");
assert(map.includes("setInterval") && map.includes("activeDriverRefreshMs"), "admin map refreshes live locations on a controlled interval.");
assert(map.includes("/api/admin/active-driver-locations"), "admin map refreshes through the secure admin API.");
assert(map.includes("Reverse geocoding not available") && map.includes("geocoderRef.current.geocode"), "marker popups attempt nearest road/address lookup without requiring it.");
assert(map.includes("Latitude:") && map.includes("Longitude:"), "marker popup shows exact coordinates.");
assert(map.includes("Accuracy:") && map.includes("accuracyStatus"), "marker popup shows actual accuracy and emergency-grade status.");
assert(map.includes("Speed:") && map.includes("Heading:"), "marker popup shows speed and heading when available.");
assert(map.includes("Device/source:"), "marker popup shows device/source metadata.");
assert(!map.includes("<strong>Work status:</strong>"), "marker popup does not show redundant work status.");

assert(reader.includes("activeDriverLiveWindowMs = 45_000"), "live driver freshness window is 45 seconds.");
assert(reader.includes(".from(\"availability_slots\")"), "reader checks signed-on work windows.");
assert(reader.includes(".eq(\"is_booked\", false)"), "reader only treats open work windows as signed-on sessions.");
assert(reader.includes(".from(\"instructor_live_locations\")"), "reader uses instructor work GPS pings for the admin safety map.");
assert(reader.includes("location.is_active === false"), "inactive sign-off rows cannot appear as live markers.");
assert(reader.includes("nowMs - recordedAtMs > activeDriverLiveWindowMs"), "stale pings are removed from the live marker layer.");
assert(reader.includes("staleSignedOnInstructors"), "stale signed-on instructors are separated from map markers.");
assert(!reader.includes("booking_id,learner_id,latitude"), "reader does not expose learner route locations to the admin active-driver marker layer.");

assert(adminApi.includes("requireAdminDashboardClient"), "live location refresh API requires approved admin dashboard access.");
assert(adminApi.includes("applyAdminSecurityHeaders"), "live location refresh API applies privileged no-store/noindex security headers.");
assert(adminApi.includes("admin.live_location.refresh"), "live location refresh API writes an audit event.");
assert(adminApi.includes("isRateLimited"), "live location refresh API is rate limited.");

assert(instructorLocationApi.includes("activeDriverLiveWindowMs"), "instructor location pings expire using the active-driver live window.");
assert(instructorLocationApi.includes("is_active: true"), "new instructor pings are marked active.");
assert(instructorLocationApi.includes("hasActiveWorkWindow"), "instructors can only send live work pings while signed on.");
assert(!instructorLocationApi.includes("Math.round(Math.max(0, accuracy))"), "instructor ping storage keeps reported accuracy precision.");

assert(availabilityApi.includes("is_active: false"), "sign-off marks existing live locations inactive.");
assert(availabilityApi.includes(".update({ expires_at: now })"), "sign-off has a backwards-compatible fallback when is_active is unavailable.");

assert(gpsHook.includes("maximumAgeMs = 0"), "browser tracking requests fresh GPS readings by default.");
assert(gpsHook.includes("enableHighAccuracy: true"), "browser tracking requests high-accuracy device GPS.");
assert(gpsUtils.includes("Number(numberValue.toFixed(2))"), "GPS accuracy keeps two-decimal device precision.");
assert(cache.includes("clearCachedLiveLocation"), "client live-location cache can be cleared.");
assert(instructorPanel.includes("clearCachedLiveLocation(\"instructor-work\", \"working-day\")"), "instructor sign-off clears cached work location.");

assert(migration.includes("alter table public.instructor_live_locations") && migration.includes("is_active boolean"), "migration adds active/inactive location state.");
assert(migration.includes("instructor_live_locations_admin_live_idx"), "migration adds an indexed live-map lookup path.");
assert(migration.includes("create table if not exists public.instructor_safety_events"), "migration adds the future-ready safety event structure.");
assert(migration.includes("private.current_user_is_admin()"), "safety events are admin-readable only through RLS.");

if (process.exitCode) {
  process.exit(process.exitCode);
}
