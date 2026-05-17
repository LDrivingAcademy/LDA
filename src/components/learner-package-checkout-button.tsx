"use client";

import { useState } from "react";
import { CreditCard } from "lucide-react";
import type { BillingInterval, LearnerPackageId } from "@/lib/learner-packages";

type LearnerPackageCheckoutButtonProps = {
  packageId: LearnerPackageId;
  billingInterval: BillingInterval;
  label: string;
  disabled?: boolean;
  compact?: boolean;
};

export function LearnerPackageCheckoutButton({
  packageId,
  billingInterval,
  label,
  disabled = false,
  compact = false
}: LearnerPackageCheckoutButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function startCheckout() {
    if (disabled || isLoading) return;

    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/learner-packages/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          packageId,
          billingInterval
        })
      });
      const payload = (await response.json()) as { checkoutUrl?: string; error?: string };

      if (!response.ok || !payload.checkoutUrl) {
        throw new Error(payload.error ?? "Subscription checkout could not open.");
      }

      window.location.assign(payload.checkoutUrl);
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Subscription checkout could not open.");
      setIsLoading(false);
    }
  }

  return (
    <div>
      <button
        className={`lda-pill ${compact ? "lda-pill-sm" : ""} w-full justify-center disabled:cursor-not-allowed disabled:opacity-60`}
        type="button"
        onClick={startCheckout}
        disabled={disabled || isLoading}
      >
        <CreditCard size={compact ? 16 : 18} />
        {isLoading ? "Opening Stripe..." : label}
      </button>
      {error ? <p className="mt-3 text-sm font-bold text-brand">{error}</p> : null}
    </div>
  );
}
