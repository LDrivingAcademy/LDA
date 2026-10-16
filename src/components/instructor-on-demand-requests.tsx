"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Navigation, RadioTower, ToggleLeft, ToggleRight, XCircle } from "lucide-react";

export type InstructorOnDemandRequest = {
  reference: string;
  learnerEmail?: string | null;
  learnerPhone?: string | null;
  summary?: string | null;
  pickup?: string | null;
  pickupLabel?: string | null;
  pickupLatitude?: number | null;
  pickupLongitude?: number | null;
  pricePence?: number | null;
  car?: string | null;
  status: string;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type InstructorOnDemandRequestsProps = {
  requests: InstructorOnDemandRequest[];
  autoAcceptEnabled: boolean;
};

type Notice = {
  text: string;
  tone: "success" | "danger" | "neutral";
};

function statusLabel(status: string) {
  if (status === "pending_assignment") return "Pending";
  if (status === "instructor_en_route" || status === "en_route") return "On route";
  if (status === "accepted" || status === "upcoming") return "Accepted";
  return "Matching";
}

function statusClasses(status: string) {
  if (status === "pending_assignment") return "border-amber-200 bg-amber-50 text-amber-900";
  if (status === "instructor_en_route" || status === "en_route") return "border-sky-200 bg-sky-50 text-sky-900";
  if (status === "accepted" || status === "upcoming") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  return "border-zinc-200 bg-zinc-50 text-zinc-700";
}

function routeDestination(request: InstructorOnDemandRequest) {
  if (
    typeof request.pickupLatitude === "number" &&
    Number.isFinite(request.pickupLatitude) &&
    typeof request.pickupLongitude === "number" &&
    Number.isFinite(request.pickupLongitude)
  ) {
    return `${request.pickupLatitude},${request.pickupLongitude}`;
  }

  return (request.pickupLabel || request.pickup || "").trim();
}

function mapsUrl(request: InstructorOnDemandRequest) {
  const destinationText = routeDestination(request);
  if (!destinationText) {
    return "";
  }

  const destination = encodeURIComponent(destinationText);
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
}

export function InstructorOnDemandRequests({ requests, autoAcceptEnabled }: InstructorOnDemandRequestsProps) {
  const [rows, setRows] = useState(requests);
  const [autoAccept, setAutoAccept] = useState(autoAcceptEnabled);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [noticeVisible, setNoticeVisible] = useState(false);

  useEffect(() => {
    if (!notice) {
      setNoticeVisible(false);
      return;
    }

    setNoticeVisible(true);
    const fadeTimer = window.setTimeout(() => setNoticeVisible(false), 5000);
    const removeTimer = window.setTimeout(() => setNotice(null), 5500);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(removeTimer);
    };
  }, [notice]);

  const visibleRows = useMemo(() => {
    const activeRows = rows.filter((row) => ["pending_assignment", "accepted", "upcoming", "instructor_en_route", "en_route"].includes(row.status));
    return activeRows
      .sort((a, b) => {
        const aTime = new Date(a.createdAt || a.updatedAt || 0).getTime();
        const bTime = new Date(b.createdAt || b.updatedAt || 0).getTime();
        return aTime - bTime;
      })
      .slice(0, 1);
  }, [rows]);

  async function postAction(payload: Record<string, unknown>, busyKey: string) {
    setBusyAction(busyKey);
    setNotice(null);

    try {
      const response = await fetch("/api/instant-lessons/instructor-response", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || "On-demand booking update failed.");
      }

      const noticeTone =
        busyKey === "auto_accept"
          ? result?.autoAccept === true
            ? "success"
            : "danger"
          : "neutral";
      setNotice({
        text: result?.message || "On-demand booking updated.",
        tone: noticeTone
      });
      return result as { status?: string; autoAccept?: boolean };
    } catch (error) {
      setNotice({
        text: error instanceof Error ? error.message : "On-demand booking update failed.",
        tone: "danger"
      });
      return null;
    } finally {
      setBusyAction(null);
    }
  }

  async function updateAutoAccept(nextValue: boolean) {
    const result = await postAction({ action: "auto_accept", autoAccept: nextValue }, "auto_accept");
    if (result) {
      setAutoAccept(Boolean(result.autoAccept));
    }
  }

  async function respond(reference: string, action: "accept" | "decline" | "en_route") {
    const result = await postAction({ action, reference }, `${reference}:${action}`);
    if (!result) return;

    if (action === "decline") {
      setRows((current) => current.filter((row) => row.reference !== reference));
      return;
    }

    setRows((current) =>
      current.map((row) =>
        row.reference === reference
          ? {
              ...row,
              status: result.status || (action === "en_route" ? "instructor_en_route" : "accepted")
            }
          : row
      )
    );
  }

  async function goOnRoute(request: InstructorOnDemandRequest) {
    const routeUrl = mapsUrl(request);
    if (!routeUrl) {
      setNotice({
        text: "Pickup location is missing for this on-demand booking. Contact LDA support before travelling.",
        tone: "danger"
      });
      return;
    }

    const routeWindow = window.open("", "_blank", "noopener,noreferrer");
    const result = await postAction({ action: "en_route", reference: request.reference }, `${request.reference}:en_route`);

    if (!result) {
      routeWindow?.close();
      return;
    }

    setRows((current) =>
      current.map((row) =>
        row.reference === request.reference
          ? {
              ...row,
              status: result.status || "instructor_en_route"
            }
          : row
      )
    );

    if (routeWindow) {
      routeWindow.location.href = routeUrl;
    } else {
      window.location.href = routeUrl;
    }
  }

  return (
    <section className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
      <div className="border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-normal text-brand">
              <RadioTower size={17} /> On-demand bookings
            </div>
            <h2 className="mt-2 text-2xl font-black tracking-normal text-black">Accept, decline, or go en route.</h2>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-zinc-600">
              LDA shows one live on-demand request at a time. Auto-accept confirms it for you when enabled; declined requests move to the next suitable instructor automatically.
            </p>
          </div>
          <button
            type="button"
            onClick={() => updateAutoAccept(!autoAccept)}
            disabled={busyAction === "auto_accept"}
            className={`inline-flex items-center justify-center gap-2 border px-4 py-3 text-sm font-black text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              autoAccept
                ? "border-emerald-700 bg-emerald-600 hover:bg-emerald-700"
                : "border-red-700 bg-red-600 hover:bg-red-700"
            }`}
          >
            {autoAccept ? <ToggleRight size={19} /> : <ToggleLeft size={19} />}
            Auto-accept {autoAccept ? "on" : "off"}
          </button>
        </div>

        {notice ? (
          <div
            role="status"
            aria-live="polite"
            className={`mt-4 border px-4 py-3 text-sm font-bold transition-opacity duration-500 ${
              noticeVisible ? "opacity-100" : "opacity-0"
            } ${
              notice.tone === "success"
                ? "border-emerald-700 bg-emerald-600 text-white"
                : notice.tone === "danger"
                  ? "border-red-700 bg-red-600 text-white"
                  : "border-zinc-200 bg-zinc-50 text-zinc-800"
            }`}
          >
            {notice.text}
          </div>
        ) : null}

        <div className="mt-5 grid gap-3">
          {visibleRows.length ? (
            visibleRows.map((request) => {
              const isPending = request.status === "pending_assignment";
              const isAccepted = request.status === "accepted" || request.status === "upcoming";
              const isEnRoute = request.status === "instructor_en_route" || request.status === "en_route";
              const routeUrl = mapsUrl(request);
              const price = typeof request.pricePence === "number" ? `£${(request.pricePence / 100).toFixed(2)}` : "Price confirmed";
              const summary = isEnRoute
                ? "On-demand LDA lesson accepted. Your instructor is on the way to your pickup point."
                : request.summary || "On-demand LDA lesson request.";

              return (
                <article key={request.reference} className="border border-zinc-200 bg-white p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className={`inline-flex items-center gap-2 border px-3 py-1 text-xs font-black uppercase ${statusClasses(request.status)}`}>
                        {statusLabel(request.status)}
                      </div>
                      <h3 className="mt-3 text-xl font-black text-black">{request.reference}</h3>
                      <p className="mt-2 text-sm font-semibold leading-6 text-zinc-600">
                        {summary}
                      </p>
                      <div className="mt-3 grid gap-2 text-sm font-bold text-zinc-800 sm:grid-cols-2">
                        <span>Pickup: {request.pickupLabel || request.pickup || "Pickup point missing"}</span>
                        <span>Lesson value: {price}</span>
                        <span>Contact: {request.learnerEmail || "Learner account"}</span>
                        <span>Vehicle: {request.car || "Your listed vehicle"}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      {isPending ? (
                        <>
                          <button
                            type="button"
                            onClick={() => respond(request.reference, "accept")}
                            disabled={busyAction === `${request.reference}:accept`}
                            className="inline-flex items-center gap-2 border border-emerald-600 bg-emerald-600 px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <CheckCircle2 size={17} /> Accept
                          </button>
                          <button
                            type="button"
                            onClick={() => respond(request.reference, "decline")}
                            disabled={busyAction === `${request.reference}:decline`}
                            className="inline-flex items-center gap-2 border border-zinc-300 bg-white px-4 py-3 text-sm font-black text-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <XCircle size={17} /> Decline
                          </button>
                        </>
                      ) : null}
                      {isAccepted ? (
                        <button
                          type="button"
                          onClick={() => goOnRoute(request)}
                          disabled={busyAction === `${request.reference}:en_route`}
                          className="inline-flex items-center gap-2 border border-black bg-black px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Navigation size={17} /> Go on route
                        </button>
                      ) : null}
                      {isEnRoute ? (
                        <a
                          href={routeUrl}
                          target="_blank"
                          rel="noreferrer"
                          aria-disabled={!routeUrl}
                          className={`inline-flex min-w-32 items-center justify-center gap-2 border border-black bg-black px-4 py-3 text-sm font-black text-white ${routeUrl ? "" : "pointer-events-none opacity-50"}`}
                        >
                          Route <ArrowRight size={17} />
                        </a>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="border border-zinc-200 bg-zinc-50 p-4 text-sm font-bold text-zinc-600">
              No on-demand requests are waiting right now.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
