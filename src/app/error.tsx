"use client";

import { TechnicalErrorPage } from "@/components/technical-error-page";

export default function AppError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <TechnicalErrorPage error={error} reset={reset} source="app_error_boundary" />;
}
