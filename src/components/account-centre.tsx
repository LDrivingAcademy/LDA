"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, KeyRound, LogOut, MapPin, ShieldAlert, Trash2, UserRound, X } from "lucide-react";
import { requestAccountDeletion } from "@/app/account/actions";
import { signOut } from "@/app/auth/actions";
import { Brand } from "@/components/brand";
import { AccountSmartMatchPreferences } from "@/components/account-smart-match-preferences";
import { accountDeletionDeletes, accountDeletionResponseWindow, accountDeletionRetains } from "@/lib/account-deletion-policy";

const LOCATION_PREF_KEY = "lda-location-sharing-enabled";

type AccountCentreProps = {
  message?: string;
  accountRole?: "learner" | "instructor";
  showLearnerLicenceVerification?: boolean;
  provisionalLicenceConfirmedAt?: string | null;
};

function formatActivityTime(value: string) {
  if (!value) return "Time unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-GB", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

export function AccountCentre({
  message,
  accountRole = "learner",
  showLearnerLicenceVerification = false,
  provisionalLicenceConfirmedAt
}: AccountCentreProps) {
  const [isDeletionConfirmOpen, setIsDeletionConfirmOpen] = useState(false);
  const [isSecurityReportOpen, setIsSecurityReportOpen] = useState(false);
  const [securityReportDetails, setSecurityReportDetails] = useState("");
  const [securityReportStatus, setSecurityReportStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [securityReportMessage, setSecurityReportMessage] = useState("");
  const [locationSharingEnabled, setLocationSharingEnabled] = useState(true);
  const isInstructorAccount = accountRole === "instructor";
  const defaultLocationStatus = isInstructorAccount
    ? "Location sharing is on for account-level location use. Live location is required only when you start work, accept work, travel to a learner, or are signed on for LDA work."
    : "Location sharing is on for account-level location use. Live lesson tracking may ask for location when it is needed for a booked lesson.";
  const idleLocationOffStatus = isInstructorAccount
    ? "Location sharing is off while your account is idle. LDA will still require live location when you start work, accept work, travel to a learner, or are signed on for LDA work."
    : "Location sharing is off while your account is idle. LDA may still ask for location during an active booked lesson or live lesson tracking.";
  const activeLocationPromptStatus = isInstructorAccount
    ? "Location sharing is on. Your browser still controls GPS permission, and instructor work sessions will ask for it when needed."
    : "Location sharing is on. Your browser still controls GPS permission, and booked lesson tracking will ask for it when needed.";
  const fallbackLocationPromptStatus = isInstructorAccount
    ? "Location sharing is on. Instructor work sessions will ask this browser for location when needed."
    : "Location sharing is on. Booked lesson tracking will ask this browser for location when needed.";
  const locationCardCopy = isInstructorAccount
    ? "When your account is idle, this controls whether LDA can use your location in the background. When you start work, accept work, travel to a learner, or are signed on for LDA work, live location is required until you log off or end the work session."
    : "When your account is idle, this controls whether LDA can use your location in the background. During a booked lesson or live lesson tracking, LDA may ask for location so pickup and lesson support can work correctly.";
  const [locationStatus, setLocationStatus] = useState(defaultLocationStatus);
  const dashboardHref = isInstructorAccount ? "/instructor-dashboard" : "/learner-dashboard";
  const dashboardLabel = isInstructorAccount ? "Back to instructor dashboard" : "Back to learner dashboard";
  const brandLabel = isInstructorAccount ? "LDA instructor dashboard" : "LDA learner dashboard";
  const accountTypeLabel = isInstructorAccount ? "LDA Instructor Account" : "LDA Learner Account";

  useEffect(() => {
    const storedPreference = localStorage.getItem(LOCATION_PREF_KEY);
    const enabled = storedPreference !== "false";
    setLocationSharingEnabled(enabled);

    if (storedPreference === null) {
      localStorage.setItem(LOCATION_PREF_KEY, "true");
    }

    if (!enabled) {
      setLocationStatus(idleLocationOffStatus);
      return;
    }

    if (navigator.geolocation && navigator.permissions) {
      navigator.permissions
        .query({ name: "geolocation" as PermissionName })
        .then((permission) => {
          if (permission.state !== "granted") {
            setLocationStatus(activeLocationPromptStatus);
            return;
          }

          navigator.geolocation.getCurrentPosition(
            () => setLocationStatus("Location sharing is on and this browser has approved location access."),
            () => setLocationStatus("Location sharing is on, but this browser did not share its location yet."),
            { enableHighAccuracy: false, timeout: 6000 }
          );
        })
        .catch(() => undefined);
    } else if (navigator.geolocation) {
      setLocationStatus(fallbackLocationPromptStatus);
    } else {
      setLocationStatus("Location is not supported on this device.");
    }
  }, []);

  function updateLocationPreference(enabled: boolean) {
    setLocationSharingEnabled(enabled);
    localStorage.setItem(LOCATION_PREF_KEY, String(enabled));

    if (enabled) {
      setLocationStatus(defaultLocationStatus);
      return;
    }

    setLocationStatus(idleLocationOffStatus);
  }

  async function reportAccountAsHacked() {
    if (securityReportStatus === "sending") return;

    setSecurityReportStatus("sending");
    setSecurityReportMessage("");

    try {
      const response = await fetch("/api/account/report-hacked", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          additionalDetails: securityReportDetails,
          pageUrl: window.location.href
        })
      });
      const result = (await response.json().catch(() => null)) as { message?: string; error?: string } | null;

      if (!response.ok) {
        throw new Error(result?.message || result?.error || "The hacked-account report could not be sent.");
      }

      setSecurityReportStatus("sent");
      setSecurityReportMessage(result?.message || "Your report has been sent to LDA support.");
      setIsSecurityReportOpen(false);
      setSecurityReportDetails("");
    } catch (error) {
      setSecurityReportStatus("error");
      setSecurityReportMessage(error instanceof Error ? error.message : "The hacked-account report could not be sent.");
    }
  }

  return (
    <main className="min-h-screen bg-white text-black">
      <header className="lda-universal-topbar border-b border-zinc-200 bg-black text-white">
        <div className="lda-universal-topbar-inner flex w-full items-center justify-between gap-3 px-3 sm:gap-4 sm:px-6 lg:px-10">
          <div className="flex min-w-0 items-center gap-3 sm:gap-5">
            <Brand size="home" href={dashboardHref} label={brandLabel} />
            <div className="min-w-0 max-w-[42vw] sm:max-w-none">
              <div className="truncate text-xs font-black uppercase text-red-200 sm:text-sm">{accountTypeLabel}</div>
              <h1 className="mt-1 truncate text-lg font-black sm:text-3xl">Account centre</h1>
            </div>
          </div>
          <Link
            href={dashboardHref}
            className="inline-flex min-w-0 shrink-0 items-center gap-2 rounded-full px-2 py-2 text-sm font-black text-white transition sm:px-3"
          >
            <ArrowLeft size={16} className="shrink-0" /> <span className="hidden max-w-[30vw] truncate min-[390px]:inline">{dashboardLabel}</span>
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-5 px-4 py-8 sm:px-6 lg:grid-cols-2 lg:px-8">
        {message ? (
          <div className="rounded border border-red-200 bg-red-50 p-4 text-sm font-black leading-6 text-red-900 lg:col-span-2">
            {message}
          </div>
        ) : null}
        <article id="manage-profile" className={`rounded border border-zinc-200 bg-white p-5 shadow-sm ${isInstructorAccount ? "lg:col-span-2" : ""}`}>
          <UserRound className="text-brand" />
          <h2 className="mt-4 text-2xl font-black">Manage Your Profile</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Keep your personal information, password, recovery number, and security settings up to date.
          </p>
          <div className="mt-5 grid gap-3">
            {[
              ["Personal Info", "/account/personal-info"],
              ["Change Password", "/account/change-password"],
              ["Trusted Devices", "/account/trusted-devices"],
              ["Add a Recovery Number", "/account/recovery-phone"],
              ...(showLearnerLicenceVerification ? [["Provisional Driving Licence", "/account/provisional-licence"]] : []),
              ["Your Log In Activities", "/account/login-activities"]
            ].map(([label, href]) => (
              <Link key={label} href={href} className="flex items-center justify-between rounded border border-zinc-200 bg-zinc-50 p-4 text-sm font-black hover:ring-2 hover:ring-brand">
                {label} <KeyRound size={16} className="text-brand" />
              </Link>
            ))}
          </div>
          {showLearnerLicenceVerification ? (
            <div id="provisional-driving-licence" className={`mt-5 scroll-mt-28 rounded border p-4 ${provisionalLicenceConfirmedAt ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
              <h3 className={`text-lg font-black ${provisionalLicenceConfirmedAt ? "text-emerald-950" : "text-red-950"}`}>
                {provisionalLicenceConfirmedAt ? "Provisional driving licence verified" : "Provisional driving licence unverified"}
              </h3>
              <p className={`mt-1 text-sm font-semibold leading-6 ${provisionalLicenceConfirmedAt ? "text-emerald-950" : "text-red-950"}`}>
                {provisionalLicenceConfirmedAt
                  ? `Your provisional licence was verified on ${formatActivityTime(provisionalLicenceConfirmedAt)}. You can now book paid driving lessons.`
                  : "Add and verify your provisional driving licence before any paid LDA lesson can be booked. You can still use your account, but checkout stays locked until the licence check passes."}
              </p>
            </div>
          ) : null}
        </article>

        {isInstructorAccount ? null : <AccountSmartMatchPreferences />}

        <article id="settings" className="rounded border border-zinc-200 bg-white p-5 shadow-sm lg:col-span-2">
          <ShieldAlert className="text-brand" />
          <h2 className="mt-4 text-2xl font-black">Settings</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="flex min-h-[180px] flex-col rounded border border-zinc-200 bg-zinc-50 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <MapPin className="text-brand" />
                  <h3 className="mt-3 text-xl font-black">Use my location</h3>
                </div>
                <button
                  type="button"
                  aria-pressed={locationSharingEnabled}
                  onClick={() => updateLocationPreference(!locationSharingEnabled)}
                  className={`relative mt-8 h-8 w-14 shrink-0 rounded-full transition ${locationSharingEnabled ? "bg-brand" : "bg-zinc-300"}`}
                >
                  <span className={`absolute top-1 h-6 w-6 rounded-full bg-white transition ${locationSharingEnabled ? "left-7" : "left-1"}`} />
                </button>
              </div>
              <p className="mt-2 text-sm font-bold leading-5 text-zinc-700">
                {locationCardCopy}
              </p>
              <p className="mt-2 text-sm leading-5 text-zinc-600">{locationStatus}</p>
            </div>
            <div className="flex min-h-[180px] flex-col rounded border border-zinc-200 bg-zinc-50 p-4">
              <LogOut className="text-brand" />
              <h3 className="mt-3 text-xl font-black">Sign Out</h3>
              <div className="mt-auto flex items-end justify-between gap-4 pt-3">
                <p className="text-sm leading-5 text-zinc-600">Leave this device signed out of your LDA account.</p>
                <form action={signOut} className="shrink-0">
                  <button type="submit" className="lda-pill lda-pill-sm">
                    Sign out
                  </button>
                </form>
              </div>
            </div>
            <div className="flex h-full flex-col rounded border border-red-200 bg-red-50 p-4">
              <ShieldAlert className="text-brand" />
              <h3 className="mt-3 text-xl font-black">Report account as hacked</h3>
              <p className="mt-2 text-sm leading-6 text-red-950">
                Send LDA support a security report if you do not recognise a login device, location, or sign-in time.
              </p>
              {securityReportMessage ? (
                <p className={`mt-3 rounded border p-3 text-sm font-black leading-6 ${securityReportStatus === "sent" ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-red-200 bg-white text-red-950"}`}>
                  {securityReportMessage}
                </p>
              ) : null}
              <div className="mt-auto pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setSecurityReportStatus("idle");
                    setSecurityReportMessage("");
                    setIsSecurityReportOpen(true);
                  }}
                  disabled={securityReportStatus === "sending"}
                  className="lda-pill lda-pill-sm disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Report account as hacked
                </button>
              </div>
            </div>
            <div className="flex h-full flex-col rounded border border-red-200 bg-red-50 p-4">
              <Trash2 className="text-brand" />
              <h3 className="mt-3 text-xl font-black">Account Deletion</h3>
              <p className="mt-2 text-sm leading-6 text-red-950">
                Request deletion of your LDA account and personal profile data. LDA removes or anonymises identifiable data while retaining only minimal non-identifying records needed for legal, regulatory, dispute, payment, tax, or fraud-prevention reasons.
              </p>
              <div className="mt-auto pt-4">
                <button type="button" onClick={() => setIsDeletionConfirmOpen(true)} className="lda-pill lda-pill-sm">
                  Request account deletion
                </button>
              </div>
            </div>
          </div>
        </article>
      </section>
      {isDeletionConfirmOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 py-6">
          <section className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded border border-red-200 bg-white p-5 text-black shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-sm font-black uppercase text-brand">
                  <Trash2 size={17} /> Account deletion confirmation
                </div>
                <h2 className="mt-2 text-3xl font-black tracking-normal">Are you sure you want to delete your account?</h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-zinc-700">
                  If you continue, LDA will deactivate your account, remove you from active app use, and email you a restart link. You will have 30 days to restart your account before permanent deletion or anonymisation is processed.
                </p>
              </div>
              <button type="button" onClick={() => setIsDeletionConfirmOpen(false)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-zinc-200 text-zinc-600 hover:bg-zinc-100" aria-label="Close account deletion confirmation">
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <section className="rounded border border-red-200 bg-red-50 p-4">
                <h3 className="text-sm font-black uppercase text-red-900">Deleted or anonymised</h3>
                <div className="mt-3 grid gap-2">
                  {accountDeletionDeletes.map((item) => (
                    <div key={item} className="flex items-start gap-2 text-sm font-bold leading-6 text-red-950">
                      <CheckCircle2 className="mt-0.5 shrink-0 text-brand" size={16} />
                      {item}
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded border border-zinc-200 bg-zinc-50 p-4">
                <h3 className="text-sm font-black uppercase text-zinc-700">Retained where necessary</h3>
                <div className="mt-3 grid gap-2">
                  {accountDeletionRetains.map((item) => (
                    <div key={item} className="flex items-start gap-2 text-sm font-bold leading-6 text-zinc-700">
                      <CheckCircle2 className="mt-0.5 shrink-0 text-zinc-500" size={16} />
                      {item}
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <p className="mt-4 rounded border border-zinc-200 bg-white p-3 text-sm font-bold leading-6 text-zinc-700">
              You can restart your account from the email link within 30 days. After that, removable personal data is permanently deleted or anonymised, while LDA may retain only records needed for legal, payment, dispute, tax, regulatory, or fraud-prevention reasons. {accountDeletionResponseWindow}
            </p>

            <form action={requestAccountDeletion} className="mt-5 rounded border border-zinc-200 bg-zinc-50 p-4">
              <input type="hidden" name="confirmAccountDeletion" value="yes" />
              <div className="flex flex-wrap items-center justify-end gap-3">
                <button type="button" onClick={() => setIsDeletionConfirmOpen(false)} className="rounded-full border border-zinc-300 bg-white px-5 py-3 text-sm font-black text-zinc-800 hover:ring-2 hover:ring-zinc-300">
                  No, keep my account
                </button>
                <button type="submit" className="lda-pill lda-pill-sm">
                  Yes, delete my account
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
      {isSecurityReportOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 py-6">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="security-report-title"
            className="w-full max-w-xl rounded border border-red-200 bg-white p-5 text-black shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-sm font-black uppercase text-brand">
                  <ShieldAlert size={17} /> Security report
                </div>
                <h2 id="security-report-title" className="mt-2 text-3xl font-black tracking-normal">
                  Report account as hacked?
                </h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-zinc-700">
                  Add anything you want LDA support to check, such as an unknown device, location, sign-in time, or IP address. This report will be sent to info@ldrivingacademy.co.uk.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsSecurityReportOpen(false);
                  setSecurityReportStatus("idle");
                  setSecurityReportMessage("");
                }}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-zinc-200 text-zinc-600 hover:bg-zinc-100"
                aria-label="Close security report"
              >
                <X size={18} />
              </button>
            </div>

            <label className="mt-5 grid gap-2">
              <span className="text-sm font-black uppercase text-zinc-600">What should LDA check?</span>
              <textarea
                value={securityReportDetails}
                onChange={(event) => setSecurityReportDetails(event.target.value)}
                maxLength={1200}
                rows={6}
                className="w-full rounded border border-zinc-300 bg-white p-3 text-sm font-semibold leading-6 text-black outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
                placeholder="Example: I do not recognise the Windows Chrome sign-in at 02:18, or this location/IP address was not me."
              />
              <span className="text-xs font-bold text-zinc-500">{securityReportDetails.length}/1200 characters</span>
            </label>

            {securityReportMessage ? (
              <p className={`mt-4 rounded border p-3 text-sm font-black leading-6 ${securityReportStatus === "error" ? "border-red-200 bg-red-50 text-red-950" : "border-zinc-200 bg-zinc-50 text-zinc-800"}`}>
                {securityReportMessage}
              </p>
            ) : null}

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsSecurityReportOpen(false);
                  setSecurityReportStatus("idle");
                  setSecurityReportMessage("");
                }}
                disabled={securityReportStatus === "sending"}
                className="rounded-full border border-zinc-300 bg-white px-5 py-3 text-sm font-black text-zinc-800 hover:ring-2 hover:ring-zinc-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={reportAccountAsHacked}
                disabled={securityReportStatus === "sending"}
                className="lda-pill lda-pill-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                {securityReportStatus === "sending" ? "Sending report..." : "Report account hacked"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
