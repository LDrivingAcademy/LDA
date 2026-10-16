type SupabaseLike = {
  from: (table: string) => any;
};

type BookingPunctualityRow = {
  id: string;
  learner_id: string;
  instructor_id: string;
  starts_at: string;
  ends_at: string;
  status: string | null;
  instructor_arrived_at: string | null;
  instructor_late_minutes: number | null;
  time_bank_awarded_at: string | null;
};

export const arrivalDistanceThresholdMeters = 75;

export function distanceInMeters(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) {
  const earthRadiusMeters = 6371000;
  const fromLat = (from.latitude * Math.PI) / 180;
  const toLat = (to.latitude * Math.PI) / 180;
  const deltaLat = ((to.latitude - from.latitude) * Math.PI) / 180;
  const deltaLon = ((to.longitude - from.longitude) * Math.PI) / 180;
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function calculateInstructorLateMinutes(startsAt: string, arrivedAt: Date) {
  const scheduledStart = new Date(startsAt);
  if (Number.isNaN(scheduledStart.getTime())) {
    return 0;
  }

  const diffMs = arrivedAt.getTime() - scheduledStart.getTime();
  return Math.max(0, Math.ceil(diffMs / 60000));
}

export async function recordInstructorArrivalAndCredit({
  supabase,
  bookingId,
  instructorId,
  arrivedAt = new Date(),
  latitude,
  longitude,
  accuracy
}: {
  supabase: SupabaseLike;
  bookingId: string;
  instructorId: string;
  arrivedAt?: Date;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
}) {
  const { data: booking, error } = await supabase
    .from("bookings")
    .select("id,learner_id,instructor_id,starts_at,ends_at,status,instructor_arrived_at,instructor_late_minutes,time_bank_awarded_at")
    .eq("id", bookingId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Booking could not be checked.");
  }

  const bookingRow = booking as BookingPunctualityRow | null;
  if (!bookingRow) {
    throw new Error("Booking could not be found.");
  }

  if (bookingRow.instructor_id !== instructorId) {
    throw new Error("This booking is assigned to another instructor.");
  }

  if (String(bookingRow.status ?? "").toLowerCase().includes("cancel")) {
    throw new Error("Cancelled lessons cannot record arrival.");
  }

  if (bookingRow.instructor_arrived_at) {
    return {
      alreadyRecorded: true,
      lateMinutes: bookingRow.instructor_late_minutes ?? 0,
      punctualityStatus: (bookingRow.instructor_late_minutes ?? 0) > 0 ? "instructor_late" : "on_time",
      timeBankMinutesAwarded: 0
    };
  }

  const arrivedAtIso = arrivedAt.toISOString();
  const lateMinutes = calculateInstructorLateMinutes(bookingRow.starts_at, arrivedAt);
  const punctualityStatus = lateMinutes > 0 ? "instructor_late" : "on_time";
  const shouldAwardTime = lateMinutes > 0 && !bookingRow.time_bank_awarded_at;

  await supabase
    .from("bookings")
    .update({
      instructor_arrived_at: arrivedAtIso,
      lesson_started_at: arrivedAtIso,
      instructor_late_minutes: lateMinutes,
      punctuality_status: punctualityStatus,
      time_bank_awarded_at: shouldAwardTime ? arrivedAtIso : null
    })
    .eq("id", bookingRow.id);

  await supabase
    .from("lesson_booking_records")
    .update({
      instructor_arrived_at: arrivedAtIso,
      lesson_started_at: arrivedAtIso,
      instructor_late_minutes: lateMinutes,
      learner_time_bank_minutes_awarded: lateMinutes,
      punctuality_status: punctualityStatus,
      time_bank_awarded_at: shouldAwardTime ? arrivedAtIso : null
    })
    .eq("marketplace_booking_id", bookingRow.id);

  if (shouldAwardTime) {
    await supabase.from("learner_time_bank_ledger").insert({
      learner_id: bookingRow.learner_id,
      instructor_id: bookingRow.instructor_id,
      booking_reference: bookingRow.id,
      minutes: lateMinutes,
      entry_type: "instructor_late_credit",
      reason: "Instructor arrived after the scheduled lesson start time.",
      metadata: {
        arrivedAt: arrivedAtIso,
        scheduledStart: bookingRow.starts_at,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        accuracyMeters: accuracy ?? null
      }
    });

    await supabase.from("notifications").insert({
      user_id: bookingRow.learner_id,
      booking_id: bookingRow.id,
      title: "LDA time bank updated",
      body: `${lateMinutes} minute${lateMinutes === 1 ? "" : "s"} have been added to your LDA time bank because your instructor arrived after the scheduled lesson start.`,
      notification_type: "time_bank_credit"
    });
  }

  return {
    alreadyRecorded: false,
    lateMinutes,
    punctualityStatus,
    timeBankMinutesAwarded: shouldAwardTime ? lateMinutes : 0
  };
}
