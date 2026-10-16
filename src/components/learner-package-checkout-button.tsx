"use client";

import { useState } from "react";
import { CreditCard } from "lucide-react";
import { rememberInternalNavigation } from "@/components/navigation-history";
import { type BillingInterval, type LearnerPackageId } from "@/lib/learner-packages";

type LearnerPackageCheckoutButtonProps = {
  packageId: LearnerPackageId;
  currentPackageId?: LearnerPackageId;
  billingInterval: BillingInterval;
  label: string;
  disabled?: boolean;
  compact?: boolean;
  featureKey?: string;
  returnPath?: string;
};

export function LearnerPackageCheckoutButton({
  packageId,
  billingInterval,
  label,
  disabled = false,
  compact = false,
  featureKey,
  returnPath
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
          billingInterval,
          featureKey,
          returnPath
        })
      });
      const payload = (await response.json()) as { checkoutUrl?: string; error?: string };

      if (response.status === 401 || response.status === 403) {
        const next = `${window.location.pathname}${window.location.search}`;
        const loginHref = `/auth/login?role=learner&next=${encodeURIComponent(next)}&message=${encodeURIComponent("Sign in to choose your learner package.")}`;
        rememberInternalNavigation(loginHref);
        window.location.assign(loginHref);
        return;
      }

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
        className={`lda-pill ${
          compact ? "lda-pill-sm" : ""
        } min-h-11 w-full justify-center whitespace-normal text-center leading-5 disabled:cursor-not-allowed disabled:opacity-60`}
        type="button"
        onClick={() => void startCheckout()}
        disabled={disabled || isLoading}
      >
        <CreditCard size={compact ? 16 : 18} />
        {isLoading ? "Opening Stripe..." : label}
      </button>
      {error ? <p className="mt-3 text-sm font-bold text-brand">{error}</p> : null}
    </div>
  );
}
