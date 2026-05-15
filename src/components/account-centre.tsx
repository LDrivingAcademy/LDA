"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, KeyRound, LogOut, MapPin, MonitorSmartphone, ShieldAlert, Trash2, UserRound } from "lucide-react";
import { signOut } from "@/app/auth/actions";

const LOCATION_PREF_KEY = "lda-location-sharing-enabled";
const TRUSTED_DEVICE_KEY = "lda_trusted_device";
const TRUSTED_DEVICES_KEY = "lda_trusted_devices";
const REMEMBERED_IDENTIFIER_KEY = "lda_remember_identifier";

type LoginActivity = {
  device: string;
  browser: string;
  when: string;
  location: string;
};

type TrustedDevice = {
  id: string;
  name: string;
  identifier?: string;
  addedAt: string;
};

export function AccountCentre() {
  const [deletionRequested, setDeletionRequested] = useState(false);
  const [activity, setActivity] = useState<LoginActivity[]>([]);
  const [trustedDevices, setTrustedDevices] = useState<TrustedDevice[]>([]);
  const [locationSharingEnabled, setLocationSharingEnabled] = useState(true);
  const [locationStatus, setLocationStatus] = useState("Location sharing is on for live tracking and nearby instructor sorting.");

  useEffect(() => {
    const currentActivity: LoginActivity = {
      device: navigator.platform || "This device",
      browser: navigator.userAgent.includes("Safari") && !navigator.userAgent.includes("Chrome") ? "Safari" : "Browser",
      when: new Date().toLocaleString("en-GB"),
      location: "Location permission not shared"
    };

    const storedDevices = localStorage.getItem(TRUSTED_DEVICES_KEY);
    setTrustedDevices(storedDevices ? (JSON.parse(storedDevices) as TrustedDevice[]) : []);

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

  function currentDeviceName() {
    const browser = navigator.userAgent.includes("Safari") && !navigator.userAgent.includes("Chrome") ? "Safari" : navigator.userAgent.includes("Chrome") ? "Chrome" : "Browser";
    return `${navigator.platform || "This device"} · ${browser}`;
  }

  function addCurrentDevice() {
    const identifier = localStorage.getItem(REMEMBERED_IDENTIFIER_KEY) ?? undefined;
    const device: TrustedDevice = {
      id: crypto.randomUUID(),
      name: currentDeviceName(),
      identifier,
      addedAt: new Date().toISOString()
    };
    const nextDevices = [device, ...trustedDevices.filter((item) => item.name !== device.name)].slice(0, 8);
    setTrustedDevices(nextDevices);
    localStorage.setItem(TRUSTED_DEVICE_KEY, "true");
    localStorage.setItem(TRUSTED_DEVICES_KEY, JSON.stringify(nextDevices));
  }

  function removeDevice(id: string) {
    const nextDevices = trustedDevices.filter((device) => device.id !== id);
    setTrustedDevices(nextDevices);
    localStorage.setItem(TRUSTED_DEVICES_KEY, JSON.stringify(nextDevices));
    if (nextDevices.length === 0) {
      localStorage.removeItem(TRUSTED_DEVICE_KEY);
    }
  }

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
              ["Device List", "#device-list"],
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
            <div className="rounded border border-zinc-200 bg-zinc-50 p-4">
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

        <article id="device-list" className="rounded border border-zinc-200 bg-white p-5 shadow-sm lg:col-span-2">
          <MonitorSmartphone className="text-brand" />
          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black">Device List</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
                Add trusted devices that can remember your LDA login identifier. If your browser password manager also fills the password, LDA can send you straight through on this device.
              </p>
            </div>
            <button type="button" onClick={addCurrentDevice} className="lda-pill lda-pill-sm">
              Add this device
            </button>
          </div>
          <div className="mt-5 grid gap-3">
            {trustedDevices.length ? (
              trustedDevices.map((device) => (
                <div key={device.id} className="flex flex-wrap items-center justify-between gap-3 rounded border border-zinc-200 bg-zinc-50 p-4">
                  <div>
                    <div className="font-black">{device.name}</div>
                    <div className="mt-1 text-sm text-zinc-600">Added {new Date(device.addedAt).toLocaleString("en-GB")}</div>
                    {device.identifier ? <div className="mt-1 text-sm font-bold text-zinc-700">{device.identifier}</div> : null}
                  </div>
                  <button type="button" onClick={() => removeDevice(device.id)} className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-black hover:ring-2 hover:ring-brand">
                    Remove
                  </button>
                </div>
              ))
            ) : (
              <div className="rounded border border-zinc-200 bg-zinc-50 p-4 text-sm font-bold text-zinc-600">No remembered devices have been added from this browser yet.</div>
            )}
          </div>
        </article>
      </section>
    </main>
  );
}
