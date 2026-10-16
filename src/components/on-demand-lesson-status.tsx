"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { BadgeCheck, CarFront, Clock3, Loader2, RadioTower, RefreshCcw, XCircle } from "lucide-react";
import { LiveLessonMap } from "@/components/live-lesson-map";

type OnDemandStatus = {
  reference: string;
  status: string;
  paymentStatus?: string;
  cancelAllowed?: boolean;
  learnerEmail?: string;
  learnerPhone?: string;
  instructorName?: string;
  instructorEmail?: string;
  lessonSummary?: string;
  car?: string;
  message?: string;
  pickupLabel?: string;
  pickupPostcode?: string;
  pickupPoint?: { lat: number; lng: number } | null;
  instructorPoint?: { lat: number; lng: number } | null;
  instructorLocationRecordedAt?: string | null;
  error?: string;
};

type OnDemandLessonStatusProps = {
  reference: string;
  sessionId?: string;
  demo?: boolean;
};

function statusLabel(status?: string) {
  if (status === "instructor_en_route" || status === "en_route" || status === "in_progress") return "Instructor is en route";
  if (status === "accepted" || status === "upcoming") return "Instructor accepted";
  if (status === "cancelled") return "Cancelled";
  if (status === "refunded") return "Refunded";
  if (status === "payment_pending") return "Payment confirming";
  return "Waiting for instructor";
}

export function OnDemandLessonStatus({ reference, sessionId, demo }: OnDemandLessonStatusProps) {
  const [status, setStatus] = useState<OnDemandStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelMessage, setCancelMessage] = useState("");
  const [confirmationMessage, setConfirmationMessage] = useState("");
  const confirmationSentRef = useRef(false);

  const enRoute = status?.status === "instructor_en_route" || status?.status === "en_route" || status?.status === "in_progress";
  const accepted = status?.status === "accepted" || status?.status === "upcoming";
  const hasInstructor = accepted || enRoute;
  const cancelled = status?.status === "cancelled" || status?.paymentStatus === "refunded";
  const canCancel = Boolean(status?.cancelAllowed && !hasInstructor && !cancelled);

  const statusCopy = useMemo(() => {
    if (enRoute) {
      return `${status?.instructorName || "Your instructor"} is en route to your pickup point. Keep this page open to track the lesson.`;
    }

    if (accepted) {
      return `${status?.instructorName || "Your instructor"} has accepted your on-demand lesson. Distance and arrival time will activate when they are en route.`;
    }

    if (cancelled) {
      return "This on-demand request has been cancelled. If payment was taken, the refund has been requested through Stripe.";
    }

    return "We are looking for the closest suitable LDA instructor with availability. You can keep waiting, or cancel before an instructor accepts.";
  }, [accepted, cancelled, enRoute, status?.instructorName]);

  useEffect(() => {
    let active = true;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    async function loadStatus() {
      const params = new URLSearchParams({ reference });
      if (sessionId) params.set("session_id", sessionId);
      if (demo) params.set("demo", "1");

      try {
        const response = await fetch(`/api/instant-lessons/status?${params.toString()}`, {
          cache: "no-store"
        });
        const result = (await response.json()) as OnDemandStatus;
        if (!active) return;

        setStatus(result);
        setLoading(false);

        if (response.ok && !["cancelled", "refunded"].includes(result.status)) {
          timeoutId = setTimeout(loadStatus, ["accepted", "upcoming", "instructor_en_route", "en_route", "in_progress"].includes(result.status) ? 10000 : 3000);
        }
      } catch {
        if (!active) return;
        setStatus({
          reference,
          status: "waiting_for_instructor",
          error: "Status could not be refreshed. Keep this page open and try again."
        });
        setLoading(false);
        timeoutId = setTimeout(loadStatus, 5000);
      }
    }

    loadStatus();

    return () => {
      active = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [demo, reference, sessionId]);

  useEffect(() => {
    const confirmationKey = `lda-instant-booking-confirmed-${reference}`;
    const paymentConfirmed = status?.paymentStatus === "paid";

    if (!paymentConfirmed || confirmationSentRef.current || !status?.learnerEmail) {
      return;
    }

    if (typeof window !== "undefined" && window.sessionStorage.getItem(confirmationKey)) {
      setConfirmationMessage("Your booking reference confirmation has already been queued for this booking on this device.");
      return;
    }

    confirmationSentRef.current = true;
    setConfirmationMessage(status.learnerPhone ? "Sending your booking reference by email and text..." : "Sending your booking reference by email...");

    const trackingUrl = typeof window !== "undefined" ? window.location.href : "";

    fetch("/api/instant-lessons/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reference,
        learnerEmail: status.learnerEmail,
        learnerPhone: status.learnerPhone,
        learnerName: "Learner",
        instructorName: status.instructorName || "your LDA instructor",
        lessonSummary: status.lessonSummary || "On-demand LDA lesson",
        trackingUrl
      })
    })
      .then(async (response) => {
        const result = await response.json().catch(() => ({ message: "" }));

        if (!response.ok) {
          if (result?.email?.ok || result?.sms?.ok) {
            if (typeof window !== "undefined") {
              window.sessionStorage.setItem(confirmationKey, "1");
            }
          } else {
            confirmationSentRef.current = false;
          }
          setConfirmationMessage(result.message || "Your booking reference is saved, but LDA could not send the email or text yet.");
          return;
        }

        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(confirmationKey, "1");
        }

        setConfirmationMessage(result.message || "Your booking reference confirmation has been sent.");
      })
      .catch(() => {
        confirmationSentRef.current = false;
        setConfirmationMessage("Your booking reference is saved, but LDA could not send the email or text yet. Refresh this page to try again.");
      });
  }, [reference, status]);

  async function cancelRequest() {
    if (!canCancel) return;

    setCancelLoading(true);
    setCancelMessage("");

    const response = await fetch("/api/instant-lessons/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reference, sessionId })
    });
    const result = await response.json();

    setCancelLoading(false);
    setCancelMessage(result.message || result.error || "Cancellation request completed.");

    if (response.ok) {
      setStatus((current) => ({
        ...(current ?? { reference }),
        reference,
        status: "cancelled",
        paymentStatus: "refunded",
        cancelAllowed: false
      }));
    }
  }

  return (
    <div className="mt-8 rounded bg-zinc-100 p-6 text-center sm:p-10">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white text-brand">
        {hasInstructor ? <BadgeCheck size={34} /> : cancelled ? <XCircle size={34} /> : <Loader2 size={34} className="animate-spin" />}
      </div>
      <h1 className="mt-5 text-4xl font-black tracking-normal sm:text-5xl">
        {enRoute ? "Your instructor is on the way." : accepted ? "Instructor accepted." : cancelled ? "On-demand lesson cancelled." : "Waiting for an instructor."}
      </h1>
      <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-zinc-700">{statusCopy}</p>

      <div className="mx-auto mt-6 max-w-md rounded bg-black p-5 text-white">
        <div className="text-sm font-black uppercase text-red-200">Booking reference</div>
        <div className="mt-2 break-all font-mono text-3xl font-black">{reference}</div>
        <p className="mt-3 text-sm font-bold leading-6 text-zinc-200">
          We will email this reference and tracking link to you. If you added a phone number, LDA will text the same confirmation.
        </p>
        {confirmationMessage ? <p className="mt-3 text-sm font-black leading-6 text-red-100">{confirmationMessage}</p> : null}
      </div>

      <div className="mt-6 grid gap-3 text-left md:grid-cols-3">
        <div className="rounded bg-white p-4">
          <div className="flex items-center gap-2 text-sm font-black text-zinc-500">
            <CarFront size={17} /> Instructor
          </div>
          <div className="mt-2 text-xl font-black">{hasInstructor ? status?.instructorName : "Searching"}</div>
          <div className="mt-1 text-sm font-bold text-zinc-600">{hasInstructor ? status?.car || "LDA instructor vehicle" : "Closest suitable instructor with availability"}</div>
        </div>
        <div className="rounded bg-white p-4">
          <div className="flex items-center gap-2 text-sm font-black text-zinc-500">
            <Clock3 size={17} /> Status
          </div>
          <div className="mt-2 text-xl font-black">{loading ? "Loading" : statusLabel(status?.status)}</div>
          <div className="mt-1 text-sm font-bold text-zinc-600">{status?.message || "Keep this page open for updates."}</div>
        </div>
        <div className="rounded bg-white p-4">
          <div className="flex items-center gap-2 text-sm font-black text-zinc-500">
            <RadioTower size={17} /> Tracking
          </div>
          <div className="mt-2 text-xl font-black">{enRoute ? "Ready" : "Pending"}</div>
          <div className="mt-1 text-sm font-bold text-zinc-600">
            {enRoute ? "Distance and arrival time are live while the instructor travels." : accepted ? "Distance and arrival time activate once the instructor is en route." : "Tracking unlocks once an instructor accepts and goes en route."}
          </div>
        </div>
      </div>

      {status?.error ? <p className="mt-4 rounded bg-red-50 p-3 text-sm font-black text-red-700">{status.error}</p> : null}

      {canCancel ? (
        <div className="mt-6 rounded bg-white p-4 text-left">
          <h2 className="font-black">Still waiting?</h2>
          <p className="mt-1 text-sm font-bold leading-6 text-zinc-600">
            You can cancel while LDA is still looking for an instructor. Once an instructor accepts and starts preparing to travel, automatic refund cancellation is locked.
          </p>
          <button
            type="button"
            onClick={cancelRequest}
            disabled={cancelLoading}
            className="lda-pill lda-pill-sm mt-4"
          >
            <RefreshCcw size={17} /> {cancelLoading ? "Cancelling..." : "Cancel and refund"}
          </button>
        </div>
      ) : null}

      {cancelMessage ? <p className="mt-4 rounded bg-red-50 p-3 text-sm font-black text-brand">{cancelMessage}</p> : null}

      <div className="mt-6 rounded bg-white p-4 text-left">
        <div className="mb-3 flex items-center gap-2 text-sm font-black uppercase text-brand">
          <RadioTower size={17} /> {demo ? "Guest live tracking demo" : "Live lesson tracking"}
        </div>
        <LiveLessonMap
          mode={demo ? "demo" : "live"}
          lesson={{
            bookingReference: reference,
            instructorName: hasInstructor ? status?.instructorName || "your LDA instructor" : "Waiting for instructor",
            pickupLabel: status?.pickupLabel || (hasInstructor ? "Your live location" : "Your pickup location"),
            pickupPostcode: status?.pickupPostcode || "On-demand pickup",
            status: enRoute ? "instructor_en_route" : accepted ? "accepted" : "pending",
            pickupPoint: status?.pickupPoint ?? null,
            instructorPoint: enRoute ? status?.instructorPoint ?? null : null,
            instructorLocationRecordedAt: enRoute ? status?.instructorLocationRecordedAt ?? null : null
          }}
        />
      </div>

      <Link href="/" className="lda-pill mt-8">
        Back to homepage
      </Link>
    </div>
  );
}
