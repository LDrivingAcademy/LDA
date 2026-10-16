import { redirect } from "next/navigation";
import { PageTopBar } from "@/components/page-top-bar";
import { InstructorCalendarWorkspace, type InstructorSlot } from "@/components/instructor-calendar-workspace";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getInstructorApprovalState, redirectUnlessApprovedInstructor } from "@/lib/instructor-approval";
import { getLessonLifecycleStatus } from "@/lib/lesson-lifecycle";
import { getLdaTestInstructorEmail, restrictToLdaTestInstructorEmail } from "@/lib/lda-demo-accounts";
import { getStripeRuntimeMode } from "@/lib/stripe-env";

type LessonBookingRecordRow = {
  booking_reference: string;
  learner_id: string | null;
  learner_email: string | null;
  instructor_id: string | null;
  instructor_email: string | null;
  instructor_name: string | null;
  lesson_summary: string | null;
  starts_at: string | null;
  ends_at: string | null;
  pickup_postcode: string | null;
  status: string | null;
  payment_status: string | null;
  created_at: string;
};

type AvailabilitySlotRow = {
  id: string;
  instructor_id: string;
  starts_at: string;
  ends_at: string;
  is_booked: boolean | null;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

type LearnerProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type InstructorProfileRow = {
  display_name: string | null;
};

type CalendarReadClient = Pick<NonNullable<Awaited<ReturnType<typeof createClient>>>, "from">;

function formatIsoDate(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(value);
}

function formatTime(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(value);
}

function normaliseInstructorSlotStatus(status: string | null, paymentStatus: string | null, startsAt: Date, endsAt: Date | null): InstructorSlot["status"] {
  return getLessonLifecycleStatus({ status, paymentStatus, startsAt, endsAt });
}

function preferredOnDemandInstructorEmail() {
  const configuredEmail = restrictToLdaTestInstructorEmail(
    process.env.LDA_ON_DEMAND_INSTRUCTOR_EMAIL || process.env.LDA_DEMO_INSTRUCTOR_EMAIL
  );

  return configuredEmail || (getStripeRuntimeMode() !== "live" ? getLdaTestInstructorEmail() : "");
}

async function claimPreferredOnDemandAssignments(
  readClient: CalendarReadClient,
  instructorId: string,
  instructorEmail?: string | null,
  instructorName?: string | null
) {
  const preferredEmail = preferredOnDemandInstructorEmail();
  const currentEmail = instructorEmail?.trim().toLowerCase();

  if (!preferredEmail || !currentEmail || currentEmail !== preferredEmail) {
    return;
  }

  const assignment = {
    instructor_id: instructorId,
    instructor_email: instructorEmail,
    instructor_name: instructorName || "LDA instructor",
    lesson_summary: `On-demand LDA lesson accepted by ${instructorName || "your LDA instructor"}. Your instructor is preparing to travel to your pickup point.`,
    status: "accepted"
  };

  await Promise.all([
    readClient
      .from("lesson_booking_records")
      .update(assignment)
      .eq("payment_status", "paid")
      .in("status", ["checkout_started", "waiting_for_instructor", "pending_assignment"])
      .is("instructor_id", null),
    readClient
      .from("lesson_booking_records")
      .update(assignment)
      .eq("payment_status", "paid")
      .eq("instructor_email", "instructor@ldrivingacademy.co.uk")
  ]);
}

async function getInstructorCalendarSlots(
  readClient: CalendarReadClient,
  instructorId: string,
  instructorEmail?: string | null,
  instructorName?: string | null
): Promise<InstructorSlot[]> {
  const selectColumns = "booking_reference,learner_id,learner_email,instructor_id,instructor_email,instructor_name,lesson_summary,starts_at,ends_at,pickup_postcode,status,payment_status,created_at";
  const normalisedEmail = instructorEmail?.trim();
  const normalisedName = instructorName?.trim();
  const recordByReference = new Map<string, LessonBookingRecordRow>();
  const lookups = [
    readClient
      .from("lesson_booking_records")
      .select(selectColumns)
      .eq("instructor_id", instructorId)
      .order("starts_at", { ascending: true, nullsFirst: false })
      .limit(250)
      .returns<LessonBookingRecordRow[]>(),
    normalisedEmail
      ? readClient
          .from("lesson_booking_records")
          .select(selectColumns)
          .ilike("instructor_email", normalisedEmail)
          .order("starts_at", { ascending: true, nullsFirst: false })
          .limit(250)
          .returns<LessonBookingRecordRow[]>()
      : Promise.resolve({ data: [] as LessonBookingRecordRow[], error: null }),
    normalisedName
      ? readClient
          .from("lesson_booking_records")
          .select(selectColumns)
          .ilike("instructor_name", normalisedName)
          .order("starts_at", { ascending: true, nullsFirst: false })
          .limit(250)
          .returns<LessonBookingRecordRow[]>()
      : Promise.resolve({ data: [] as LessonBookingRecordRow[], error: null })
  ];
  const lookupResults = await Promise.all(lookups);

  for (const result of lookupResults) {
    if (result.error) {
      console.warn("[instructor-calendar] booking reference lookup failed", {
        instructorId,
        instructorEmail: normalisedEmail,
        instructorName: normalisedName,
        message: result.error.message
      });
      continue;
    }

    for (const record of result.data ?? []) {
      if (record.booking_reference) {
        recordByReference.set(record.booking_reference, record);
      }
    }
  }

  const records = Array.from(recordByReference.values()).sort((a, b) => {
    const left = a.starts_at ?? a.created_at;
    const right = b.starts_at ?? b.created_at;
    return left.localeCompare(right);
  });

  const learnerIds = Array.from(new Set(records.map((record) => record.learner_id).filter(Boolean) as string[]));
  const { data: learners } = learnerIds.length
    ? await readClient.from("profiles").select("id,full_name,email").in("id", learnerIds).returns<LearnerProfileRow[]>()
    : { data: [] };
  const learnerById = new Map((learners ?? []).map((learner) => [learner.id, learner]));

  const slots: InstructorSlot[] = [];

  for (const record of records) {
    const startsAt = new Date(record.starts_at ?? record.created_at);
    if (Number.isNaN(startsAt.getTime())) continue;
    const endsAt = record.ends_at ? new Date(record.ends_at) : null;
    const validEndsAt = endsAt && !Number.isNaN(endsAt.getTime()) ? endsAt : null;
    const learner = record.learner_id ? learnerById.get(record.learner_id) : null;

    slots.push({
      id: record.booking_reference,
      date: formatIsoDate(startsAt),
      start: formatTime(startsAt),
      end: validEndsAt ? formatTime(validEndsAt) : "Time pending",
      status: normaliseInstructorSlotStatus(record.status, record.payment_status, startsAt, validEndsAt),
      learner: learner?.full_name || learner?.email || record.learner_email || "LDA learner",
      pickup: record.pickup_postcode || "Pickup not recorded",
      reference: record.booking_reference,
      note: record.lesson_summary || "LDA lesson booking"
    });
  }

  const availabilityWindowStart = new Date();
  availabilityWindowStart.setDate(availabilityWindowStart.getDate() - 14);
  const availabilityWindowEnd = new Date();
  availabilityWindowEnd.setDate(availabilityWindowEnd.getDate() + 45);

  const { data: availabilityRows, error: availabilityError } = await readClient
    .from("availability_slots")
    .select("id,instructor_id,starts_at,ends_at,is_booked")
    .eq("instructor_id", instructorId)
    .eq("is_booked", false)
    .gte("ends_at", availabilityWindowStart.toISOString())
    .lte("starts_at", availabilityWindowEnd.toISOString())
    .order("starts_at", { ascending: true })
    .limit(250)
    .returns<AvailabilitySlotRow[]>();

  if (availabilityError) {
    console.warn("[instructor-calendar] availability slot lookup failed", {
      instructorId,
      message: availabilityError.message
    });
  }

  for (const availability of availabilityRows ?? []) {
    const startsAt = new Date(availability.starts_at);
    const endsAt = new Date(availability.ends_at);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) continue;

    slots.push({
      id: availability.id,
      date: formatIsoDate(startsAt),
      start: formatTime(startsAt),
      end: formatTime(endsAt),
      status: "free",
      note: startsAt <= new Date() && endsAt > new Date() ? "Live working window" : "Available for learner booking"
    });
  }

  return slots.sort((a, b) => `${a.date}T${a.start}`.localeCompare(`${b.date}T${b.start}`));
}

export default async function InstructorCalendarPage() {
  const supabase = await createClient();

  if (!hasSupabaseConfig() || !supabase) {
    return (
      <div className="lda-instructor-calendar-page">
        <PageTopBar backHref="/dashboard" backLabel="Back to dashboard" />
      <InstructorCalendarWorkspace instructorName="LDA instructor" useDemoSlots />
      </div>
    );
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?role=instructor");
  }

  const readClient = createAdminClient() ?? supabase;
  const [{ data: profile }, { data: instructorProfile }, approvalState] = await Promise.all([
    readClient.from("profiles").select("full_name,email").eq("id", user.id).maybeSingle(),
    readClient.from("instructor_profiles").select("display_name").eq("user_id", user.id).maybeSingle(),
    getInstructorApprovalState(readClient, user.id)
  ]);
  redirectUnlessApprovedInstructor(approvalState);
  const typedProfile = profile as { full_name?: string | null; email?: string | null } | null;
  const typedInstructorProfile = instructorProfile as InstructorProfileRow | null;
  const instructorDisplayName = typedInstructorProfile?.display_name || typedProfile?.full_name || user.email || "LDA instructor";
  await claimPreferredOnDemandAssignments(readClient, user.id, typedProfile?.email ?? user.email, instructorDisplayName);
  const liveSlots = await getInstructorCalendarSlots(readClient, user.id, typedProfile?.email ?? user.email, instructorDisplayName);

  return (
    <div className="lda-instructor-calendar-page">
      <PageTopBar backHref="/dashboard" backLabel="Back to dashboard" />
      <InstructorCalendarWorkspace instructorName={instructorDisplayName} instructorEmail={typedProfile?.email ?? user.email} initialSlots={liveSlots} />
    </div>
  );
}
