"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CreditCard } from "lucide-react";
import type { SmartMatchHandoffContext } from "@/lib/smart-match-handoff";

type InstantLessonBookingProps = {
  amountPence: number;
  initialLearnerDetails?: LearnerDetails | null;
  initialPickup?: string | null;
  initialTransmission?: TransmissionPreference | null;
};

type LearnerDetails = {
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  dateOfBirth?: string | null;
  homeAddress?: string | null;
  provisionalLicenceConfirmed?: boolean | null;
  learnerEligibleForBooking?: boolean | null;
};

type InstantLessonDetailsResponse = {
  details?: LearnerDetails | null;
  redirectTo?: string;
};

type VerifyState =
  | { status: "idle"; message: string }
  | { status: "checking"; message: string }
  | { status: "valid"; message: string; mode: string }
  | { status: "invalid"; message: string };

type TransmissionPreference = "automatic" | "manual";

function cleanLicenceNumber(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function InstantLessonBooking({
  amountPence,
  initialLearnerDetails,
  initialPickup = null,
  initialTransmission = null
}: InstantLessonBookingProps) {
  const [learnerDetails, setLearnerDetails] = useState<LearnerDetails | null>(initialLearnerDetails ?? null);
  const [fullName, setFullName] = useState(initialLearnerDetails?.fullName ?? "");
  const [email, setEmail] = useState(initialLearnerDetails?.email ?? "");
  const [phone, setPhone] = useState(initialLearnerDetails?.phone ?? "");
  const [pickup, setPickup] = useState(initialPickup ?? initialLearnerDetails?.homeAddress ?? "");
  const [transmission, setTransmission] = useState<TransmissionPreference>(initialTransmission ?? "automatic");
  const [licenceNumber, setLicenceNumber] = useState("");
  const [permission, setPermission] = useState(false);
  const [verifyState, setVerifyState] = useState<VerifyState>({
    status: "idle",
    message: "Enter your 16-character provisional licence number and tick permission. LDA will check it automatically before checkout."
  });
  const [checkoutState, setCheckoutState] = useState<"idle" | "loading" | "error">("idle");
  const [checkoutError, setCheckoutError] = useState("");
  const lastLicenceCheckRef = useRef("");
  const verifyRequestRef = useRef(0);
  const smartMatchSavedRef = useRef(false);
  const [smartMatchContext, setSmartMatchContext] = useState<SmartMatchHandoffContext | null>(null);

  const normalisedLicence = useMemo(() => cleanLicenceNumber(licenceNumber), [licenceNumber]);
  const hasSavedLearnerDetails = Boolean(learnerDetails?.email);
  const hasSavedLicenceVerification = Boolean(learnerDetails?.provisionalLicenceConfirmed);
  const hasVerifiedProvisionalLicence = hasSavedLicenceVerification || verifyState.status === "valid";
  const needsLicenceEntry = !hasSavedLicenceVerification;
  const hasRequiredCheckoutDetails = Boolean(fullName.trim() && email.trim() && pickup.trim());
  const learnerLoginHref = useMemo(() => {
    if (typeof window === "undefined") return "/auth/login?role=learner&next=/lesson-now";
    const next = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    return `/auth/login?role=learner&next=${encodeURIComponent(next)}`;
  }, []);
  const canSubmitCheckout = Boolean(
    hasRequiredCheckoutDetails &&
      (!needsLicenceEntry || (permission && normalisedLicence.length >= 16)) &&
      checkoutState !== "loading" &&
      verifyState.status !== "checking"
  );

  useEffect(() => {
    if (initialLearnerDetails?.email) {
      return;
    }

    let active = true;

    async function loadSavedLearnerDetails() {
      try {
        const response = await fetch("/api/account/instant-lesson-details", {
          cache: "no-store",
          credentials: "same-origin"
        });

        if (!active || !response.ok) {
          return;
        }

        const result = (await response.json()) as InstantLessonDetailsResponse;

        if (result.redirectTo) {
          window.location.replace(result.redirectTo);
          return;
        }

        if (!result.details?.email) {
          return;
        }

        setLearnerDetails(result.details);
        setFullName((current) => current || result.details?.fullName || "");
        setEmail((current) => current || result.details?.email || "");
        setPhone((current) => current || result.details?.phone || "");
        setPickup((current) => current || result.details?.homeAddress || "");
      } catch {
        // Guest booking remains available if saved details cannot be loaded.
      }
    }

    void loadSavedLearnerDetails();

    return () => {
      active = false;
    };
  }, [initialLearnerDetails?.email]);

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem("lda:smart-match-context:v1");
      if (!stored) return;
      const parsed = JSON.parse(stored);
      if (parsed?.source === "smart-match") {
        setSmartMatchContext(parsed);
      }
    } catch {
      // On-demand booking can continue without Smart Match context.
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pickupParam = params.get("postcode");
    const transmissionParam = params.get("transmission");

    if (!initialPickup && pickupParam) {
      setPickup((current) => current || pickupParam);
    }

    if (!initialTransmission && (transmissionParam === "manual" || transmissionParam === "automatic")) {
      setTransmission(transmissionParam);
    }
  }, [initialPickup, initialTransmission]);

  useEffect(() => {
    if (!hasSavedLearnerDetails || !smartMatchContext || smartMatchSavedRef.current) return;

    smartMatchSavedRef.current = true;
    fetch("/api/smart-match/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        preferences: {
          postcode: smartMatchContext.postcode || pickup,
          budgetPence: smartMatchContext.budgetPence,
          transmission: smartMatchContext.transmission || transmission,
          availability: "book-now",
          bookingPath: "on-demand",
          confidence: smartMatchContext.confidence,
          lessonStage: smartMatchContext.lessonStage,
          accessibilityNeeds: smartMatchContext.accessibilityNeeds ?? [],
          learningPreferences: smartMatchContext.learningPreferences ?? [],
          communicationPreferences: smartMatchContext.communicationPreferences ?? [],
          environmentPreferences: smartMatchContext.environmentPreferences ?? [],
          lessonSupport: smartMatchContext.lessonSupport ?? [],
          goals: smartMatchContext.goals ?? [],
          disclosureConsent: Boolean(smartMatchContext.disclosureConsent),
          privateNote: smartMatchContext.privateNote ?? ""
        }
      })
    }).catch(() => {
      smartMatchSavedRef.current = false;
    });
  }, [hasSavedLearnerDetails, pickup, smartMatchContext, transmission]);

  useEffect(() => {
    if (initialPickup) {
      setPickup(initialPickup);
    }
  }, [initialPickup]);

  useEffect(() => {
    if (initialTransmission) {
      setTransmission(initialTransmission);
    }
  }, [initialTransmission]);

  const runLicenceCheck = useCallback(async () => {
    if (hasSavedLicenceVerification) {
      return true;
    }

    if (!permission || normalisedLicence.length < 16) {
      setVerifyState({
        status: "idle",
        message: "Enter your 16-character provisional licence number and tick permission. LDA will check it automatically before checkout."
      });
      return false;
    }

    const checkKey = `${normalisedLicence}:${permission}`;
    if (verifyState.status === "valid" && lastLicenceCheckRef.current === checkKey) {
      return true;
    }
    if (verifyState.status === "invalid" && lastLicenceCheckRef.current === checkKey) {
      return false;
    }

    const requestId = verifyRequestRef.current + 1;
    verifyRequestRef.current = requestId;
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

    if (requestId !== verifyRequestRef.current) {
      return false;
    }

    if (!response.ok || !result.valid) {
      lastLicenceCheckRef.current = checkKey;
      setVerifyState({
        status: "invalid",
        message: "No licence found or invalid licence number."
      });
      return false;
    }

    lastLicenceCheckRef.current = checkKey;
    setVerifyState({
      status: "valid",
      mode: result.mode ?? "demo",
      message: result.message ?? "Licence check passed."
    });
    return true;
  }, [hasSavedLicenceVerification, normalisedLicence, permission, verifyState.status]);

  useEffect(() => {
    if (!needsLicenceEntry) {
      return;
    }

    if (!permission || normalisedLicence.length < 16) {
      verifyRequestRef.current += 1;
      setVerifyState({
        status: "idle",
        message: "Enter your 16-character provisional licence number and tick permission. LDA will check it automatically before checkout."
      });
      return;
    }

    const checkKey = `${normalisedLicence}:${permission}`;
    if (verifyState.status === "checking") {
      return;
    }
    if ((verifyState.status === "valid" || verifyState.status === "invalid") && lastLicenceCheckRef.current === checkKey) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void runLicenceCheck();
    }, 650);

    return () => window.clearTimeout(timeoutId);
  }, [needsLicenceEntry, normalisedLicence, permission, runLicenceCheck, verifyState.status]);

  async function startCheckout() {
    if (!hasRequiredCheckoutDetails) {
      return;
    }

    let licenceValid = hasVerifiedProvisionalLicence;
    if (!licenceValid && needsLicenceEntry) {
      licenceValid = await runLicenceCheck();
    }

    if (!licenceValid) {
      setCheckoutState("error");
      setCheckoutError("No licence found or invalid licence number.");
      return;
    }

    setCheckoutState("loading");
    setCheckoutError("");

    const response = await fetch("/api/instant-lessons/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName,
        learnerEmail: email,
        learnerPhone: phone,
        pickup,
        transmission,
        amountPence,
        smartMatchContext,
        provisionalLicenceNumber: hasSavedLicenceVerification ? undefined : normalisedLicence,
        provisionalLicencePermission: hasSavedLicenceVerification ? undefined : permission
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
        void startCheckout();
      }}
      className="rounded bg-white p-5 text-black shadow-2xl"
    >
      <div className="text-sm font-black uppercase text-brand">
        {hasSavedLearnerDetails ? "Instant learner booking" : "Guest on-demand booking"}
      </div>
      <h2 className="mt-2 text-3xl font-black tracking-normal">
        {hasSavedLearnerDetails ? "Book with your saved LDA details." : "Book an on-demand lesson."}
      </h2>
      <p className="mt-2 text-sm leading-6 text-zinc-600">
        {hasSavedLearnerDetails
          ? hasSavedLicenceVerification
            ? "We have filled in the details saved to your LDA account, and your provisional driving licence is already verified on your profile."
            : "We have filled in the contact details saved to your LDA account, but your provisional driving licence is unverified. Enter it below so LDA can check it before checkout."
          : "You can book without an account, but LDA must verify your provisional driving licence before checkout can open."}
      </p>
      {smartMatchContext ? (
        <div className="mt-4 rounded border border-red-100 bg-red-50 p-4 text-sm font-bold leading-6 text-zinc-800">
          <div className="text-xs font-black uppercase text-brand">Smart Match handoff</div>
          <p className="mt-2">
            {smartMatchContext.instructorName
              ? `You came from a Smart Match result for ${smartMatchContext.instructorName}.`
              : "You came from Smart Match."} LDA has kept your learning preferences for this booking session.
          </p>
          {smartMatchContext.matchScore ? (
            <div className="mt-2 text-xs font-black uppercase text-zinc-500">{smartMatchContext.matchScore}% match score</div>
          ) : null}
          {smartMatchContext.accessibilityNeeds?.length || smartMatchContext.learningPreferences?.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {[...(smartMatchContext.accessibilityNeeds ?? []), ...(smartMatchContext.learningPreferences ?? [])].slice(0, 5).map((item) => (
                <span key={item} className="rounded-full bg-white px-3 py-1 text-xs font-black text-zinc-700 ring-1 ring-red-100">
                  {item}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {hasSavedLearnerDetails && !hasSavedLicenceVerification ? (
        <div className="mt-4 rounded bg-red-50 p-3 text-sm font-bold leading-6 text-red-900 ring-1 ring-red-100">
          Provisional driving licence unverified. Enter and confirm your licence below before checkout can open.
        </div>
      ) : !hasSavedLearnerDetails ? (
        <div className="mt-4 rounded bg-red-50 p-4 text-sm font-bold leading-6 text-zinc-800 ring-1 ring-red-100">
          <p>
            Already have an LDA learner account? Sign in first and we can use the saved name, email, phone number, and licence verification from your profile.
          </p>
          <Link href={learnerLoginHref} className="lda-pill lda-pill-sm mt-5 w-fit">
            Sign in as learner
          </Link>
        </div>
      ) : null}

      <div className="mt-5 grid gap-4">
        <label className="grid gap-1">
          <span className="text-sm font-black text-zinc-700">Your name</span>
          <input
            required
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            autoComplete="name"
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
            autoComplete="email"
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
            autoComplete="tel"
            className="min-h-12 rounded border border-zinc-300 px-4 font-bold text-black"
            placeholder="Used for text confirmation and lesson updates"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-sm font-black text-zinc-700">Pickup postcode or full address</span>
          <input
            required
            value={pickup}
            onChange={(event) => setPickup(event.target.value)}
            autoComplete="street-address"
            className="min-h-12 rounded border border-zinc-300 px-4 font-bold text-black"
            placeholder="SW1A 1AA or 10 Downing Street"
          />
          <span className="text-xs font-bold leading-5 text-zinc-500">
            Enter the pickup point the instructor should route to after accepting your on-demand lesson.
          </span>
        </label>

        <label className="grid gap-1">
          <span className="text-sm font-black text-zinc-700">Transmission</span>
          <select
            value={transmission}
            onChange={(event) => setTransmission(event.target.value === "manual" ? "manual" : "automatic")}
            className="min-h-12 rounded border border-zinc-300 bg-white px-4 font-bold text-black"
          >
            <option value="automatic">Automatic</option>
            <option value="manual">Manual</option>
          </select>
        </label>

        {hasSavedLearnerDetails && hasSavedLicenceVerification ? (
          <div className="rounded bg-green-50 p-3 text-sm font-bold leading-6 text-green-800">
            Provisional driving licence verified on your learner profile. Press checkout to continue.
          </div>
        ) : needsLicenceEntry ? (
            <>
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

              {verifyState.status !== "idle" ? (
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
              ) : null}
            </>
        ) : null}
      </div>

      <button disabled={!canSubmitCheckout} className="lda-pill mt-6 min-h-[5rem] w-full gap-4 px-8 text-2xl shadow-[inset_0_0_0_2px_rgba(255,255,255,0.18),0_18px_34px_rgba(184,0,15,0.25)]" type="submit">
        <CreditCard size={30} strokeWidth={2.4} />
        {checkoutState === "loading" ? "Opening secure checkout..." : "Checkout"}
      </button>
      {checkoutState === "error" ? (
        <p className="mt-3 text-sm font-bold text-brand">{checkoutError || "Payment could not start. Please try again or contact support."}</p>
      ) : null}
    </form>
  );
}
