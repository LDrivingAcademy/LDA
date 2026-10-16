import type { Metadata } from "next";
import Link from "next/link";
import { RadioTower } from "lucide-react";
import { Brand } from "@/components/brand";
import { DynamicBackLink } from "@/components/dynamic-back-link";
import { LiveLessonMap, type LiveLessonDetails } from "@/components/live-lesson-map";
import { MainMenu } from "@/components/main-menu";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { getHeaderAccountSummary } from "@/lib/current-account";

type TrackingPageProps = {
  searchParams?: Promise<{ from?: string; booking?: string; mode?: string }>;
};

type BookingRow = {
  id: string;
  instructor_id: string;
  starts_at: string;
  ends_at: string;
  pickup_postcode: string;
  pickup_latitude: number | null;
  pickup_longitude: number | null;
  status: string | null;
};

type LessonBookingRecordRow = {
  booking_reference: string;
  marketplace_booking_id: string | null;
  instructor_id: string | null;
  instructor_name: string | null;
  starts_at: string | null;
  pickup_postcode: string | null;
  status: string | null;
};

const trackingUnlockWindowMinutes = 15;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;

export const metadata: Metadata = {
  title: "Live Lesson Tracking | L Driving Academy",
  description: "Secure L Driving Academy live lesson tracking for confirmed learner bookings.",
  robots: {
    index: false,
    follow: false,
    nocache: true
  }
};

async function getLearnerLiveLesson(bookingReference?: string): Promise<LiveLessonDetails | null> {
  if (!hasSupabaseConfig()) {
    return null;
  }

  const supabase = await createClient();
  if (!supabase) {
    return null;
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  let marketplaceBookingId = bookingReference && uuidPattern.test(bookingReference) ? bookingReference : "";

  if (bookingReference && !marketplaceBookingId) {
    const { data: referenceBooking, error: referenceError } = await supabase
      .from("lesson_booking_records")
      .select("booking_reference,marketplace_booking_id,instructor_id,instructor_name,starts_at,pickup_postcode,status")
      .eq("learner_id", user.id)
      .eq("booking_reference", bookingReference)
      .maybeSingle();

    if (referenceError) {
      console.warn("[tracking] lesson booking reference lookup failed", {
        bookingReference,
        message: referenceError.message
      });
      return null;
    }

    const record = referenceBooking as LessonBookingRecordRow | null;
    if (!record) {
      return null;
    }

    marketplaceBookingId = record.marketplace_booking_id || "";

    if (!uuidPattern.test(marketplaceBookingId)) {
      return {
        bookingReference: record.booking_reference,
        instructorName: record.instructor_name || "Your LDA instructor",
        pickupLabel: record.pickup_postcode || "your pickup",
        pickupPostcode: record.pickup_postcode || "your pickup",
        startsAt: record.starts_at,
        status: record.status || "upcoming",
        pickupPoint: null,
        instructorPoint: null,
        instructorLocationRecordedAt: null
      };
    }
  }

  const now = new Date();
  const unlocksBefore = new Date(now.getTime() + trackingUnlockWindowMinutes * 60 * 1000);

  let bookingQuery = supabase
    .from("bookings")
    .select("id,instructor_id,starts_at,ends_at,pickup_postcode,pickup_latitude,pickup_longitude,status")
    .eq("learner_id", user.id)
    .in("status", ["accepted", "instructor_en_route", "in_progress"])
    .gt("ends_at", now.toISOString())
    .lte("starts_at", unlocksBefore.toISOString())
    .order("starts_at", { ascending: true })
    .limit(1);

  if (marketplaceBookingId) {
    bookingQuery = bookingQuery.eq("id", marketplaceBookingId);
  }

  const { data: bookings, error: bookingError } = await bookingQuery.returns<BookingRow[]>();

  if (bookingError) {
    console.error("[tracking] learner booking lookup failed", { userId: user.id, message: bookingError.message });
    return null;
  }

  const booking = bookings?.[0];
  if (!booking) {
    return null;
  }

  const readClient = createAdminClient() ?? supabase;
  const [instructorProfileResult, locationShareResult] = await Promise.all([
    readClient.from("profiles").select("full_name,email").eq("id", booking.instructor_id).maybeSingle(),
    supabase
      .from("location_shares")
      .select("latitude,longitude,recorded_at")
      .eq("booking_id", booking.id)
      .eq("instructor_id", booking.instructor_id)
      .eq("learner_id", user.id)
      .gt("expires_at", new Date().toISOString())
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  if (instructorProfileResult.error) {
    console.warn("[tracking] instructor profile lookup failed", {
      bookingId: booking.id,
      message: instructorProfileResult.error.message
    });
  }

  if (locationShareResult.error) {
    console.warn("[tracking] live location lookup failed", {
      bookingId: booking.id,
      message: locationShareResult.error.message
    });
  }

  const instructorProfile = instructorProfileResult.data as { full_name?: string | null; email?: string | null } | null;
  const latestLocation = locationShareResult.data as { latitude: number; longitude: number; recorded_at: string } | null;
  const pickupPostcode = booking.pickup_postcode || "your pickup";

  return {
    bookingReference: booking.id,
    instructorName: instructorProfile?.full_name || instructorProfile?.email || "Your LDA instructor",
    pickupLabel: pickupPostcode,
    pickupPostcode,
    startsAt: booking.starts_at,
    status: booking.status,
    pickupPoint:
      typeof booking.pickup_latitude === "number" && typeof booking.pickup_longitude === "number"
        ? { lat: booking.pickup_latitude, lng: booking.pickup_longitude }
        : null,
    instructorPoint: latestLocation ? { lat: latestLocation.latitude, lng: latestLocation.longitude } : null,
    instructorLocationRecordedAt: latestLocation?.recorded_at ?? null
  };
}

export default async function TrackingPage({ searchParams }: TrackingPageProps) {
  const params = await searchParams;
  const account = await getHeaderAccountSummary();
  const bookingReference = params?.booking;
  const cameFromHome = params?.from === "home";
  const isLearnerTracking =
    params?.mode === "learner" ||
    params?.from === "dashboard" ||
    params?.from === "learner-dashboard" ||
    Boolean(bookingReference);
  const liveLesson = isLearnerTracking ? await getLearnerLiveLesson(bookingReference) : null;
  const hasDatabaseBookingReference = Boolean(bookingReference && uuidPattern.test(bookingReference));
  const backHref = cameFromHome ? "/" : isLearnerTracking ? "/learner-dashboard" : "/";
  const backLabel = cameFromHome ? "Back to homepage" : isLearnerTracking ? "Back to learner dashboard" : "Back to homepage";
  const badge = hasDatabaseBookingReference ? "Booked lesson tracking" : isLearnerTracking ? "Live tracking" : "Live tracking demo";
  const heading = isLearnerTracking
    ? liveLesson
      ? "Track your booked instructor to your pickup point."
      : "No active lesson is ready to track yet."
    : "Preview learner live tracking after booking.";
  const description = hasDatabaseBookingReference
    ? liveLesson
      ? `Tracking booking ${liveLesson.bookingReference}. This learner view follows the confirmed instructor from roughly 15 minutes before lesson time until arrival at the pickup point.`
      : `Booking ${bookingReference} is not currently available for live tracking on this account.`
    : isLearnerTracking
      ? liveLesson
        ? "This learner tracking view is connected to your accepted booking. It shows your pickup location and the instructor's latest live location once their ping is active."
        : "Your learner account does not currently have an accepted upcoming booking ready for live tracking. Bookings unlock here when they are accepted and close to lesson time."
      : "This public demo shows how learners will see instructor distance, estimated arrival time, and route progress before a confirmed lesson.";

  return (
    <>
      <header className="lda-universal-topbar sticky top-0 z-30 bg-black text-white">
        <div className="lda-universal-topbar-inner flex w-full items-center justify-between gap-5 px-[15px]">
          <Brand />
          <div className="hidden items-center gap-6 md:flex">
            <DynamicBackLink
              fallbackHref={backHref}
              fallbackLabel={backLabel}
              iconSize={17}
              className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-black text-white hover:ring-2 hover:ring-brand"
            />
          </div>
          <div className="md:hidden">
            <MainMenu account={account} />
          </div>
        </div>
      </header>
      <main className="min-h-screen bg-white text-black">
        <section className="bg-black text-white">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-red-500/60 bg-red-500/15 px-4 py-2 text-sm font-black text-red-100">
              <RadioTower size={17} /> {badge}
            </div>
            <h1 className="mt-5 max-w-3xl text-5xl font-black tracking-normal">{heading}</h1>
            <p className="mt-4 max-w-2xl text-lg font-semibold leading-8 text-zinc-300">
              {description}
            </p>
          </div>
        </section>
        <LiveLessonMap mode={isLearnerTracking ? "live" : "demo"} lesson={isLearnerTracking ? liveLesson : undefined} />
      </main>
    </>
  );
}
