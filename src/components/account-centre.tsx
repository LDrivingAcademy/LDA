"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BadgeCheck, BellRing, Gift, History, KeyRound, LogOut, MapPin, MessageSquareText, Navigation, ShieldAlert, Star, TicketPercent, Trash2, UserRound } from "lucide-react";
import { signOut } from "@/app/auth/actions";

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
  const [notificationPrefs, setNotificationPrefs] = useState({
    lessonUpdates: true,
    driverEnRoute: true,
    driverArrived: true,
    cancellationUpdates: true,
    offers: false
  });
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
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
        <article id="live-tracking" className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
          <Navigation className="text-brand" />
          <h2 className="mt-4 text-2xl font-black">Live Tracking</h2>
          <h3 className="mt-2 text-xl font-black text-zinc-800">Available near lesson time.</h3>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Tracking starts when an instructor marks themselves en route, usually around 15 minutes before pickup, and stops once they arrive at the agreed location.
          </p>
          <Link href="/tracking" className="lda-pill lda-pill-sm mt-4">
            Open tracking view
          </Link>
        </article>

        <article id="after-lesson-revision" className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
          <BadgeCheck className="text-brand" />
          <h2 className="mt-4 text-2xl font-black">After Lesson Revision</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Review instructor notes, completed lesson checklist items, and recommended videos before your next lesson.
          </p>
          <Link href="/progress-tracker" className="lda-pill lda-pill-sm mt-4">
            Open progress tracker
          </Link>
        </article>

        <article id="booking-history" className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
          <History className="text-brand" />
          <h2 className="mt-4 text-2xl font-black">Your Booking History</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">See previous, upcoming, cancelled, and completed lessons in one place.</p>
          <div className="mt-4 grid gap-3">
            {[
              ["Amelia Khan", "Upcoming", "16 May 2026 at 10:00"],
              ["Marcus Reed", "Completed", "8 May 2026 at 15:00"]
            ].map(([instructor, status, time]) => (
              <div key={`${instructor}-${time}`} className="rounded border border-zinc-200 bg-zinc-50 p-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-black">{instructor}</span>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-black uppercase text-zinc-700">{status}</span>
                </div>
                <div className="mt-1 text-zinc-600">{time}</div>
              </div>
            ))}
          </div>
        </article>

        <article id="rate-your-instructor" className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
          <MessageSquareText className="text-brand" />
          <h2 className="mt-4 text-2xl font-black">Rate Your Instructor</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">Leave a review after a completed lesson. Learners are not reviewed on LDA.</p>
          <div className="mt-4 flex gap-1">
            {[1, 2, 3, 4, 5].map((rating) => (
              <button
                key={rating}
                type="button"
                onClick={() => setReviewRating(rating)}
                className={rating <= reviewRating ? "text-brand" : "text-zinc-300"}
                aria-label={`${rating} star review`}
              >
                <Star size={24} fill="currentColor" />
              </button>
            ))}
          </div>
          <textarea
            value={reviewText}
            onChange={(event) => setReviewText(event.target.value)}
            placeholder="Write an optional review for your completed lesson"
            className="mt-4 min-h-24 w-full rounded border border-zinc-300 bg-white p-3 text-sm font-bold text-black"
          />
          <button type="button" className="lda-pill lda-pill-sm mt-4">
            Save review
          </button>
        </article>

        <article id="notification-hub" className="rounded border border-zinc-200 bg-white p-5 shadow-sm lg:col-span-2">
          <BellRing className="text-brand" />
          <h2 className="mt-4 text-2xl font-black">Notification Hub</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">Choose which lesson alerts LDA can send for your account.</p>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {[
              ["lessonUpdates", "Lesson confirmations and changes"],
              ["driverEnRoute", "Instructor en route alerts"],
              ["driverArrived", "Instructor has arrived"],
              ["cancellationUpdates", "Cancellation and refund updates"],
              ["offers", "Deals, free trials, and learner offers"]
            ].map(([key, label]) => (
              <label key={key} className="flex items-center justify-between gap-4 rounded border border-zinc-200 bg-zinc-50 p-3 text-sm font-black text-zinc-800">
                <span>{label}</span>
                <input
                  type="checkbox"
                  checked={notificationPrefs[key as keyof typeof notificationPrefs]}
                  onChange={(event) => setNotificationPrefs((prefs) => ({ ...prefs, [key]: event.target.checked }))}
                  className="h-5 w-5 accent-red-600"
                />
              </label>
            ))}
          </div>
        </article>

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
