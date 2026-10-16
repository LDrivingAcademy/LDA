"use client";

import { useEffect, useState, useTransition } from "react";
import { ClipboardCheck } from "lucide-react";
import { acknowledgeShiftHandover } from "@/app/technical-support/actions";

type HandoverLine = {
  label: string;
  value: string;
};

type TechnicalSupportHandoverBriefProps = {
  accessLabel: string;
  briefSummary: string;
  handoverDate: string;
  initiallyOpen: boolean;
  lines: HandoverLine[];
  requiresAcknowledgement: boolean;
};

export function TechnicalSupportHandoverBrief({
  accessLabel,
  briefSummary,
  handoverDate,
  initiallyOpen,
  lines,
  requiresAcknowledgement
}: TechnicalSupportHandoverBriefProps) {
  const [open, setOpen] = useState(initiallyOpen);
  const [needsAcknowledgement, setNeedsAcknowledgement] = useState(requiresAcknowledgement);
  const [acknowledgementError, setAcknowledgementError] = useState("");
  const [isAcknowledging, startAcknowledgement] = useTransition();

  useEffect(() => {
    if (initiallyOpen) {
      setOpen(true);
      setNeedsAcknowledgement(requiresAcknowledgement);
    }
  }, [handoverDate, initiallyOpen, requiresAcknowledgement]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setNeedsAcknowledgement(false);
            setOpen(true);
          }}
          className="inline-flex items-center gap-2 rounded border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-black text-white transition hover:border-red-500 hover:ring-2 hover:ring-red-500/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-300"
        >
          <ClipboardCheck size={17} />
          Handover brief
        </button>
        <div className="rounded border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm font-black text-zinc-300">
          Auto-refresh enabled · {accessLabel}
        </div>
      </div>

      {open ? (
        <section
          aria-describedby="shift-handover-description"
          aria-labelledby="shift-handover-title"
          aria-modal="true"
          role="dialog"
          className="fixed inset-0 z-[100] grid place-items-center bg-black/80 px-4 py-8 backdrop-blur-sm"
        >
          <article className="w-full max-w-2xl rounded border border-zinc-700 bg-zinc-950 p-6 text-white shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded border border-red-500/30 bg-red-500/15 text-brand">
                <ClipboardCheck size={24} />
              </div>
              <div>
                <div className="text-sm font-black uppercase text-red-200">Daily shift handover</div>
                <h2 id="shift-handover-title" className="mt-1 text-3xl font-black tracking-normal">
                  Today&apos;s operational brief
                </h2>
                <p id="shift-handover-description" className="mt-2 text-sm font-semibold leading-6 text-zinc-300">
                  Read this before starting work in the technical portal. It summarises active issues, outages, priority work, and the handover rules for {handoverDate}.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              {lines.map((line) => (
                <div key={line.label} className="rounded border border-zinc-800 bg-black p-4">
                  <div className="text-xs font-black uppercase text-red-200">{line.label}</div>
                  <p className="mt-2 text-sm font-semibold leading-6 text-zinc-200">{line.value}</p>
                </div>
              ))}
            </div>

            {needsAcknowledgement ? (
              <form
                action={(formData) => {
                  startAcknowledgement(async () => {
                    setAcknowledgementError("");
                    try {
                      await acknowledgeShiftHandover(formData);
                      setNeedsAcknowledgement(false);
                      setOpen(false);
                    } catch {
                      setAcknowledgementError("The handover could not be signed off. Try again before starting work.");
                    }
                  });
                }}
                className="mt-5"
              >
                <input type="hidden" name="briefSummary" value={briefSummary} />
                {acknowledgementError ? (
                  <p className="mb-3 rounded border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-100">
                    {acknowledgementError}
                  </p>
                ) : null}
                <button
                  disabled={isAcknowledging}
                  className="w-full rounded bg-red-600 px-5 py-3 text-sm font-black text-white transition hover:bg-red-500 disabled:cursor-wait disabled:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-300"
                >
                  {isAcknowledging ? "Signing off..." : "OK, I have read the handover"}
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="mt-5 w-full rounded bg-red-600 px-5 py-3 text-sm font-black text-white transition hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-300"
              >
                OK, close brief
              </button>
            )}
          </article>
        </section>
      ) : null}
    </>
  );
}
