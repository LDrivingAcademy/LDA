"use client";

import Link from "next/link";
import { ArrowRight, BookOpenCheck, CarFront, FileUp, UsersRound, X } from "lucide-react";
import { useState } from "react";

export function LearnerInstructorApplyTile() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group grid min-h-[220px] gap-5 overflow-hidden rounded bg-zinc-100 p-5 text-left text-black hover:bg-zinc-200 sm:grid-cols-[1fr_150px] sm:p-6"
      >
        <div className="flex flex-col items-start">
          <h3 className="text-2xl font-black">Become an instructor</h3>
          <p className="mt-4 max-w-xs text-base leading-7 text-zinc-800">
            Apply to move your learner account into the instructor pathway once you have passed and have the right evidence for LDA review.
          </p>
          <span className="mt-auto inline-flex items-center rounded-full bg-brand px-4 py-2 text-sm font-black text-white">
            Apply now
          </span>
        </div>
        <div className="relative grid place-items-start text-black sm:place-items-center">
          <div className="grid h-20 w-20 place-items-center rounded bg-white text-brand shadow-sm transition group-hover:scale-105 sm:h-24 sm:w-24">
            <UsersRound size={68} />
          </div>
        </div>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="learner-instructor-apply-title">
          <section className="w-full max-w-2xl rounded bg-white p-5 text-black shadow-2xl sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-2 text-xs font-black uppercase text-brand ring-1 ring-red-100">
                  <CarFront size={15} /> Learner account
                </div>
                <h2 id="learner-instructor-apply-title" className="mt-4 text-3xl font-black tracking-normal sm:text-4xl">
                  You are using a learner account.
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-zinc-200 bg-white text-black hover:ring-2 hover:ring-brand"
                aria-label="Close instructor application options"
              >
                <X size={18} />
              </button>
            </div>

            <p className="mt-4 text-base font-semibold leading-7 text-zinc-700">
              If you are still learning, stay in your learner dashboard. If you have passed your practical test and your instructor has signed off your LDA progress, LDA can review whether this account can transfer into the instructor pathway.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <article className="rounded border border-zinc-200 bg-zinc-50 p-4">
                <BookOpenCheck className="text-brand" />
                <h3 className="mt-3 text-lg font-black">Still learning</h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-zinc-600">
                  Keep building progress until your practical test is passed and your instructor checklist is complete.
                </p>
              </article>
              <article className="rounded border border-red-200 bg-red-50 p-4">
                <FileUp className="text-brand" />
                <h3 className="mt-3 text-lg font-black">Passed outside LDA</h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-red-950">
                  You can upload your pass evidence on the transfer form so LDA can verify it before approving instructor access.
                </p>
              </article>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link href="/account/instructor-transfer?from=home" className="lda-pill">
                Transfer / become an instructor <ArrowRight size={18} />
              </Link>
              <Link href="/learner-dashboard" className="inline-flex min-h-14 items-center justify-center rounded-full border border-zinc-300 bg-white px-6 py-3 text-sm font-black text-black hover:ring-2 hover:ring-brand">
                I'm still a learner
              </Link>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
