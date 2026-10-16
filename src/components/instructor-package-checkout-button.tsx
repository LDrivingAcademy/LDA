"use client";

import { useState } from "react";
import { CreditCard } from "lucide-react";
import { rememberInternalNavigation } from "@/components/navigation-history";

import { type BillingInterval, type InstructorPackageId } from "@/lib/instructor-packages";

type InstructorPackageCheckoutButtonProps = {
  packageId: InstructorPackageId;
  currentPackageId?: InstructorPackageId;
  billingInterval: BillingInterval;
  label: string;
  disabled?: boolean;
  compact?: boolean;
  featureKey?: string;
  returnPath?: string;
};

export function InstructorPackageCheckoutButton({
  packageId,
  billingInterval,
  label,
  disabled = false,
  compact = false,
  featureKey,
  returnPath,
}: InstructorPackageCheckoutButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function startCheckout() {
    if (disabled || isLoading) {
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/instructor-packages/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId, billingInterval, featureKey, returnPath }),
      });
      const payload = (await response.json()) as { checkoutUrl?: string; error?: string };

      if (response.status === 401 || response.status === 403) {
        const next = `${window.location.pathname}${window.location.search}`;
        const loginHref = `/auth/login?role=instructor&next=${encodeURIComponent(next)}&message=${encodeURIComponent("Sign in to choose your instructor package.")}`;
        rememberInternalNavigation(loginHref);
        window.location.assign(loginHref);
        return;
      }

      if (!response.ok || !payload.checkoutUrl) {
        throw new Error(payload.error ?? "Checkout could not open.");
      }

      window.location.assign(payload.checkoutUrl);
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Checkout could not open.");
      setIsLoading(false);
    }
  }

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      <button
        type="button"
        onClick={() => void startCheckout()}
        disabled={disabled || isLoading}
        className={[
          "inline-flex w-full items-center justify-center gap-3 rounded-full bg-gradient-to-b from-red-500 to-brand px-6 font-black text-white shadow-[0_16px_36px_rgba(237,0,15,0.28)] ring-2 ring-red-300 transition hover:-translate-y-0.5 hover:from-red-400 hover:to-red-700 disabled:cursor-not-allowed disabled:from-red-300 disabled:to-red-300 disabled:text-white/80",
          compact ? "py-3 text-sm" : "py-4 text-base",
        ].join(" ")}
      >
        <CreditCard size={18} />
        {isLoading ? "Opening checkout..." : label}
      </button>
      {error ? <p className="text-sm font-bold text-brand">{error}</p> : null}
    </div>
  );
}
