import { BookingHistoryPanel, type BookingRecord } from "@/components/booking-history-panel";
import { AdminSessionAutoSignOut } from "@/components/admin-session-auto-sign-out";
import { LearnerPageHeader } from "@/components/learner-page-header";
import { isSignedInAdmin } from "@/lib/account-package-state";
import { redirectIfWrongMarketplaceRole } from "@/lib/account-route-guard";
import { getPageBackLink, type PageSourceSearchParams } from "@/lib/page-back-link";
import { requireSignedInPage } from "@/lib/page-auth";

type BookingHistoryPageProps = {
  searchParams?: PageSourceSearchParams;
};

export default async function BookingHistoryPage({ searchParams }: BookingHistoryPageProps) {
  const resolvedSearchParams = await searchParams;
  const cancelBookingReference = Array.isArray(resolvedSearchParams?.cancel) ? resolvedSearchParams.cancel[0] : resolvedSearchParams?.cancel;
  const openBookingReference = Array.isArray(resolvedSearchParams?.booking) ? resolvedSearchParams.booking[0] : resolvedSearchParams?.booking;
  const { backHref, backLabel, fromDashboard, fromAdmin } = await getPageBackLink(Promise.resolve(resolvedSearchParams), {
    allowAdminSource: await isSignedInAdmin()
  });
  const { supabase, user } = await requireSignedInPage("Sign in before viewing booking history.");
  await redirectIfWrongMarketplaceRole(supabase, user.id, "learner");
  const initialBookings = await getLearnerBookingHistory(supabase, user.id);

  return (
    <main className="min-h-screen bg-white text-black">
      {fromAdmin ? <AdminSessionAutoSignOut /> : null}
      <LearnerPageHeader
        eyebrow="Booking history"
        title="View every LDA lesson in one place."
        body="Open completed lessons for details, review upcoming lessons, and cancel bookings with clear confirmation and cancellation-policy guidance."
        backHref={backHref}
        backLabel={backLabel}
        brandHref={fromAdmin ? "/admin" : "/"}
        brandLabel={fromAdmin ? "LDA admin dashboard" : "L Driving Academy home"}
      />
      <BookingHistoryPanel
        fromDashboard={fromDashboard}
        initialBookings={initialBookings}
        initialOpenBookingId={openBookingReference}
        initialCancelBookingId={cancelBookingReference}
      />
    </main>
  );
}

type SupabaseClient = Awaited<ReturnType<typeof requireSignedInPage>>["supabase"];

type BookingRow = {
  id: string;
  instructor_id: string;
  starts_at: string;
  ends_at: string;
  pickup_postcode: string | null;
  lesson_price_pence: number | null;
  status: string | null;
};

type InstructorRow = {
  user_id: string;
  display_name: string | null;
  car_make: string | null;
  car_model: string | null;
  transmission: string | null;
};

type ProgressRow = {
  lesson_reference: string | null;
  instructor_name: string | null;
  instructor_id: string | null;
  sent_at: string;
  completed_skills: string[] | null;
  instructor_notes: string | null;
  next_lesson_focus: string | null;
};

type LessonBookingRecordRow = {
  booking_reference: string;
  instructor_id: string | null;
  instructor_name: string | null;
  lesson_summary: string | null;
  starts_at: string | null;
  ends_at: string | null;
  pickup_postcode: string | null;
  lesson_price_pence: number | null;
  car: string | null;
  status: string | null;
  payment_status: string | null;
  created_at: string;
};

async function getLearnerBookingHistory(supabase: SupabaseClient, learnerId: string): Promise<BookingRecord[]> {
  const [{ data: bookings }, { data: progressRecords }, referenceResult] = await Promise.all([
    supabase
      .from("bookings")
      .select("id,instructor_id,starts_at,ends_at,pickup_postcode,lesson_price_pence,status")
      .eq("learner_id", learnerId)
      .order("starts_at", { ascending: false })
      .limit(100),
    supabase
      .from("lesson_progress_records")
      .select("lesson_reference,instructor_name,instructor_id,sent_at,completed_skills,instructor_notes,next_lesson_focus")
      .eq("learner_id", learnerId)
      .order("sent_at", { ascending: false })
      .limit(100),
    supabase
      .from("lesson_booking_records")
      .select("booking_reference,instructor_id,instructor_name,lesson_summary,starts_at,ends_at,pickup_postcode,lesson_price_pence,car,status,payment_status,created_at")
      .eq("learner_id", learnerId)
      .order("starts_at", { ascending: false, nullsFirst: false })
      .limit(100)
  ]);
  const bookingRows = (bookings as BookingRow[] | null) ?? [];
  const progressRows = (progressRecords as ProgressRow[] | null) ?? [];
  const referenceRows = (referenceResult.data as LessonBookingRecordRow[] | null) ?? [];
  if (referenceResult.error) {
    console.warn("[booking-history] lesson booking reference lookup failed", {
      userId: learnerId,
      message: referenceResult.error.message
    });
  }
  const instructorIds = Array.from(new Set(bookingRows.map((booking) => booking.instructor_id).filter(Boolean)));
  const { data: instructors } = instructorIds.length
    ? await supabase
        .from("instructor_profiles")
        .select("user_id,display_name,car_make,car_model,transmission")
        .in("user_id", instructorIds)
    : { data: [] };
  const instructorById = new Map(((instructors as InstructorRow[] | null) ?? []).map((instructor) => [instructor.user_id, instructor]));
  const progressByReference = new Map(progressRows.filter((record) => record.lesson_reference).map((record) => [record.lesson_reference as string, record]));

  const coreBookings = bookingRows.map((booking) => {
    const startsAt = new Date(booking.starts_at);
    const endsAt = new Date(booking.ends_at);
    const instructor = instructorById.get(booking.instructor_id);
    const progress =
      progressByReference.get(booking.id) ??
      progressRows.find((record) => record.instructor_id === booking.instructor_id && Math.abs(new Date(record.sent_at).getTime() - startsAt.getTime()) < 36 * 60 * 60 * 1000);
    const car = [instructor?.car_make, instructor?.car_model, instructor?.transmission].filter(Boolean).join(" ") || "Instructor vehicle";
    const review = formatProgressSummary(progress);

    return {
      id: booking.id,
      instructorId: booking.instructor_id,
      instructorName: progress?.instructor_name || instructor?.display_name || "LDA instructor",
      lessonSummary: `${formatDate(startsAt)} at ${formatTime(startsAt)} from ${booking.pickup_postcode || "pickup not recorded"}. ${car}.`,
      date: startsAt.toISOString().slice(0, 10),
      time: formatTime(startsAt),
      startsAt: startsAt.toISOString(),
      endsAt: Number.isNaN(endsAt.getTime()) ? undefined : endsAt.toISOString(),
      pickup: booking.pickup_postcode || "Not recorded",
      pricePence: booking.lesson_price_pence ?? 0,
      car,
      status: normaliseBookingStatus(booking.status, startsAt, endsAt),
      review
    };
  });

  const referenceBookings = referenceRows.map((booking) => {
    const startsAt = booking.starts_at ? new Date(booking.starts_at) : new Date(booking.created_at);
    const endsAt = booking.ends_at ? new Date(booking.ends_at) : null;
    const date = Number.isNaN(startsAt.getTime()) ? "" : startsAt.toISOString().slice(0, 10);
    const time = Number.isNaN(startsAt.getTime()) ? "Not recorded" : formatTime(startsAt);

    return {
      id: booking.booking_reference,
      instructorId: booking.instructor_id ?? undefined,
      instructorName: booking.instructor_name || "LDA instructor",
      lessonSummary: booking.lesson_summary || `${date || "Lesson date pending"} at ${time} from ${booking.pickup_postcode || "pickup not recorded"}.`,
      date: date || "Not recorded",
      time,
      startsAt: Number.isNaN(startsAt.getTime()) ? undefined : startsAt.toISOString(),
      endsAt: endsAt && !Number.isNaN(endsAt.getTime()) ? endsAt.toISOString() : undefined,
      pickup: booking.pickup_postcode || "Not recorded",
      pricePence: booking.lesson_price_pence ?? 0,
      car: booking.car || "Instructor vehicle",
      status: normaliseBookingStatus(booking.status || booking.payment_status, startsAt, endsAt),
      review: undefined
    };
  });

  const merged: BookingRecord[] = [...referenceBookings];
  for (const booking of coreBookings) {
    if (!merged.some((item) => item.id === booking.id)) {
      merged.push(booking);
    }
  }

  return merged;
}

function normaliseBookingStatus(status: string | null, startsAt: Date, endsAt?: Date | null): BookingRecord["status"] {
  const value = String(status ?? "").toLowerCase();
  const now = Date.now();
  const startsAtTime = startsAt.getTime();
  const endsAtTime = endsAt?.getTime();

  if (value.includes("cancel")) return "cancelled";
  if (Number.isFinite(endsAtTime) ? (endsAtTime as number) < now : Number.isFinite(startsAtTime) && startsAtTime < now) {
    return "completed";
  }
  if (value.includes("complete")) return "completed";
  if (value.includes("accept") || value.includes("confirm") || value.includes("paid")) return "upcoming";
  return "pending";
}

function formatProgressSummary(progress?: ProgressRow) {
  if (!progress) {
    return undefined;
  }

  const skills = progress.completed_skills?.filter(Boolean).join(", ");
  const notes = progress.instructor_notes?.trim();
  const nextFocus = progress.next_lesson_focus?.trim();
  return [skills ? `Covered ${skills}` : "", notes, nextFocus ? `Next focus: ${nextFocus}` : ""].filter(Boolean).join(". ");
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(value);
}

function formatTime(value: Date) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }).format(value);
}
