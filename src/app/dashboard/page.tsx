import type { Metadata } from "next";
import Link from "next/link";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, CircleAlert, FileCheck2, Route, ShieldCheck } from "lucide-react";
import { Brand } from "@/components/brand";
import { FastSignOutButton } from "@/components/fast-sign-out-button";
import { InstructorLessonPingMap, type InstructorRouteLesson } from "@/components/instructor-lesson-ping-map";
import { InstructorLessonProgressReminder, type InstructorProgressReminderLesson } from "@/components/instructor-lesson-progress-reminder";
import { InstructorDashboardMenu } from "@/components/instructor-dashboard-menu";
import { LearnerBookingDashboard, type LearnerBookingConfirmation, type LearnerBookingInstructor } from "@/components/learner-booking-dashboard";
import { LearnerDashboardJourney } from "@/components/learner-dashboard-journey";
import { LearnerDashboardMenu } from "@/components/learner-dashboard-menu";
import { LoginActivityReporter } from "@/components/login-activity-reporter";
import { InstructorSetupGuide } from "@/components/instructor-setup-guide";
import { InstructorSetupWelcomeModal } from "@/components/instructor-setup-welcome-modal";
import { InstructorOnDemandRequests, type InstructorOnDemandRequest } from "@/components/instructor-on-demand-requests";
import { InstructorStartWorkPanel } from "@/components/instructor-start-work-panel";
import { InstructorSmartMatchProfileSection } from "@/components/instructor-smart-match-profile-section";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { InstructorFinanceProfile } from "@/lib/instructor-finance-profile";
import { getInstructorSetupReadiness, refreshInstructorSetupAvailability } from "@/lib/instructor-setup-readiness";
import { hasCompletedLearnerEligibility } from "@/lib/learner-eligibility";
import { type InstructorPackageId } from "@/lib/instructor-packages";
import { getInstructorVerificationDisplayFromEvidence } from "@/lib/instructor-verification-status";
import { type LearnerPackageId } from "@/lib/learner-packages";
import { readLearnerVerificationToken, learnerVerificationCookieName } from "@/lib/learner-verification-session";
import { readSubscriptionSessionToken, subscriptionSessionCookieName } from "@/lib/subscription-session-cookie";
import { recoverLatestStripeSubscriptionForSignedInAccount } from "@/lib/subscription-return-recovery";
import { getStripeSecretKey } from "@/lib/stripe-env";
import { getLdaTestInstructorEmail } from "@/lib/lda-demo-accounts";
import { isLessonRouteAccessActive } from "@/lib/lesson-route-access";
import { isDirectorAdminEmail } from "@/lib/admin-access";
import { requireActiveLdaAuthSession } from "@/lib/auth-sessions";
import { clientLoginActivityPendingCookieName } from "@/lib/login-activity";
import { shouldBypassInstructorAvailabilityPauseForTest } from "@/lib/test-instructor-visibility";
import {
  filterAvailabilitySlotsByFutureCompliance,
  readInstructorFutureComplianceDocuments
} from "@/lib/instructor-future-compliance";
import {
  flattenInstructorVerificationRequirements,
  getInstructorVerificationRequirements
} from "@/lib/instructor-verification-requirements";
import {
  getEntitledInstructorPackageId,
  getEntitledLearnerPackageId,
  hasActiveSubscriptionEntitlement,
  hasInactiveSubscriptionStatus,
  isPaidInstructorPackageId,
  isPaidLearnerPackageId
} from "@/lib/subscription-entitlements";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = {
  title: "Account Dashboard | L Driving Academy",
  description: "Secure L Driving Academy account dashboard for signed-in learners and instructors.",
  robots: {
    index: false,
    follow: false,
    nocache: true
  }
};

const instructorDashboardSections = [
  {
    title: "Lessons/Diary",
    bio: "See lessons, pickup details, booking status, reminders, learner enquiries, and important platform notifications.",
    href: "/instructor-calendar?from=dashboard"
  },
  {
    title: "Pupil Management",
    bio: "Keep active pupils and test-ready pupils organised in one focused workspace.",
    href: "/pupil-management?from=dashboard"
  },
  {
    title: "Pupil Progress",
    bio: "Track learner development against the DVSA syllabus and keep lesson evidence ready for the next session.",
    href: "/progress-tracker?from=dashboard"
  },
  {
    title: "Finance",
    bio: "Review lesson earnings, outstanding payments, received payments, and payout-ready booking evidence.",
    href: "/instructor-finance?from=dashboard"
  },
  {
    title: "Performance Metrics",
    bio: "Monitor the signals that shape your LDA profile: pass rate, lessons delivered, retention, reviews, and cancellations.",
    href: "/instructor-performance?from=dashboard"
  },
  {
    title: "Vehicle & Compliance",
    bio: "Stay ahead of vehicle servicing, insurance expiry, ADI registration, and compliance reminders.",
    href: "/instructor-vehicle-compliance?from=dashboard"
  }
];

type DashboardPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
  forcedRole?: "learner" | "instructor";
};

type InstructorTrackingBookingRow = {
  id: string;
  learner_id: string;
  starts_at: string;
  ends_at: string;
  pickup_postcode: string;
  pickup_latitude: number | null;
  pickup_longitude: number | null;
  status: string | null;
};

type InstructorProgressReferenceRow = {
  booking_reference: string;
  learner_id: string | null;
  learner_email: string | null;
  starts_at: string | null;
  ends_at: string | null;
  status: string | null;
};

type DashboardQueryResult<T> = {
  data: T | null;
  error: { message: string } | null;
};

type InstructorDashboardProfile = {
  verification_status?: string | null;
  hourly_rate_pence?: number | null;
  base_postcode?: string | null;
  areas_covered?: string[] | null;
  transmission?: string | null;
  car_make?: string | null;
  car_model?: string | null;
  stripe_account_id?: string | null;
  learner_availability_paused?: boolean | null;
  learner_availability_pause_reason?: string | null;
  instructor_package?: string | null;
  instructor_subscription_status?: string | null;
  instructor_package_expires_at?: string | null;
  auto_accept_bookings?: boolean | null;
};

type InstructorVerificationDisplay = ReturnType<typeof getInstructorVerificationDisplayFromEvidence>;

type InstructorApplicationDocumentRow = {
  document_type?: string | null;
  status?: string | null;
  created_at?: string | null;
};

const instructorApplicationRequiredDocuments = [
  { type: "adi_pdi_badge", label: "ADI badge evidence" },
  { type: "driving_licence", label: "Driving licence evidence" },
  { type: "dbs_check", label: "DBS evidence" },
  { type: "mot_certificate", label: "MOT evidence" },
  { type: "vehicle_tax_status", label: "Vehicle tax evidence" },
  { type: "vehicle_registration", label: "Vehicle registration evidence" },
  { type: "vehicle_safety_declaration", label: "Vehicle safety declaration" },
  { type: "tuition_insurance", label: "Paid tuition insurance evidence" }
];

type LearnerDashboardProfile = {
  date_of_birth?: string | null;
  provisional_licence_confirmed_at?: string | null;
  terms_accepted_at?: string | null;
  learner_package?: string | null;
  learner_subscription_status?: string | null;
  learner_package_expires_at?: string | null;
  learner_plus_active?: boolean | null;
  learner_plus_started_at?: string | null;
  learner_plus_expires_at?: string | null;
};

type ConfirmedBookingRow = {
  booking_reference: string;
  instructor_id: string | null;
  instructor_name: string | null;
  lesson_summary: string | null;
  starts_at: string | null;
  pickup_postcode: string | null;
  lesson_price_pence: number | null;
  car: string | null;
  status: string | null;
};

type InstructorOnDemandRequestRow = {
  booking_reference: string;
  learner_email: string | null;
  learner_phone: string | null;
  lesson_summary: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  pickup_postcode: string | null;
  pickup_label?: string | null;
  pickup_latitude?: number | null;
  pickup_longitude?: number | null;
  lesson_price_pence: number | null;
  car: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type LiveInstructorProfileRow = {
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

type LiveAvailabilitySlotRow = {
  instructor_id: string;
  starts_at: string;
  ends_at: string;
  is_booked: boolean | null;
};

function getSearchParam(searchParams: Record<string, string | string[] | undefined> | undefined, key: string) {
  const value = searchParams?.[key];
  return Array.isArray(value) ? value[0] : value;
}

function getSubscriptionReturnPlan(searchParams: Record<string, string | string[] | undefined> | undefined) {
  return getSearchParam(searchParams, "subscription") === "updated" ? getSearchParam(searchParams, "plan") : null;
}

function getInstructorPlanOverride(plan?: string | null): InstructorPackageId | null {
  return plan === "instructor" || plan === "instructor-plus" || plan === "instructor-pro" ? plan : null;
}

function getLearnerPlanOverride(plan?: string | null): LearnerPackageId | null {
  return plan === "learner" || plan === "learner-plus" || plan === "learner-pro" ? plan : null;
}

function isMissingColumnError(error: { message?: string } | null | undefined, column: string) {
  return Boolean(error?.message?.includes(column) && error.message.includes("does not exist"));
}

function isMissingAnyColumnError(error: unknown) {
  const candidate = error as { code?: string; message?: string } | null;
  return candidate?.code === "42703" || /column .* does not exist/i.test(candidate?.message ?? "");
}

function normaliseApplicationStatus(value?: string | null) {
  return String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function isCompletedApplicationStatus(value?: string | null) {
  const normalised = normaliseApplicationStatus(value);
  return normalised === "completed" || normalised === "approved" || normalised === "clear";
}

function getInstructorApplicationDocumentSummary(documents: InstructorApplicationDocumentRow[]) {
  const latestByType = new Map<string, InstructorApplicationDocumentRow>();

  for (const document of documents) {
    const documentType = String(document.document_type ?? "");
    if (documentType && !latestByType.has(documentType)) {
      latestByType.set(documentType, document);
    }
  }

  const missingRequired = instructorApplicationRequiredDocuments.filter((document) => !latestByType.has(document.type));
  const uploadedRequiredCount = instructorApplicationRequiredDocuments.length - missingRequired.length;
  const pendingRequiredCount = instructorApplicationRequiredDocuments.filter((document) => {
    const status = normaliseApplicationStatus(latestByType.get(document.type)?.status);
    return status === "pending" || status === "in_progress";
  }).length;
  const approvedRequiredCount = instructorApplicationRequiredDocuments.filter((document) => {
    return isCompletedApplicationStatus(latestByType.get(document.type)?.status);
  }).length;
  const rejectedRequiredCount = instructorApplicationRequiredDocuments.filter((document) => {
    const status = normaliseApplicationStatus(latestByType.get(document.type)?.status);
    return status === "rejected";
  }).length;

  return {
    totalRequired: instructorApplicationRequiredDocuments.length,
    uploadedRequiredCount,
    approvedRequiredCount,
    pendingRequiredCount,
    rejectedRequiredCount,
    missingRequiredLabels: missingRequired.map((document) => document.label)
  };
}

function addDaysIsoDate(days: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatSlotDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(value));
}

function formatSlotTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));
}

function nextSlotLabel(slots: Record<string, string[]>) {
  const firstDate = Object.keys(slots).sort()[0];
  const firstTime = firstDate ? slots[firstDate]?.[0] : null;

  if (!firstDate || !firstTime) return "Availability pending";
  if (firstDate === addDaysIsoDate(0)) return `Today ${firstTime}`;
  if (firstDate === addDaysIsoDate(1)) return `Tomorrow ${firstTime}`;

  return `${new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "Europe/London" }).format(new Date(`${firstDate}T12:00:00`))} ${firstTime}`;
}

async function getLiveLearnerInstructors(
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
    .returns<LiveInstructorProfileRow[]>();

  const fallbackInstructorLookup =
    primaryInstructorLookup.error && isMissingAnyColumnError(primaryInstructorLookup.error)
      ? await readClient
          .from("instructor_profiles")
          .select(
            "user_id,display_name,bio,adi_pdi_status,hourly_rate_pence,transmission,car_make,car_model,areas_covered,base_postcode,latitude,longitude,stripe_account_id"
          )
          .eq("verification_status", "approved")
          .limit(40)
          .returns<LiveInstructorProfileRow[]>()
      : null;

  const instructors = fallbackInstructorLookup ? fallbackInstructorLookup.data : primaryInstructorLookup.data;
  const instructorError = fallbackInstructorLookup ? fallbackInstructorLookup.error : primaryInstructorLookup.error;

  if (instructorError) {
    console.warn("[dashboard] live instructor search lookup failed", {
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

      const testInstructor = (testInstructorFallbackLookup ? testInstructorFallbackLookup.data : testInstructorLookup.data) as LiveInstructorProfileRow | null;
      const testInstructorError = testInstructorFallbackLookup ? testInstructorFallbackLookup.error : testInstructorLookup.error;

      if (!testInstructorError && testInstructor?.user_id) {
        instructorRows = [testInstructor, ...instructorRows];
      }
    }
  }

  const instructorIds = instructorRows.map((instructor) => instructor.user_id);

  if (!instructorIds.length) {
    return [];
  }

  const { data: profileEmails, error: profileEmailError } = await readClient
    .from("profiles")
    .select("id,email")
    .in("id", instructorIds)
    .returns<Array<{ id: string; email: string | null }>>();

  if (profileEmailError) {
    console.warn("[dashboard] live instructor email lookup failed", {
      message: profileEmailError.message
    });
  }

  const emailByInstructorId = new Map((profileEmails ?? []).map((profile) => [profile.id, profile.email ?? ""]));

  const now = new Date();
  const windowEnd = new Date(now);
  windowEnd.setDate(windowEnd.getDate() + 35);
  windowEnd.setHours(23, 59, 59, 999);

  const { data: availability, error: availabilityError } = await readClient
    .from("availability_slots")
    .select("instructor_id,starts_at,ends_at,is_booked")
    .in("instructor_id", instructorIds)
    .eq("is_booked", false)
    .gt("ends_at", now.toISOString())
    .lte("starts_at", windowEnd.toISOString())
    .order("starts_at", { ascending: true })
    .returns<LiveAvailabilitySlotRow[]>();

  if (availabilityError) {
    console.warn("[dashboard] live instructor availability lookup failed", {
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
    const date = formatSlotDate(slot.starts_at);
    const time = formatSlotTime(slot.starts_at);
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
        next: nextSlotLabel(slots),
        car: `${car}${transmission ? ` ${transmission}` : ""}`,
        bio:
          instructor.bio ||
          "Verified LDA instructor with learner-facing availability, local pickup support, and progress notes after lessons.",
        slots,
        learnerAvailabilityPaused: Boolean(instructor.learner_availability_paused) && !bypassPausedAvailability,
        learnerAvailabilityPauseReason: bypassPausedAvailability ? undefined : instructor.learner_availability_pause_reason ?? undefined,
        stripeConnectedAccountId: instructor.stripe_account_id ?? undefined
      };
    })
    .filter((instructor) => !instructor.learnerAvailabilityPaused && Object.keys(instructor.slots).length > 0);
}

export default async function DashboardPage({ searchParams, forcedRole }: DashboardPageProps) {
  const resolvedSearchParams = await searchParams;
  const requestedRole = forcedRole === "instructor" ? "instructor" : "learner";
  const supabase = await createClient();

  if (!hasSupabaseConfig() || !supabase) {
    return (
      <main className="min-h-screen bg-black px-4 py-10 text-white">
        <section className="mx-auto max-w-4xl rounded border border-zinc-800 bg-zinc-950 p-6 shadow-sm">
          <h1 className="text-3xl font-black">Secure dashboard access is temporarily unavailable</h1>
          <p className="mt-3 leading-7 text-zinc-400">
            Please try again later. If this continues, contact LDA support and we will help you get back into your account.
          </p>
          <Link href={`/auth/login?role=${requestedRole}`} className="lda-pill lda-pill-sm mt-5">
            Open login <ArrowRight size={16} />
          </Link>
        </section>
      </main>
    );
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth/login?role=${requestedRole}`);
  }

  const readClient = createAdminClient() ?? supabase;
  const bookingConfirmedReference = getSearchParam(resolvedSearchParams, "bookingConfirmed");
  const nowIso = new Date().toISOString();
  const [
    profileResult,
    rolesResult,
    instructorProfileWithPackageResult,
    learnerProfileWithPackageResult,
    instructorDocumentsResult,
    confirmedBookingResult,
    adminAuthUserResult,
    activeAvailabilityResult
  ] = await Promise.all([
    readClient.from("profiles").select("full_name,email,phone,terms_version_accepted").eq("id", user.id).maybeSingle(),
    readClient.from("account_roles").select("role").eq("user_id", user.id),
    supabase
      .from("instructor_profiles")
      .select("verification_status,hourly_rate_pence,base_postcode,areas_covered,transmission,car_make,car_model,stripe_account_id,learner_availability_paused,learner_availability_pause_reason,instructor_package,instructor_subscription_status,instructor_package_expires_at,auto_accept_bookings")
      .eq("user_id", user.id)
      .maybeSingle(),
    readClient
      .from("learner_profiles")
      .select("date_of_birth,provisional_licence_confirmed_at,terms_accepted_at,learner_package,learner_subscription_status,learner_package_expires_at,learner_plus_active,learner_plus_started_at,learner_plus_expires_at")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("instructor_documents")
      .select("document_type,status,created_at")
      .eq("instructor_id", user.id)
      .order("created_at", { ascending: false }),
    bookingConfirmedReference
      ? readClient
          .from("lesson_booking_records")
          .select("booking_reference,instructor_id,instructor_name,lesson_summary,starts_at,pickup_postcode,lesson_price_pence,car,status")
          .eq("booking_reference", bookingConfirmedReference)
          .eq("learner_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    createAdminClient()?.auth.admin.getUserById(user.id) ?? Promise.resolve({ data: null, error: null }),
    readClient
      .from("availability_slots")
      .select("id")
      .eq("instructor_id", user.id)
      .eq("is_booked", false)
      .lte("starts_at", nowIso)
      .gt("ends_at", nowIso)
      .limit(1)
  ]);
  const instructorProfileResult = (isMissingColumnError(instructorProfileWithPackageResult.error, "instructor_package")
    ? await supabase.from("instructor_profiles").select("verification_status,hourly_rate_pence,base_postcode,areas_covered,transmission,car_make,car_model,stripe_account_id,learner_availability_paused,learner_availability_pause_reason,auto_accept_bookings").eq("user_id", user.id).maybeSingle()
    : instructorProfileWithPackageResult) as DashboardQueryResult<InstructorDashboardProfile>;
  const learnerProfileResult = (isMissingColumnError(learnerProfileWithPackageResult.error, "learner_package")
    ? await readClient
        .from("learner_profiles")
        .select("date_of_birth,provisional_licence_confirmed_at,terms_accepted_at,learner_plus_active,learner_plus_started_at,learner_plus_expires_at")
        .eq("user_id", user.id)
        .maybeSingle()
    : learnerProfileWithPackageResult) as DashboardQueryResult<LearnerDashboardProfile>;
  const profile = profileResult.data;
  const roles = rolesResult.data;
  const instructorProfile = instructorProfileResult.data;
  const learnerProfile = learnerProfileResult.data;
  const instructorDocuments = instructorDocumentsResult.data;
  const instructorFinance = (adminAuthUserResult.data?.user?.user_metadata?.lda_instructor_finance ?? {}) as InstructorFinanceProfile;
  const instructorSetupPromptDismissed = Boolean(adminAuthUserResult.data?.user?.user_metadata?.lda_instructor_setup_prompt_dismissed_at);
  const instructorSetupPromptEligible = Boolean(adminAuthUserResult.data?.user?.user_metadata?.lda_instructor_setup_prompt_eligible_at);
  const instructorSetupGuideEnabled = Boolean(adminAuthUserResult.data?.user?.user_metadata?.lda_instructor_setup_guide_enabled_at);
  const instructorSetupGuideClosed = Boolean(adminAuthUserResult.data?.user?.user_metadata?.lda_instructor_setup_guide_closed_at);
  const instructorSetupCompleted = Boolean(adminAuthUserResult.data?.user?.user_metadata?.lda_instructor_setup_completed_at);
  const instructorHasActiveAvailability = Boolean(activeAvailabilityResult.data?.length);
  const instructorIsWorking = instructorHasActiveAvailability && !instructorProfile?.learner_availability_paused;
  const confirmedBookingRow = confirmedBookingResult.data as ConfirmedBookingRow | null;
  const confirmedBookingStartsAt = confirmedBookingRow?.starts_at ? new Date(confirmedBookingRow.starts_at) : null;
  const confirmedBookingDate =
    confirmedBookingRow?.starts_at && confirmedBookingStartsAt && !Number.isNaN(confirmedBookingStartsAt.getTime())
      ? formatSlotDate(confirmedBookingRow.starts_at)
      : "";
  const initialBookingConfirmation: LearnerBookingConfirmation | null =
    confirmedBookingRow && confirmedBookingDate
      ? {
          reference: confirmedBookingRow.booking_reference,
          instructorId: confirmedBookingRow.instructor_id,
          instructorName: confirmedBookingRow.instructor_name || "LDA instructor",
          lessonSummary: confirmedBookingRow.lesson_summary || "LDA driving lesson",
          date: confirmedBookingDate,
          time: confirmedBookingRow.starts_at ? formatSlotTime(confirmedBookingRow.starts_at) : "Time saved with booking",
          bookingWindow: confirmedBookingDate > addDaysIsoDate(1) ? "advance_scheduled" : "same_day_or_next_day",
          pickup: confirmedBookingRow.pickup_postcode || "Pickup point saved with booking",
          pricePence: confirmedBookingRow.lesson_price_pence ?? 0,
          car: confirmedBookingRow.car || "Instructor vehicle"
        }
      : null;

  const readErrors = [
    ["profiles", profileResult.error],
    ["account_roles", rolesResult.error],
    ["instructor_profiles", instructorProfileResult.error],
    ["learner_profiles", learnerProfileResult.error],
    ["instructor_documents", instructorDocumentsResult.error],
    ["availability_slots", activeAvailabilityResult.error]
  ].filter((entry): entry is [string, NonNullable<typeof profileResult.error>] => Boolean(entry[1]));

  if (readErrors.length) {
    console.error("[dashboard] account data read failed", {
      userId: user.id,
      errors: readErrors.map(([table, error]) => ({ table, message: error.message }))
    });
  }

  const roleNames = roles?.map((role) => String(role.role)) ?? [];
  const roleLabels = roleNames.join(", ") || "learner";
  const forcedMarketplaceRole = forcedRole === "learner" || forcedRole === "instructor" ? forcedRole : null;
  const hasAdminRole = roleNames.includes("admin") && isDirectorAdminEmail(user.email);
  const actualMarketplaceRole = roleNames.includes("instructor") ? "instructor" : "learner";

  if (forcedMarketplaceRole && !hasAdminRole && forcedMarketplaceRole !== actualMarketplaceRole) {
    redirect(actualMarketplaceRole === "instructor" ? "/instructor-dashboard" : "/learner-dashboard");
  }

  const requestedAdminPreview = hasAdminRole && !forcedMarketplaceRole ? getSearchParam(resolvedSearchParams, "adminPreview") : null;
  const adminPreviewRole =
    requestedAdminPreview === "learner" || requestedAdminPreview === "instructor" || requestedAdminPreview === "in-progress"
      ? requestedAdminPreview
      : null;
  const adminPreviewInstructorInProgress = adminPreviewRole === "in-progress";
  const isAdmin = hasAdminRole && !forcedMarketplaceRole;
  const isInstructor = forcedMarketplaceRole ? forcedMarketplaceRole === "instructor" : adminPreviewRole === "instructor" || adminPreviewInstructorInProgress || (!isAdmin && actualMarketplaceRole === "instructor");
  const cookieStore = await cookies();

  if (!isAdmin) {
    const activeSession = await requireActiveLdaAuthSession({
      adminClient: createAdminClient(),
      cookieStore,
      headers: await headers(),
      userId: user.id,
      role: isInstructor ? "instructor" : "learner",
      readOnly: true
    });

    if (!activeSession.ok) {
      redirect(`/auth/login?role=${isInstructor ? "instructor" : "learner"}&message=${encodeURIComponent("Sign in before opening your account dashboard.")}`);
    }
  }

  const learnerDashboardSection = !isInstructor ? getSearchParam(resolvedSearchParams, "section") : null;
  const autoStartInstructorRoute = isInstructor && getSearchParam(resolvedSearchParams, "startRoute") === "1";
  const isLearnerDrivingLessonsView = learnerDashboardSection === "driving-lessons";
  const smartMatchSelectedInstructorId = getSearchParam(resolvedSearchParams, "instructor");
  const smartMatchSelectedInstructorName = getSearchParam(resolvedSearchParams, "instructorName");
  const smartMatchPickup = getSearchParam(resolvedSearchParams, "postcode");
  const smartMatchTransmissionParam = getSearchParam(resolvedSearchParams, "transmission");
  const smartMatchTransmission =
    smartMatchTransmissionParam === "manual" || smartMatchTransmissionParam === "automatic"
      ? smartMatchTransmissionParam
      : null;
  const smartMatchAvailabilityDate = getSearchParam(resolvedSearchParams, "date");
  const dashboardSource = getSearchParam(resolvedSearchParams, "from");
  const learnerDrivingLessonsBack =
    dashboardSource === "home"
      ? { href: "/", label: "Back to homepage" }
      : { href: "/learner-dashboard", label: "Back to learner dashboard" };
  const pendingSubscriptionReturn = getSearchParam(resolvedSearchParams, "subscription") === "pending";
  const subscriptionReturnPlan = getSubscriptionReturnPlan(resolvedSearchParams);
  const shouldRecordClientLoginActivity = Boolean(cookieStore.get(clientLoginActivityPendingCookieName)?.value);
  const subscriptionSession = readSubscriptionSessionToken(
    cookieStore.get(subscriptionSessionCookieName)?.value,
    user.id,
    isInstructor ? "instructor" : "learner"
  );
  const learnerVerificationSession = readLearnerVerificationToken(
    cookieStore.get(learnerVerificationCookieName)?.value,
    user.id
  );

  if (pendingSubscriptionReturn) {
    redirect(`/api/subscriptions/recover?role=${isInstructor ? "instructor" : "learner"}`);
  }

  const hasLearnerPlus =
    !isInstructor &&
    !hasInactiveSubscriptionStatus(learnerProfile?.learner_subscription_status) &&
    Boolean(learnerProfile?.learner_plus_active) &&
    hasActiveSubscriptionEntitlement({
      packageId: "learner-plus",
      status: learnerProfile?.learner_subscription_status,
      expiresAt: learnerProfile?.learner_plus_expires_at
    });
  const learnerProfilePackage = getEntitledLearnerPackageId({
    packageId: learnerProfile?.learner_package,
    status: learnerProfile?.learner_subscription_status,
    expiresAt: learnerProfile?.learner_package_expires_at
  });
  const instructorProfilePackage = getEntitledInstructorPackageId({
    packageId: instructorProfile?.instructor_package,
    status: instructorProfile?.instructor_subscription_status,
    expiresAt: instructorProfile?.instructor_package_expires_at
  });
  const learnerSubscriptionIsInactive = hasInactiveSubscriptionStatus(learnerProfile?.learner_subscription_status);
  const instructorSubscriptionIsInactive = hasInactiveSubscriptionStatus(instructorProfile?.instructor_subscription_status);
  const learnerSessionPackage = !isInstructor && !learnerSubscriptionIsInactive && isPaidLearnerPackageId(subscriptionSession?.packageId) ? subscriptionSession.packageId : null;
  const instructorSessionPackage = isInstructor && !instructorSubscriptionIsInactive && isPaidInstructorPackageId(subscriptionSession?.packageId) ? subscriptionSession.packageId : null;
  let recoveredSubscriptionPlan: LearnerPackageId | InstructorPackageId | null = null;

  if (!isAdmin) {
    const hasCurrentCloudPaidPackage = isInstructor
      ? isPaidInstructorPackageId(instructorProfilePackage)
      : isPaidLearnerPackageId(learnerProfilePackage) || hasLearnerPlus;
    const currentSessionPackage = isInstructor ? instructorSessionPackage : learnerSessionPackage;
    const shouldRecoverSubscription =
      Boolean(subscriptionReturnPlan) &&
      !hasCurrentCloudPaidPackage &&
      !currentSessionPackage;

    if (shouldRecoverSubscription) {
      const stripeSecret = getStripeSecretKey();

      try {
        const recovered = await recoverLatestStripeSubscriptionForSignedInAccount({
          supabase,
          userId: user.id,
          email: profile?.email ?? user.email,
          role: isInstructor ? "instructor" : "learner",
          secretKey: stripeSecret.value
        });

        if (recovered) {
          recoveredSubscriptionPlan = recovered.target.packageId;
        }
      } catch (error) {
        console.error("[dashboard] subscription cloud recovery failed", {
          userId: user.id,
          role: isInstructor ? "instructor" : "learner",
          error
        });
      }
    }
  }
  const displayName = profile?.full_name || user.email || "Learner";
  const verificationStatus = getInstructorVerificationDisplayFromEvidence(
    instructorProfile?.verification_status,
    (instructorDocuments ?? []).map((document) => document.status)
  );
  const instructorApplicationSummary = getInstructorApplicationDocumentSummary(
    ((adminPreviewInstructorInProgress ? [] : instructorDocuments) ?? []) as InstructorApplicationDocumentRow[]
  );
  const previewVerificationStatus = adminPreviewInstructorInProgress
    ? getInstructorVerificationDisplayFromEvidence("in_progress", [])
    : verificationStatus;
  const hasApprovedInstructorAccess = (isAdmin && !adminPreviewInstructorInProgress) || instructorProfile?.verification_status === "approved";
  const instructorSetupReadiness = getInstructorSetupReadiness(instructorProfile, instructorFinance);
  const shouldShowInstructorSetupPrompt =
    !isAdmin &&
    isInstructor &&
    hasApprovedInstructorAccess &&
    instructorSetupPromptEligible &&
    !instructorSetupReadiness.complete &&
    !instructorSetupGuideEnabled &&
    !instructorSetupPromptDismissed &&
    !instructorSetupCompleted;
  const shouldShowInstructorSetupGuide =
    !isAdmin &&
    isInstructor &&
    hasApprovedInstructorAccess &&
    !instructorSetupReadiness.complete &&
    instructorSetupGuideEnabled &&
    !instructorSetupGuideClosed &&
    !instructorSetupCompleted;
  const recoveredLearnerPlan = !isInstructor ? getLearnerPlanOverride(recoveredSubscriptionPlan) : null;
  const recoveredInstructorPlan = isInstructor ? getInstructorPlanOverride(recoveredSubscriptionPlan) : null;
  const learnerProfilePaidPackage = isPaidLearnerPackageId(learnerProfilePackage) ? learnerProfilePackage : null;
  const instructorProfilePaidPackage = isPaidInstructorPackageId(instructorProfilePackage) ? instructorProfilePackage : null;
  const learnerPackageId = (isAdmin ? "learner-pro" : recoveredLearnerPlan || learnerProfilePaidPackage || (hasLearnerPlus ? "learner-plus" : null) || learnerSessionPackage || "learner") as LearnerPackageId;
  const learnerPackageLabel =
    learnerPackageId === "learner-pro"
      ? "Learner Pro"
      : learnerPackageId === "learner-plus" || hasLearnerPlus
        ? "Learner Plus"
        : "Learner";
  const learnerUpgrade =
    isAdmin
      ? null
      : learnerPackageId === "learner"
      ? { label: "Upgrade to Plus", href: "/learner-plus?from=dashboard" }
      : learnerPackageId === "learner-plus"
        ? { label: "Upgrade to Pro", href: "/learner-plus?from=dashboard" }
        : null;
  const instructorPackageId = (isAdmin ? (adminPreviewInstructorInProgress ? "instructor" : "instructor-pro") : recoveredInstructorPlan || instructorProfilePaidPackage || instructorSessionPackage || "instructor") as InstructorPackageId;
  const instructorPackageLabel =
    instructorPackageId === "instructor-plus"
      ? "Instructor Plus"
      : instructorPackageId === "instructor-pro"
        ? "Instructor Pro"
        : "Instructor";
  const instructorUpgrade =
    isAdmin
      ? null
      : instructorPackageId === "instructor"
      ? { label: "Upgrade to Plus", href: "/instructor-plus?from=dashboard" }
      : instructorPackageId === "instructor-plus"
        ? { label: "Upgrade to Pro", href: "/instructor-plus?from=dashboard" }
        : null;
  const hasLearnerSetup = hasCompletedLearnerEligibility(learnerProfile);
  const hasRecentLearnerVerification = Boolean(learnerVerificationSession);
  const liveLearnerInstructors = !isInstructor && !isAdmin ? await getLiveLearnerInstructors(readClient) : [];
  const accountTypeLabel = isAdmin
    ? adminPreviewInstructorInProgress
      ? "Admin preview: Instructor in progress"
      : adminPreviewRole === "instructor"
      ? "Admin preview: Instructor"
      : adminPreviewRole === "learner"
        ? "Admin preview: Learner"
        : "Admin Account"
    : isInstructor
      ? hasApprovedInstructorAccess
        ? "Instructor Account"
        : "Instructor application"
      : "Learner account";
let instructorRouteLesson: InstructorRouteLesson | null = null;
  let instructorProgressReminderLesson: InstructorProgressReminderLesson | null = null;
  let instructorOnDemandRequests: InstructorOnDemandRequest[] = [];

  if (isInstructor && !isAdmin && hasApprovedInstructorAccess) {
    await refreshInstructorSetupAvailability({
      db: readClient,
      userId: user.id,
      profile: instructorProfile,
      finance: instructorFinance
    });
  }

  if (isInstructor && !isAdmin && hasApprovedInstructorAccess) {
    const onDemandSelectWithRoute = "booking_reference,learner_email,learner_phone,lesson_summary,starts_at,ends_at,pickup_postcode,pickup_label,pickup_latitude,pickup_longitude,lesson_price_pence,car,status,created_at,updated_at";
    const onDemandSelectFallback = "booking_reference,learner_email,learner_phone,lesson_summary,pickup_postcode,lesson_price_pence,car,status,created_at,updated_at";
    let onDemandQuery = await readClient
      .from("lesson_booking_records")
      .select(onDemandSelectWithRoute)
      .eq("instructor_id", user.id)
      .in("status", ["pending_assignment", "accepted", "upcoming", "instructor_en_route", "en_route"])
      .order("created_at", { ascending: true })
      .limit(10)
      .returns<InstructorOnDemandRequestRow[]>();

    if (onDemandQuery.error?.code === "42703") {
      onDemandQuery = await readClient
        .from("lesson_booking_records")
        .select(onDemandSelectFallback)
        .eq("instructor_id", user.id)
        .in("status", ["pending_assignment", "accepted", "upcoming", "instructor_en_route", "en_route"])
        .order("created_at", { ascending: true })
        .limit(10)
        .returns<InstructorOnDemandRequestRow[]>();
    }

    if (onDemandQuery.error) {
      console.warn("[dashboard] instructor on-demand request lookup failed", {
        userId: user.id,
        message: onDemandQuery.error.message
      });
    }

    instructorOnDemandRequests = (onDemandQuery.data ?? [])
      .filter((request) =>
        isLessonRouteAccessActive({
          status: request.status,
          startsAt: request.starts_at,
          endsAt: request.ends_at,
          createdAt: request.created_at,
          updatedAt: request.updated_at
        })
      )
      .slice(0, 1)
      .map((request) => ({
        reference: request.booking_reference,
        learnerEmail: request.learner_email,
        learnerPhone: request.learner_phone,
        summary: request.lesson_summary,
        pickup: request.pickup_postcode,
        pickupLabel: request.pickup_label,
        pickupLatitude: request.pickup_latitude,
        pickupLongitude: request.pickup_longitude,
        pricePence: request.lesson_price_pence,
        car: request.car,
        status: request.status || "waiting_for_instructor",
        createdAt: request.created_at,
        updatedAt: request.updated_at || request.created_at
      }));

    const nowIso = new Date().toISOString();
    const { data: instructorBookings, error: instructorBookingsError } = await readClient
      .from("bookings")
      .select("id,learner_id,starts_at,ends_at,pickup_postcode,pickup_latitude,pickup_longitude,status")
      .eq("instructor_id", user.id)
      .in("status", ["accepted", "pending"])
      .gt("ends_at", nowIso)
      .order("starts_at", { ascending: true })
      .limit(1)
      .returns<InstructorTrackingBookingRow[]>();

    if (instructorBookingsError) {
      console.warn("[dashboard] instructor tracking booking lookup failed", {
        userId: user.id,
        message: instructorBookingsError.message
      });
    }

    const instructorBooking = instructorBookings?.[0];
    if (instructorBooking) {
      const { data: learnerForRoute, error: learnerForRouteError } = await readClient
        .from("profiles")
        .select("full_name,email")
        .eq("id", instructorBooking.learner_id)
        .maybeSingle();

      if (learnerForRouteError) {
        console.warn("[dashboard] learner route profile lookup failed", {
          bookingId: instructorBooking.id,
          message: learnerForRouteError.message
        });
      }

      const learnerProfileForRoute = learnerForRoute as { full_name?: string | null; email?: string | null } | null;
      instructorRouteLesson = {
        bookingReference: instructorBooking.id,
        learnerName: learnerProfileForRoute?.full_name || learnerProfileForRoute?.email || "Learner",
        pickupAddress: instructorBooking.pickup_postcode,
        startsAt: instructorBooking.starts_at,
        pickupPoint:
          typeof instructorBooking.pickup_latitude === "number" && typeof instructorBooking.pickup_longitude === "number"
            ? { lat: instructorBooking.pickup_latitude, lng: instructorBooking.pickup_longitude }
            : null
      };
    }

    const lessonReminderWindowStart = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const { data: endedBookings, error: endedBookingsError } = await readClient
      .from("bookings")
      .select("id,learner_id,starts_at,ends_at,pickup_postcode,pickup_latitude,pickup_longitude,status")
      .eq("instructor_id", user.id)
      .in("status", ["accepted", "completed"])
      .lte("ends_at", nowIso)
      .gte("ends_at", lessonReminderWindowStart)
      .order("ends_at", { ascending: false })
      .limit(5)
      .returns<InstructorTrackingBookingRow[]>();

    if (endedBookingsError) {
      console.warn("[dashboard] instructor progress reminder lookup failed", {
        userId: user.id,
        message: endedBookingsError.message
      });
    }

    const { data: endedReferenceBookings, error: endedReferenceBookingsError } = await readClient
      .from("lesson_booking_records")
      .select("booking_reference,learner_id,learner_email,starts_at,ends_at,status")
      .eq("instructor_id", user.id)
      .not("status", "ilike", "%cancel%")
      .lte("ends_at", nowIso)
      .gte("ends_at", lessonReminderWindowStart)
      .order("ends_at", { ascending: false })
      .limit(5)
      .returns<InstructorProgressReferenceRow[]>();

    if (endedReferenceBookingsError) {
      console.warn("[dashboard] instructor progress reference reminder lookup failed", {
        userId: user.id,
        message: endedReferenceBookingsError.message
      });
    }

    const progressReminderCandidates = [
      ...((endedBookings ?? []).map((booking) => ({
        bookingReference: booking.id,
        learnerId: booking.learner_id,
        learnerEmail: null as string | null,
        startsAt: booking.starts_at,
        endsAt: booking.ends_at
      }))),
      ...((endedReferenceBookings ?? [])
        .filter((booking) => booking.learner_id && booking.starts_at && booking.ends_at)
        .map((booking) => ({
          bookingReference: booking.booking_reference,
          learnerId: booking.learner_id as string,
          learnerEmail: booking.learner_email,
          startsAt: booking.starts_at as string,
          endsAt: booking.ends_at as string
        })))
    ].sort((a, b) => new Date(b.endsAt).getTime() - new Date(a.endsAt).getTime());

    const checkedReminderReferences = new Set<string>();

    for (const endedBooking of progressReminderCandidates) {
      if (checkedReminderReferences.has(endedBooking.bookingReference)) {
        continue;
      }
      checkedReminderReferences.add(endedBooking.bookingReference);

      const { data: existingProgressRecord, error: existingProgressError } = await readClient
        .from("lesson_progress_records")
        .select("id")
        .eq("instructor_id", user.id)
        .eq("learner_id", endedBooking.learnerId)
        .eq("lesson_reference", endedBooking.bookingReference)
        .maybeSingle();

      if (existingProgressError) {
        console.warn("[dashboard] progress reminder record check failed", {
          bookingId: endedBooking.bookingReference,
          message: existingProgressError.message
        });
        continue;
      }

      if (existingProgressRecord) {
        continue;
      }

      const { data: learnerForReminder, error: learnerForReminderError } = await readClient
        .from("profiles")
        .select("full_name,email")
        .eq("id", endedBooking.learnerId)
        .maybeSingle();

      if (learnerForReminderError) {
        console.warn("[dashboard] learner reminder profile lookup failed", {
          bookingId: endedBooking.bookingReference,
          message: learnerForReminderError.message
        });
      }

      const learnerProfileForReminder = learnerForReminder as { full_name?: string | null; email?: string | null } | null;
      instructorProgressReminderLesson = {
        bookingReference: endedBooking.bookingReference,
        learnerName: learnerProfileForReminder?.full_name || learnerProfileForReminder?.email || endedBooking.learnerEmail || "Learner",
        startsAt: endedBooking.startsAt,
        endsAt: endedBooking.endsAt
      };
      break;
    }
  }

  if (!isAdmin && !isInstructor && !hasLearnerSetup && !hasRecentLearnerVerification) {
    console.warn("[dashboard] learner setup incomplete", {
      userId: user.id,
      hasLearnerProfile: Boolean(learnerProfile),
      hasDateOfBirth: Boolean(learnerProfile?.date_of_birth),
      hasProvisionalLicenceConfirmation: Boolean(learnerProfile?.provisional_licence_confirmed_at),
      hasTermsAcceptance: Boolean(learnerProfile?.terms_accepted_at),
      learnerProfileReadError: learnerProfileResult.error?.message ?? null
    });
    redirect("/auth/verify?role=learner&message=Complete learner setup before opening your learner account. Add your date of birth and verify your provisional driving licence.");
  }

  if (!isAdmin && !isInstructor && !hasLearnerSetup && hasRecentLearnerVerification) {
    console.warn("[dashboard] learner setup read incomplete but recent verification token is valid", {
      userId: user.id,
      hasLearnerProfile: Boolean(learnerProfile),
      hasDateOfBirth: Boolean(learnerProfile?.date_of_birth),
      hasProvisionalLicenceConfirmation: Boolean(learnerProfile?.provisional_licence_confirmed_at),
      hasTermsAcceptance: Boolean(learnerProfile?.terms_accepted_at),
      learnerProfileReadError: learnerProfileResult.error?.message ?? null
    });
  }

  return (
    <main className="min-h-screen bg-white text-black">
      <LoginActivityReporter shouldRecord={shouldRecordClientLoginActivity} />
      <header className="lda-universal-topbar border-b border-zinc-800 bg-ink text-white">
        <div className="lda-universal-topbar-inner flex w-full items-center justify-between gap-3 px-3 sm:gap-4 sm:px-6 lg:px-10">
          <div className="flex min-w-0 items-center gap-3 sm:gap-5">
            <Brand size="home" />
            <div data-lda-account-compact="true" className={isAdmin || (isInstructor && !hasApprovedInstructorAccess) ? "hidden min-w-0 max-w-[34vw] min-[390px]:block sm:max-w-[46vw] lg:max-w-none" : "hidden min-w-0 lg:block"}>
              <div className="truncate text-xs font-bold text-red-200 sm:text-sm">{accountTypeLabel}</div>
              <div className="mt-1 truncate text-base font-black sm:text-xl">{displayName}</div>
              <div className="mt-1 hidden flex-wrap items-center gap-3 sm:flex">
                {isAdmin ? (
                  <>
                    <span className="rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1 text-xs font-black uppercase text-red-100">
                      {adminPreviewInstructorInProgress ? "in progress view" : adminPreviewRole ? `${adminPreviewRole} view` : "Admin access"}
                    </span>
                    <Link href="/admin-preview" className="rounded-full border border-red-500/40 bg-transparent px-3 py-1 text-xs font-black uppercase text-red-100 hover:ring-2 hover:ring-brand">
                      Switch preview
                    </Link>
                    <Link href="/admin" className="rounded-full border border-red-500/40 bg-transparent px-3 py-1 text-xs font-black uppercase text-red-100 hover:ring-2 hover:ring-brand">
                      Admin dashboard
                    </Link>
                  </>
                ) : isInstructor ? (
                  <>
                    {hasApprovedInstructorAccess ? (
                      <>
                        <Link href="/instructor-plus?from=dashboard" className="rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1 text-xs font-black uppercase text-red-100 hover:ring-2 hover:ring-brand">
                          {instructorPackageLabel}
                        </Link>
                        {instructorUpgrade ? (
                          <Link href={instructorUpgrade.href} className="rounded-full border border-red-500/40 bg-transparent px-3 py-1 text-xs font-black uppercase text-red-100 hover:ring-2 hover:ring-brand">
                            {instructorUpgrade.label}
                          </Link>
                        ) : null}
                      </>
                    ) : (
                      <Link href="/instructor-verification?from=dashboard" className="rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1 text-xs font-black uppercase text-red-100 hover:ring-2 hover:ring-brand">
                        In progress
                      </Link>
                    )}
                  </>
                ) : (
                  <>
                    <Link href="/learner-plus?from=dashboard" className="rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1 text-xs font-black uppercase text-red-100 hover:ring-2 hover:ring-brand">
                      {learnerPackageLabel}
                    </Link>
                    {learnerUpgrade ? (
                      <Link href={learnerUpgrade.href} className="rounded-full border border-red-500/40 bg-transparent px-3 py-1 text-xs font-black uppercase text-red-100 hover:ring-2 hover:ring-brand">
                        {learnerUpgrade.label}
                      </Link>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="ml-auto flex min-w-0 shrink-0 items-center gap-2 sm:gap-3">
            {isInstructor && !isAdmin && hasApprovedInstructorAccess ? (
              <div className="flex min-w-0 max-w-[36vw] flex-col items-end gap-0.5 leading-tight lg:hidden">
                <span className="max-w-full truncate text-[10px] font-bold text-red-200">Instructor account</span>
                <span className="max-w-full truncate text-sm font-black">{displayName.trim().split(/\s+/)[0]}</span>
                <Link href="/instructor-plus?from=dashboard" className="inline-flex max-w-full items-center truncate rounded-full border border-red-500/40 bg-red-500/10 px-2 py-1 text-[10px] font-black uppercase text-red-100 focus-ring" aria-label={`Manage subscription: ${instructorPackageLabel}`}>
                  <span className="truncate">{instructorPackageLabel}</span>
                </Link>
              </div>
            ) : null}
            {!isInstructor && !isAdmin ? (
              <div className="flex min-w-0 max-w-[36vw] flex-col items-end gap-0.5 leading-tight lg:hidden">
                <span className="max-w-full truncate text-[10px] font-bold text-red-200">Learner account</span>
                <span className="max-w-full truncate text-sm font-black">{displayName.trim().split(/\s+/)[0]}</span>
                <Link href="/learner-plus?from=dashboard" className="inline-flex max-w-full items-center truncate rounded-full border border-red-500/40 bg-red-500/10 px-2 py-1 text-[10px] font-black uppercase text-red-100 focus-ring" aria-label={`Manage subscription: ${learnerPackageLabel}`}>
                  <span className="truncate">{learnerPackageLabel}</span>
                </Link>
              </div>
            ) : null}
            {!isInstructor && isLearnerDrivingLessonsView ? (
              <Link href={learnerDrivingLessonsBack.href} className="inline-flex max-w-[48vw] items-center gap-2 truncate text-sm font-black text-white hover:text-brand sm:max-w-none">
                <ArrowLeft size={17} /> {learnerDrivingLessonsBack.label}
              </Link>
            ) : (
              <>
                <div className={isAdmin || (isInstructor && !hasApprovedInstructorAccess) ? "" : "hidden lg:block"}><FastSignOutButton /></div>
                {isInstructor ? (
                  hasApprovedInstructorAccess ? <InstructorDashboardMenu hideAccountLink={isAdmin} accountName={displayName} membershipLabel={instructorPackageLabel} upgrade={instructorUpgrade} /> : null
                ) : (
                  <LearnerDashboardMenu hideAccountLink={isAdmin} accountName={displayName} accountLabel={accountTypeLabel} membershipLabel={learnerPackageLabel} upgrade={learnerUpgrade} />
                )}
              </>
            )}
          </div>
        </div>
      </header>

      {isInstructor ? (
        hasApprovedInstructorAccess ? (
          <>
          <InstructorSetupWelcomeModal show={shouldShowInstructorSetupPrompt} />
          {shouldShowInstructorSetupGuide ? (
            <InstructorSetupGuide
              checklist={instructorSetupReadiness.checklist}
              completeCount={instructorSetupReadiness.completeCount}
              totalCount={instructorSetupReadiness.totalCount}
            />
          ) : null}
          <InstructorLessonProgressReminder lesson={instructorProgressReminderLesson} />
          <section className="bg-black text-white">
            <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-red-500/60 bg-red-500/15 px-4 py-2 text-sm font-black text-red-100">
                <Route size={17} /> LDA instructor dashboard
              </div>
              <h1 className="mt-2 max-w-4xl text-4xl font-black tracking-normal sm:text-6xl">
                Run every part of your teaching day in one place.
              </h1>
              <p className="mt-5 max-w-3xl text-lg font-semibold leading-8 text-zinc-300">
                Your diary, pupil records, availability, lesson evidence, vehicle compliance, performance, and payouts now sit in one instructor workspace.
              </p>
            </div>
          </section>

          <InstructorSetupStatusBanner readiness={instructorSetupReadiness} />
          {!isAdmin && instructorSetupReadiness.complete ? (
            <InstructorStartWorkPanel initiallyLive={instructorIsWorking} />
          ) : null}
          <InstructorOnDemandRequests
            requests={instructorOnDemandRequests}
            autoAcceptEnabled={Boolean(instructorProfile?.auto_accept_bookings)}
          />

          <InstructorSmartMatchProfileSection standardRatePence={instructorProfile?.hourly_rate_pence ?? null} />

          <InstructorDashboardSections />

          <InstructorDashboard
            trackingLesson={instructorRouteLesson}
            autoStartRoute={autoStartInstructorRoute}
            initiallyWorking={instructorIsWorking}
          />
          </>
        ) : (
        <PendingInstructorDashboard
          displayName={displayName}
          verificationStatus={previewVerificationStatus}
          documentSummary={instructorApplicationSummary}
        />
        )
      ) : (
        <LearnerDashboardJourney
          showBookingDashboard={isLearnerDrivingLessonsView}
          currentLearnerPackageId={learnerPackageId}
          bookingDashboard={
            <LearnerBookingDashboard
              learnerEmail={profile?.email ?? user.email}
              learnerPhone={profile?.phone}
              provisionalLicenceConfirmed={Boolean(learnerProfile?.provisional_licence_confirmed_at)}
              initialInstructors={liveLearnerInstructors}
              initialAvailabilityDate={smartMatchAvailabilityDate}
              initialSelectedInstructorId={smartMatchSelectedInstructorId}
              initialSelectedInstructorName={smartMatchSelectedInstructorName}
              initialPickup={smartMatchPickup}
              initialTransmission={smartMatchTransmission}
              initialBookingConfirmation={initialBookingConfirmation}
            />
          }
        />
      )}
    </main>
  );
}

function PendingInstructorDashboard({
  displayName,
  verificationStatus,
  documentSummary
}: {
  displayName: string;
  verificationStatus: InstructorVerificationDisplay;
  documentSummary: ReturnType<typeof getInstructorApplicationDocumentSummary>;
}) {
  const missingPreview = documentSummary.missingRequiredLabels.slice(0, 4);
  const remainingMissingCount = documentSummary.missingRequiredLabels.length - missingPreview.length;

  return (
    <>
      <section className="bg-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-red-500/60 bg-red-500/15 px-4 py-2 text-sm font-black text-red-100">
            <ShieldCheck size={17} /> Instructor application
          </div>
          <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-normal sm:text-6xl">
            Your instructor profile is in progress.
          </h1>
          <p className="mt-5 max-w-3xl text-lg font-semibold leading-8 text-zinc-300">
            {displayName} is signed in and linked to this application. Instructor bookings, calendar visibility, availability, finance, and learner-facing search stay locked until LDA approves the account.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/instructor-verification?from=dashboard" className="lda-pill lda-pill-sm">
              Check status <ArrowRight size={16} />
            </Link>
            <Link href="/" className="inline-flex min-h-11 items-center justify-center rounded-full border border-zinc-700 bg-zinc-950 px-5 py-2 text-sm font-black text-white hover:border-red-500">
              Homepage
            </Link>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <article className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
          <FileCheck2 className="text-brand" />
          <h2 className="mt-4 text-2xl font-black">Current status</h2>
          <p className="mt-2 text-base font-semibold leading-7 text-zinc-600">
            Your instructor application is currently marked as <span className="font-black text-black">{verificationStatus.label}</span>. LDA will unlock the full instructor workspace once all required documents are complete and the account is approved.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            {[
              ["Required uploaded", `${documentSummary.uploadedRequiredCount}/${documentSummary.totalRequired}`],
              ["Approved", String(documentSummary.approvedRequiredCount)],
              ["Awaiting review", String(documentSummary.pendingRequiredCount)],
              ["Needs action", String(documentSummary.missingRequiredLabels.length + documentSummary.rejectedRequiredCount)]
            ].map(([label, value]) => (
              <div key={label} className="rounded border border-zinc-200 bg-zinc-50 p-3">
                <div className="text-2xl font-black">{value}</div>
                <div className="mt-1 text-xs font-black uppercase text-zinc-500">{label}</div>
              </div>
            ))}
          </div>
          {missingPreview.length ? (
            <div className="mt-5 rounded border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-950">
              <div className="font-black uppercase">Still needed</div>
              <div className="mt-2">
                {missingPreview.join(", ")}
                {remainingMissingCount > 0 ? `, plus ${remainingMissingCount} more` : ""}
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold leading-6 text-emerald-950">
              All required evidence has been uploaded. LDA admin review must still approve the application before instructor tools and learner visibility unlock.
            </div>
          )}
          <Link href="/instructor-verification?from=dashboard" className="lda-pill lda-pill-sm mt-5">
            View verification details <ArrowRight size={16} />
          </Link>
        </article>
      </section>
      <InstructorDashboardSections locked />
    </>
  );
}

function InstructorSetupStatusBanner({
  readiness
}: {
  readiness: ReturnType<typeof getInstructorSetupReadiness>;
}) {
  if (readiness.complete) {
    return null;
  }

  const nextItems = readiness.checklist.filter((item) => !item.complete).slice(0, 3);

  return (
    <section className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
      <article className="rounded border border-amber-200 bg-amber-50 p-5 text-amber-950 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 text-sm font-black uppercase">
              <CircleAlert size={17} /> Setup required before learner search goes live
            </div>
            <h2 className="mt-2 text-2xl font-black">Complete your approved instructor setup.</h2>
            <p className="mt-2 max-w-3xl text-sm font-bold leading-6">
              Your instructor account is approved, but LDA will keep learner-facing availability paused until finance, tax, payment, pricing, and profile setup are complete.
            </p>
          </div>
          <Link href="/instructor-setup?from=dashboard" className="lda-pill lda-pill-sm shrink-0">
            Set up account <ArrowRight size={16} />
          </Link>
        </div>
        <div className="mt-5 grid gap-2 md:grid-cols-3">
          {nextItems.map((item) => (
            <div key={item.key} className="rounded border border-amber-200 bg-white/70 p-3">
              <div className="flex items-center gap-2 text-sm font-black">
                {item.complete ? <CheckCircle2 size={16} className="text-emerald-700" /> : <CircleAlert size={16} className="text-amber-700" />}
                {item.label}
              </div>
              <p className="mt-1 text-xs font-bold leading-5">{item.detail}</p>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}

function InstructorDashboardSections({ locked = false }: { locked?: boolean }) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {instructorDashboardSections.map((section) => (
          <article key={section.title} className={`flex min-h-[230px] flex-col rounded bg-zinc-100 p-5 text-black shadow-sm transition sm:p-6 ${locked ? "opacity-75" : "hover:bg-zinc-200"}`}>
            <h2 className="text-2xl font-black">{section.title}</h2>
            <p className="mt-4 max-w-sm text-base leading-7 text-zinc-800">{section.bio}</p>
            {locked ? (
              <span className="mt-auto inline-flex min-h-10 items-center justify-center rounded-full border border-zinc-300 bg-white px-5 py-2 text-sm font-black text-zinc-600">
                Locked until approved
              </span>
            ) : (
              <Link href={section.href} className="lda-pill lda-pill-sm mt-auto self-start">
                View
              </Link>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function InstructorDashboard({
  trackingLesson,
  autoStartRoute,
  initiallyWorking
}: {
  trackingLesson: InstructorRouteLesson | null;
  autoStartRoute: boolean;
  initiallyWorking: boolean;
}) {
  return (
    <section id="instructor-live-tracking" className="mx-auto max-w-7xl scroll-mt-28 px-4 pb-10 sm:px-6 lg:px-8">
      <InstructorLessonPingMap
        lesson={trackingLesson}
        autoStartRoute={autoStartRoute}
        initiallyWorking={initiallyWorking}
      />
    </section>
  );
}

