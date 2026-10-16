import { isLdaTestAccountEmail, normaliseLdaAccountEmail } from "@/lib/lda-demo-accounts";

export function normaliseMetricEmail(value?: string | null) {
  return normaliseLdaAccountEmail(value);
}

export function isLdaDemoMetricEmail(value?: string | null) {
  return isLdaTestAccountEmail(value);
}

export function isTestStripeCheckoutSessionId(value?: string | null) {
  return String(value ?? "").trim().startsWith("cs_test_");
}

export function isLiveStripeCheckoutSessionId(value?: string | null) {
  return String(value ?? "").trim().startsWith("cs_live_");
}

export function isLiveAdminPaymentRow(row: { stripe_checkout_session_id?: string | null }) {
  return isLiveStripeCheckoutSessionId(row.stripe_checkout_session_id);
}

export function isDemoMetricRow(row: {
  stripe_checkout_session_id?: string | null;
  learner_email?: string | null;
  instructor_email?: string | null;
  email?: string | null;
}) {
  return (
    isTestStripeCheckoutSessionId(row.stripe_checkout_session_id) ||
    isLdaDemoMetricEmail(row.learner_email) ||
    isLdaDemoMetricEmail(row.instructor_email) ||
    isLdaDemoMetricEmail(row.email)
  );
}

export function isProductionLessonMetricRow(row: {
  stripe_checkout_session_id?: string | null;
  learner_email?: string | null;
  instructor_email?: string | null;
  email?: string | null;
}) {
  return isLiveStripeCheckoutSessionId(row.stripe_checkout_session_id) && !isDemoMetricRow(row);
}
