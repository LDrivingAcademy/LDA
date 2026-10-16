"use client";

import { TechnicalErrorPage } from "@/components/technical-error-page";

export default function LearnerDashboardError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <TechnicalErrorPage error={error} reset={reset} source="learner_dashboard" />;
}
