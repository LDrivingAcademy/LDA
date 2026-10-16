import { isLdaQaBypassInstructorEmail, isLdaTestInstructorEmail } from "@/lib/lda-demo-accounts";

export { isLdaTestInstructorEmail };

export function shouldBypassInstructorAvailabilityPauseForTest(email?: string | null) {
  return isLdaQaBypassInstructorEmail(email);
}
