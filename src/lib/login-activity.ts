import type { SupabaseClient } from "@supabase/supabase-js";

export type LoginActivity = {
  id: string;
  device: string;
  browser: string;
  when: string;
  location: string;
  ipAddress: string;
  countryCode: string;
  isUnusual: boolean;
};

export type LoginDeviceActivity = LoginActivity & {
  firstSeen: string;
  signInCount: number;
  locations: string[];
  ipAddresses: string[];
};

type MarketplaceLoginRole = "learner" | "instructor";
export const clientLoginActivityPendingCookieName = "lda_client_login_activity_pending";

export type LoginActivityRecordResult =
  | { ok: true }
  | { ok: false; message: string; code?: string };

type LoginActivityDetailsInput = {
  supabase: SupabaseClient | null;
  userId: string;
  role: MarketplaceLoginRole;
  headers: Headers;
  deviceLabel?: string;
  browserName?: string;
  approximateLocation?: string;
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
};

function headerValue(headers: Headers, name: string) {
  return headers.get(name) ?? headers.get(name.toLowerCase()) ?? "";
}

function decodeHeaderValue(value: string) {
  if (!value) return "";

  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value;
  }
}

function getClientIp(headers: Headers) {
  const forwardedFor = headerValue(headers, "x-forwarded-for")
    .split(",")
    .map((item) => item.trim())
    .find(Boolean);

  return (
    forwardedFor ||
    headerValue(headers, "x-real-ip") ||
    headerValue(headers, "cf-connecting-ip") ||
    headerValue(headers, "x-vercel-forwarded-for") ||
    ""
  );
}

function getApproximateLocation(headers: Headers) {
  const city = decodeHeaderValue(headerValue(headers, "x-vercel-ip-city") || headerValue(headers, "cf-ipcity"));
  const region = decodeHeaderValue(headerValue(headers, "x-vercel-ip-country-region") || headerValue(headers, "cf-region"));
  const countryCode = (headerValue(headers, "x-vercel-ip-country") || headerValue(headers, "cf-ipcountry")).toUpperCase();
  const locationParts = [city, region, countryCode].filter((part, index, parts) => Boolean(part) && parts.indexOf(part) === index);

  return {
    countryCode,
    location: locationParts.length > 0 ? locationParts.join(", ") : "Approximate location unavailable"
  };
}

function getBrowserName(userAgent: string) {
  if (/Edg\//i.test(userAgent)) return "Microsoft Edge";
  if (/CriOS|Chrome\//i.test(userAgent) && !/Edg\//i.test(userAgent)) return "Chrome";
  if (/Firefox\//i.test(userAgent)) return "Firefox";
  if (/Safari\//i.test(userAgent) && !/Chrome\//i.test(userAgent)) return "Safari";
  if (/SamsungBrowser/i.test(userAgent)) return "Samsung Internet";
  return "Browser";
}

function getDeviceLabel(userAgent: string) {
  if (/iPad/i.test(userAgent)) return "iPad";
  if (/iPhone/i.test(userAgent)) return "iPhone";
  if (/Android/i.test(userAgent) && /Mobile/i.test(userAgent)) return "Android phone";
  if (/Android/i.test(userAgent)) return "Android tablet";
  if (/Windows/i.test(userAgent)) return /Mobile|Tablet|Touch/i.test(userAgent) ? "Windows tablet" : "Windows PC";
  if (/Macintosh|Mac OS X/i.test(userAgent)) return "MacBook or iMac";
  if (/Linux/i.test(userAgent)) return "Linux computer";
  return "Unknown device";
}

export function buildLoginActivityFromHeaders(headers: Headers) {
  const userAgent = headerValue(headers, "user-agent");
  const { countryCode, location } = getApproximateLocation(headers);

  return {
    deviceLabel: getDeviceLabel(userAgent),
    browserName: getBrowserName(userAgent),
    approximateLocation: location,
    countryCode: countryCode || null,
    ipAddress: getClientIp(headers) || null,
    isUnusual: Boolean(countryCode && countryCode !== "GB")
  };
}

export async function recordLoginActivity({
  supabase,
  userId,
  role,
  headers
}: {
  supabase: SupabaseClient | null;
  userId: string;
  role: MarketplaceLoginRole;
  headers: Headers;
}): Promise<LoginActivityRecordResult> {
  if (!supabase) return { ok: false, message: "Secure login records are temporarily unavailable." };

  const activity = buildLoginActivityFromHeaders(headers);
  const { error } = await supabase.from("login_activities").insert({
    user_id: userId,
    role,
    device_label: activity.deviceLabel,
    browser_name: activity.browserName,
    approximate_location: activity.approximateLocation,
    country_code: activity.countryCode,
    ip_address: activity.ipAddress,
    is_unusual: activity.isUnusual
  });

  if (error) {
    console.warn("[login-activity] could not record login activity", {
      userId,
      message: error.message
    });
    return { ok: false, message: error.message, code: error.code };
  }

  return { ok: true };
}

function formatClientLocation({
  approximateLocation,
  latitude,
  longitude,
  accuracy
}: Pick<LoginActivityDetailsInput, "approximateLocation" | "latitude" | "longitude" | "accuracy">) {
  const safeLocation = typeof approximateLocation === "string" ? approximateLocation.trim().slice(0, 180) : "";
  if (safeLocation) return safeLocation;

  if (typeof latitude === "number" && typeof longitude === "number") {
    const accuracyLabel = typeof accuracy === "number" && Number.isFinite(accuracy) ? `, accuracy ${Math.round(accuracy)}m` : "";
    return `Precise browser location shared: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}${accuracyLabel}`;
  }

  return "";
}

export async function recordLoginActivityDetails({
  supabase,
  userId,
  role,
  headers,
  deviceLabel,
  browserName,
  approximateLocation,
  latitude,
  longitude,
  accuracy
}: LoginActivityDetailsInput): Promise<LoginActivityRecordResult> {
  if (!supabase) return { ok: false, message: "Secure login records are temporarily unavailable." };

  const headerActivity = buildLoginActivityFromHeaders(headers);
  const clientLocation = formatClientLocation({ approximateLocation, latitude, longitude, accuracy });

  const { error } = await supabase.from("login_activities").insert({
    user_id: userId,
    role,
    device_label: deviceLabel?.trim().slice(0, 120) || headerActivity.deviceLabel,
    browser_name: browserName?.trim().slice(0, 80) || headerActivity.browserName,
    approximate_location: clientLocation || headerActivity.approximateLocation,
    country_code: headerActivity.countryCode,
    ip_address: headerActivity.ipAddress,
    is_unusual: headerActivity.isUnusual
  });

  if (error) {
    console.warn("[login-activity] could not record client login activity", {
      userId,
      message: error.message
    });
    return { ok: false, message: error.message, code: error.code };
  }

  return { ok: true };
}

export async function getLoginActivities(supabase: SupabaseClient | null, userId: string): Promise<LoginActivity[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("login_activities")
    .select("id,signed_in_at,device_label,browser_name,approximate_location,ip_address,country_code,is_unusual")
    .eq("user_id", userId)
    .order("signed_in_at", { ascending: false })
    .limit(100);

  if (error) {
    console.warn("[login-activity] could not load login activities", {
      userId,
      message: error.message
    });
    return [];
  }

  return (data ?? []).map((activity) => ({
    id: String(activity.id),
    device: String(activity.device_label ?? "Unknown device"),
    browser: String(activity.browser_name ?? "Browser"),
    when: String(activity.signed_in_at ?? ""),
    location: String(activity.approximate_location ?? "Approximate location unavailable"),
    ipAddress: String(activity.ip_address ?? ""),
    countryCode: String(activity.country_code ?? ""),
    isUnusual: Boolean(activity.is_unusual)
  }));
}

export async function getLoginDevices(supabase: SupabaseClient | null, userId: string): Promise<LoginDeviceActivity[]> {
  const activities = await getLoginActivities(supabase, userId);
  const devices = new Map<string, LoginDeviceActivity>();

  for (const activity of activities) {
    const deviceKey = [
      activity.device.toLowerCase(),
      activity.browser.toLowerCase(),
      activity.countryCode.toLowerCase(),
      activity.ipAddress || "no-ip"
    ].join("|");
    const existing = devices.get(deviceKey);

    if (!existing) {
      devices.set(deviceKey, {
        ...activity,
        firstSeen: activity.when,
        signInCount: 1,
        locations: activity.location ? [activity.location] : [],
        ipAddresses: activity.ipAddress ? [activity.ipAddress] : []
      });
      continue;
    }

    existing.signInCount += 1;
    existing.isUnusual = existing.isUnusual || activity.isUnusual;
    if (activity.location && !existing.locations.includes(activity.location)) {
      existing.locations.push(activity.location);
    }
    if (activity.ipAddress && !existing.ipAddresses.includes(activity.ipAddress)) {
      existing.ipAddresses.push(activity.ipAddress);
    }

    const firstSeenDate = new Date(existing.firstSeen).getTime();
    const activityDate = new Date(activity.when).getTime();
    if (!Number.isNaN(activityDate) && (Number.isNaN(firstSeenDate) || activityDate < firstSeenDate)) {
      existing.firstSeen = activity.when;
    }
  }

  return Array.from(devices.values());
}
