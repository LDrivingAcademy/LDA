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
  SlidersHorizontal,
  Star
} from "lucide-react";
import { demoInstructors } from "@/lib/marketplace-content";
import { formatMoney } from "@/lib/money";
import { readStoredJsonOrNull, readStoredValue, writeStoredValue } from "@/lib/browser-storage";
import { NearbyInstructorGoogleMap } from "@/components/nearby-instructor-google-map";

const LOCATION_PREF_KEY = "lda-location-sharing-enabled";
const LOCATION_PERMISSION_REQUESTED_KEY = "lda-location-permission-requested";

type Instructor = (typeof demoInstructors)[number] & {
  id: string;
  distanceMiles: number;
  slots: Record<string, string[]>;
  stripeConnectedAccountId?: string;
};

type BookingRecord = {
  id: string;
  instructorName: string;
  instructorId: string;
  lessonSummary: string;
  date: string;
  time: string;
  pickup: string;
  pricePence: number;
  car: string;
  status: "pending" | "upcoming" | "completed" | "cancelled";
  rating?: number;
  review?: string;
};

const instructors: Instructor[] = [
  {
    ...demoInstructors[0],
    id: "amelia-khan",
    distanceMiles: 1.8,
    slots: {
      "2026-05-13": ["16:30", "18:00"],
      "2026-05-14": ["09:30", "13:00", "17:30"],
      "2026-05-16": ["10:00", "12:00"]
    }
  },
  {
    ...demoInstructors[1],
    id: "marcus-reed",
    distanceMiles: 2.6,
    slots: {
      "2026-05-14": ["10:00", "14:30"],
      "2026-05-15": ["09:00", "15:00"],
      "2026-05-18": ["11:30"]
    }
  },
  {
    ...demoInstructors[2],
    id: "priya-shah",
    distanceMiles: 4.1,
    slots: {
      "2026-05-15": ["13:00", "16:00"],
      "2026-05-17": ["10:30"],
      "2026-05-19": ["12:30", "18:30"]
    }
  }
];

const demoBookingRecords: BookingRecord[] = [
  {
    id: "LDA-AME-UPCOMING",
    instructorName: "Amelia Khan",
    instructorId: "amelia-khan",
    lessonSummary: "2026-05-16 at 10:00 from EN5 5XY. Toyota Yaris Hybrid, automatic.",
    date: "2026-05-16",
    time: "10:00",
    pickup: "EN5 5XY",
    pricePence: 4200,
    car: "Toyota Yaris Hybrid",
    status: "upcoming"
  },
  {
    id: "LDA-MAR-COMPLETE",
    instructorName: "Marcus Reed",
    instructorId: "marcus-reed",
    lessonSummary: "2026-05-08 at 15:00 from EN5 5XY. Ford Fiesta, manual.",
    date: "2026-05-08",
    time: "15:00",
    pickup: "EN5 5XY",
    pricePence: 3900,
    car: "Ford Fiesta",
    status: "completed"
  }
];

function distanceLimit(value: string) {
  if (value === "local") return 5;
  if (value === "preferred") return 15;
  return Number(value);
}

function makeBookingReference(instructorId: string) {
  return `LDA-${instructorId.toUpperCase().slice(0, 3)}-${Date.now().toString(36).toUpperCase()}`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function LearnerBookingDashboard({ learnerEmail, learnerPhone }: { learnerEmail?: string | null; learnerPhone?: string | null }) {
  const postcodeRef = useRef<HTMLInputElement>(null);
  const checkoutRequestRef = useRef<{
    signature: string;
    reference: string;
    promise: Promise<{ checkoutUrl?: string; error?: string; message?: string }>;
  } | null>(null);
  const [postcode, setPostcode] = useState("EN5 5XY");
  const [distance, setDistance] = useState("5");
  const [transmission, setTransmission] = useState("any");
  const [maxPrice, setMaxPrice] = useState(45);
  const [availabilityDate, setAvailabilityDate] = useState("2026-05-14");
  const [sortBy, setSortBy] = useState("relevance");
  const [selectedInstructorId, setSelectedInstructorId] = useState(instructors[0].id);
  const [selectedSlot, setSelectedSlot] = useState("09:30");
  const [checkoutState, setCheckoutState] = useState<"idle" | "loading" | "error" | "confirmed">("idle");
  const [checkoutError, setCheckoutError] = useState("");
  const [confirmationRef, setConfirmationRef] = useState("");
  const [bookingRecords, setBookingRecords] = useState<BookingRecord[]>([]);
  const [userPosition, setUserPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState("Location sharing is on for live tracking and nearby instructor sorting.");

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
    const initialBookings = Array.isArray(stored) ? stored : demoBookingRecords;
    setBookingRecords(initialBookings);

    if (!stored) {
      writeStoredValue("lda-learner-bookings", JSON.stringify(demoBookingRecords));
    }
  }, []);

  useEffect(() => {
    const storedPreference = readStoredValue(LOCATION_PREF_KEY);
    const enabled = storedPreference !== "false";

    if (storedPreference === null) {
      writeStoredValue(LOCATION_PREF_KEY, "true");
    }

    if (enabled) {
      void updateLocationFromBrowser();
    } else {
      setLocationStatus("Location sharing is off. Turn it back on in Account settings when you want live tracking.");
    }

    const interval = window.setInterval(() => {
      if (readStoredValue(LOCATION_PREF_KEY) !== "false") {
        void updateLocationFromBrowser();
      }
    }, 5000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!bookingRecords.length) return;
    writeStoredValue("lda-learner-bookings", JSON.stringify(bookingRecords));
  }, [bookingRecords]);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    const input = postcodeRef.current;
    const google = (window as any).google;

    if (!key || !input || google?.maps?.places) {
      if (input && google?.maps?.places) {
        const autocomplete = new google.maps.places.Autocomplete(input, {
          componentRestrictions: { country: "gb" },
          fields: ["formatted_address", "address_components"]
        });
        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          setPostcode(place.formatted_address || input.value);
        });
      }
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>("script[data-lda-google-maps], script[src*='maps.googleapis.com/maps/api/js']");

    if (existingScript) {
      const initialiseAutocomplete = () => {
        const loadedGoogle = (window as any).google;
        if (!postcodeRef.current || !loadedGoogle?.maps?.places) return;
        const autocomplete = new loadedGoogle.maps.places.Autocomplete(postcodeRef.current, {
          componentRestrictions: { country: "gb" },
          fields: ["formatted_address", "address_components"]
        });
        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          setPostcode(place.formatted_address || postcodeRef.current?.value || "");
        });
      };

      existingScript.addEventListener("load", initialiseAutocomplete, { once: true });
      window.setTimeout(initialiseAutocomplete, 350);
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`;
    script.async = true;
    script.dataset.ldaGoogleMaps = "true";
    script.onload = () => {
      const loadedGoogle = (window as any).google;
      if (!postcodeRef.current || !loadedGoogle?.maps?.places) return;
      const autocomplete = new loadedGoogle.maps.places.Autocomplete(postcodeRef.current, {
        componentRestrictions: { country: "gb" },
        fields: ["formatted_address", "address_components"]
      });
      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        setPostcode(place.formatted_address || postcodeRef.current?.value || "");
      });
    };
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const booking = params.get("booking");

    if (params.get("payment") !== "success" || !booking) return;

    const bookingDetails = readStoredJsonOrNull<{
      instructorName: string;
      instructorId: string;
      lessonSummary: string;
      learnerEmail?: string | null;
      date?: string;
      time?: string;
      pickup?: string;
      pricePence?: number;
      car?: string;
    }>(`lda-booking-${booking}`);

    if (!bookingDetails) return;

    const bookedInstructor = instructors.find((instructor) => instructor.id === bookingDetails.instructorId) ?? instructors[0];

    setConfirmationRef(booking);
    setCheckoutState("confirmed");
    setBookingRecords((records) => {
      if (records.some((record) => record.id === booking)) return records;

      return [
        {
          id: booking,
          instructorName: bookingDetails.instructorName,
          instructorId: bookingDetails.instructorId,
          lessonSummary: bookingDetails.lessonSummary,
          date: bookingDetails.date ?? availabilityDate,
          time: bookingDetails.time ?? selectedSlot,
          pickup: bookingDetails.pickup ?? postcode,
          pricePence: bookingDetails.pricePence ?? bookedInstructor.price,
          car: bookingDetails.car ?? bookedInstructor.car,
          status: "upcoming"
        },
        ...records
      ];
    });

    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification("LDA lesson booked", {
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
        learnerEmail: bookingDetails.learnerEmail,
        learnerPhone,
        lessonSummary: bookingDetails.lessonSummary
      })
    }).catch(() => undefined);
  }, [availabilityDate, learnerPhone, postcode, selectedSlot]);

  const filteredInstructors = useMemo(() => {
    const maxDistance = distanceLimit(distance);
    const filtered = instructors.filter((instructor) => {
      const matchesTransmission = transmission === "any" || instructor.transmission === transmission;
      return matchesTransmission && instructor.price <= maxPrice * 100 && instructor.distanceMiles <= maxDistance;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === "distance") return a.distanceMiles - b.distanceMiles;
      if (sortBy === "price") return a.price - b.price;
      return Number(b.rating) - Number(a.rating);
    });
  }, [distance, maxPrice, sortBy, transmission]);

  const selectedInstructor = filteredInstructors.find((instructor) => instructor.id === selectedInstructorId) ?? filteredInstructors[0] ?? instructors[0];
  const availableSlots = selectedInstructor.slots[availabilityDate] ?? [];
  const lessonSummary = `${availabilityDate} at ${selectedSlot || "selected time"} from ${postcode}. ${selectedInstructor.car}, ${selectedInstructor.transmission}.`;
  const canPay = Boolean(selectedInstructor && selectedSlot && postcode);
  const trackingBooking =
    bookingRecords.find((record) => record.status === "upcoming" || record.status === "pending") ??
    bookingRecords[0] ??
    null;
  const trackingHref = trackingBooking
    ? `/tracking?from=learner-dashboard&booking=${encodeURIComponent(trackingBooking.id)}`
    : "/tracking?from=learner-dashboard";

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
      if (readStoredValue(LOCATION_PERMISSION_REQUESTED_KEY) === "true") {
        setLocationStatus("Location sharing is enabled. This browser still needs location permission before LDA can show your exact live position.");
        return;
      }

      writeStoredValue(LOCATION_PERMISSION_REQUESTED_KEY, "true");
    }

    setLocationStatus("Refreshing your approved location...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserPosition({ lat: position.coords.latitude, lng: position.coords.longitude });
        writeStoredValue(LOCATION_PREF_KEY, "true");
        writeStoredValue(LOCATION_PERMISSION_REQUESTED_KEY, "true");
        setLocationStatus("Live location is enabled for nearby instructor sorting and lesson tracking.");
      },
      () => setLocationStatus("Location permission was not granted. Postcode search still works, and you can change this later in Account settings."),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  function checkoutSignature() {
    return JSON.stringify({
      instructorId: selectedInstructor.id,
      instructorName: selectedInstructor.name,
      lessonSummary,
      amountPence: selectedInstructor.price,
      stripeConnectedAccountId: selectedInstructor.stripeConnectedAccountId
    });
  }

  function savePendingBooking(reference: string) {
    writeStoredValue(
      `lda-booking-${reference}`,
      JSON.stringify({
        instructorName: selectedInstructor.name,
        instructorId: selectedInstructor.id,
        lessonSummary,
        date: availabilityDate,
        time: selectedSlot,
        pickup: postcode,
        pricePence: selectedInstructor.price,
        car: selectedInstructor.car,
        learnerEmail,
        learnerPhone
      })
    );
  }

  function createCheckoutSession(reference: string) {
    return fetch("/api/bookings/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: false,
      body: JSON.stringify({
        bookingId: reference,
        instructorName: selectedInstructor.name,
        lessonSummary,
        amountPence: selectedInstructor.price,
        stripeConnectedAccountId: selectedInstructor.stripeConnectedAccountId,
        learnerEmail,
        paymentPreference: "checkout"
      })
    }).then((response) => response.json().then((result) => (response.ok ? result : Promise.reject(result))));
  }

  function warmCheckoutSession() {
    if (!canPay || checkoutState === "loading") return;

    const signature = checkoutSignature();
    if (checkoutRequestRef.current?.signature === signature) return;

    const reference = makeBookingReference(selectedInstructor.id);
    savePendingBooking(reference);
    checkoutRequestRef.current = {
      signature,
      reference,
      promise: createCheckoutSession(reference)
    };
  }

  async function startCheckout() {
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

  return (
    <section id="learner-journey" className="mx-auto grid max-w-7xl gap-6 bg-white px-4 pb-10 text-black sm:px-6 lg:px-8">
      <section className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-black uppercase text-brand">
          <SlidersHorizontal size={16} /> Search filters
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-6">
          <label className="grid gap-1 lg:col-span-2">
            <span className="text-xs font-black uppercase text-zinc-600">Pickup postcode or preferred area</span>
            <input
              ref={postcodeRef}
              value={postcode}
              onChange={(event) => setPostcode(event.target.value.toUpperCase())}
              placeholder="EN5 5XY"
              className="rounded border border-zinc-300 bg-white px-3 py-3 text-sm font-bold text-black"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-black uppercase text-zinc-600">Distance</span>
            <select value={distance} onChange={(event) => setDistance(event.target.value)} className="rounded border border-zinc-300 bg-white px-3 py-3 text-sm font-bold text-black">
              <option value="5">Within 5 miles</option>
              <option value="10">Within 10 miles</option>
              <option value="15">Within 15 miles</option>
              <option value="local">My local area</option>
              <option value="preferred">Preferred area</option>
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-black uppercase text-zinc-600">Transmission</span>
            <select value={transmission} onChange={(event) => setTransmission(event.target.value)} className="rounded border border-zinc-300 bg-white px-3 py-3 text-sm font-bold text-black">
              <option value="any">Any</option>
              <option value="automatic">Automatic</option>
              <option value="manual">Manual</option>
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-black uppercase text-zinc-600">Availability</span>
            <input type="date" value={availabilityDate} min={todayIso()} onChange={(event) => setAvailabilityDate(event.target.value)} className="rounded border border-zinc-300 bg-white px-3 py-3 text-sm font-bold text-black" />
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-black uppercase text-zinc-600">Sort by</span>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="rounded border border-zinc-300 bg-white px-3 py-3 text-sm font-bold text-black">
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
      </section>

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
            selectedInstructorId={selectedInstructor.id}
            userPosition={userPosition}
            onSelectInstructor={setSelectedInstructorId}
          />
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <div className="grid gap-5">
          <div className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-2xl font-black">Approved instructors closest to {postcode || "you"}</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">Adjust the filters first, then choose an instructor and a visible availability slot.</p>
          </div>

          <div className="grid items-stretch gap-4 xl:grid-cols-3">
            {filteredInstructors.map((instructor) => (
              <article key={instructor.id} className={`flex h-full min-h-[430px] flex-col rounded border p-5 shadow-sm ${selectedInstructor.id === instructor.id ? "border-brand bg-red-50" : "border-zinc-200 bg-white"}`}>
                <div className="flex min-h-[122px] items-start justify-between gap-3">
                  <div>
                    <div className="grid h-16 w-16 place-items-center rounded bg-black text-xl font-black text-white">{instructor.name.slice(0, 1)}</div>
                    <h3 className="mt-4 text-xl font-black">{instructor.name}</h3>
                  </div>
                  <span className="rounded bg-red-500/10 px-2 py-1 text-xs font-black text-brand">Verified {instructor.type}</span>
                </div>
                <p className="mt-2 truncate text-sm leading-6 text-zinc-600" title={instructor.bio}>{instructor.bio}</p>
                <div className="mt-4 grid min-h-[116px] grid-rows-4 gap-2 text-sm text-zinc-700">
                  <span className="inline-flex min-w-0 items-center gap-2"><Star size={16} className="shrink-0 text-brand" /> <span className="truncate">{instructor.rating} rating</span></span>
                  <span className="inline-flex min-w-0 items-center gap-2"><MapPin size={16} className="shrink-0 text-brand" /> <span className="truncate">{instructor.distanceMiles} miles away</span></span>
                  <span className="inline-flex min-w-0 items-center gap-2"><CarFront size={16} className="shrink-0 text-brand" /> <span className="truncate">{instructor.car} · {instructor.transmission}</span></span>
                  <span className="inline-flex min-w-0 items-center gap-2"><Clock3 size={16} className="shrink-0 text-brand" /> <span className="truncate">Next: {instructor.next}</span></span>
                </div>
                <div className="mt-3 min-h-[46px] rounded border border-zinc-200 bg-zinc-50 p-3 text-xs font-bold leading-5 text-zinc-700">
                  <div className="truncate" title={`Covers ${instructor.areas}`}>Covers {instructor.areas}</div>
                </div>
                <div className="mt-auto flex items-center justify-between border-t border-zinc-200 pt-4">
                  <div>
                    <div className="text-xs font-bold uppercase text-zinc-600">Price</div>
                    <div className="text-2xl font-black">{formatMoney(instructor.price)}/hr</div>
                  </div>
                  <button type="button" onClick={() => setSelectedInstructorId(instructor.id)} className="lda-pill lda-pill-sm">Choose</button>
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="grid gap-5">
          <section className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-black uppercase text-brand">
              <CalendarCheck size={16} /> Book {selectedInstructor.name}
            </div>
            <div className="mt-4 rounded border border-zinc-200 bg-zinc-50 p-4">
              <div className="text-xs font-black uppercase text-zinc-600">Selected date</div>
              <div className="mt-2 text-xl font-black">{availabilityDate}</div>
              <div className="mt-1 text-sm text-zinc-600">{selectedInstructor.car}</div>
            </div>
            <div className="mt-4 grid gap-2">
              <div className="text-xs font-black uppercase text-zinc-600">Available slots</div>
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

          <section className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-black uppercase text-brand">
              <CreditCard size={16} /> Confirm and pay
            </div>
            <div className="mt-4 grid gap-3 rounded border border-zinc-200 bg-zinc-50 p-4 text-sm">
              <div><span className="font-black text-zinc-600">Instructor:</span> {selectedInstructor.name}</div>
              <div><span className="font-black text-zinc-600">Pickup:</span> {postcode}</div>
              <div><span className="font-black text-zinc-600">Lesson:</span> {availabilityDate} at {selectedSlot || "choose a slot"}</div>
              <div><span className="font-black text-zinc-600">Upfront price:</span> {formatMoney(selectedInstructor.price)} with no hidden booking fee</div>
            </div>
            <p className="mt-3 text-xs leading-5 text-zinc-500">
              Stripe Checkout securely handles card entry and any eligible payment methods enabled on the LDA Stripe account.
            </p>
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
            {checkoutState === "error" ? <p className="mt-3 text-sm font-bold text-brand">{checkoutError || "Checkout could not open. Check Stripe keys in Vercel."}</p> : null}
            {checkoutState === "confirmed" ? (
              <div className="mt-4 rounded border border-red-500/30 bg-red-500/10 p-4 text-sm leading-6 text-red-100">
                <MailCheck className="mb-2" />
                Thank you for booking {selectedInstructor.name}. Your unique booking reference is <span className="font-black">{confirmationRef}</span>. Only share it with your instructor when they arrive.
              </div>
            ) : null}
          </section>
        </aside>
      </section>
    </section>
  );
}
