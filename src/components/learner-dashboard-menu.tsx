"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, Menu } from "lucide-react";

const learnerMenuItems = [
  { label: "After Lesson Revision", href: "/after-lesson-revision?from=dashboard" },
  { label: "Rate Your Instructor", href: "/rate-instructor?from=dashboard" },
  { label: "Your Booking History", href: "/booking-history?from=dashboard" },
  { label: "Notification Hub", href: "/notification-hub?from=dashboard" }
];

export function LearnerDashboardMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-label={isOpen ? "Close learner dashboard menu" : "Open learner dashboard menu"}
        onClick={() => setIsOpen((open) => !open)}
        className="lda-pill lda-pill-sm"
      >
        <Menu size={17} /> Menu
      </button>
      {isOpen ? (
        <div className="absolute right-0 z-30 mt-3 w-[min(92vw,360px)] overflow-hidden rounded border border-zinc-800 bg-zinc-950 text-white shadow-2xl">
          <div className="grid border-b border-zinc-800 p-2">
            {learnerMenuItems.map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setIsOpen(false)} className="rounded px-4 py-3 text-sm font-black hover:bg-red-500/15 hover:ring-1 hover:ring-brand">
                {item.label}
              </Link>
            ))}
          </div>
          <Link href="/account" onClick={() => setIsOpen(false)} className="flex items-center justify-between px-6 py-4 text-sm font-black hover:bg-red-500/15">
            Account <ChevronRight size={17} />
          </Link>
        </div>
      ) : null}
    </div>
  );
}
