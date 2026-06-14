"use client";

import { useState } from "react";
import { CreditCard, ShieldCheck, X } from "lucide-react";
import { getCurrentLearnerPackage, type BillingInterval, type LearnerPackageId } from "@/lib/learner-packages";

type LearnerPackageCheckoutButtonProps = {
  packageId: LearnerPackageId;
  currentPackageId?: LearnerPackageId;
  billingInterval: BillingInterval;
  label: string;
  disabled?: boolean;
  compact?: boolean;
};

const basePackageId: LearnerPackageId = "learner";

function getChangeType(currentRank: number, targetRank: number) {
  if (targetRank > currentRank) return "Upgrade";
  if (targetRank < currentRank) return "Downgrade";
  return "Change";
}

export function LearnerPackageCheckoutButton({
  packageId,
  currentPackageId = basePackageId,
  billingInterval,
  label,
  disabled = false,
  compact = false
}: LearnerPackageCheckoutButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isConfirming, setIsConfirming] = useState(false);
  const currentPackage = getCurrentLearnerPackage(currentPackageId);
  const targetPackage = getCurrentLearnerPackage(packageId);
  const isExistingPaidPlanChange = currentPackageId !== basePackageId && packageId !== currentPackageId;
  const changeType = getChangeType(currentPackage.rank, targetPackage.rank);
  const intervalLabel = billingInterval === "yearly" ? "yearly" : "monthly";

  async function startCheckout(confirmedPlanChange = false) {
    if (disabled || isLoading) return;

    if (isExistingPaidPlanChange && !confirmedPlanChange) {
      setIsConfirming(true);
      return;
    }

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
          confirmedPlanChange
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
      {isConfirming ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-md border border-zinc-200 bg-white p-5 text-left text-black shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-black uppercase text-brand">
                  <ShieldCheck size={15} />
                  Confirm plan change
                </div>
                <h3 className="mt-4 text-2xl font-black tracking-normal">{changeType} learner package</h3>
              </div>
              <button
                type="button"
                aria-label="Close plan change confirmation"
                className="rounded-full border border-zinc-200 p-2 text-zinc-600 transition hover:border-brand hover:text-brand"
                onClick={() => setIsConfirming(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 grid gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm font-bold text-zinc-800">
              <div className="flex items-center justify-between gap-4">
                <span className="text-zinc-500">Current plan</span>
                <span className="text-right">{currentPackage.name}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-zinc-500">New plan</span>
                <span className="text-right">{targetPackage.name}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-zinc-500">Billing</span>
                <span className="text-right capitalize">{intervalLabel}</span>
              </div>
            </div>

            <p className="mt-5 text-sm font-bold leading-6 text-zinc-700">
              LDA will update the same Stripe subscription and use the saved billing account. Stripe may apply a prorated charge or credit depending on your billing cycle.
            </p>
            <p className="mt-3 text-sm font-bold leading-6 text-zinc-700">
              If Stripe needs a new payment method or extra bank confirmation, you will be sent through the secure Stripe payment screen.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                className="min-h-11 rounded-full border border-zinc-300 bg-white px-5 text-sm font-black text-zinc-900 transition hover:border-zinc-500"
                onClick={() => setIsConfirming(false)}
              >
                Keep current plan
              </button>
              <button
                type="button"
                className="lda-pill lda-pill-sm min-h-11 justify-center"
                disabled={isLoading}
                onClick={() => {
                  setIsConfirming(false);
                  void startCheckout(true);
                }}
              >
                {isLoading ? "Confirming..." : `Confirm ${changeType.toLowerCase()}`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
