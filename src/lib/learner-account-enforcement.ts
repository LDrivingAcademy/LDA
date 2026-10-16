import { sendAdminNoticeEmail } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";

type EnforcementAction = "warning" | "suspension" | "revocation";

type EnforcementStep = {
  key: string;
  threshold: number;
  action: EnforcementAction;
  title: string;
  emailSubject: string;
  banDuration?: string;
  body: (count: number) => string;
};

type LessonPatternRecord = {
  booking_reference: string | null;
  status: string | null;
  payment_status: string | null;
  cancellation_actor: string | null;
  cancelled_at: string | null;
  created_at: string | null;
};

const enforcementWindowDays = 90;

const enforcementSteps: EnforcementStep[] = [
  {
    key: "warning_1",
    threshold: 3,
    action: "warning",
    title: "First LDA cancellation and refund warning",
    emailSubject: "Important update about your LDA account",
    body: (count) =>
      `Following a review of recent account activity, your LDA learner account has recorded ${count} learner cancellation or refund-linked event${count === 1 ? "" : "s"} within ${enforcementWindowDays} days. Please only book lessons you intend to take, and use cancellation or refund requests only where genuinely needed. Continued activity outside LDA platform standards may result in a final warning or temporary booking restrictions.`
  },
  {
    key: "warning_2",
    threshold: 5,
    action: "warning",
    title: "Final LDA cancellation and refund warning",
    emailSubject: "Final update about your LDA account",
    body: (count) =>
      `Following a further review, your LDA learner account has recorded ${count} learner cancellation or refund-linked event${count === 1 ? "" : "s"} within ${enforcementWindowDays} days. This is a final account warning. Continued repeated cancellations, refund requests, or refund-linked activity may lead to temporary suspension of learner booking access.`
  },
  {
    key: "suspend_7_days",
    threshold: 7,
    action: "suspension",
    title: "Your LDA learner account has been suspended for 7 days",
    emailSubject: "Your LDA learner account has been suspended",
    banDuration: "168h",
    body: (count) =>
      `Your LDA learner account has recorded ${count} learner cancellation or refund-linked event${count === 1 ? "" : "s"} within ${enforcementWindowDays} days. Learner booking access has been suspended for 7 days to protect instructor availability, payment integrity, and platform reliability.`
  },
  {
    key: "suspend_2_months",
    threshold: 9,
    action: "suspension",
    title: "Your LDA learner account has been suspended for 2 months",
    emailSubject: "Your LDA learner account has been suspended",
    banDuration: "1460h",
    body: (count) =>
      `Your LDA learner account has recorded ${count} learner cancellation or refund-linked event${count === 1 ? "" : "s"} within ${enforcementWindowDays} days after previous warnings. Learner booking access has been suspended for 2 months.`
  },
  {
    key: "suspend_1_year",
    threshold: 12,
    action: "suspension",
    title: "Your LDA learner account has been suspended for 1 year",
    emailSubject: "Your LDA learner account has been suspended",
    banDuration: "8760h",
    body: (count) =>
      `Your LDA learner account has recorded ${count} learner cancellation or refund-linked event${count === 1 ? "" : "s"} within ${enforcementWindowDays} days. Learner booking access has been suspended for 1 year because previous warnings and restrictions have not corrected the repeated activity pattern.`
  },
  {
    key: "revoke_account",
    threshold: 15,
    action: "revocation",
    title: "Your LDA learner account access has been revoked",
    emailSubject: "Your LDA learner account access has been revoked",
    banDuration: "876000h",
    body: (count) =>
      `Your LDA learner account has recorded ${count} learner cancellation or refund-linked event${count === 1 ? "" : "s"} within ${enforcementWindowDays} days after repeated warnings and suspensions. Learner booking access has been revoked. Contact LDA support if you believe this decision requires manual review.`
  }
];

function isLearnerCancellationOrRefund(record: LessonPatternRecord) {
  const actor = String(record.cancellation_actor ?? "").toLowerCase();
  if (actor === "instructor" || actor === "admin") {
    return false;
  }

  const status = String(record.status ?? "").toLowerCase();
  const paymentStatus = String(record.payment_status ?? "").toLowerCase();

  return (
    actor === "learner" ||
    status.includes("cancelled_by_learner") ||
    status.includes("refund") ||
    paymentStatus.includes("refund")
  );
}

function isInsideWindow(record: LessonPatternRecord, cutoffMs: number) {
  const eventTime = new Date(record.cancelled_at ?? record.created_at ?? "").getTime();
  return Number.isFinite(eventTime) && eventTime >= cutoffMs;
}

export async function enforceLearnerCancellationPolicy(learnerId?: string | null, bookingReference?: string | null) {
  if (!learnerId) {
    return null;
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return null;
  }

  const cutoffMs = Date.now() - enforcementWindowDays * 24 * 60 * 60 * 1000;
  const { data: records, error: recordsError } = await supabase
    .from("lesson_booking_records")
    .select("booking_reference,status,payment_status,cancellation_actor,cancelled_at,created_at")
    .eq("learner_id", learnerId)
    .order("created_at", { ascending: false })
    .limit(500);

  if (recordsError) {
    console.error("[learner-enforcement] could not read learner records", recordsError);
    return null;
  }

  const patternCount = ((records ?? []) as LessonPatternRecord[]).filter((record) => isInsideWindow(record, cutoffMs) && isLearnerCancellationOrRefund(record)).length;
  const dueSteps = enforcementSteps.filter((step) => patternCount >= step.threshold);

  if (!dueSteps.length) {
    return { action: "none", patternCount };
  }

  const { data: existingEvents, error: existingError } = await supabase
    .from("learner_account_enforcement_events")
    .select("enforcement_key")
    .eq("learner_id", learnerId)
    .in("enforcement_key", dueSteps.map((step) => step.key));

  if (existingError) {
    console.error("[learner-enforcement] could not read existing events", existingError);
    return null;
  }

  const issuedKeys = new Set((existingEvents ?? []).map((event) => event.enforcement_key));
  const nextStep = dueSteps.find((step) => !issuedKeys.has(step.key));

  if (!nextStep) {
    return { action: "already-issued", patternCount };
  }

  const body = nextStep.body(patternCount);
  const now = new Date().toISOString();
  const { data: profile } = await supabase.from("profiles").select("full_name,email").eq("id", learnerId).maybeSingle();

  const { error: eventError } = await supabase.from("learner_account_enforcement_events").insert({
    learner_id: learnerId,
    booking_reference: bookingReference ?? null,
    enforcement_key: nextStep.key,
    enforcement_action: nextStep.action,
    event_count: patternCount,
    window_days: enforcementWindowDays,
    reason: body,
    ban_duration: nextStep.banDuration ?? null,
    created_at: now
  });

  if (eventError) {
    console.error("[learner-enforcement] could not create enforcement event", eventError);
    return null;
  }

  await supabase.from("notifications").insert({
    user_id: learnerId,
    notification_type: "learner_policy_enforcement",
    title: nextStep.title,
    body
  });

  if (nextStep.banDuration) {
    await supabase.auth.admin.updateUserById(learnerId, {
      ban_duration: nextStep.banDuration
    } as { ban_duration: string });
  }

  if (profile?.email) {
    try {
      await sendAdminNoticeEmail({
        to: profile.email,
        subject: nextStep.emailSubject,
        title: nextStep.title,
        body: `${body}\n\nIf you believe this was caused by an exceptional circumstance, reply to this email so LDA support can review your account.`
      });
    } catch (error) {
      console.error("[learner-enforcement] warning email failed", error);
    }
  }

  return {
    action: nextStep.action,
    key: nextStep.key,
    patternCount
  };
}

export function getLearnerCancellationPolicySteps() {
  return enforcementSteps.map((step) => ({
    key: step.key,
    threshold: step.threshold,
    action: step.action,
    title: step.title
  }));
}
