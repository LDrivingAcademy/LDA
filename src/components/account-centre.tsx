"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Gift, KeyRound, MapPin, ShieldAlert, TicketPercent, Trash2, UserRound } from "lucide-react";

type LoginActivity = {
  device: string;
  browser: string;
  when: string;
  location: string;
};

function createReferralCode() {
  const seed = typeof window !== "undefined" ? window.localStorage.getItem("lda-profile-name") || "LDA" : "LDA";
  return `${seed.replace(/[^a-z0-9]/gi, "").slice(0, 6).toUpperCase() || "LDA"}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

export function AccountCentre() {
  const [promoCode, setPromoCode] = useState("");
  const [referralCode, setReferralCode] = useState("LDA-FRIEND");
  const [deletionRequested, setDeletionRequested] = useState(false);
  const [activity, setActivity] = useState<LoginActivity[]>([]);
  const referralLink = useMemo(() => `https://ldrivingacademy.co.uk/auth/sign-up?role=learner&ref=${referralCode}`, [referralCode]);

  useEffect(() => {
    setReferralCode(createReferralCode());
    const currentActivity: LoginActivity = {
      device: navigator.platform || "This device",
      browser: navigator.userAgent.includes("Safari") && !navigator.userAgent.includes("Chrome") ? "Safari" : "Browser",
      when: new Date().toLocaleString("en-GB"),
      location: "Location permission not shared"
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const located = {
            ...currentActivity,
            location: `${position.coords.latitude.toFixed(2)}, ${position.coords.longitude.toFixed(2)}`
          };
          setActivity([located]);
          localStorage.setItem("lda-login-activity", JSON.stringify([located]));
        },
        () => {
          setActivity([currentActivity]);
          localStorage.setItem("lda-login-activity", JSON.stringify([currentActivity]));
        },
        { enableHighAccuracy: false, timeout: 6000 }
      );
    } else {
      setActivity([currentActivity]);
    }
  }, []);

  return (
    <main className="min-h-screen bg-white text-black">
      <header className="border-b border-zinc-200 bg-black text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
          <div>
            <div className="text-sm font-black uppercase text-red-200">LDA Account</div>
            <h1 className="mt-1 text-3xl font-black">Account centre</h1>
          </div>
          <Link href="/dashboard" className="lda-pill lda-pill-sm">
            <ArrowLeft size={16} /> Back to dashboard
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-5 px-4 py-8 sm:px-6 lg:grid-cols-2 lg:px-8">
        <article className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
          <Gift className="text-brand" />
          <h2 className="mt-4 text-2xl font-black">Invite Friends and Family</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">Share your personal link so friends and family can receive a lesson discount when referral rewards are enabled.</p>
          <div className="mt-4 rounded border border-zinc-200 bg-zinc-50 p-3 text-sm font-black text-zinc-800">{referralLink}</div>
          <button type="button" onClick={() => navigator.clipboard?.writeText(referralLink)} className="lda-pill lda-pill-sm mt-4">
            Copy referral link
          </button>
        </article>

        <article className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
          <TicketPercent className="text-brand" />
          <h2 className="mt-4 text-2xl font-black">Promotional Codes</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">Enter LDA promotional codes for lesson discounts, trials, or seasonal offers.</p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input value={promoCode} onChange={(event) => setPromoCode(event.target.value.toUpperCase())} placeholder="Enter code" className="min-w-0 flex-1 rounded border border-zinc-300 px-3 py-3 font-bold" />
            <button type="button" className="lda-pill lda-pill-sm">Apply code</button>
          </div>
        </article>

        <article id="manage-profile" className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
          <UserRound className="text-brand" />
          <h2 className="mt-4 text-2xl font-black">Manage Your Profile</h2>
          <div className="mt-5 grid gap-3">
            {[
              ["Personal Info", "/auth/verify?role=learner"],
              ["Change Password", "/auth/forgot-password?role=learner"],
              ["Add a Recovery Number", "/auth/verify?role=learner"],
              ["Your Logging Activities", "#logging-activities"]
            ].map(([label, href]) => (
              <Link key={label} href={href} className="flex items-center justify-between rounded border border-zinc-200 bg-zinc-50 p-4 text-sm font-black hover:ring-2 hover:ring-brand">
                {label} <KeyRound size={16} className="text-brand" />
              </Link>
            ))}
          </div>
        </article>

        <article id="logging-activities" className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
          <MapPin className="text-brand" />
          <h2 className="mt-4 text-2xl font-black">Your Logging Activities</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">Recent account activity from this browser. Production security can extend this with IP intelligence and suspicious-location email checks.</p>
          <div className="mt-5 grid gap-3">
            {activity.map((item) => (
              <div key={`${item.device}-${item.when}`} className="rounded border border-zinc-200 bg-zinc-50 p-4 text-sm">
                <div className="font-black">{item.device} · {item.browser}</div>
                <div className="mt-1 text-zinc-600">{item.when}</div>
                <div className="mt-1 font-bold text-zinc-700">{item.location}</div>
              </div>
            ))}
          </div>
        </article>

        <article id="settings" className="rounded border border-zinc-200 bg-white p-5 shadow-sm lg:col-span-2">
          <ShieldAlert className="text-brand" />
          <h2 className="mt-4 text-2xl font-black">Settings</h2>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="rounded border border-red-200 bg-red-50 p-4">
              <Trash2 className="text-brand" />
              <h3 className="mt-3 text-xl font-black">Account Deletion</h3>
              <p className="mt-2 text-sm leading-6 text-red-950">Deleting your account starts a recovery window before final removal. Booking and legal records may be retained where LDA has a lawful basis.</p>
              <button type="button" onClick={() => setDeletionRequested(true)} className="lda-pill lda-pill-sm mt-4">
                Request account deletion
              </button>
              {deletionRequested ? <p className="mt-3 text-sm font-black text-red-700">Deletion request noted. A final confirmation workflow will be added before live release.</p> : null}
            </div>
            <div className="rounded border border-zinc-200 bg-zinc-50 p-4">
              <h3 className="text-xl font-black">Sign Up</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">Create a learner or instructor profile if you need another role on LDA.</p>
              <Link href="/auth/sign-up?role=learner" className="lda-pill lda-pill-sm mt-4">
                Open sign up
              </Link>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}
