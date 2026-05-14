"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BadgeCheck, CalendarCheck, CarFront, CreditCard, MailCheck, MapPin, Navigation, SlidersHorizontal, Star } from "lucide-react";
import { demoInstructors } from "@/lib/marketplace-content";
import { formatMoney } from "@/lib/money";

type Instructor = (typeof demoInstructors)[number] & {
  id: string;
  distanceMiles: number;
  slots: Record<string, string[]>;
  stripeConnectedAccountId?: string;
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

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`;
    script.async = true;
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

    const stored = localStorage.getItem(`lda-booking-${booking}`);
    if (!stored) return;

    const bookingDetails = JSON.parse(stored) as {
      instructorName: string;
      instructorId: string;
      lessonSummary: string;
      learnerEmail?: string | null;
    };

    setConfirmationRef(booking);
    setCheckoutState("confirmed");
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
  }, [learnerPhone]);

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

  async function startCheckout() {
    if (!canPay) return;
    setCheckoutState("loading");
    setCheckoutError("");
    const reference = makeBookingReference(selectedInstructor.id);

    localStorage.setItem(
      `lda-booking-${reference}`,
      JSON.stringify({
        instructorName: selectedInstructor.name,
        instructorId: selectedInstructor.id,
        lessonSummary,
        learnerEmail,
        learnerPhone
      })
    );

    const response = await fetch("/api/bookings/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookingId: reference,
        instructorName: selectedInstructor.name,
        lessonSummary,
        amountPence: selectedInstructor.price,
        stripeConnectedAccountId: selectedInstructor.stripeConnectedAccountId,
        paymentPreference: "checkout"
      })
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.checkoutUrl) {
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
            <span className="text-xs text-zinc-500">Google Places autocomplete activates when `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is set.</span>
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

      <section className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <div className="grid gap-5">
          <div className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-2xl font-black">Approved instructors closest to {postcode || "you"}</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">Adjust the filters first, then choose an instructor and a visible availability slot.</p>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            {filteredInstructors.map((instructor) => (
              <article key={instructor.id} className={`rounded border p-5 shadow-sm ${selectedInstructor.id === instructor.id ? "border-brand bg-red-50" : "border-zinc-200 bg-white"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="grid h-12 w-12 place-items-center rounded bg-black text-lg font-black text-white">{instructor.name.slice(0, 1)}</div>
                    <h3 className="mt-4 text-xl font-black">{instructor.name}</h3>
                  </div>
                  <span className="rounded bg-red-500/10 px-2 py-1 text-xs font-black text-brand">Verified {instructor.type}</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-zinc-600">{instructor.bio}</p>
                <div className="mt-4 grid gap-2 text-sm text-zinc-700">
                  <span className="inline-flex items-center gap-2"><Star size={16} className="text-brand" /> {instructor.rating} rating</span>
                  <span className="inline-flex items-center gap-2"><MapPin size={16} className="text-brand" /> {instructor.distanceMiles} miles away</span>
                  <span className="inline-flex items-center gap-2"><CarFront size={16} className="text-brand" /> {instructor.car}</span>
                </div>
                <div className="mt-5 flex items-center justify-between border-t border-zinc-200 pt-4">
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
            <button disabled={!canPay || checkoutState === "loading"} onClick={() => startCheckout()} className="lda-pill mt-5 w-full">
              <CreditCard size={18} /> {checkoutState === "loading" ? "Opening secure checkout..." : "Checkout"}
            </button>
            {checkoutState === "error" ? <p className="mt-3 text-sm font-bold text-brand">{checkoutError || "Checkout could not open. Check Stripe keys in Vercel."}</p> : null}
            {checkoutState === "confirmed" ? (
              <div className="mt-4 rounded border border-red-500/30 bg-red-500/10 p-4 text-sm leading-6 text-red-950">
                <MailCheck className="mb-2" />
                Thank you for booking {selectedInstructor.name}. Your unique booking reference is <span className="font-black">{confirmationRef}</span>. Only share it with your instructor when they arrive.
              </div>
            ) : null}
          </section>
        </aside>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <article id="tracking" className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-black uppercase text-brand">
            <Navigation size={16} /> Live tracking
          </div>
          <h3 className="mt-3 text-2xl font-black">Available near lesson time.</h3>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            Tracking starts around 15 minutes before the lesson when the instructor marks themselves en route, then stops when they arrive at the pickup address.
          </p>
          <Link href="/tracking" className="lda-pill lda-pill-sm mt-5">Open tracking view</Link>
        </article>
        <article className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-black uppercase text-brand">
            <BadgeCheck size={16} /> After the lesson
          </div>
          <h3 className="mt-3 text-2xl font-black">Review notes and videos.</h3>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            When the lesson is completed, your instructor can send feedback, checklist updates, and revision videos so the next lesson does not repeat covered skills.
          </p>
          <Link href="/progress-tracker" className="lda-pill lda-pill-sm mt-5">Open progress tracker</Link>
        </article>
      </section>
    </section>
  );
}
