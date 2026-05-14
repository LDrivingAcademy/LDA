"use client";

import { FormEvent, useMemo, useState } from "react";
import { Apple, BadgeCheck, CreditCard, Mail, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type InstantLessonBookingProps = {
  instructorName: string;
  instructorEmail: string;
  lessonSummary: string;
  amountPence: number;
};

type VerifyState =
  | { status: "idle"; message: string }
  | { status: "checking"; message: string }
  | { status: "valid"; message: string; mode: string }
  | { status: "invalid"; message: string };

function cleanLicenceNumber(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

const paymentOptions: { value: string; label: string; icon: LucideIcon }[] = [
  { value: "card", label: "Manual card entry", icon: CreditCard },
  { value: "apple_pay", label: "Apple Pay", icon: Apple },
  { value: "visa", label: "Visa", icon: CreditCard },
  { value: "mastercard", label: "Mastercard", icon: CreditCard },
  { value: "maestro", label: "Maestro", icon: CreditCard },
  { value: "paypal", label: "PayPal", icon: BadgeCheck }
];

export function InstantLessonBooking({
  instructorName,
  instructorEmail,
  lessonSummary,
  amountPence
}: InstantLessonBookingProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [licenceNumber, setLicenceNumber] = useState("");
  const [permission, setPermission] = useState(false);
  const [verifyState, setVerifyState] = useState<VerifyState>({
    status: "idle",
    message: "Enter the 16-character provisional licence number, then run the DVLA check."
  });
  const [checkoutState, setCheckoutState] = useState<"idle" | "loading" | "error">("idle");
  const [paymentPreference, setPaymentPreference] = useState("card");
  const [checkoutError, setCheckoutError] = useState("");

  const normalisedLicence = useMemo(() => cleanLicenceNumber(licenceNumber), [licenceNumber]);
  const canPay = Boolean(verifyState.status === "valid" && fullName.trim() && email.trim() && permission);

  async function verifyLicence() {
    setVerifyState({ status: "checking", message: "Checking licence details..." });

    const response = await fetch("/api/dvla/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        drivingLicenceNumber: normalisedLicence,
        permissionConfirmed: permission
      })
    });
    const result = await response.json();

    if (!response.ok || !result.valid) {
      setVerifyState({
        status: "invalid",
        message: result.message ?? "Licence could not be verified."
      });
      return;
    }

    setVerifyState({
      status: "valid",
      mode: result.mode ?? "demo",
      message: result.message ?? "Licence check passed."
    });
  }

  async function startCheckout(preferredPaymentOption = paymentPreference) {
    if (!canPay) {
      return;
    }

    setPaymentPreference(preferredPaymentOption);
    setCheckoutState("loading");
    setCheckoutError("");

    const response = await fetch("/api/instant-lessons/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName,
        learnerEmail: email,
        learnerPhone: phone,
        provisionalLicenceNumber: normalisedLicence,
        instructorName,
        instructorEmail,
        lessonSummary,
        amountPence,
        paymentPreference: preferredPaymentOption
      })
    });
    const result = await response.json();

    if (!response.ok || !result.checkoutUrl) {
      setCheckoutError(result.error || "Payment could not start. Please try again or contact support.");
      setCheckoutState("error");
      return;
    }

    window.location.href = result.checkoutUrl;
  }

  return (
    <form
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        startCheckout("card");
      }}
      className="rounded bg-white p-5 text-black shadow-2xl"
    >
      <div className="text-sm font-black uppercase text-brand">Instant guest booking</div>
      <h2 className="mt-2 text-3xl font-black tracking-normal">Book without creating an account.</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-600">
        Instant bookings are priced higher because you are reserving the closest available instructor at short notice.
      </p>

      <div className="mt-5 grid gap-4">
        <label className="grid gap-1">
          <span className="text-sm font-black text-zinc-700">Your name</span>
          <input
            required
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            className="min-h-12 rounded border border-zinc-300 px-4 font-bold text-black"
            placeholder="Full name"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-sm font-black text-zinc-700">Email address</span>
          <input
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="min-h-12 rounded border border-zinc-300 px-4 font-bold text-black"
            placeholder="name@gmail.com, name@hotmail.com..."
          />
        </label>

        <label className="grid gap-1">
          <span className="text-sm font-black text-zinc-700">Phone number <span className="font-medium text-zinc-500">(optional)</span></span>
          <input
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="min-h-12 rounded border border-zinc-300 px-4 font-bold text-black"
            placeholder="Used for text confirmation and lesson updates"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-sm font-black text-zinc-700">Provisional driving licence number</span>
          <input
            required
            value={licenceNumber}
            onChange={(event) => setLicenceNumber(event.target.value)}
            maxLength={20}
            className="min-h-12 rounded border border-zinc-300 px-4 font-mono text-sm font-black uppercase text-black"
            placeholder="16 characters"
          />
        </label>

        <label className="flex items-start gap-3 rounded bg-zinc-100 p-3 text-sm font-bold leading-6 text-zinc-700">
          <input
            checked={permission}
            onChange={(event) => setPermission(event.target.checked)}
            type="checkbox"
            className="mt-1"
          />
          I confirm this is my licence number and I give L Driving Academy permission to check entitlement through the configured DVLA route.
        </label>

        <button
          type="button"
          onClick={verifyLicence}
          disabled={!permission || normalisedLicence.length < 16 || verifyState.status === "checking"}
          className="lda-pill lda-pill-sm"
        >
          <ShieldCheck size={17} /> {verifyState.status === "checking" ? "Checking..." : "Check DVLA licence"}
        </button>

        <div
          className={`rounded p-3 text-sm font-bold leading-6 ${
            verifyState.status === "valid"
              ? "bg-green-50 text-green-800"
              : verifyState.status === "invalid"
                ? "bg-red-50 text-red-700"
                : "bg-zinc-100 text-zinc-700"
          }`}
        >
          {verifyState.message}
        </div>
      </div>

      <div className="mt-6 rounded bg-zinc-100 p-4">
        <div className="text-sm font-black text-zinc-600">Payment methods</div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-black text-zinc-700">
          {paymentOptions.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              disabled={!canPay || checkoutState === "loading"}
              onClick={() => startCheckout(value)}
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-2 transition ${
                paymentPreference === value ? "border-brand bg-brand text-white" : "border-zinc-200 bg-white text-zinc-800 hover:border-brand"
              }`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs leading-5 text-zinc-500">
          Each option opens Stripe Checkout. Manual card entry, Visa, Mastercard, Maestro, and eligible Apple Pay are handled by Stripe's secure card form; Apple Pay requires Stripe domain verification and PayPal depends on account eligibility.
        </p>
      </div>

      <button disabled={!canPay || checkoutState === "loading"} className="lda-pill mt-6 w-full" type="submit">
        <Mail size={18} /> {checkoutState === "loading" ? "Opening secure checkout..." : "Pay and reserve lesson now"}
      </button>
      {checkoutState === "error" ? (
        <p className="mt-3 text-sm font-bold text-brand">{checkoutError || "Payment could not start. Please try again or contact support."}</p>
      ) : null}
    </form>
  );
}
