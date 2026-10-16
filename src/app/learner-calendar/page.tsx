import { AdminSessionAutoSignOut } from "@/components/admin-session-auto-sign-out";
import { LearnerCalendarWorkspace, type LearnerCalendarLesson } from "@/components/learner-calendar-workspace";
import { PageTopBar } from "@/components/page-top-bar";
import { isSignedInAdmin } from "@/lib/account-package-state";
import { redirectIfWrongMarketplaceRole } from "@/lib/account-route-guard";
import { getPageBackLink, type PageSourceSearchParams } from "@/lib/page-back-link";
import { requireSignedInPage } from "@/lib/page-auth";
import { getLessonLifecycleStatus } from "@/lib/lesson-lifecycle";

type LearnerCalendarPageProps = {
  searchParams?: PageSourceSearchParams;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function LearnerCalendarPage({ searchParams }: LearnerCalendarPageProps) {
  const { fromAdmin } = await getPageBackLink(searchParams, {
    allowAdminSource: await isSignedInAdmin()
  });
  const { supabase, user } = await requireSignedInPage("Sign in before viewing your learner calendar.");
  await redirectIfWrongMarketplaceRole(supabase, user.id, "learner");
  const [{ data: profile }, lessons] = await Promise.all([
    supabase.from("profiles").select("full_name,email").eq("id", user.id).maybeSingle(),
    getLearnerCalendarLessons(supabase, user.id)
  ]);

  return (
    <main className="min-h-screen bg-white text-black">
      {fromAdmin ? <AdminSessionAutoSignOut /> : null}
      <PageTopBar
        backHref={fromAdmin ? "/admin" : "/learner-dashboard"}
        backLabel={fromAdmin ? "Back to admin" : "Back to learner dashboard"}
        brandHref={fromAdmin ? "/admin" : "/"}
        brandLabel={fromAdmin ? "LDA admin dashboard" : "L Driving Academy home"}
        useNavigationHistory={false}
      />
      <LearnerCalendarWorkspace
        learnerName={profile?.full_name || user.email || "LDA learner"}
        learnerEmail={profile?.email ?? user.email}
        initialLessons={lessons}
      />
    </main>
  );
}

type SupabaseClient = Awaited<ReturnType<typeof requireSignedInPage>>["supabase"];

type BookingRow = {
  id: string;
  instructor_id: string;
  starts_at: string;
  ends_at: string | null;
  pickup_postcode: string | null;
  status: string | null;
};

type InstructorRow = {
  user_id: string;
  display_name: string | null;
  car_make: string | null;
  car_model: string | null;
  transmission: string | null;
};

type LessonBookingRecordRow = {
  booking_reference: string;
  instructor_id: string | null;
  instructor_name: string | null;
  lesson_summary: string | null;
  starts_at: string | null;
  ends_at: string | null;
  pickup_postcode: string | null;
  car: string | null;
  status: string | null;
  payment_status: string | null;
  created_at: string;
};

async function getLearnerCalendarLessons(supabase: SupabaseClient, learnerId: string): Promise<LearnerCalendarLesson[]> {
  const [bookingResult, referenceResult] = await Promise.all([
    supabase
      .from("bookings")
      .select("id,instructor_id,starts_at,ends_at,pickup_postcode,status")
      .eq("learner_id", learnerId)
      .order("starts_at", { ascending: true })
      .limit(250),
    supabase
      .from("lesson_booking_records")
      .select("booking_reference,instructor_id,instructor_name,lesson_summary,starts_at,ends_at,pickup_postcode,car,status,payment_status,created_at")
      .eq("learner_id", learnerId)
      .order("starts_at", { ascending: true, nullsFirst: false })
      .limit(250)
  ]);
  const bookingRows = (bookingResult.data as BookingRow[] | null) ?? [];
  const referenceRows = (referenceResult.data as LessonBookingRecordRow[] | null) ?? [];

  if (bookingResult.error) {
    console.warn("[learner-calendar] booking lookup failed", {
      userId: learnerId,
      message: bookingResult.error.message
    });
  }

  if (referenceResult.error) {
    console.warn("[learner-calendar] lesson booking reference lookup failed", {
      userId: learnerId,
      message: referenceResult.error.message
    });
  }

  const instructorIds = Array.from(
    new Set(
      [
        ...bookingRows.map((booking) => booking.instructor_id),
        ...referenceRows.map((booking) => booking.instructor_id)
      ].filter(Boolean) as string[]
    )
  );
  const { data: instructors } = instructorIds.length
    ? await supabase
        .from("instructor_profiles")
        .select("user_id,display_name,car_make,car_model,transmission")
        .in("user_id", instructorIds)
    : { data: [] };
  const instructorById = new Map(((instructors as InstructorRow[] | null) ?? []).map((instructor) => [instructor.user_id, instructor]));

  const lessons = referenceRows
    .map((booking) => {
      const startsAt = parseCalendarDate(booking.starts_at ?? booking.created_at);
      const endsAt = booking.ends_at ? parseCalendarDate(booking.ends_at) : null;
      const instructor = booking.instructor_id ? instructorById.get(booking.instructor_id) : undefined;

      return createCalendarLesson({
        id: booking.booking_reference,
        instructorName: booking.instructor_name || instructor?.display_name || "LDA instructor",
        startsAt,
        endsAt,
        pickup: booking.pickup_postcode || "Not recorded",
        car: booking.car || formatInstructorCar(instructor),
        status: normaliseCalendarStatus(booking.status || booking.payment_status, startsAt, endsAt),
        reference: booking.booking_reference,
        summary: booking.lesson_summary || undefined
      });
    })
    .filter(isCalendarLesson);

  for (const booking of bookingRows) {
    if (lessons.some((lesson) => lesson.id === booking.id || lesson.reference === booking.id)) {
      continue;
    }

    const startsAt = parseCalendarDate(booking.starts_at);
    const endsAt = booking.ends_at ? parseCalendarDate(booking.ends_at) : null;
    const instructor = instructorById.get(booking.instructor_id);
    const calendarLesson = createCalendarLesson({
      id: booking.id,
      instructorName: instructor?.display_name || "LDA instructor",
      startsAt,
      endsAt,
      pickup: booking.pickup_postcode || "Not recorded",
      car: formatInstructorCar(instructor),
      status: normaliseCalendarStatus(booking.status, startsAt, endsAt),
      reference: booking.id,
      summary: undefined
    });

    if (calendarLesson) {
      lessons.push(calendarLesson);
    }
  }

  return lessons.sort((a, b) => `${a.date}T${a.start}`.localeCompare(`${b.date}T${b.start}`));
}

function createCalendarLesson({
  id,
  instructorName,
  startsAt,
  endsAt,
  pickup,
  car,
  status,
  reference,
  summary
}: {
  id: string;
  instructorName: string;
  startsAt: Date | null;
  endsAt: Date | null;
  pickup: string;
  car: string;
  status: LearnerCalendarLesson["status"];
  reference: string;
  summary?: string;
}): LearnerCalendarLesson | null {
  if (!startsAt || Number.isNaN(startsAt.getTime())) {
    return null;
  }

  const validEndsAt = endsAt && !Number.isNaN(endsAt.getTime()) ? endsAt : null;
  return {
    id,
    date: formatIsoDate(startsAt),
    start: formatTime(startsAt),
    end: validEndsAt ? formatTime(validEndsAt) : "Time pending",
    status,
    instructorName,
    pickup,
    car,
    reference,
    summary: summary || `${formatDisplayDate(startsAt)} at ${formatTime(startsAt)} from ${pickup}.`
  };
}

function isCalendarLesson(lesson: LearnerCalendarLesson | null): lesson is LearnerCalendarLesson {
  return Boolean(lesson);
}

function normaliseCalendarStatus(status: string | null, startsAt: Date | null, endsAt?: Date | null): LearnerCalendarLesson["status"] {
  return getLessonLifecycleStatus({ status, startsAt, endsAt });
}

function parseCalendarDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatInstructorCar(instructor?: InstructorRow) {
  return [instructor?.car_make, instructor?.car_model, instructor?.transmission].filter(Boolean).join(" ") || "Instructor vehicle";
}

function formatIsoDate(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(value);
}

function formatDisplayDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Europe/London" }).format(value);
}

function formatTime(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/London"
  }).format(value);
}
