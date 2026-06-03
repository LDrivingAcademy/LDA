"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, KeyRound, LogOut, MapPin, ShieldAlert, Trash2, UserRound } from "lucide-react";
import { signOut } from "@/app/auth/actions";

const LOCATION_PREF_KEY = "lda-location-sharing-enabled";

type LoginActivity = {
  device: string;
  browser: string;
  when: string;
  location: string;
};

export function AccountCentre() {
  const [deletionRequested, setDeletionRequested] = useState(false);
  const [activity, setActivity] = useState<LoginActivity[]>([]);
  const [locationSharingEnabled, setLocationSharingEnabled] = useState(true);
  const [locationStatus, setLocationStatus] = useState("Location sharing is on for live tracking and nearby instructor sorting.");

  useEffect(() => {
    const currentActivity: LoginActivity = {
      device: navigator.platform || "This device",
      browser: navigator.userAgent.includes("Safari") && !navigator.userAgent.includes("Chrome") ? "Safari" : "Browser",
      when: new Date().toLocaleString("en-GB"),
      location: "Location permission not shared"
    };

    const storedPreference = localStorage.getItem(LOCATION_PREF_KEY);
    const enabled = storedPreference !== "false";
    setLocationSharingEnabled(enabled);

    if (storedPreference === null) {
      localStorage.setItem(LOCATION_PREF_KEY, "true");
    }

    if (!enabled) {
      setLocationStatus("Location sharing is off. Live tracking and nearby instructor sorting will use your postcode until it is turned back on.");
      setActivity([currentActivity]);
      localStorage.setItem("lda-login-activity", JSON.stringify([currentActivity]));
      return;
    }

    if (navigator.geolocation && navigator.permissions) {
      navigator.permissions
        .query({ name: "geolocation" as PermissionName })
        .then((permission) => {
          if (permission.state !== "granted") {
            setLocationStatus("Location sharing is on. Your browser still controls whether LDA can access GPS location.");
            setActivity([currentActivity]);
            localStorage.setItem("lda-login-activity", JSON.stringify([currentActivity]));
            return;
          }

          navigator.geolocation.getCurrentPosition(
            (position) => {
              const located = {
                ...currentActivity,
                location: `${position.coords.latitude.toFixed(2)}, ${position.coords.longitude.toFixed(2)}`
              };
              setActivity([located]);
              setLocationStatus("Location sharing is on and this browser has approved location access.");
              localStorage.setItem("lda-login-activity", JSON.stringify([located]));
            },
            () => {
              setActivity([currentActivity]);
              setLocationStatus("Location sharing is on, but this browser did not share its location.");
              localStorage.setItem("lda-login-activity", JSON.stringify([currentActivity]));
            },
            { enableHighAccuracy: false, timeout: 6000 }
          );
        })
        .catch(() => {
          setActivity([currentActivity]);
          localStorage.setItem("lda-login-activity", JSON.stringify([currentActivity]));
        });
    } else if (navigator.geolocation) {
      setLocationStatus("Location sharing is on. Use the dashboard location button once if this browser needs approval.");
      setActivity([currentActivity]);
      localStorage.setItem("lda-login-activity", JSON.stringify([currentActivity]));
    } else {
      setLocationStatus("Location is not supported on this device.");
      setActivity([currentActivity]);
    }
  }, []);

  function updateLocationPreference(enabled: boolean) {
    setLocationSharingEnabled(enabled);
    localStorage.setItem(LOCATION_PREF_KEY, String(enabled));

    if (enabled) {
      setLocationStatus("Location sharing is on. Browser permission is only requested from the dashboard when needed.");
      return;
    }

    setLocationStatus("Location sharing is off. Live tracking and nearby instructor sorting will use your postcode until it is turned back on.");
  }

  return (
    <main className="min-h-screen bg-white text-black">
      <header className="border-b border-zinc-200 bg-black text-white">
        <div className="flex w-full items-center justify-between px-[15px] py-5">
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
              ["Personal Info", "/account/personal-info"],
              ["Change Password", "/auth/forgot-password?role=learner"],
              ["Add a Recovery Number", "/account/personal-info"],
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
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <div className="flex h-full flex-col rounded border border-zinc-200 bg-zinc-50 p-4">
              <MapPin className="text-brand" />
              <div className="mt-3 flex items-center justify-between gap-4">
                <h3 className="text-xl font-black">Use my location</h3>
                <button
                  type="button"
                  aria-pressed={locationSharingEnabled}
                  onClick={() => updateLocationPreference(!locationSharingEnabled)}
                  className={`relative h-8 w-14 rounded-full transition ${locationSharingEnabled ? "bg-brand" : "bg-zinc-300"}`}
                >
                  <span className={`absolute top-1 h-6 w-6 rounded-full bg-white transition ${locationSharingEnabled ? "left-7" : "left-1"}`} />
                </button>
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{locationStatus}</p>
            </div>
            <div className="flex h-full flex-col rounded border border-red-200 bg-red-50 p-4">
              <Trash2 className="text-brand" />
              <h3 className="mt-3 text-xl font-black">Account Deletion</h3>
              <p className="mt-2 text-sm leading-6 text-red-950">
                Deleting your account starts a recovery window before final removal. Booking and legal records may be retained where LDA has a lawful basis.
              </p>
              <div className="mt-auto pt-4">
                <button type="button" onClick={() => setDeletionRequested(true)} className="lda-pill lda-pill-sm">
                  Request account deletion
                </button>
                {deletionRequested ? <p className="mt-3 text-sm font-black text-red-700">Deletion request noted. A final confirmation workflow will be added before live release.</p> : null}
              </div>
            </div>
            <div className="flex h-full flex-col rounded border border-zinc-200 bg-zinc-50 p-4">
              <LogOut className="text-brand" />
              <h3 className="mt-3 text-xl font-black">Sign Out</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">Leave this device signed out of your LDA account.</p>
              <form action={signOut} className="mt-auto pt-4">
                <button type="submit" className="lda-pill lda-pill-sm">
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
