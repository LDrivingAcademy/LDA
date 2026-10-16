"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  CalendarCheck,
  CarFront,
  Clock3,
  CreditCard,
  MailCheck,
  MapPin,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  X
} from "lucide-react";
import { demoInstructors } from "@/lib/marketplace-content";
import { formatMoney } from "@/lib/money";
import { readStoredJsonOrNull, readStoredValue, writeStoredValue } from "@/lib/browser-storage";
import { createBookingReference } from "@/lib/booking-reference";
import type { SmartMatchHandoffContext } from "@/lib/smart-match-handoff";
import { loadGoogleMaps } from "@/lib/google-maps-loader";
import type { LiveGpsPoint } from "@/lib/live-gps-utils";
import { requestFreshGpsPoint, subscribeLiveGps } from "@/lib/live-gps-watch-manager";
import { readCachedLiveLocation, writeCachedLiveLocation } from "@/lib/live-location-client-cache";
import { NearbyInstructorGoogleMap } from "@/components/nearby-instructor-google-map";

const LOCATION_PREF_KEY = "lda-location-sharing-enabled";
const LOCATION_PERMISSION_REQUESTED_KEY = "lda-location-permission-requested";
const PRECISE_PICKUP_ACCURACY_METRES = 1;
type LatLng = {
  lat: number;
  lng: number;
};

type AddressPrediction = {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
};

export type LearnerBookingInstructor = (typeof demoInstructors)[number] & {
  id: string;
  distanceMiles: number;
  slots: Record<string, string[]>;
  email?: string | null;
  learnerAvailabilityPaused?: boolean;
  learnerAvailabilityPauseReason?: string;
  stripeConnectedAccountId?: string;
};

type BookingRecord = {
  id: string;
  instructorName: string;
  instructorId: string;
  lessonSummary: string;
  date: string;
  time: string;
  bookingWindow?: "same_day_or_next_day" | "advance_scheduled";
  pickup: string;
  pricePence: number;
  car: string;
  status: "pending" | "upcoming" | "completed" | "cancelled";
  rating?: number;
  review?: string;
};

export type LearnerBookingConfirmation = {
  reference: string;
  instructorName: string;
  instructorId?: string | null;
  lessonSummary: string;
  date: string;
  time: string;
  bookingWindow?: BookingRecord["bookingWindow"];
  pickup: string;
  pricePence: number;
  car: string;
};

export type LearnerLessonPackage = {
  id: string;
  title: string;
  body?: string;
  hours: number;
  sessionHours: number;
  totalSessions: number;
  paceLabel: string;
  checkoutLabel?: string;
};

type LessonPackageSession = {
  date: string;
  time: string;
};

type SmartMatchSessionContext = SmartMatchHandoffContext;

type LicenceVerifyState =
  | { status: "idle"; message: string }
  | { status: "checking"; message: string }
  | { status: "valid"; message: string; mode: string }
  | { status: "invalid"; message: string };

function loadGoogleMapsPlaces(): Promise<any> {
  return loadGoogleMaps(undefined, ["places"]).then(() => window.google);
}

function latLngFromGoogleLocation(location: any): LatLng | null {
  const lat = typeof location?.lat === "function" ? location.lat() : location?.lat;
  const lng = typeof location?.lng === "function" ? location.lng() : location?.lng;

  return typeof lat === "number" && typeof lng === "number" ? { lat, lng } : null;
}

function extractUkPostcode(value: string) {
  const match = value.toUpperCase().match(/\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/);
  return match ? `${match[1]} ${match[2]}` : null;
}

function looksLikeUkPostcode(value: string) {
  return Boolean(extractUkPostcode(value));
}

function isOnlyUkPostcode(value: string) {
  const postcode = extractUkPostcode(value);
  return Boolean(postcode && value.trim().toUpperCase() === postcode);
}

async function geocodeUkPostcode(address: string) {
  const postcode = extractUkPostcode(address);
  if (!postcode) return null;

  const response = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`, {
    headers: { Accept: "application/json" }
  });

  if (!response.ok) return null;

  const data = (await response.json()) as {
    result?: {
      postcode?: string | null;
      latitude?: number | null;
      longitude?: number | null;
      admin_district?: string | null;
      region?: string | null;
    } | null;
  };
  const result = data.result;

  if (typeof result?.latitude !== "number" || typeof result.longitude !== "number") {
    return null;
  }

  const area = [result.admin_district, result.region].filter(Boolean).join(", ");

  return {
    location: { lat: result.latitude, lng: result.longitude },
    formattedAddress: `${result.postcode ?? postcode}${area ? `, ${area}` : ""}, UK`
  };
}

async function geocodeAddress(address: string, bias?: LatLng | null) {
  if (!address.trim()) {
    return null;
  }

  const postcodeFallback = await geocodeUkPostcode(address).catch(() => null);
  let google: any;

  try {
    google = await loadGoogleMapsPlaces();
  } catch {
    return postcodeFallback;
  }

  if (!google?.maps?.Geocoder || !address.trim()) {
    return postcodeFallback;
  }

  const geocoder = new google.maps.Geocoder();
  const request: Record<string, any> = {
    address: /\buk\b/i.test(address) ? address : `${address}, UK`,
    region: "gb",
    componentRestrictions: { country: "GB" }
  };

  if (bias) {
    request.bounds = new google.maps.LatLngBounds(
      { lat: bias.lat - 0.025, lng: bias.lng - 0.035 },
      { lat: bias.lat + 0.025, lng: bias.lng + 0.035 }
    );
  }

  try {
    const result = await geocoder.geocode(request);
    const match = result.results?.[0];
    const location = latLngFromGoogleLocation(match?.geometry?.location);

    return location
      ? {
          location,
          formattedAddress: match.formatted_address || postcodeFallback?.formattedAddress || address
        }
      : postcodeFallback;
  } catch {
    return postcodeFallback;
  }
}

async function getGoogleAddressPredictions(query: string, bias?: LatLng | null): Promise<AddressPrediction[]> {
  if (!query.trim() || query.trim().length < 3) {
    return [];
  }

  let google: any;

  try {
    google = await loadGoogleMapsPlaces();
  } catch {
    return [];
  }

  if (!google?.maps?.places?.AutocompleteService) {
    return [];
  }

  const service = new google.maps.places.AutocompleteService();
  const request: Record<string, any> = {
    input: query,
    componentRestrictions: { country: "gb" },
    types: ["address"]
  };

  if (bias) {
    request.locationBias = {
      radius: 2500,
      center: new google.maps.LatLng(bias.lat, bias.lng)
    };
  }

  return new Promise((resolve) => {
    service.getPlacePredictions(request, (predictions: any[] | null, status: string) => {
      if (status !== google.maps.places.PlacesServiceStatus.OK || !Array.isArray(predictions)) {
        resolve([]);
        return;
      }

      resolve(
        predictions.slice(0, 6).map((prediction) => ({
          placeId: prediction.place_id,
          description: prediction.description,
          mainText: prediction.structured_formatting?.main_text ?? prediction.description,
          secondaryText: prediction.structured_formatting?.secondary_text ?? ""
        }))
      );
    });
  });
}

async function geocodeGooglePlaceId(placeId: string) {
  const google = await loadGoogleMapsPlaces();

  if (!google?.maps?.Geocoder) {
    return null;
  }

  const geocoder = new google.maps.Geocoder();
  const result = await geocoder.geocode({ placeId });
  const match = result.results?.[0];
  const location = latLngFromGoogleLocation(match?.geometry?.location);

  return location
    ? {
        location,
        formattedAddress: match.formatted_address || match.name || ""
      }
    : null;
}

async function reverseGeocodeLocation(position: LatLng) {
  const google = await loadGoogleMapsPlaces();

  if (!google?.maps?.Geocoder) {
    return "";
  }

  const geocoder = new google.maps.Geocoder();
  const result = await geocoder.geocode({ location: position });

  return result.results?.[0]?.formatted_address || "";
}

function cleanLicenceNumber(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function looksLikeDoorAddress(value: string) {
  const normalised = value.trim();
  if (!normalised || isOnlyUkPostcode(normalised)) return false;
  return /(?:^|,\s*)\d+[A-Z]?\b/i.test(normalised) && looksLikeUkPostcode(normalised);
}

function addDaysIso(days: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function dateOnlyFromIso(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;

  const date = new Date(year, month - 1, day);
  date.setHours(12, 0, 0, 0);
  return date;
}

function getBookingWindowForDate(value: string): BookingRecord["bookingWindow"] {
  const selectedDate = dateOnlyFromIso(value);
  const tomorrow = dateOnlyFromIso(addDaysIso(1));

  if (!selectedDate || !tomorrow || selectedDate.getTime() <= tomorrow.getTime()) {
    return "same_day_or_next_day";
  }

  return "advance_scheduled";
}

function formatDisplayDate(value: string) {
  const date = dateOnlyFromIso(value);
  if (!date) return value;

  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

function buildDemoInstructors(): LearnerBookingInstructor[] {
  const today = addDaysIso(0);
  const tomorrow = addDaysIso(1);
  const inTwoDays = addDaysIso(2);
  const inThreeDays = addDaysIso(3);
  const inFourDays = addDaysIso(4);
  const inFiveDays = addDaysIso(5);

  return [
    {
      ...demoInstructors[0],
      id: "amelia-khan",
      distanceMiles: 1.8,
      slots: {
        [today]: ["16:30", "18:00"],
        [tomorrow]: ["09:30", "13:00", "17:30"],
        [inThreeDays]: ["10:00", "12:00"],
        [inFourDays]: ["11:00", "14:00"]
      }
    },
    {
      ...demoInstructors[1],
      id: "marcus-reed",
      distanceMiles: 2.6,
      slots: {
        [today]: ["10:00", "14:30"],
        [inTwoDays]: ["09:00", "15:00"],
        [inFourDays]: ["10:30", "16:00"],
        [inFiveDays]: ["11:30"]
      }
    },
    {
      ...demoInstructors[2],
      id: "priya-shah",
      distanceMiles: 4.1,
      slots: {
        [tomorrow]: ["13:00", "16:00"],
        [inThreeDays]: ["10:30"],
        [inFiveDays]: ["12:30", "18:30"]
      }
    }
  ];
}

const coveredAreasByInstructor: Record<string, string[]> = {
  "amelia-khan": ["Barnet", "Finchley", "Edgware", "Mill Hill", "Whetstone", "High Barnet", "New Barnet", "Totteridge"],
  "marcus-reed": ["Hendon", "Golders Green", "Brent Cross", "Cricklewood", "Colindale", "West Hampstead", "Dollis Hill", "Neasden"],
  "priya-shah": ["Harrow", "Wembley", "Kenton", "Northolt", "Pinner", "South Harrow", "Kingsbury", "Sudbury"]
};

const retiredDemoBookingReferences = new Set(["LDA-AME-UPCOMING", "LDA-MAR-COMPLETE"]);

function isRetiredDemoBooking(record: BookingRecord) {
  return retiredDemoBookingReferences.has(record.id.toUpperCase());
}

function distanceLimit(value: string) {
  if (value === "preferred") return 5;
  if (value === "local") return 10;
  return Number(value);
}

function smartMatchInstructorScore(instructor: LearnerBookingInstructor, context: SmartMatchSessionContext | null) {
  if (!context) return 0;

  const wanted = [
    ...(context.accessibilityNeeds ?? []),
    ...(context.learningPreferences ?? []),
    ...(context.communicationPreferences ?? []),
    ...(context.environmentPreferences ?? []),
    ...(context.lessonSupport ?? []),
    ...(context.goals ?? [])
  ].map((value) => value.toLowerCase());

  if (!wanted.length && !context.instructorId && !context.instructorName) return 0;

  const haystack = [
    instructor.name,
    instructor.bio,
    instructor.areas,
    instructor.car,
    instructor.transmission
  ]
    .join(" ")
    .toLowerCase();

  let score = wanted.reduce((total, value) => {
    const words = value.split(/\W+/).filter((word) => word.length > 2);
    const wordMatches = words.filter((word) => haystack.includes(word)).length;
    return total + wordMatches;
  }, 0);

  if (context.instructorId && instructor.id === context.instructorId) score += 20;
  if (context.instructorName && instructor.name.trim().toLowerCase() === context.instructorName.trim().toLowerCase()) score += 20;
  if (/calm|patient|nervous|structured|progress|confidence|mock|test|parking/i.test(instructor.bio ?? "")) score += 1;

  return score;
}

function comparePackageSessions(a: LessonPackageSession, b: LessonPackageSession) {
  return `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`);
}

function getInstructorSessionsFromDate(instructor: LearnerBookingInstructor, fromDate: string) {
  return Object.entries(instructor.slots)
    .flatMap(([date, times]) => times.map((time) => ({ date, time })))
    .filter((session) => session.date >= fromDate)
    .sort(comparePackageSessions);
}

function buildPackageSessionPlan({
  instructor,
  fromDate,
  firstTime,
  totalSessions
}: {
  instructor: LearnerBookingInstructor | null;
  fromDate: string;
  firstTime: string;
  totalSessions: number;
}) {
  if (!instructor || !firstTime || totalSessions <= 0) return [];

  const firstSession = { date: fromDate, time: firstTime };
  const seen = new Set([`${firstSession.date}-${firstSession.time}`]);
  const sessions = [firstSession];

  for (const session of getInstructorSessionsFromDate(instructor, fromDate)) {
    const key = `${session.date}-${session.time}`;
    if (seen.has(key)) continue;
    if (comparePackageSessions(session, firstSession) < 0) continue;
    sessions.push(session);
    seen.add(key);
    if (sessions.length >= totalSessions) break;
  }

  return sessions.slice(0, totalSessions);
}

function countPackageSessions(instructor: LearnerBookingInstructor, fromDate: string) {
  return getInstructorSessionsFromDate(instructor, fromDate).length;
}

export function LearnerBookingDashboard({
  learnerEmail,
  learnerPhone,
  provisionalLicenceConfirmed = false,
  bookingMode = "quick",
  initialInstructors,
  initialAvailabilityDate,
  initialSelectedInstructorId = null,
  initialSelectedInstructorName = null,
  initialPickup = null,
  initialTransmission = null,
  allowDemoInstructors = false,
  initialBookingConfirmation = null,
  lessonPackage = null
}: {
  learnerEmail?: string | null;
  learnerPhone?: string | null;
  provisionalLicenceConfirmed?: boolean;
  bookingMode?: "quick" | "scheduled";
  initialInstructors?: LearnerBookingInstructor[];
  initialAvailabilityDate?: string | null;
  initialSelectedInstructorId?: string | null;
  initialSelectedInstructorName?: string | null;
  initialPickup?: string | null;
  initialTransmission?: "automatic" | "manual" | null;
  allowDemoInstructors?: boolean;
  initialBookingConfirmation?: LearnerBookingConfirmation | null;
  lessonPackage?: LearnerLessonPackage | null;
}) {
  const postcodeRef = useRef<HTMLInputElement>(null);
  const postcodeValueRef = useRef("");
  const pickupPositionSourceRef = useRef<"live" | "pickup" | null>(null);
  const pickupInputTouchedRef = useRef(false);
  const selectedPickupAddressRef = useRef("");
  const bestLiveAccuracyRef = useRef<number | null>(null);
  const checkoutRequestRef = useRef<{
    signature: string;
    reference: string;
    promise: Promise<{ checkoutUrl?: string; error?: string; message?: string }>;
  } | null>(null);
  const [postcode, setPostcode] = useState(initialPickup ?? "");
  const [distance, setDistance] = useState("5");
  const [transmission, setTransmission] = useState<string>(initialTransmission ?? "automatic");
  const [maxPrice, setMaxPrice] = useState(45);
  const [availabilityDate, setAvailabilityDate] = useState(() => initialAvailabilityDate || addDaysIso(bookingMode === "scheduled" ? 2 : 0));
  const [sortBy, setSortBy] = useState("distance");
  const [selectedInstructorId, setSelectedInstructorId] = useState<string | null>(initialSelectedInstructorId);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [checkoutState, setCheckoutState] = useState<"idle" | "loading" | "error" | "confirmed">("idle");
  const [checkoutError, setCheckoutError] = useState("");
  const [confirmationRef, setConfirmationRef] = useState("");
  const [confirmationDetails, setConfirmationDetails] = useState<{
    instructorName: string;
    date: string;
    time: string;
    bookingWindow?: BookingRecord["bookingWindow"];
    pickup: string;
    pickupLatitude?: number | null;
    pickupLongitude?: number | null;
    pickupSource?: "live" | "pickup" | null;
  } | null>(null);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [bookingRecords, setBookingRecords] = useState<BookingRecord[]>([]);
  const [userPosition, setUserPosition] = useState<LatLng | null>(null);
  const [liveLocationAccuracy, setLiveLocationAccuracy] = useState<number | null>(null);
  const [pickupPosition, setPickupPosition] = useState<LatLng | null>(null);
  const [pickupPositionSource, setPickupPositionSource] = useState<"live" | "pickup" | null>(null);
  const [pickupLocationLabel, setPickupLocationLabel] = useState("");
  const [addressPredictions, setAddressPredictions] = useState<AddressPrediction[]>([]);
  const [addressLookupStatus, setAddressLookupStatus] = useState<"idle" | "loading" | "error">("idle");
  const [locationStatus, setLocationStatus] = useState("Location sharing is on for live tracking and nearby instructor sorting.");
  const [licenceNumber, setLicenceNumber] = useState("");
  const [licencePermission, setLicencePermission] = useState(false);
  const [licenceVerifyState, setLicenceVerifyState] = useState<LicenceVerifyState>(() =>
    provisionalLicenceConfirmed
      ? {
          status: "valid",
          mode: "saved",
          message: "Your provisional licence has already been verified and saved to this learner account."
        }
      : {
          status: "idle",
          message: "Run the DVLA provisional licence check before checkout."
        }
  );
  const [smartMatchContext, setSmartMatchContext] = useState<SmartMatchSessionContext | null>(null);
  const smartMatchPreselectAppliedRef = useRef(false);

  useEffect(() => {
    postcodeValueRef.current = postcode;
  }, [postcode]);

  useEffect(() => {
    if (initialAvailabilityDate) {
      setAvailabilityDate(initialAvailabilityDate);
    }
  }, [initialAvailabilityDate]);

  useEffect(() => {
    if (initialPickup) {
      setPostcode(initialPickup);
    }
  }, [initialPickup]);

  useEffect(() => {
    if (initialTransmission) {
      setTransmission(initialTransmission);
    }
  }, [initialTransmission]);

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem("lda:smart-match-context:v1");
      if (!stored) return;
      const parsed = JSON.parse(stored) as SmartMatchSessionContext;
      if (parsed?.source === "smart-match") {
        setSmartMatchContext(parsed);
      }
    } catch {
      // Booking can continue without Smart Match context.
    }
  }, []);

  useEffect(() => {
    pickupPositionSourceRef.current = pickupPositionSource;
  }, [pickupPositionSource]);

  useEffect(() => {
    const resetStickyCheckoutState = () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get("payment") !== "success") {
        setCheckoutState((state) => (state === "loading" ? "idle" : state));
      }
    };

    window.addEventListener("pageshow", resetStickyCheckoutState);

    return () => {
      window.removeEventListener("pageshow", resetStickyCheckoutState);
    };
  }, []);

  useEffect(() => {
    const stored = readStoredJsonOrNull<BookingRecord[]>("lda-learner-bookings");
    const initialBookings = Array.isArray(stored) ? stored.filter((record) => !isRetiredDemoBooking(record)) : [];
    setBookingRecords(initialBookings);

    if (stored && initialBookings.length !== stored.length) {
      writeStoredValue("lda-learner-bookings", JSON.stringify(initialBookings));
    }
  }, [pickupPosition, postcode]);

  useEffect(() => {
    const storedPreference = readStoredValue(LOCATION_PREF_KEY);
    const enabled = storedPreference !== "false";
    let unsubscribe: (() => void) | null = null;

    if (storedPreference === null) {
      writeStoredValue(LOCATION_PREF_KEY, "true");
    }

    if (enabled) {
      const cachedPoint = readCachedLiveLocation("learner-pickup", "current");
      if (cachedPoint) {
        applyBrowserPosition(cachedPoint);
      }

      void updateLocationFromBrowser();
      if (navigator.geolocation) {
        unsubscribe = subscribeLiveGps(
          { source: "learner_pickup", enableHighAccuracy: true, maximumAge: 2500, timeout: 15000 },
          {
            onPoint: applyBrowserPosition,
            onError: () => undefined
          }
        );
      }
    } else {
      setLocationStatus("Location sharing is off. Turn it back on in Account settings when you want live tracking.");
    }

    return () => {
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (!bookingRecords.length) return;
    writeStoredValue("lda-learner-bookings", JSON.stringify(bookingRecords));
  }, [bookingRecords]);

  useEffect(() => {
    if (!initialBookingConfirmation) return;

    setConfirmationRef(initialBookingConfirmation.reference);
    setConfirmationDetails({
      instructorName: initialBookingConfirmation.instructorName,
      date: initialBookingConfirmation.date,
      time: initialBookingConfirmation.time,
      bookingWindow: initialBookingConfirmation.bookingWindow,
      pickup: initialBookingConfirmation.pickup
    });
    setCheckoutState("confirmed");
    setShowConfirmationModal(true);
    setBookingRecords((records) => {
      if (records.some((record) => record.id === initialBookingConfirmation.reference)) {
        return records;
      }

      return [
        {
          id: initialBookingConfirmation.reference,
          instructorName: initialBookingConfirmation.instructorName,
          instructorId: initialBookingConfirmation.instructorId ?? "",
          lessonSummary: initialBookingConfirmation.lessonSummary,
          date: initialBookingConfirmation.date,
          time: initialBookingConfirmation.time,
          bookingWindow: initialBookingConfirmation.bookingWindow,
          pickup: initialBookingConfirmation.pickup,
          pricePence: initialBookingConfirmation.pricePence,
          car: initialBookingConfirmation.car,
          status: "upcoming"
        },
        ...records
      ];
    });
  }, [initialBookingConfirmation]);

  const instructors = useMemo(
    () => (initialInstructors && initialInstructors.length > 0 ? initialInstructors : allowDemoInstructors ? buildDemoInstructors() : []),
    [allowDemoInstructors, initialInstructors]
  );

  useEffect(() => {
    const input = postcodeRef.current;
    let cancelled = false;
    let listener: { remove: () => void } | null = null;

    if (!input) {
      return;
    }

    loadGoogleMapsPlaces()
      .then((google) => {
        if (cancelled || !postcodeRef.current || !google?.maps?.places) return;
        const autocomplete = new google.maps.places.Autocomplete(postcodeRef.current, {
          componentRestrictions: { country: "gb" },
          fields: ["formatted_address", "geometry", "address_components", "name"],
          types: ["address"]
        });
        listener = autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          const address = place.formatted_address || postcodeRef.current?.value || "";
          const location = latLngFromGoogleLocation(place.geometry?.location);

          pickupInputTouchedRef.current = Boolean(address.trim());
          selectedPickupAddressRef.current = address;
          setPostcode(address);
          setAddressPredictions([]);
          setAddressLookupStatus("idle");

          if (location) {
            setPickupPosition(location);
            setPickupPositionSource("pickup");
            setPickupLocationLabel(address);
            setLocationStatus(`Map centred on pickup: ${address}.`);
          }
        });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      listener?.remove();
    };
  }, []);

  useEffect(() => {
    const query = postcode.trim();
    let cancelled = false;

    if (!query || query === selectedPickupAddressRef.current) {
      setAddressPredictions([]);
      setAddressLookupStatus("idle");
      return;
    }

    if (!pickupInputTouchedRef.current || query.length < 3) {
      setAddressPredictions([]);
      setAddressLookupStatus("idle");
      return;
    }

    const timeout = window.setTimeout(() => {
      setAddressLookupStatus("loading");
      getGoogleAddressPredictions(query, userPosition)
        .then((predictions) => {
          if (cancelled) return;
          setAddressPredictions(predictions);
          setAddressLookupStatus(predictions.length ? "idle" : "error");
        })
        .catch(() => {
          if (cancelled) return;
          setAddressPredictions([]);
          setAddressLookupStatus("error");
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [postcode, userPosition]);

  useEffect(() => {
    const query = postcode.trim();
    let cancelled = false;

    if (!query) {
      if (userPosition) {
        setPickupPosition(userPosition);
        setPickupPositionSource("live");
        setPickupLocationLabel("Live pickup pin");
        setLocationStatus("Using your live device location as the pickup point. Enter an address only if you want a different pickup.");
      } else {
        setPickupPosition(null);
        setPickupPositionSource(null);
        setPickupLocationLabel("");
      }
      return;
    }

    if (!pickupInputTouchedRef.current) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setLocationStatus(`Finding pickup location for ${query}...`);
      geocodeAddress(query, userPosition)
        .then((result) => {
          if (cancelled) return;

          if (!result) {
            setPickupPosition(null);
            setPickupLocationLabel("");
            setLocationStatus("LDA could not find that pickup location yet. Choose a Google suggestion or check the postcode.");
            return;
          }

          setPickupPosition(result.location);
          setPickupPositionSource("pickup");
          setPickupLocationLabel(result.formattedAddress);
          setLocationStatus(
            isOnlyUkPostcode(query)
              ? `Postcode found. Choose the full pickup address from the suggestions before checkout.`
              : `Map centred on pickup: ${result.formattedAddress}.`
          );
        })
        .catch(() => {
          if (cancelled) return;
          setPickupPosition(null);
          setPickupLocationLabel("");
          setLocationStatus("LDA could not find that pickup location yet. Choose a Google suggestion or check the postcode.");
        });
    }, 650);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [postcode, userPosition]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const booking = params.get("booking");
    const checkoutSessionId = params.get("session_id");

    if (params.get("payment") !== "success" || !booking) return;

    const bookingDetails = readStoredJsonOrNull<{
      instructorName: string;
      instructorId: string;
      instructorEmail?: string | null;
      lessonSummary: string;
      learnerEmail?: string | null;
      learnerPhone?: string | null;
      date?: string;
      time?: string;
      bookingWindow?: BookingRecord["bookingWindow"];
      pickup?: string;
      pickupLatitude?: number | null;
      pickupLongitude?: number | null;
      pickupSource?: "live" | "pickup" | null;
      pricePence?: number;
      car?: string;
    }>(`lda-booking-${booking}`);

    if (!bookingDetails) return;

    const bookedInstructor = instructors.find((instructor) => instructor.id === bookingDetails.instructorId) ?? instructors[0];

    setSelectedInstructorId(bookingDetails.instructorId);
    if (bookingDetails.date) setAvailabilityDate(bookingDetails.date);
    if (bookingDetails.time) setSelectedSlot(bookingDetails.time);
    if (bookingDetails.pickup) {
      pickupInputTouchedRef.current = bookingDetails.pickupSource !== "live";
      setPostcode(bookingDetails.pickup);
    }
    if (
      bookingDetails.pickupLatitude !== null &&
      bookingDetails.pickupLatitude !== undefined &&
      bookingDetails.pickupLongitude !== null &&
      bookingDetails.pickupLongitude !== undefined
    ) {
      setPickupPosition({ lat: bookingDetails.pickupLatitude, lng: bookingDetails.pickupLongitude });
      setPickupPositionSource(bookingDetails.pickupSource ?? "pickup");
      setPickupLocationLabel(bookingDetails.pickupSource === "live" ? "Live pickup pin" : bookingDetails.pickup ?? "");
    }
    const confirmedDate = bookingDetails.date ?? availabilityDate;
    const confirmedTime = bookingDetails.time ?? selectedSlot;
    const confirmedPickup = bookingDetails.pickup ?? postcode;

    setConfirmationRef(booking);
    setConfirmationDetails({
      instructorName: bookingDetails.instructorName,
      date: confirmedDate,
      time: confirmedTime || "Time saved with booking",
      bookingWindow: bookingDetails.bookingWindow ?? getBookingWindowForDate(confirmedDate),
      pickup: confirmedPickup || "Pickup point saved with booking",
      pickupLatitude: bookingDetails.pickupLatitude ?? null,
      pickupLongitude: bookingDetails.pickupLongitude ?? null,
      pickupSource: bookingDetails.pickupSource ?? null
    });
    setCheckoutState("confirmed");
    setShowConfirmationModal(true);
    setBookingRecords((records) => {
      if (records.some((record) => record.id === booking)) return records;

      return [
        {
          id: booking,
          instructorName: bookingDetails.instructorName,
          instructorId: bookingDetails.instructorId,
          lessonSummary: bookingDetails.lessonSummary,
          date: confirmedDate,
          time: confirmedTime,
          bookingWindow: bookingDetails.bookingWindow ?? getBookingWindowForDate(confirmedDate),
          pickup: confirmedPickup,
          pricePence: bookingDetails.pricePence ?? bookedInstructor.price,
          car: bookingDetails.car ?? bookedInstructor.car,
          status: "upcoming"
        },
        ...records
      ];
    });

    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(bookingDetails.bookingWindow === "advance_scheduled" ? "LDA lesson scheduled" : "LDA lesson booked", {
          body: `Your lesson with ${bookingDetails.instructorName} is confirmed. Reference ${booking}.`
        });
      } catch {
        // Notification permissions can change between page load and checkout return.
      }
    }

    fetch("/api/bookings/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookingId: booking,
        instructorName: bookingDetails.instructorName,
        instructorId: bookingDetails.instructorId,
        instructorEmail: bookingDetails.instructorEmail,
        learnerEmail: bookingDetails.learnerEmail,
        learnerPhone: bookingDetails.learnerPhone ?? learnerPhone,
        lessonSummary: bookingDetails.lessonSummary,
        checkoutSessionId,
        date: confirmedDate,
        time: confirmedTime,
        bookingWindow: bookingDetails.bookingWindow ?? getBookingWindowForDate(confirmedDate),
        pickup: confirmedPickup,
        pickupLatitude: bookingDetails.pickupLatitude ?? null,
        pickupLongitude: bookingDetails.pickupLongitude ?? null,
        pickupSource: bookingDetails.pickupSource ?? null,
        pricePence: bookingDetails.pricePence,
        car: bookingDetails.car
      })
    }).catch(() => undefined);

    window.history.replaceState(null, "", window.location.pathname);
  }, [availabilityDate, instructors, learnerPhone, postcode, selectedSlot]);

  const bookingWindow = getBookingWindowForDate(availabilityDate);
  const isAdvanceScheduledLesson = bookingWindow === "advance_scheduled";
  const isScheduledWorkspace = bookingMode === "scheduled";
  const bookingWindowLabel = isAdvanceScheduledLesson ? "Scheduled lesson" : "Today or tomorrow lesson";
  const todayAvailabilityDate = addDaysIso(0);
  const tomorrowAvailabilityDate = addDaysIso(1);
  const minAvailabilityDate = addDaysIso(isScheduledWorkspace ? 2 : 0);
  const maxQuickAvailabilityDate = isScheduledWorkspace ? undefined : tomorrowAvailabilityDate;

  useEffect(() => {
    if (isScheduledWorkspace) return;
    if (availabilityDate !== todayAvailabilityDate && availabilityDate !== tomorrowAvailabilityDate) {
      setAvailabilityDate(todayAvailabilityDate);
    }
  }, [availabilityDate, isScheduledWorkspace, todayAvailabilityDate, tomorrowAvailabilityDate]);

  const filteredInstructors = useMemo(() => {
    const maxDistance = distanceLimit(distance);
    const filtered = instructors.filter((instructor) => {
      const matchesTransmission = instructor.transmission === transmission;
      const hasSelectedDateAvailability = (instructor.slots[availabilityDate] ?? []).length > 0;
      const smartMatchScore = smartMatchInstructorScore(instructor, smartMatchContext);
      const smartMatchAllowsInstructor = !smartMatchContext || smartMatchScore > 0 || Boolean(smartMatchContext.instructorId || smartMatchContext.instructorName);
      return (
        !instructor.learnerAvailabilityPaused &&
        matchesTransmission &&
        hasSelectedDateAvailability &&
        instructor.price <= maxPrice * 100 &&
        instructor.distanceMiles <= maxDistance &&
        smartMatchAllowsInstructor
      );
    });

    return [...filtered].sort((a, b) => {
      if (smartMatchContext) {
        const smartMatchScoreDiff = smartMatchInstructorScore(b, smartMatchContext) - smartMatchInstructorScore(a, smartMatchContext);
        if (smartMatchScoreDiff !== 0) return smartMatchScoreDiff;
      }
      if (lessonPackage) {
        const aCanCover = countPackageSessions(a, availabilityDate) >= lessonPackage.totalSessions;
        const bCanCover = countPackageSessions(b, availabilityDate) >= lessonPackage.totalSessions;
        if (aCanCover !== bCanCover) return aCanCover ? -1 : 1;
      }
      if (sortBy === "distance") return a.distanceMiles - b.distanceMiles;
      if (sortBy === "price") return a.price - b.price;
      return Number(b.rating) - Number(a.rating);
    });
  }, [availabilityDate, distance, instructors, lessonPackage, maxPrice, smartMatchContext, sortBy, transmission]);

  const selectedInstructor = selectedInstructorId ? (filteredInstructors.find((instructor) => instructor.id === selectedInstructorId) ?? null) : null;
  const availableSlots = selectedInstructor?.slots[availabilityDate] ?? [];
  const livePickupCoordinateLabel =
    pickupPositionSource === "live" && pickupPosition
      ? `Live pickup location (${pickupPosition.lat.toFixed(5)}, ${pickupPosition.lng.toFixed(5)})`
      : "";
  const bookingPickupLabel = postcode.trim() || pickupLocationLabel || livePickupCoordinateLabel || "Live pickup location";
  const packageSessionPlan = useMemo(
    () =>
      lessonPackage
        ? buildPackageSessionPlan({
            instructor: selectedInstructor,
            fromDate: availabilityDate,
            firstTime: selectedSlot,
            totalSessions: lessonPackage.totalSessions
          })
        : [],
    [availabilityDate, lessonPackage, selectedInstructor, selectedSlot]
  );
  const packageSessionCount = packageSessionPlan.length;
  const packageHasEnoughSessions = !lessonPackage || packageSessionCount >= lessonPackage.totalSessions;
  const effectivePricePence = selectedInstructor ? selectedInstructor.price * (lessonPackage?.hours ?? 1) : 0;
  const lessonSummary = selectedInstructor
    ? lessonPackage
      ? `${lessonPackage.title}: ${lessonPackage.hours} hours with ${selectedInstructor.name}. First session ${availabilityDate} at ${selectedSlot || "selected time"} from ${bookingPickupLabel}. ${lessonPackage.paceLabel}.`
      : `${bookingWindowLabel}: ${availabilityDate} at ${selectedSlot || "selected time"} from ${bookingPickupLabel}. ${selectedInstructor.car}, ${selectedInstructor.transmission}.`
    : "";
  const normalisedLicence = useMemo(() => cleanLicenceNumber(licenceNumber), [licenceNumber]);
  const hasVerifiedProvisionalLicence = provisionalLicenceConfirmed || licenceVerifyState.status === "valid";
  const hasLivePickup = pickupPositionSource === "live" && Boolean(pickupPosition);
  const hasManualDoorPickup = pickupPositionSource === "pickup" && looksLikeDoorAddress(postcode);
  const confirmedPickupPosition = hasManualDoorPickup || hasLivePickup ? pickupPosition : null;
  const hasResolvedPickupPoint = Boolean(confirmedPickupPosition && (hasManualDoorPickup || hasLivePickup));
  const checkoutPickupLatitude = confirmedPickupPosition?.lat ?? null;
  const checkoutPickupLongitude = confirmedPickupPosition?.lng ?? null;
  const checkoutPickupSource = hasLivePickup ? "live" : hasManualDoorPickup ? "pickup" : null;
  const canPay = Boolean(
    selectedInstructor &&
      !selectedInstructor.learnerAvailabilityPaused &&
      selectedSlot &&
      hasResolvedPickupPoint &&
      hasVerifiedProvisionalLicence &&
      packageHasEnoughSessions
  );
  const trackingBooking = bookingRecords.find((record) => record.status === "upcoming" || record.status === "pending") ?? null;
  const trackingHref = trackingBooking
    ? `/tracking?from=learner-dashboard&booking=${encodeURIComponent(trackingBooking.id)}`
    : "/tracking?from=learner-dashboard";
  const mapPosition = pickupPosition ?? userPosition;
  const mapPositionSource = mapPosition ? (pickupPositionSource ?? "live") : undefined;
  useEffect(() => {
    if (selectedInstructorId && !filteredInstructors.some((instructor) => instructor.id === selectedInstructorId)) {
      setSelectedInstructorId(null);
    }
  }, [filteredInstructors, selectedInstructorId]);

  useEffect(() => {
    if (smartMatchPreselectAppliedRef.current || selectedInstructorId || !filteredInstructors.length) return;

    const targetId = initialSelectedInstructorId || smartMatchContext?.instructorId || "";
    const targetName = initialSelectedInstructorName || smartMatchContext?.instructorName || "";
    const normalisedTargetName = targetName.trim().toLowerCase();
    const match = filteredInstructors.find((instructor) => instructor.id === targetId) ??
      (normalisedTargetName
        ? filteredInstructors.find((instructor) => instructor.name.trim().toLowerCase() === normalisedTargetName)
        : null);

    if (match) {
      smartMatchPreselectAppliedRef.current = true;
      setSelectedInstructorId(match.id);
    }
  }, [filteredInstructors, initialSelectedInstructorId, initialSelectedInstructorName, selectedInstructorId, smartMatchContext]);

  useEffect(() => {
    checkoutRequestRef.current = null;

    if (!selectedInstructor) {
      setSelectedSlot("");
      return;
    }

    setSelectedSlot((currentSlot) => (availableSlots.includes(currentSlot) ? currentSlot : availableSlots[0] ?? ""));
  }, [availabilityDate, availableSlots, postcode, selectedInstructor]);

  function handleInstructorSelection(instructorId: string) {
    setSelectedInstructorId((current) => {
      if (current === instructorId) return null;
      if (current) return current;
      return instructorId;
    });
  }

  async function selectAddressPrediction(prediction: AddressPrediction) {
    selectedPickupAddressRef.current = prediction.description;
    pickupInputTouchedRef.current = true;
    setPostcode(prediction.description);
    setAddressPredictions([]);
    setAddressLookupStatus("loading");
    setLocationStatus(`Confirming pickup address: ${prediction.description}...`);

    try {
      const result = await geocodeGooglePlaceId(prediction.placeId);

      if (!result) {
        setPickupPosition(null);
        setPickupLocationLabel("");
        setAddressLookupStatus("error");
        setLocationStatus("LDA could not confirm that address. Choose another suggestion or enter the house number and postcode.");
        return;
      }

      const address = result.formattedAddress || prediction.description;
      selectedPickupAddressRef.current = address;
      setPostcode(address);
      setPickupPosition(result.location);
      setPickupPositionSource("pickup");
      setPickupLocationLabel(address);
      setAddressLookupStatus("idle");
      setLocationStatus(`Pickup address confirmed: ${address}.`);
    } catch {
      setPickupPosition(null);
      setPickupLocationLabel("");
      setAddressLookupStatus("error");
      setLocationStatus("LDA could not confirm that address. Choose another suggestion or enter the house number and postcode.");
    }
  }

  function applyBrowserPosition(position: LiveGpsPoint) {
    const livePosition = { lat: position.lat, lng: position.lng };
    const accuracy = position.accuracy;
    const bestAccuracy = bestLiveAccuracyRef.current;

    if (
      bestAccuracy !== null &&
      accuracy !== null &&
      accuracy > bestAccuracy &&
      !pickupInputTouchedRef.current
    ) {
      setLocationStatus("Keeping the most precise live pickup pin available from this device.");
      return;
    }

    bestLiveAccuracyRef.current =
      accuracy === null ? bestAccuracy : bestAccuracy === null ? accuracy : Math.min(bestAccuracy, accuracy);

    setUserPosition(livePosition);
    setLiveLocationAccuracy(accuracy);
    writeCachedLiveLocation("learner-pickup", "current", position);
    writeStoredValue(LOCATION_PREF_KEY, "true");
    writeStoredValue(LOCATION_PERMISSION_REQUESTED_KEY, "true");

    if (!pickupInputTouchedRef.current) {
      setPickupPosition(livePosition);
      setPickupPositionSource("live");

      const currentPickupText = postcodeValueRef.current.trim();
      setPickupLocationLabel("Live pickup pin");

      if (!currentPickupText && accuracy !== null && accuracy <= PRECISE_PICKUP_ACCURACY_METRES) {
        reverseGeocodeLocation(livePosition)
          .then((address) => {
            if (!address || pickupInputTouchedRef.current || postcodeValueRef.current.trim()) return;
            setPostcode(address);
            setPickupLocationLabel(address);
            setLocationStatus(`Using your precise live device location as the pickup point: ${address}.`);
          })
          .catch(() => undefined);
      } else if (!currentPickupText) {
        setLocationStatus("Using your live device location as the pickup point. Enter an exact pickup address only if you want the instructor sent somewhere else.");
      } else {
        setLocationStatus("Live location is enabled. The exact pickup address you entered will be used for checkout.");
      }
      return;
    }

    if (pickupPositionSourceRef.current !== "pickup") {
      setLocationStatus("Live location is enabled. Enter a pickup postcode or full address only if you want to move the pickup point.");
    }
  }

  async function updateLocationFromBrowser() {
    if (!navigator.geolocation) {
      setLocationStatus("Location is not supported on this device.");
      return;
    }

    if (readStoredValue(LOCATION_PREF_KEY) === "false") {
      setLocationStatus("Location sharing is off. Turn it back on in Account settings when you want live tracking.");
      return;
    }

    const permission = await navigator.permissions?.query({ name: "geolocation" as PermissionName }).catch(() => null);

    if (permission?.state === "denied") {
      setLocationStatus("Location is blocked in this browser. Update browser site permissions if you want live tracking.");
      return;
    }

    if (permission?.state !== "granted") {
      writeStoredValue(LOCATION_PERMISSION_REQUESTED_KEY, "true");
    }

    setLocationStatus("Refreshing your approved location...");
    const point = await requestFreshGpsPoint({
      source: "learner_pickup",
      enableHighAccuracy: true,
      maximumAge: 2500,
      timeout: 15000
    });

    if (point) {
      applyBrowserPosition(point);
    } else {
      setLocationStatus("Location permission was not granted. Postcode search still works, and you can change this later in Account settings.");
    }
  }

  async function verifyLicence() {
    setLicenceVerifyState({ status: "checking", message: "Checking provisional licence details..." });

    const response = await fetch("/api/dvla/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        drivingLicenceNumber: normalisedLicence,
        permissionConfirmed: licencePermission
      })
    });
    const result = await response.json();

    if (!response.ok || !result.valid) {
      setLicenceVerifyState({
        status: "invalid",
        message: result.message ?? "Licence could not be verified."
      });
      return;
    }

    setLicenceVerifyState({
      status: "valid",
      mode: result.mode ?? "live",
      message: result.message ?? "Licence check passed and saved for future bookings."
    });
  }

  function checkoutSignature() {
    if (!selectedInstructor) return "";

    return JSON.stringify({
      instructorId: selectedInstructor.id,
      instructorName: selectedInstructor.name,
      instructorEmail: selectedInstructor.email,
      lessonSummary,
      amountPence: effectivePricePence,
      bookingWindow,
      date: availabilityDate,
      time: selectedSlot,
      pickup: bookingPickupLabel,
      pickupLatitude: checkoutPickupLatitude,
      pickupLongitude: checkoutPickupLongitude,
      pickupSource: checkoutPickupSource,
      car: selectedInstructor.car,
      stripeConnectedAccountId: selectedInstructor.stripeConnectedAccountId,
      lessonPackage: lessonPackage
        ? {
            ...lessonPackage,
            sessions: packageSessionPlan
          }
        : null
    });
  }

  function savePendingBooking(reference: string) {
    if (!selectedInstructor) return;

    writeStoredValue(
      `lda-booking-${reference}`,
      JSON.stringify({
        instructorName: selectedInstructor.name,
        instructorId: selectedInstructor.id,
        instructorEmail: selectedInstructor.email,
        lessonSummary,
        date: availabilityDate,
        time: selectedSlot,
        bookingWindow,
        pickup: bookingPickupLabel,
        pickupLatitude: checkoutPickupLatitude,
        pickupLongitude: checkoutPickupLongitude,
        pickupSource: checkoutPickupSource,
        pricePence: effectivePricePence,
        car: selectedInstructor.car,
        lessonPackage: lessonPackage
          ? {
              ...lessonPackage,
              sessions: packageSessionPlan
            }
          : null,
        learnerEmail,
        learnerPhone
      })
    );
  }

  function createCheckoutSession(reference: string) {
    if (!selectedInstructor) {
      return Promise.reject({ error: "Choose an instructor before checkout." });
    }

    if (selectedInstructor.learnerAvailabilityPaused) {
      return Promise.reject({
        error: selectedInstructor.learnerAvailabilityPauseReason || "This instructor is temporarily unavailable while LDA reviews compliance evidence."
      });
    }

    return fetch("/api/bookings/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: false,
      body: JSON.stringify({
        bookingId: reference,
        instructorId: selectedInstructor.id,
        instructorName: selectedInstructor.name,
        instructorEmail: selectedInstructor.email,
        lessonSummary,
        amountPence: effectivePricePence,
        bookingWindow,
        date: availabilityDate,
        time: selectedSlot,
        pickup: bookingPickupLabel,
        pickupLatitude: checkoutPickupLatitude,
        pickupLongitude: checkoutPickupLongitude,
        pickupSource: checkoutPickupSource,
        car: selectedInstructor.car,
        lessonPackage: lessonPackage
          ? {
              ...lessonPackage,
              sessions: packageSessionPlan
            }
          : null,
        learnerAvailabilityPaused: Boolean(selectedInstructor.learnerAvailabilityPaused),
        learnerAvailabilityPauseReason: selectedInstructor.learnerAvailabilityPauseReason,
        stripeConnectedAccountId: selectedInstructor.stripeConnectedAccountId,
        learnerEmail,
        learnerPhone,
        paymentPreference: "checkout",
        smartMatchContext
      })
    }).then((response) => response.json().then((result) => (response.ok ? result : Promise.reject(result))));
  }

  function warmCheckoutSession() {
    if (!canPay || !selectedInstructor || checkoutState === "loading") return;

    const signature = checkoutSignature();
    if (checkoutRequestRef.current?.signature === signature) return;

    const reference = createBookingReference();
    savePendingBooking(reference);
    checkoutRequestRef.current = {
      signature,
      reference,
      promise: createCheckoutSession(reference)
    };
  }

  async function startCheckout() {
    if (!selectedInstructor) return;

    if (selectedInstructor.learnerAvailabilityPaused) {
      setCheckoutError(selectedInstructor.learnerAvailabilityPauseReason || "This instructor is temporarily unavailable while LDA reviews compliance evidence.");
      setCheckoutState("error");
      return;
    }

    if (!canPay) return;
    setCheckoutState("loading");
    setCheckoutError("");

    const signature = checkoutSignature();
    if (checkoutRequestRef.current?.signature !== signature) {
      warmCheckoutSession();
    }

    const result = await checkoutRequestRef.current?.promise.catch((error) => error ?? {});

    if (!result?.checkoutUrl) {
      setCheckoutError(result.error || result.message || "Checkout could not open. Check Stripe keys in Vercel.");
      setCheckoutState("error");
      return;
    }

    window.location.href = result.checkoutUrl;
  }

  const confirmationIsScheduled = confirmationDetails?.bookingWindow === "advance_scheduled";
  const confirmationStatusLabel = confirmationIsScheduled ? "Lesson scheduled" : "Lesson booked";
  const confirmationTitle = confirmationIsScheduled ? "Your LDA lesson is scheduled." : "Your LDA lesson is confirmed.";
  const confirmationMessage = confirmationIsScheduled
    ? "LDA is sending your scheduled lesson confirmation email, adding this update to your notification hub, and saving it to your calendar."
    : "LDA is sending your confirmation email, adding this update to your notification hub, and saving the lesson to your calendar.";

  return (
    <section id="learner-journey" className="mx-auto grid max-w-7xl gap-6 bg-white px-4 pb-10 text-black sm:px-6 lg:px-8">
      {showConfirmationModal && confirmationRef ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 px-4 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="booking-confirmed-title"
            className="relative w-full max-w-lg rounded border border-zinc-200 bg-white p-6 text-black shadow-2xl"
          >
            <button
              type="button"
              onClick={() => setShowConfirmationModal(false)}
              aria-label="Close booking confirmation"
              className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full border border-zinc-200 text-zinc-700 hover:bg-zinc-100"
            >
              <X size={20} />
            </button>
            <div className="inline-flex items-center gap-2 rounded bg-green-50 px-3 py-2 text-sm font-black uppercase text-green-800">
              <MailCheck size={17} /> {confirmationStatusLabel}
            </div>
            <h2 id="booking-confirmed-title" className="mt-4 pr-12 text-3xl font-black tracking-normal">
              {confirmationTitle}
            </h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-zinc-700">
              {confirmationMessage}
            </p>
            {confirmationDetails ? (
              <div className="mt-5 grid gap-2 rounded border border-zinc-200 bg-zinc-50 p-4 text-sm font-bold leading-6 text-zinc-700">
                <div>
                  <span className="text-zinc-500">Instructor:</span> <span className="text-black">{confirmationDetails.instructorName}</span>
                </div>
                <div>
                  <span className="text-zinc-500">Date:</span> <span className="text-black">{formatDisplayDate(confirmationDetails.date)}</span>
                </div>
                <div>
                  <span className="text-zinc-500">Time:</span> <span className="text-black">{confirmationDetails.time}</span>
                </div>
                <div>
                  <span className="text-zinc-500">Pickup:</span> <span className="text-black">{confirmationDetails.pickup}</span>
                </div>
              </div>
            ) : null}
            <div className="mt-5 rounded border border-red-200 bg-red-50 p-4">
              <div className="text-xs font-black uppercase text-brand">Booking reference</div>
              <div className="mt-2 break-all font-mono text-xl font-black text-black">{confirmationRef}</div>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              {confirmationIsScheduled ? (
                <>
                  <Link href="/learner-calendar?from=scheduled-confirmation" className="lda-pill lda-pill-sm">
                    Back to calendar
                  </Link>
                  <Link href="/learner-dashboard" className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-black hover:bg-zinc-100">
                    Back to learner dashboard
                  </Link>
                </>
              ) : (
                <>
                  <Link href={`/tracking?from=learner-dashboard&booking=${encodeURIComponent(confirmationRef)}`} className="lda-pill lda-pill-sm">
                    Track lesson
                  </Link>
                  <Link href="/booking-history?from=dashboard" className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-black hover:bg-zinc-100">
                    Booking history
                  </Link>
                </>
              )}
            </div>
          </section>
        </div>
      ) : null}
      {smartMatchContext ? (
        <article className="rounded border border-red-200 bg-red-50 p-5 text-black shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-sm font-black uppercase text-brand">Smart Match handoff</div>
              <h2 className="mt-2 text-2xl font-black">
                {smartMatchContext.instructorName
                  ? `Continuing with ${smartMatchContext.instructorName}`
                  : "Continuing from Smart Match"}
              </h2>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-zinc-700">
                LDA has carried your learning preferences into this booking session. Your private note is not shown publicly and is only prepared for the instructor you book.
              </p>
            </div>
            {smartMatchContext.matchScore ? (
              <div className="rounded bg-white px-4 py-3 text-center ring-1 ring-red-100">
                <div className="text-2xl font-black text-brand">{smartMatchContext.matchScore}%</div>
                <div className="text-xs font-black uppercase text-zinc-500">Match score</div>
              </div>
            ) : null}
          </div>
          {smartMatchContext.reasons?.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {smartMatchContext.reasons.slice(0, 4).map((reason) => (
                <span key={reason} className="rounded-full border border-red-100 bg-white px-3 py-1 text-xs font-black text-zinc-700">
                  {reason}
                </span>
              ))}
            </div>
          ) : null}
        </article>
      ) : null}
      {!isScheduledWorkspace ? (
        <section className="grid gap-5">
          <article className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-black uppercase text-brand">
                  <MapPin size={16} /> Nearby instructor map
                </div>
                <h2 className="mt-3 text-2xl font-black">View instructors around your pickup area.</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-600">{locationStatus}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href={trackingHref} className="lda-pill lda-pill-sm">
                  Live tracking
                </Link>
              </div>
            </div>
            <NearbyInstructorGoogleMap
              postcode={postcode}
              instructors={filteredInstructors}
              selectedInstructorId={selectedInstructorId ?? ""}
              userPosition={mapPosition}
              positionSource={mapPositionSource}
              onSelectInstructor={handleInstructorSelection}
            />
          </article>
        </section>
      ) : null}

      <section className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-black uppercase text-brand">
            <SlidersHorizontal size={16} /> Search filters
          </div>
          {isScheduledWorkspace ? (
            <Link
              href="/learner-dashboard?section=driving-lessons&from=scheduled-lessons#driving-lessons-booking"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-black text-zinc-800 transition hover:ring-2 hover:ring-brand/40"
            >
              <CalendarCheck size={16} /> Same-day booking
            </Link>
          ) : (
            <Link
              href="/scheduled-lessons?from=driving-lessons"
              className="lda-pill lda-pill-sm"
            >
              <CalendarCheck size={16} /> Schedule lesson
            </Link>
          )}
        </div>
        <div className="mt-5 grid items-start gap-y-4 gap-x-6 lg:grid-cols-6">
          <label className="relative grid content-start gap-1 lg:col-span-2">
            <span className="text-xs font-black uppercase text-zinc-600">Pickup postcode or address</span>
            <input
              ref={postcodeRef}
              value={postcode}
              onChange={(event) => {
                const value = event.target.value;

                pickupInputTouchedRef.current = Boolean(value.trim());
                selectedPickupAddressRef.current = "";
                setPostcode(value);
                if (value.trim()) {
                  setPickupPosition(null);
                  setPickupPositionSource("pickup");
                  setPickupLocationLabel("");
                } else {
                  setPickupPosition(userPosition);
                  setPickupPositionSource(userPosition ? "live" : null);
                  setPickupLocationLabel(userPosition ? "Live pickup pin" : "");
                  setLocationStatus(
                    userPosition
                      ? "Using your live device location as the pickup point. Enter an address only if you want a different pickup."
                      : "Share your live location or enter a pickup address to show nearby instructors."
                  );
                }
              }}
              placeholder="SW1A 1AA or 10 Downing Street"
              className="h-14 rounded border border-zinc-300 bg-white px-3 text-sm font-bold text-black"
            />
            {addressPredictions.length ? (
              <div className="absolute left-0 right-0 top-[74px] z-30 overflow-hidden rounded border border-zinc-200 bg-white shadow-xl">
                {addressPredictions.map((prediction) => (
                  <button
                    key={prediction.placeId}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => void selectAddressPrediction(prediction)}
                    className="grid w-full gap-1 border-b border-zinc-100 px-3 py-3 text-left last:border-b-0 hover:bg-red-50 focus:bg-red-50"
                  >
                    <span className="text-sm font-black text-zinc-950">{prediction.mainText}</span>
                    {prediction.secondaryText ? <span className="text-xs font-bold text-zinc-500">{prediction.secondaryText}</span> : null}
                  </button>
                ))}
              </div>
            ) : null}
            {addressLookupStatus === "error" && postcode.trim().length >= 3 && !looksLikeDoorAddress(postcode) ? (
              <span className="text-xs font-bold leading-5 text-zinc-500">
                Choose a full address with a house number if you want a different pickup. Otherwise LDA can use your live pickup pin.
              </span>
            ) : null}
          </label>
          <label className="grid content-start gap-1">
            <span className="text-xs font-black uppercase text-zinc-600">Distance</span>
            <select value={distance} onChange={(event) => setDistance(event.target.value)} className="h-14 rounded border border-zinc-300 bg-white px-3 text-sm font-bold text-black">
              <option value="5">Within 5 miles</option>
              <option value="10">Within 10 miles</option>
              <option value="15">Within 15 miles</option>
              <option value="local">My local borough</option>
              <option value="preferred">Pickup or live area</option>
            </select>
          </label>
          <label className="grid content-start gap-1 lg:ml-2">
            <span className="text-xs font-black uppercase text-zinc-600">Transmission</span>
            <select value={transmission} onChange={(event) => setTransmission(event.target.value)} className="h-14 rounded border border-zinc-300 bg-white px-3 text-sm font-bold text-black">
              <option value="automatic">Automatic</option>
              <option value="manual">Manual</option>
            </select>
          </label>
          <label className="grid content-start gap-1">
            <span className="text-xs font-black uppercase text-zinc-600">Availability</span>
            {isScheduledWorkspace ? (
              <>
                <input
                  type="date"
                  value={availabilityDate}
                  min={minAvailabilityDate}
                  max={maxQuickAvailabilityDate}
                  onChange={(event) => setAvailabilityDate(event.target.value)}
                  className="h-14 rounded border border-zinc-300 bg-white px-3 text-sm font-bold text-black"
                />
                <span className="mt-1 text-xs font-bold leading-5 text-zinc-500">
                  Scheduled lessons start from the day after tomorrow. Use this route for advance diary bookings.
                </span>
              </>
            ) : (
              <>
                <input type="hidden" value={availabilityDate} readOnly />
                <select
                  value={availabilityDate}
                  onChange={(event) => setAvailabilityDate(event.target.value)}
                  className="h-14 rounded border border-zinc-300 bg-white px-3 text-sm font-bold text-black"
                >
                  <option value={todayAvailabilityDate}>Today</option>
                  <option value={tomorrowAvailabilityDate}>Tomorrow</option>
                </select>
              </>
            )}
          </label>
          <label className="grid content-start gap-1">
            <span className="text-xs font-black uppercase text-zinc-600">Sort by</span>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="h-14 rounded border border-zinc-300 bg-white px-3 text-sm font-bold text-black">
              <option value="relevance">Relevance</option>
              <option value="distance">Distance</option>
              <option value="price">Price</option>
            </select>
          </label>
        </div>
        <label className="mt-5 grid gap-2">
          <span className="text-xs font-black uppercase text-zinc-600">Price selector: up to {formatMoney(maxPrice * 100)}/hr</span>
          <input type="range" min="30" max="60" step="1" value={maxPrice} onChange={(event) => setMaxPrice(Number(event.target.value))} className="accent-red-600" />
        </label>
        {isScheduledWorkspace ? (
          <div className="mt-4 grid gap-3 rounded border border-red-200 bg-red-50 p-4 text-sm font-bold leading-6 text-red-950">
            <div className="text-xs font-black uppercase text-brand">Scheduled lesson terms</div>
            <p>
              Scheduled lessons are advance bookings that reserve an instructor&apos;s diary time for a future date. Payment is taken at checkout so the selected slot can be held securely.
            </p>
            <p>
              Because this time is reserved in advance, learner cancellations are not automatically refundable. If an instructor cancels, or exceptional circumstances apply, LDA support can review a replacement lesson or refund under the cancellation policy.
            </p>
          </div>
        ) : null}
      </section>

      <section className={`grid gap-5 ${filteredInstructors.length ? "xl:grid-cols-[1fr_420px]" : ""}`}>
        <div className="grid gap-5">
          {filteredInstructors.length ? (
            <>
              <div className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
                <h2 className="text-2xl font-black">
                  {lessonPackage ? `Approved instructors for ${lessonPackage.title}` : `Approved instructors closest to ${postcode || "you"}`}
                </h2>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  {lessonPackage
                    ? `Choose one instructor for the full ${lessonPackage.hours}-hour package. LDA checks their future diary from ${formatDisplayDate(availabilityDate)} and prioritises instructors who can cover every planned session.`
                    : isScheduledWorkspace
                    ? `Only instructors with advance availability on ${formatDisplayDate(availabilityDate)} are shown. These bookings reserve future diary time and follow the scheduled lesson terms.`
                    : `Only instructors with availability on ${formatDisplayDate(availabilityDate)} are shown. Today and tomorrow are short-window lesson bookings.`}
                </p>
              </div>

              <div className="grid items-stretch gap-4 xl:grid-cols-2">
                {filteredInstructors.map((instructor) => {
              const isChosen = selectedInstructorId === instructor.id;
              const selectionIsLocked = Boolean(selectedInstructorId && !isChosen);
              const coveredAreas = coveredAreasByInstructor[instructor.id] ?? instructor.areas.split(",").map((area) => area.trim()).filter(Boolean);
              const packageSessionCapacity = lessonPackage ? countPackageSessions(instructor, availabilityDate) : 0;
              const canCoverPackage = !lessonPackage || packageSessionCapacity >= lessonPackage.totalSessions;

              return (
                <article key={instructor.id} className={`flex h-full min-h-[470px] min-w-0 flex-col overflow-hidden rounded border p-5 shadow-sm transition ${isChosen ? "border-brand bg-red-50" : "border-zinc-200 bg-white"} ${selectionIsLocked ? "opacity-80" : ""}`}>
                  <div className="grid min-h-[122px] grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                    <div className="min-w-0">
                      <div className="grid h-16 w-16 place-items-center rounded bg-black text-xl font-black text-white">{instructor.name.slice(0, 1)}</div>
                      <h3 className="mt-4 break-words text-xl font-black leading-7">{instructor.name}</h3>
                    </div>
                    <span className="max-w-28 rounded bg-red-500/10 px-2 py-1 text-center text-xs font-black text-brand">Verified {instructor.type}</span>
                  </div>
                  <p className="mt-3 min-h-[72px] break-words text-sm font-bold leading-6 text-zinc-600" title={instructor.bio}>{instructor.bio}</p>
                  <div className="mt-4 grid min-h-[116px] grid-rows-4 gap-2 text-sm text-zinc-700">
                    <span className="inline-flex min-w-0 items-center gap-2"><Star size={16} className="shrink-0 text-brand" /> <span className="truncate">{instructor.rating} rating</span></span>
                    <span className="inline-flex min-w-0 items-center gap-2"><MapPin size={16} className="shrink-0 text-brand" /> <span className="truncate">{instructor.distanceMiles} miles away</span></span>
                    <span className="inline-flex min-w-0 items-center gap-2"><CarFront size={16} className="shrink-0 text-brand" /> <span className="truncate">{instructor.car} - {instructor.transmission}</span></span>
                    <span className="inline-flex min-w-0 items-center gap-2"><Clock3 size={16} className="shrink-0 text-brand" /> <span className="truncate">Next: {instructor.next}</span></span>
                  </div>
                  <div className="mt-3 min-h-[84px] rounded border border-zinc-200 bg-zinc-50 p-3 text-xs font-bold leading-5 text-zinc-700">
                    <div className="mb-2 text-[11px] font-black uppercase tracking-wide text-zinc-500">Areas covered, nearest first</div>
                    <div className="flex flex-wrap gap-2" title={`Covers ${coveredAreas.join(", ")}`}>
                      {coveredAreas.slice(0, 8).map((area, index) => (
                        <span key={area} className={`rounded-full border border-zinc-200 bg-white px-2 py-1 leading-none shadow-sm ${index >= 4 ? "xl:hidden" : ""}`}>
                          {area}
                        </span>
                      ))}
                    </div>
                  </div>
                  {lessonPackage ? (
                    <div className={`mt-3 rounded border p-3 text-xs font-black leading-5 ${canCoverPackage ? "border-green-200 bg-green-50 text-green-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
                      <div className="uppercase">{canCoverPackage ? "Can cover this package" : "Limited package cover"}</div>
                      <div className="mt-1 font-bold normal-case">
                        {packageSessionCapacity}/{lessonPackage.totalSessions} visible sessions from {formatDisplayDate(availabilityDate)}.
                      </div>
                    </div>
                  ) : null}
                  <div className="mt-auto flex flex-wrap items-end justify-between gap-4 border-t border-zinc-200 pt-4">
                    <div className="min-w-0">
                      <div className="text-xs font-bold uppercase text-zinc-600">{lessonPackage ? "Package estimate" : "Price"}</div>
                      <div
                        className="whitespace-nowrap text-2xl font-black tracking-tight"
                        title={lessonPackage ? `${formatMoney(instructor.price * lessonPackage.hours)} total` : `${formatMoney(instructor.price)}/hr`}
                      >
                        {lessonPackage ? formatMoney(instructor.price * lessonPackage.hours) : `${formatMoney(instructor.price)}/hr`}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleInstructorSelection(instructor.id)}
                      disabled={selectionIsLocked}
                      aria-pressed={isChosen}
                      className={`lda-pill lda-pill-sm min-w-28 max-w-full shrink-0 justify-center ${selectionIsLocked ? "cursor-not-allowed" : ""}`}
                      style={
                        isChosen
                          ? {
                              background: "#000000",
                              borderColor: "#000000",
                              boxShadow: "none",
                              transform: "none"
                            }
                          : selectionIsLocked
                            ? {
                                background: "linear-gradient(180deg, #ff8b92, #e85b64)",
                                borderColor: "#ffb7bc",
                                boxShadow: "none",
                                transform: "none"
                              }
                            : undefined
                      }
                    >
                      {isChosen ? "Chosen" : "Choose"}
                    </button>
                  </div>
                </article>
              );
                })}
              </div>
            </>
          ) : (
            <article className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
              <h2 className="text-2xl font-black">No approved instructors match this day and filter set.</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-zinc-600">
                Choose another date, increase the distance, or raise the price filter to see available instructors near {postcode || "your pickup area"}.
              </p>
            </article>
          )}
        </div>

        {filteredInstructors.length ? (
        <aside className="grid gap-5">
          {selectedInstructor ? (
            <>
              <section className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-black uppercase text-brand">
                  <CalendarCheck size={16} /> Book {selectedInstructor.name}
                </div>
                <div className="mt-4 rounded border border-zinc-200 bg-zinc-50 p-4">
                  <div className="text-xs font-black uppercase text-zinc-600">{lessonPackage ? "Package start date" : "Selected date"}</div>
                  <div className="mt-2 text-xl font-black">{formatDisplayDate(availabilityDate)}</div>
                  <div className="mt-1 text-sm text-zinc-600">{selectedInstructor.car}</div>
                  <div className={`mt-3 rounded px-3 py-2 text-xs font-black uppercase ${isAdvanceScheduledLesson ? "bg-amber-100 text-amber-900" : "bg-white text-zinc-700"}`}>
                    {bookingWindowLabel}
                  </div>
                </div>
                {lessonPackage ? (
                  <div className={`mt-4 rounded border p-4 text-sm font-bold leading-6 ${packageHasEnoughSessions ? "border-green-200 bg-green-50 text-green-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
                    <div className="text-xs font-black uppercase">{lessonPackage.title}</div>
                    <p className="mt-2">
                      {lessonPackage.paceLabel}. LDA will keep this booking with {selectedInstructor.name} where their diary can cover the full block.
                    </p>
                    <p className="mt-2">
                      {packageSessionCount}/{lessonPackage.totalSessions} sessions found from {formatDisplayDate(availabilityDate)}.
                    </p>
                  </div>
                ) : null}
                <div className="mt-4 grid gap-2">
                  <div className="text-xs font-black uppercase text-zinc-600">{lessonPackage ? "First session options" : "Available slots"}</div>
                  {availableSlots.length ? (
                    <div className="grid grid-cols-2 gap-2">
                      {availableSlots.map((slot) => (
                        <button key={slot} type="button" onClick={() => setSelectedSlot(slot)} className={`rounded border px-3 py-2 text-sm font-black ${selectedSlot === slot ? "border-brand bg-brand text-white" : "border-zinc-300 bg-white text-zinc-800"}`}>
                          {slot}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded border border-zinc-200 bg-zinc-50 p-3 text-sm font-bold text-zinc-600">No slots on this date. Pick another date.</div>
                  )}
                </div>
              </section>

              {selectedSlot ? (
                <section className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-2 text-sm font-black uppercase text-brand">
                    <CreditCard size={16} /> Confirm and pay
                  </div>
                  <div className="mt-4 grid gap-3 rounded border border-zinc-200 bg-zinc-50 p-4 text-sm">
                    <div><span className="font-black text-zinc-600">Instructor:</span> {selectedInstructor.name}</div>
                    <div><span className="font-black text-zinc-600">Pickup:</span> {bookingPickupLabel}</div>
                    <div><span className="font-black text-zinc-600">{lessonPackage ? "First session:" : "Lesson:"}</span> {formatDisplayDate(availabilityDate)} at {selectedSlot}</div>
                    <div><span className="font-black text-zinc-600">Booking type:</span> {bookingWindowLabel}</div>
                    {lessonPackage ? (
                      <>
                        <div><span className="font-black text-zinc-600">Package:</span> {lessonPackage.title} - {lessonPackage.hours} hours</div>
                        <div><span className="font-black text-zinc-600">Planned sessions:</span> {packageSessionCount}/{lessonPackage.totalSessions}</div>
                      </>
                    ) : null}
                    <div><span className="font-black text-zinc-600">{lessonPackage ? "Package price:" : "Upfront price:"}</span> {formatMoney(effectivePricePence)} with no hidden booking fee</div>
                  </div>
                  {lessonPackage ? (
                    <div className="mt-4 rounded border border-zinc-200 bg-white p-4">
                      <div className="text-xs font-black uppercase text-zinc-600">Package lesson plan</div>
                      <div className="mt-3 grid gap-2 text-sm font-bold text-zinc-700">
                        {packageSessionPlan.slice(0, 6).map((session, index) => (
                          <div key={`${session.date}-${session.time}-${index}`} className="flex items-center justify-between gap-3 rounded border border-zinc-200 bg-zinc-50 px-3 py-2">
                            <span>Session {index + 1}</span>
                            <span className="text-right text-black">{formatDisplayDate(session.date)} at {session.time}</span>
                          </div>
                        ))}
                        {packageSessionPlan.length > 6 ? (
                          <div className="rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-zinc-600">
                            +{packageSessionPlan.length - 6} more sessions saved at checkout.
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                  {hasVerifiedProvisionalLicence ? (
                    <div className="mt-4 rounded border border-green-200 bg-green-50 p-4 text-sm font-bold leading-6 text-green-800">
                      <div className="flex items-center gap-2 text-xs font-black uppercase">
                        <ShieldCheck size={16} /> Provisional licence verified
                      </div>
                      <p className="mt-2">
                        LDA has saved this verification on your learner account, so you do not need to enter the licence number again for this booking.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-4 grid gap-3 rounded border border-zinc-200 bg-zinc-50 p-4">
                      <label className="grid gap-1">
                        <span className="text-xs font-black uppercase text-zinc-600">Provisional driving licence number</span>
                        <input
                          required
                          value={licenceNumber}
                          onChange={(event) => {
                            setLicenceNumber(event.target.value);
                            setLicenceVerifyState({
                              status: "idle",
                              message: "Run the DVLA provisional licence check before checkout."
                            });
                          }}
                          maxLength={20}
                          className="rounded border border-zinc-300 bg-white px-3 py-3 font-mono text-sm font-black uppercase text-black"
                          placeholder="16 characters"
                        />
                      </label>
                      <label className="flex items-start gap-3 rounded bg-white p-3 text-sm font-bold leading-6 text-zinc-700">
                        <input
                          checked={licencePermission}
                          onChange={(event) => {
                            setLicencePermission(event.target.checked);
                            setLicenceVerifyState({
                              status: "idle",
                              message: "Run the DVLA provisional licence check before checkout."
                            });
                          }}
                          type="checkbox"
                          className="mt-1"
                        />
                        I confirm this is my licence number and I give LDA permission to verify entitlement through the configured DVLA route.
                      </label>
                      <button
                        type="button"
                        onClick={verifyLicence}
                        disabled={!licencePermission || normalisedLicence.length < 16 || licenceVerifyState.status === "checking"}
                        className="lda-pill lda-pill-sm justify-center"
                      >
                        <ShieldCheck size={17} /> {licenceVerifyState.status === "checking" ? "Checking..." : "Check DVLA licence"}
                      </button>
                      <div
                        className={`rounded p-3 text-sm font-bold leading-6 ${
                          licenceVerifyState.status === "invalid" ? "bg-red-50 text-red-700" : "bg-white text-zinc-600"
                        }`}
                      >
                        {licenceVerifyState.message}
                      </div>
                    </div>
                  )}
                  <button
                    disabled={!canPay || checkoutState === "loading"}
                    onPointerEnter={warmCheckoutSession}
                    onFocus={warmCheckoutSession}
                    onTouchStart={warmCheckoutSession}
                    onClick={() => startCheckout()}
                    className="lda-pill mt-5 w-full"
                  >
                    <CreditCard size={18} /> {checkoutState === "loading" ? "Opening secure checkout..." : "Checkout"}
                  </button>
                  {!hasResolvedPickupPoint ? (
                    <p className="mt-3 rounded border border-amber-200 bg-amber-50 p-3 text-xs font-black leading-5 text-amber-900">
                      Share your live location or enter a full pickup address before checkout. If you use live location, LDA will send the instructor to the live pickup pin captured when you book.
                    </p>
                  ) : null}
                  {lessonPackage && !packageHasEnoughSessions ? (
                    <p className="mt-3 rounded border border-amber-200 bg-amber-50 p-3 text-xs font-black leading-5 text-amber-900">
                      This instructor does not currently show enough available sessions for the full package from this start date. Choose another instructor or start date before checkout.
                    </p>
                  ) : null}
                  {checkoutState === "error" ? <p className="mt-3 text-sm font-bold text-brand">{checkoutError || "Checkout could not open. Check Stripe keys in Vercel."}</p> : null}
                  {checkoutState === "confirmed" ? (
                    <div className="mt-4 rounded border border-red-500/30 bg-red-500/10 p-4 text-sm leading-6 text-red-100">
                      <MailCheck className="mb-2" />
                      Thank you for booking {selectedInstructor.name}. Your unique booking reference is <span className="font-black">{confirmationRef}</span>. Only share it with your instructor when they arrive.
                    </div>
                  ) : null}
                </section>
              ) : null}
            </>
          ) : (
            <section className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-black uppercase text-brand">
                <CalendarCheck size={16} /> Choose an instructor first
              </div>
              <p className="mt-3 text-sm font-bold leading-6 text-zinc-600">
                Choose an approved instructor to view their available lesson times for {formatDisplayDate(availabilityDate)}. LDA will then prepare a secure checkout summary based on your selected instructor, date, pickup details, and lesson preferences.
              </p>
            </section>
          )}
        </aside>
        ) : null}
      </section>
    </section>
  );
}

