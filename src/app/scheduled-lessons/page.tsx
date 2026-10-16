import Link from "next/link";
import { AlertTriangle, BookOpenCheck, CalendarCheck, CarFront, CheckCircle2, Clock3, GraduationCap, RefreshCcw, ShieldCheck, type LucideIcon } from "lucide-react";
import { LearnerBookingDashboard, type LearnerBookingInstructor } from "@/components/learner-booking-dashboard";
import { LearnerPageHeader } from "@/components/learner-page-header";
import { ScheduledLessonDatePlanner } from "@/components/scheduled-lesson-date-planner";
import { redirectIfWrongMarketplaceRole } from "@/lib/account-route-guard";
import { getPageBackLink } from "@/lib/page-back-link";
import { requireSignedInPage } from "@/lib/page-auth";
import { getLdaTestInstructorEmail } from "@/lib/lda-demo-accounts";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { shouldBypassInstructorAvailabilityPauseForTest } from "@/lib/test-instructor-visibility";
import {
  filterAvailabilitySlotsByFutureCompliance,
  readInstructorFutureComplianceDocuments
} from "@/lib/instructor-future-compliance";
import {
  flattenInstructorVerificationRequirements,
  getInstructorVerificationRequirements
} from "@/lib/instructor-verification-requirements";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Schedule Driving Lessons | LDA",
  description:
    "Schedule future LDA driving lessons, weekly blocks, semi-intensive courses, intensive courses, refresher lessons, and test-day support with approved instructors.",
  alternates: {
    canonical: "/scheduled-lessons"
  }
};

type ScheduledLessonsPageProps = {
  searchParams?: Promise<{
    from?: string | string[];
    message?: string | string[];
    date?: string | string[];
    course?: string | string[];
    instructor?: string | string[];
    instructorName?: string | string[];
    postcode?: string | string[];
    transmission?: string | string[];
  } | undefined>;
};

type ScheduledInstructorProfileRow = {
  user_id: string;
  display_name: string | null;
  bio: string | null;
  adi_pdi_status: string | null;
  hourly_rate_pence: number | null;
  transmission: string | null;
  car_make: string | null;
  car_model: string | null;
  areas_covered: string[] | null;
  base_postcode: string | null;
  latitude: number | null;
  longitude: number | null;
  learner_availability_paused?: boolean | null;
  learner_availability_pause_reason?: string | null;
  stripe_account_id?: string | null;
};

type ScheduledAvailabilitySlotRow = {
  instructor_id: string;
  starts_at: string;
  ends_at: string;
  is_booked: boolean | null;
};

type ScheduledLessonPackage = {
  id: string;
  title: string;
  eyebrow: string;
  body: string;
  icon: LucideIcon;
  hours: number;
  sessionHours: number;
  totalSessions: number;
  paceLabel: string;
  checkoutLabel: string;
};

const scheduledLessonPackages: ScheduledLessonPackage[] = [
  {
    id: "10-hour-block",
    title: "10 hour weekly block",
    eyebrow: "Steady learning",
    body: "A traditional weekly block for learners who want regular two-hour lessons, steady progress, and the same instructor where their diary allows.",
    icon: Clock3,
    hours: 10,
    sessionHours: 2,
    totalSessions: 5,
    paceLabel: "Five 2-hour sessions, usually weekly or fortnightly",
    checkoutLabel: "Reserve weekly block"
  },
  {
    id: "20-hour-block",
    title: "20 hour standard course",
    eyebrow: "Block booking",
    body: "A structured ten-session course for learners who want continuity, clear diary planning, and one instructor carrying progress forward.",
    icon: CalendarCheck,
    hours: 20,
    sessionHours: 2,
    totalSessions: 10,
    paceLabel: "Ten 2-hour sessions at a planned pace",
    checkoutLabel: "Reserve 20 hour course"
  },
  {
    id: "30-hour-block",
    title: "30 hour beginner course",
    eyebrow: "Block booking",
    body: "A longer course for newer learners who want a consistent instructor, a full lesson pathway, and a planned route towards test readiness.",
    icon: CheckCircle2,
    hours: 30,
    sessionHours: 2,
    totalSessions: 15,
    paceLabel: "Fifteen 2-hour sessions",
    checkoutLabel: "Reserve 30 hour course"
  },
  {
    id: "semi-intensive-course",
    title: "Semi-intensive course",
    eyebrow: "Faster progress",
    body: "A flexible middle-ground for learners who want to progress faster than weekly lessons while still fitting driving around work, school, or family commitments.",
    icon: ShieldCheck,
    hours: 18,
    sessionHours: 2,
    totalSessions: 9,
    paceLabel: "Nine 2-hour sessions across several weeks",
    checkoutLabel: "Start semi-intensive"
  },
  {
    id: "one-week-intensive",
    title: "Fast Pass intensive course",
    eyebrow: "Condensed plan",
    body: "A condensed course for learners who need a focused week of driving with the same instructor where the instructor can cover the full diary plan.",
    icon: GraduationCap,
    hours: 20,
    sessionHours: 2,
    totalSessions: 10,
    paceLabel: "Two 2-hour sessions per day across one week",
    checkoutLabel: "Start Fast Pass"
  },
  {
    id: "mock-test",
    title: "Mock test before the real test",
    eyebrow: "Test preparation",
    body: "A two-hour practical mock test session with feedback before the official driving test.",
    icon: BookOpenCheck,
    hours: 2,
    sessionHours: 2,
    totalSessions: 1,
    paceLabel: "One 2-hour session",
    checkoutLabel: "Book mock test"
  },
  {
    id: "test-car-hire",
    title: "Hire a car for test",
    eyebrow: "Test day support",
    body: "Reserve an instructor vehicle for test day with enough time for arrival, preparation, and handover.",
    icon: CarFront,
    hours: 3,
    sessionHours: 3,
    totalSessions: 1,
    paceLabel: "One 3-hour test-day booking",
    checkoutLabel: "Reserve test car"
  },
  {
    id: "refresher-course",
    title: "Retest and refresher block",
    eyebrow: "Targeted support",
    body: "A focused block for learners who recently failed a test, paused their lessons, or need targeted support before returning to test standard.",
    icon: RefreshCcw,
    hours: 10,
    sessionHours: 2,
    totalSessions: 5,
    paceLabel: "Five 2-hour targeted sessions",
    checkoutLabel: "Book refresher block"
  },
  {
    id: "pass-plus-motorway",
    title: "Pass Plus and motorway module",
    eyebrow: "Post-test skills",
    body: "A specialist module for newly qualified drivers or confident learners who want supported motorway, rural road, night-driving, or advanced safety practice.",
    icon: CarFront,
    hours: 6,
    sessionHours: 2,
    totalSessions: 3,
    paceLabel: "Three 2-hour specialist sessions",
    checkoutLabel: "Book specialist module"
  }
];

function addDaysIso(days: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function normaliseScheduledDate(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;
  const minimum = addDaysIso(2);

  if (!candidate || !/^\d{4}-\d{2}-\d{2}$/.test(candidate)) {
    return null;
  }

  return candidate >= minimum ? candidate : minimum;
}

function normaliseScheduledCourse(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate) return null;
  return scheduledLessonPackages.find((packageOption) => packageOption.id === candidate) ?? null;
}

function formatScheduledSlotDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(value));
}

function formatScheduledSlotTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));
}

function nextScheduledSlotLabel(slots: Record<string, string[]>) {
  const firstDate = Object.keys(slots).sort()[0];
  const firstTime = firstDate ? slots[firstDate]?.[0] : null;

  if (!firstDate || !firstTime) return "Availability pending";
  if (firstDate === addDaysIso(0)) return `Today ${firstTime}`;
  if (firstDate === addDaysIso(1)) return `Tomorrow ${firstTime}`;

  return `${new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "Europe/London" }).format(new Date(`${firstDate}T12:00:00`))} ${firstTime}`;
}

function isMissingAnyColumnError(error: unknown) {
  const candidate = error as { code?: string; message?: string } | null;
  return candidate?.code === "42703" || /column .* does not exist/i.test(candidate?.message ?? "");
}

async function getScheduledLiveLearnerInstructors(
  readClient: Pick<NonNullable<Awaited<ReturnType<typeof createClient>>>, "from">
): Promise<LearnerBookingInstructor[]> {
  let primaryInstructorQuery = readClient
    .from("instructor_profiles")
    .select(
      "user_id,display_name,bio,adi_pdi_status,hourly_rate_pence,transmission,car_make,car_model,areas_covered,base_postcode,latitude,longitude,learner_availability_paused,learner_availability_pause_reason,stripe_account_id"
    )
    .eq("verification_status", "approved")
    .eq("compliance_status", "clear");

  if (!shouldBypassInstructorAvailabilityPauseForTest(getLdaTestInstructorEmail())) {
    primaryInstructorQuery = primaryInstructorQuery.eq("learner_availability_paused", false);
  }

  const primaryInstructorLookup = await primaryInstructorQuery
    .limit(40)
    .returns<ScheduledInstructorProfileRow[]>();

  const fallbackInstructorLookup =
    primaryInstructorLookup.error && isMissingAnyColumnError(primaryInstructorLookup.error)
      ? await readClient
          .from("instructor_profiles")
          .select(
            "user_id,display_name,bio,adi_pdi_status,hourly_rate_pence,transmission,car_make,car_model,areas_covered,base_postcode,latitude,longitude,stripe_account_id"
          )
          .eq("verification_status", "approved")
          .limit(40)
          .returns<ScheduledInstructorProfileRow[]>()
      : null;

  const instructors = fallbackInstructorLookup ? fallbackInstructorLookup.data : primaryInstructorLookup.data;
  const instructorError = fallbackInstructorLookup ? fallbackInstructorLookup.error : primaryInstructorLookup.error;

  if (instructorError) {
    console.warn("[scheduled-lessons] live instructor search lookup failed", {
      message: instructorError.message
    });
    return [];
  }

  let instructorRows = instructors ?? [];

  if (shouldBypassInstructorAvailabilityPauseForTest(getLdaTestInstructorEmail())) {
    const { data: testAccount, error: testAccountError } = await readClient
      .from("profiles")
      .select("id,email")
      .ilike("email", getLdaTestInstructorEmail())
      .maybeSingle();

    if (!testAccountError && testAccount?.id && !instructorRows.some((instructor) => instructor.user_id === testAccount.id)) {
      const testInstructorLookup = await readClient
        .from("instructor_profiles")
        .select(
          "user_id,display_name,bio,adi_pdi_status,hourly_rate_pence,transmission,car_make,car_model,areas_covered,base_postcode,latitude,longitude,learner_availability_paused,learner_availability_pause_reason,stripe_account_id"
        )
        .eq("user_id", testAccount.id)
        .maybeSingle();

      const testInstructorFallbackLookup =
        testInstructorLookup.error && isMissingAnyColumnError(testInstructorLookup.error)
          ? await readClient
              .from("instructor_profiles")
              .select(
                "user_id,display_name,bio,adi_pdi_status,hourly_rate_pence,transmission,car_make,car_model,areas_covered,base_postcode,latitude,longitude,stripe_account_id"
              )
              .eq("user_id", testAccount.id)
              .maybeSingle()
          : null;

      const testInstructor = (testInstructorFallbackLookup ? testInstructorFallbackLookup.data : testInstructorLookup.data) as ScheduledInstructorProfileRow | null;
      const testInstructorError = testInstructorFallbackLookup ? testInstructorFallbackLookup.error : testInstructorLookup.error;

      if (!testInstructorError && testInstructor?.user_id) {
        instructorRows = [testInstructor, ...instructorRows];
      }
    }
  }

  const instructorIds = instructorRows.map((instructor) => instructor.user_id).filter(Boolean);

  if (!instructorIds.length) {
    return [];
  }

  const { data: profileEmails, error: profileEmailError } = await readClient
    .from("profiles")
    .select("id,email")
    .in("id", instructorIds)
    .returns<Array<{ id: string; email: string | null }>>();

  if (profileEmailError) {
    console.warn("[scheduled-lessons] live instructor email lookup failed", {
      message: profileEmailError.message
    });
  }

  const emailByInstructorId = new Map((profileEmails ?? []).map((profile) => [profile.id, profile.email ?? ""]));

  const now = new Date();
  const windowEnd = new Date(now);
  windowEnd.setDate(windowEnd.getDate() + 60);
  windowEnd.setHours(23, 59, 59, 999);

  const { data: availability, error: availabilityError } = await readClient
    .from("availability_slots")
    .select("instructor_id,starts_at,ends_at,is_booked")
    .in("instructor_id", instructorIds)
    .eq("is_booked", false)
    .gt("ends_at", now.toISOString())
    .lte("starts_at", windowEnd.toISOString())
    .order("starts_at", { ascending: true })
    .returns<ScheduledAvailabilitySlotRow[]>();

  if (availabilityError) {
    console.warn("[scheduled-lessons] live instructor availability lookup failed", {
      message: availabilityError.message
    });
  }

  const requirementSections = await getInstructorVerificationRequirements(readClient);
  const requiredDocumentTypes = flattenInstructorVerificationRequirements(requirementSections)
    .filter((document) => document.requirement === "required")
    .map((document) => document.type);
  const documentsByInstructor = await readInstructorFutureComplianceDocuments(readClient, instructorIds);
  const compliantAvailability = filterAvailabilitySlotsByFutureCompliance(
    availability ?? [],
    documentsByInstructor,
    requiredDocumentTypes
  );
  const slotsByInstructor = new Map<string, Record<string, string[]>>();
  for (const slot of compliantAvailability) {
    const date = formatScheduledSlotDate(slot.starts_at);
    const time = formatScheduledSlotTime(slot.starts_at);
    const slots = slotsByInstructor.get(slot.instructor_id) ?? {};
    slots[date] = Array.from(new Set([...(slots[date] ?? []), time])).sort();
    slotsByInstructor.set(slot.instructor_id, slots);
  }

  return instructorRows
    .map((instructor, index) => {
      const slots = slotsByInstructor.get(instructor.user_id) ?? {};
      const areas = instructor.areas_covered?.filter(Boolean) ?? [];
      const car = [instructor.car_make, instructor.car_model].filter(Boolean).join(" ") || "Instructor vehicle";
      const transmission = instructor.transmission === "manual" ? "manual" : "automatic";
      const email = emailByInstructorId.get(instructor.user_id) || undefined;
      const bypassPausedAvailability = shouldBypassInstructorAvailabilityPauseForTest(email);

      return {
        id: instructor.user_id,
        email,
        name: instructor.display_name || "LDA instructor",
        type: "ADI",
        price: instructor.hourly_rate_pence && instructor.hourly_rate_pence > 0 ? instructor.hourly_rate_pence : 4200,
        transmission,
        areas: areas.length ? areas.join(", ") : instructor.base_postcode || "Local area",
        distance: `${(index + 1.4).toFixed(1)} miles`,
        distanceMiles: Number((index + 1.4).toFixed(1)),
        rating: "New",
        next: nextScheduledSlotLabel(slots),
        car: `${car}${transmission ? ` ${transmission}` : ""}`,
        bio: instructor.bio || "Approved LDA instructor with scheduled lesson availability.",
        slots,
        learnerAvailabilityPaused: Boolean(instructor.learner_availability_paused) && !bypassPausedAvailability,
        learnerAvailabilityPauseReason: bypassPausedAvailability ? undefined : instructor.learner_availability_pause_reason || undefined,
        stripeConnectedAccountId: instructor.stripe_account_id || undefined
      };
    })
    .filter((instructor) => !instructor.learnerAvailabilityPaused && Object.values(instructor.slots).some((times) => times.length > 0));
}

export default async function ScheduledLessonsPage({ searchParams }: ScheduledLessonsPageProps) {
  const { backHref, backLabel } = await getPageBackLink(searchParams);
  const params = await searchParams;
  const selectedDate = normaliseScheduledDate(params?.date);
  const selectedCourse = normaliseScheduledCourse(params?.course);
  const source = Array.isArray(params?.from) ? params.from[0] : params?.from;
  const selectedInstructorId = Array.isArray(params?.instructor) ? params.instructor[0] : params?.instructor;
  const selectedInstructorName = Array.isArray(params?.instructorName) ? params.instructorName[0] : params?.instructorName;
  const initialPickup = Array.isArray(params?.postcode) ? params.postcode[0] : params?.postcode;
  const transmissionParam = Array.isArray(params?.transmission) ? params.transmission[0] : params?.transmission;
  const initialTransmission = transmissionParam === "manual" || transmissionParam === "automatic" ? transmissionParam : null;
  const sourceParam = source || "learner-dashboard";
  const packageDate = selectedDate || addDaysIso(2);
  const { supabase, user } = await requireSignedInPage("Sign in before scheduling driving lessons.");
  await redirectIfWrongMarketplaceRole(supabase, user.id, "learner");
  const [{ data: profile }, { data: learnerProfile }] = await Promise.all([
    supabase.from("profiles").select("email,phone").eq("id", user.id).maybeSingle(),
    supabase.from("learner_profiles").select("provisional_licence_confirmed_at").eq("user_id", user.id).maybeSingle()
  ]);
  const readClient = createAdminClient() ?? supabase;
  const liveLearnerInstructors = await getScheduledLiveLearnerInstructors(readClient);

  return (
    <main className="min-h-screen bg-white text-black">
      <LearnerPageHeader
        eyebrow="Scheduled lessons"
        title="Schedule future driving lessons."
        body="Choose future instructor availability, reserve diary time in advance, and keep scheduled lessons attached to your LDA booking history and learner calendar."
        backHref={backHref}
        backLabel={backLabel}
      />

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-4 lg:grid-cols-3">
          <article className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
            <CalendarCheck className="text-brand" size={26} />
            <h2 className="mt-3 text-xl font-black">Future diary booking</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-zinc-600">
              This page starts from the day after tomorrow. Today and tomorrow stay in the normal driving lessons section.
            </p>
          </article>
          <article className="rounded border border-red-200 bg-red-50 p-5 shadow-sm">
            <ShieldCheck className="text-brand" size={26} />
            <h2 className="mt-3 text-xl font-black">Paid in advance</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-red-950">
              Scheduled lessons reserve instructor time, so learner cancellation does not trigger automatic refund cancellation.
            </p>
          </article>
          <article className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
            <AlertTriangle className="text-brand" size={26} />
            <h2 className="mt-3 text-xl font-black">Instructor cancellation review</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-zinc-600">
              If an instructor cancels scheduled lessons, LDA support can review refund or replacement options and monitor repeated cancellations.
            </p>
          </article>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
        <div className="rounded border border-zinc-200 bg-zinc-50 p-5 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-sm font-black uppercase text-brand">Scheduled lesson packages</div>
              <h2 className="mt-2 text-3xl font-black tracking-normal">Choose a course, then keep one instructor where possible.</h2>
              <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-zinc-600">
                Pick the route that matches how you want to learn: weekly blocks, semi-intensive courses, intensive Fast Pass plans, retest support, specialist modules, or test-day vehicle hire. LDA then checks instructor diary space from your selected start date and prioritises one instructor for the full plan, so each session builds naturally from the last.
              </p>
            </div>
            <div className="rounded-full border border-red-200 bg-white px-4 py-2 text-xs font-black uppercase text-brand">
              Same instructor first
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {scheduledLessonPackages.map((packageOption) => {
              const Icon = packageOption.icon;
              const isSelected = selectedCourse?.id === packageOption.id;
              const packageHref = `/scheduled-lessons?from=${encodeURIComponent(sourceParam)}&course=${encodeURIComponent(packageOption.id)}&date=${encodeURIComponent(packageDate)}#scheduled-lessons-calendar`;

              return (
                <article key={packageOption.id} className={`flex min-h-[270px] flex-col rounded border p-5 shadow-sm transition ${isSelected ? "border-brand bg-red-50" : "border-zinc-200 bg-white"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="grid h-12 w-12 place-items-center rounded bg-red-50 text-brand">
                      <Icon size={24} />
                    </div>
                    <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-black uppercase text-brand">
                      {packageOption.eyebrow}
                    </span>
                  </div>
                  <h3 className="mt-4 text-xl font-black">{packageOption.title}</h3>
                  <p className="mt-2 flex-1 text-sm font-semibold leading-6 text-zinc-600">{packageOption.body}</p>
                  <div className="mt-4 rounded border border-zinc-200 bg-zinc-50 p-3 text-xs font-black uppercase leading-5 text-zinc-700">
                    {packageOption.hours} hours. {packageOption.paceLabel}. Paid upfront.
                  </div>
                  <Link
                    href={packageHref}
                    className={`mt-4 inline-flex min-h-11 items-center justify-center rounded-full px-5 py-2 text-sm font-black ${isSelected ? "bg-black text-white" : "bg-brand text-white"}`}
                  >
                    {isSelected ? "Package selected" : packageOption.checkoutLabel}
                  </Link>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <ScheduledLessonDatePlanner
        initialDate={selectedDate}
        from={sourceParam}
        courseId={selectedCourse?.id ?? null}
        courseTitle={selectedCourse?.title ?? null}
      />

      <section id="scheduled-lessons-booking" className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
        {selectedDate ? (
          (() => {
            const learnerLessonPackage = selectedCourse
              ? {
                  id: selectedCourse.id,
                  title: selectedCourse.title,
                  body: selectedCourse.body,
                  hours: selectedCourse.hours,
                  sessionHours: selectedCourse.sessionHours,
                  totalSessions: selectedCourse.totalSessions,
                  paceLabel: selectedCourse.paceLabel,
                  checkoutLabel: selectedCourse.checkoutLabel
                }
              : null;

            return (
          <LearnerBookingDashboard
            bookingMode="scheduled"
            initialAvailabilityDate={selectedDate}
            initialSelectedInstructorId={selectedInstructorId ?? null}
            initialSelectedInstructorName={selectedInstructorName ?? null}
            initialPickup={initialPickup ?? null}
            initialTransmission={initialTransmission}
            learnerEmail={profile?.email ?? user.email}
            learnerPhone={profile?.phone}
            provisionalLicenceConfirmed={Boolean(learnerProfile?.provisional_licence_confirmed_at)}
            initialInstructors={liveLearnerInstructors}
            lessonPackage={learnerLessonPackage}
          />
            );
          })()
        ) : (
          <div className="rounded border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="text-sm font-black uppercase text-brand">Choose a scheduled date</div>
            <h2 className="mt-2 text-2xl font-black">Pick a day on the calendar first.</h2>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-zinc-600">
              Scheduled lesson search opens after you choose a future date and press Find instructor. This keeps future scheduled lessons separate from same-day and tomorrow bookings.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
