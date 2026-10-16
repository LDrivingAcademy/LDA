"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, CircleAlert, ExternalLink, X } from "lucide-react";
import { closeInstructorSetupGuideAction } from "@/app/instructor-setup/actions";
import type { InstructorSetupChecklistItem } from "@/lib/instructor-setup-readiness";

type InstructorSetupGuideProps = {
  checklist: InstructorSetupChecklistItem[];
  completeCount: number;
  totalCount: number;
};

export function InstructorSetupGuide({
  checklist,
  completeCount,
  totalCount
}: InstructorSetupGuideProps) {
  const [visible, setVisible] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [isPending, startTransition] = useTransition();
  const nextItem = useMemo(() => checklist.find((item) => !item.complete) ?? checklist[0], [checklist]);
  const progress = totalCount > 0 ? Math.round((completeCount / totalCount) * 100) : 0;

  if (!visible || !nextItem) {
    return null;
  }

  function closeGuide() {
    startTransition(() => {
      void closeInstructorSetupGuideAction();
      setVisible(false);
    });
  }

  return (
    <aside className="fixed bottom-5 left-4 z-40 w-[min(calc(100vw-2rem),390px)] rounded border border-zinc-800 bg-white text-black shadow-2xl">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={() => setExpanded((open) => !open)}
            className="min-w-0 flex-1 text-left"
            aria-expanded={expanded}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-black">Setup guide</h2>
              {expanded ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-200">
              <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-3 text-sm font-bold text-zinc-700">
              Next: <span className="text-brand">{nextItem.label}</span>
            </p>
          </button>
          <button
            type="button"
            onClick={closeGuide}
            disabled={isPending}
            className="grid size-9 shrink-0 place-items-center rounded-full border border-zinc-300 bg-white text-black hover:ring-2 hover:ring-brand disabled:opacity-60"
            aria-label="Close setup guide"
          >
            <X size={17} />
          </button>
        </div>

        {expanded ? (
          <div className="mt-5 border-t border-zinc-200 pt-4">
            <div className="text-sm font-black text-zinc-800">
              {completeCount}/{totalCount} complete
            </div>
            <div className="mt-4 grid gap-2">
              {checklist.map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  className="group rounded border border-zinc-200 bg-zinc-50 p-3 hover:border-brand hover:bg-white"
                >
                  <div className="flex items-start gap-3">
                    {item.complete ? (
                      <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-700" />
                    ) : (
                      <CircleAlert size={18} className="mt-0.5 shrink-0 text-amber-700" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3 text-sm font-black">
                        <span>{item.label}</span>
                        <ExternalLink size={15} className="shrink-0 text-zinc-500 group-hover:text-brand" />
                      </div>
                      <p className="mt-1 text-xs font-bold leading-5 text-zinc-600">{item.detail}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
