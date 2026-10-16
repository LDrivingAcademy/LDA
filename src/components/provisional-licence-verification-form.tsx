"use client";

import { useState } from "react";
import { CheckCircle2, ShieldCheck } from "lucide-react";

type LicenceVerifyState =
  | { status: "idle"; message: string }
  | { status: "checking"; message: string }
  | { status: "valid"; mode?: string; message: string }
  | { status: "invalid"; message: string };

type ProvisionalLicenceVerificationFormProps = {
  provisionalLicenceConfirmedAt?: string | null;
  initialLicenceNumber?: string | null;
};

function cleanLicenceNumber(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function formatVerificationDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

export function ProvisionalLicenceVerificationForm({
  provisionalLicenceConfirmedAt,
  initialLicenceNumber
}: ProvisionalLicenceVerificationFormProps) {
  const [licenceNumber, setLicenceNumber] = useState(cleanLicenceNumber(initialLicenceNumber ?? "").slice(0, 16));
  const [licencePermission, setLicencePermission] = useState(false);
  const [verifyState, setVerifyState] = useState<LicenceVerifyState>({
    status: provisionalLicenceConfirmedAt ? "valid" : "idle",
    message: provisionalLicenceConfirmedAt
      ? `You are now verified. Your provisional driving licence was confirmed on ${formatVerificationDate(provisionalLicenceConfirmedAt)}.`
      : "Enter your 16-character GB photocard provisional driving licence number and run the check."
  });
  const normalisedLicence = cleanLicenceNumber(licenceNumber);
  const isVerified = verifyState.status === "valid";

  async function verifyLicence() {
    setVerifyState({ status: "checking", message: "Checking provisional driving licence details..." });

    try {
      const response = await fetch("/api/dvla/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          drivingLicenceNumber: normalisedLicence,
          permissionConfirmed: licencePermission
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
        mode: result.mode ?? "live",
        message: result.message ?? "You are now verified. Your provisional driving licence has been saved to your learner account."
      });
    } catch {
      setVerifyState({
        status: "invalid",
        message: "Licence verification could not be reached. Try again before booking."
      });
    }
  }

  return (
    <article className="rounded border border-zinc-200 bg-white p-5 shadow-2xl">
      <div className="inline-flex items-center gap-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-black uppercase text-brand">
        <ShieldCheck size={16} /> Licence verification
      </div>
      <h2 className="mt-4 text-2xl font-black tracking-normal">Add or change provisional driving licence</h2>
      <p className="mt-3 text-sm font-semibold leading-6 text-zinc-700">
        LDA checks your provisional driving licence through the configured DVLA verification route and saves the confirmation so paid lesson booking can continue.
      </p>

      <div className="mt-5 grid gap-5">
        <div className={`rounded border p-4 ${isVerified ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
          <div className="flex items-start gap-3">
            <CheckCircle2 className={`mt-1 shrink-0 ${isVerified ? "text-emerald-700" : "text-brand"}`} size={22} />
            <div>
              <h3 className={`text-xl font-black ${isVerified ? "text-emerald-950" : "text-red-950"}`}>
                {isVerified ? "You are now verified" : "Verification required before paid lessons"}
              </h3>
              <p className={`mt-1 text-sm font-bold leading-6 ${isVerified ? "text-emerald-950" : "text-red-950"}`}>
                {verifyState.message}
              </p>
            </div>
          </div>
        </div>

        <label className="grid gap-2">
          <span className="text-sm font-black text-zinc-700">Provisional driving licence number</span>
          <input
            value={licenceNumber}
            onChange={(event) => {
              setLicenceNumber(cleanLicenceNumber(event.target.value).slice(0, 16));
              setVerifyState({
                status: "idle",
                message: "Save this provisional licence number to run the verification check again."
              });
            }}
            inputMode="text"
            autoComplete="off"
            className="rounded border border-zinc-300 bg-white px-4 py-3 font-mono text-sm font-black uppercase tracking-[0.12em] text-black"
            placeholder="16 characters"
            maxLength={16}
          />
        </label>

        <label className="flex items-start gap-3 rounded border border-zinc-200 bg-zinc-50 p-4 text-sm font-bold leading-6 text-zinc-700">
          <input
            type="checkbox"
            checked={licencePermission}
            onChange={(event) => setLicencePermission(event.target.checked)}
            className="mt-1"
          />
          I confirm this is my licence number and I give LDA permission to check it and save the provisional licence confirmation.
        </label>

        <button
          type="button"
          onClick={verifyLicence}
          disabled={!licencePermission || normalisedLicence.length !== 16 || verifyState.status === "checking"}
          className="lda-pill w-full justify-center disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ShieldCheck size={18} />
          {verifyState.status === "checking" ? "Checking..." : "Save"}
        </button>
      </div>
    </article>
  );
}
