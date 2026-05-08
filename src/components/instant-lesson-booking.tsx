"use client";

import { FormEvent, useMemo, useState } from "react";
import { Apple, BadgeCheck, CreditCard, Mail, ShieldCheck } from "lucide-react";

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

type PaymentMethod = "apple_pay" | "visa" | "mastercard" | "maestro" | "paypal";

const paymentMethods: Array<{
  id: PaymentMethod;
  label: string;
  detail: string;
  icon: "apple" | "card" | "paypal";
}> = [
  { id: "apple_pay", label: "Apple Pay", detail: "Available on supported Apple devices through Stripe.", icon: "apple" },
  { id: "visa", label: "Visa", detail: "Pay securely by card through Stripe Checkout.", icon: "card" },
  { id: "mastercard", label: "Mastercard", detail: "Pay securely by card through Stripe Checkout.", icon: "card" },
  { id: "maestro", label: "Maestro", detail: "Card support depends on the live Stripe account.", icon: "card" },
  { id: "paypal", label: "PayPal", detail: "Available when PayPal is enabled on the Stripe account.", icon: "paypal" }
];

function paymentLabel(method: PaymentMethod) {
  return paymentMethods.find((paymentMethod) => paymentMethod.id === method)?.label ?? "payment";
}

function PaymentIcon({ icon }: { icon: "apple" | "card" | "paypal" }) {
  if (icon === "apple") {
    return <Apple size={16} />;
  }

  if (icon === "paypal") {
    return <BadgeCheck size={16} />;
  }

  return <CreditCard size={16} />;
}

function cleanLicenceNumber(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function InstantLessonBooking({
  instructorName,
  instructorEmail,
  lessonSummary,
  amountPence
}: InstantLessonBookingProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [licenceNumber, setLicenceNumber] = useState("");
  const [permission, setPermission] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>("apple_pay");
  const [verifyState, setVerifyState] = useState<VerifyState>({
    status: "idle",
    message: "Enter the 16-character provisional licence number, then run the DVLA check."
  });
  const [checkoutState, setCheckoutState] = useState<"idle" | "loading" | "error">("idle");

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

  async function startCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canPay) {
      return;
    }

    setCheckoutState("loading");

    const response = await fetch("/api/instant-lessons/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName,
        learnerEmail: email,
        provisionalLicenceNumber: normalisedLicence,
        instructorName,
        instructorEmail,
        lessonSummary,
        amountPence,
        preferredPaymentMethod: selectedPaymentMethod
      })
    });
    const result = await response.json();

    if (!response.ok || !result.checkoutUrl) {
      setCheckoutState("error");
      return;
    }

    window.location.href = result.checkoutUrl;
  }

  return (
    <form onSubmit={startCheckout} className="rounded bg-white p-5 text-black shadow-2xl">
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
        <div className="mt-3 grid gap-2">
          {paymentMethods.map((method) => (
            <label
              key={method.id}
              className={`flex cursor-pointer items-start gap-3 rounded border px-3 py-3 text-sm font-bold ${
                selectedPaymentMethod === method.id
                  ? "border-brand bg-white text-black shadow-sm"
                  : "border-transparent bg-white text-zinc-700"
              }`}
            >
              <input
                type="radio"
                name="preferredPaymentMethod"
                value={method.id}
                checked={selectedPaymentMethod === method.id}
                onChange={() => setSelectedPaymentMethod(method.id)}
                className="mt-1"
              />
              <span className="mt-0.5 text-brand"><PaymentIcon icon={method.icon} /></span>
              <span>
                <span className="block font-black">{method.label}</span>
                <span className="mt-1 block text-xs leading-5 text-zinc-500">{method.detail}</span>
              </span>
            </label>
          ))}
        </div>
        <p className="mt-3 text-xs leading-5 text-zinc-500">
          Stripe Checkout handles cards and eligible wallets securely. The next screen will show the live methods enabled on the Stripe account.
        </p>
      </div>

      <button disabled={!canPay || checkoutState === "loading"} className="lda-pill mt-6 w-full" type="submit">
        <Mail size={18} /> {checkoutState === "loading" ? "Opening secure checkout..." : `Pay with ${paymentLabel(selectedPaymentMethod)}`}
      </button>
      {checkoutState === "error" ? (
        <p className="mt-3 text-sm font-bold text-brand">Payment could not start. Please try again or contact support.</p>
      ) : null}
    </form>
  );
}
