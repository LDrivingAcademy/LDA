"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, KeyRound, LogOut, MapPin, ShieldAlert, Trash2, UserRound } from "lucide-react";
import { signOut } from "@/app/auth/actions";

type LoginActivity = {
  device: string;
  browser: string;
  when: string;
  location: string;
};

export function AccountCentre() {
  const [deletionRequested, setDeletionRequested] = useState(false);
  const [activity, setActivity] = useState<LoginActivity[]>([]);

  useEffect(() => {
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
        <article id="manage-profile" className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
          <UserRound className="text-brand" />
          <h2 className="mt-4 text-2xl font-black">Manage Your Profile</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Keep your personal information, password, recovery number, and security settings up to date.
          </p>
          <div className="mt-5 grid gap-3">
            {[
              ["Personal Info", "/auth/verify?role=learner"],
              ["Change Password", "/auth/forgot-password?role=learner"],
              ["Add a Recovery Number", "/auth/verify?role=learner"],
              ["Your Log In Activities", "#log-in-activities"]
            ].map(([label, href]) => (
              <Link key={label} href={href} className="flex items-center justify-between rounded border border-zinc-200 bg-zinc-50 p-4 text-sm font-black hover:ring-2 hover:ring-brand">
                {label} <KeyRound size={16} className="text-brand" />
              </Link>
            ))}
          </div>
        </article>

        <article id="log-in-activities" className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
          <MapPin className="text-brand" />
          <h2 className="mt-4 text-2xl font-black">Your Log In Activities</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Recent account activity from this browser. Production security can extend this with IP intelligence and suspicious-location email checks.
          </p>
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
              <p className="mt-2 text-sm leading-6 text-red-950">
                Deleting your account starts a recovery window before final removal. Booking and legal records may be retained where LDA has a lawful basis.
              </p>
              <button type="button" onClick={() => setDeletionRequested(true)} className="lda-pill lda-pill-sm mt-4">
                Request account deletion
              </button>
              {deletionRequested ? <p className="mt-3 text-sm font-black text-red-700">Deletion request noted. A final confirmation workflow will be added before live release.</p> : null}
            </div>
            <div className="rounded border border-zinc-200 bg-zinc-50 p-4">
              <LogOut className="text-brand" />
              <h3 className="mt-3 text-xl font-black">Sign Out</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">Leave this device signed out of your LDA account.</p>
              <form action={signOut}>
                <button type="submit" className="lda-pill lda-pill-sm mt-4">
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}
