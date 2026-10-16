import { isRuntimeStripeTestModeAllowed } from "@/lib/runtime-env";

export const LDA_TEST_INSTRUCTOR_EMAIL = "joshuamn1@hotmail.com";
export const LDA_TEST_LEARNER_EMAIL = "joshuamn1@icloud.com";

const LDA_TEST_ACCOUNT_EMAILS = new Set([
  LDA_TEST_INSTRUCTOR_EMAIL,
  LDA_TEST_LEARNER_EMAIL
]);

export function normaliseLdaAccountEmail(value?: string | null) {
  return String(value ?? "").trim().toLowerCase();
}

export function isLdaTestInstructorEmail(email?: string | null) {
  return normaliseLdaAccountEmail(email) === LDA_TEST_INSTRUCTOR_EMAIL;
}

export function isLdaTestLearnerEmail(email?: string | null) {
  return normaliseLdaAccountEmail(email) === LDA_TEST_LEARNER_EMAIL;
}

export function isLdaTestAccountEmail(email?: string | null) {
  return LDA_TEST_ACCOUNT_EMAILS.has(normaliseLdaAccountEmail(email));
}

export function isLdaQaBypassEnabled() {
  return isRuntimeStripeTestModeAllowed();
}

export function isLdaQaBypassInstructorEmail(email?: string | null) {
  return isLdaQaBypassEnabled() && isLdaTestInstructorEmail(email);
}

export function isLdaQaBypassLearnerEmail(email?: string | null) {
  return isLdaQaBypassEnabled() && isLdaTestLearnerEmail(email);
}

export function isLdaQaBypassAccountEmail(email?: string | null) {
  return isLdaQaBypassEnabled() && isLdaTestAccountEmail(email);
}

export function getLdaTestInstructorEmail() {
  return LDA_TEST_INSTRUCTOR_EMAIL;
}

export function getLdaTestLearnerEmail() {
  return LDA_TEST_LEARNER_EMAIL;
}

export function restrictToLdaTestInstructorEmail(email?: string | null) {
  return isLdaQaBypassInstructorEmail(email) ? LDA_TEST_INSTRUCTOR_EMAIL : "";
}
