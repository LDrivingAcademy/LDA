import type { InstructorFinanceProfile } from "@/lib/instructor-finance-profile";
import { shouldBypassInstructorAvailabilityPauseForTest } from "@/lib/test-instructor-visibility";

export const instructorSetupPauseReason =
  "Instructor account approved. Complete finance, tax, payment, pricing, and profile setup before learner-facing availability goes live.";

type InstructorSetupProfile = {
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
};

export type InstructorSetupChecklistItem = {
  key: string;
  label: string;
  detail: string;
  complete: boolean;
  href: string;
};

function hasText(value?: string | null) {
  return Boolean(value?.trim());
}

function hasValidTransmission(value?: string | null) {
  return value === "automatic" || value === "manual";
}

function hasAreas(value?: string[] | null) {
  return Boolean(value?.some((area) => area.trim()));
}

export function getInstructorSetupChecklist(
  profile: InstructorSetupProfile | null | undefined,
  finance: InstructorFinanceProfile | null | undefined
): InstructorSetupChecklistItem[] {
  return [
    {
      key: "profile",
      label: "Profile and learner-facing details",
      detail: "Add your base postcode, covered areas, transmission, and lesson vehicle.",
      complete:
        hasText(profile?.base_postcode) &&
        hasAreas(profile?.areas_covered) &&
        hasValidTransmission(profile?.transmission) &&
        hasText(profile?.car_make) &&
        hasText(profile?.car_model),
      href: "/instructor-setup#profile"
    },
    {
      key: "pricing",
      label: "Payment structure",
      detail: "Set the hourly price learners will see before checkout.",
      complete: typeof profile?.hourly_rate_pence === "number" && profile.hourly_rate_pence > 0,
      href: "/instructor-setup#profile"
    },
    {
      key: "stripe",
      label: "Stripe payout connection",
      detail: "Connect the instructor Stripe account used for payment routing and payouts.",
      complete: hasText(profile?.stripe_account_id),
      href: "/instructor-setup/finance"
    },
    {
      key: "payout",
      label: "Payout bank account",
      detail: "Save verified payout details so LDA can pay cleared lesson earnings.",
      complete: Boolean(finance?.payout?.savedAt),
      href: "/instructor-setup/finance"
    },
    {
      key: "tax",
      label: "Tax profile",
      detail: "Save UTR and National Insurance details for finance records and review.",
      complete: Boolean(finance?.tax?.savedAt),
      href: "/instructor-setup/tax"
    }
  ];
}

export function getInstructorSetupReadiness(
  profile: InstructorSetupProfile | null | undefined,
  finance: InstructorFinanceProfile | null | undefined
) {
  const checklist = getInstructorSetupChecklist(profile, finance);
  const completeCount = checklist.filter((item) => item.complete).length;
  const complete = checklist.length > 0 && completeCount === checklist.length;

  return {
    checklist,
    completeCount,
    totalCount: checklist.length,
    complete
  };
}

export async function refreshInstructorSetupAvailability({
  db,
  userId,
  profile,
  finance
}: {
  db: { from: (table: string) => any };
  userId: string;
  profile: InstructorSetupProfile | null | undefined;
  finance: InstructorFinanceProfile | null | undefined;
}) {
  if (profile?.verification_status !== "approved") {
    return;
  }

  const { data: accountProfile } = await db
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle();
  const currentReason = profile.learner_availability_pause_reason ?? "";

  if (shouldBypassInstructorAvailabilityPauseForTest(accountProfile?.email)) {
    if (profile.learner_availability_paused && currentReason === instructorSetupPauseReason) {
      await db.from("instructor_profiles").update({
        learner_availability_paused: false,
        learner_availability_pause_reason: null
      }).eq("user_id", userId);
    }
    return;
  }

  const readiness = getInstructorSetupReadiness(profile, finance);

  if (!readiness.complete) {
    if (!profile.learner_availability_paused || currentReason !== instructorSetupPauseReason) {
      await db.from("instructor_profiles").update({
        learner_availability_paused: true,
        learner_availability_pause_reason: instructorSetupPauseReason
      }).eq("user_id", userId);
    }
    return;
  }

  if (profile.learner_availability_paused && currentReason === instructorSetupPauseReason) {
    await db.from("instructor_profiles").update({
      learner_availability_paused: false,
      learner_availability_pause_reason: null
    }).eq("user_id", userId);
  }
}
