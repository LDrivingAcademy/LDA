"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FastSignOutButton } from "@/components/fast-sign-out-button";
import { ChevronRight } from "lucide-react";
import { mainMenuItemClass, mainMenuTriggerClass } from "@/components/main-menu";

const instructorMenuItems = [
  { label: "Learner Progress Notes", href: "/progress-tracker?from=dashboard" },
  { label: "Your Bookings & Calendar", href: "/instructor-calendar" },
  { label: "Notification Hub", href: "/notification-hub?from=dashboard" },
  { label: "Support", href: "/support?from=dashboard" }
];

export function InstructorDashboardMenu({ hideAccountLink = false, accountName, membershipLabel, upgrade }: { hideAccountLink?: boolean; accountName?: string; membershipLabel?: string; upgrade?: { href: string; label: string } | null }) {
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
        aria-label={isOpen ? "Close instructor dashboard menu" : "Open instructor dashboard menu"}
        onClick={() => setIsOpen((open) => !open)}
        className={mainMenuTriggerClass}
      >
        <span className="lda-main-menu-lines" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </button>
      {isOpen ? (
        <div className="absolute right-0 z-30 mt-3 w-[min(92vw,360px)] max-h-[75dvh] overflow-y-auto overflow-x-hidden rounded border border-zinc-800 bg-zinc-950 text-white shadow-2xl">
          {accountName ? <div className="border-b border-zinc-800 px-4 py-3 lg:hidden">
            <p className="text-xs font-bold text-red-200">Instructor account</p>
            <p className="break-words font-black">{accountName}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
                <Link href="/instructor-plus?from=dashboard" onClick={() => setIsOpen(false)} className="rounded-full border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-black uppercase text-red-100 focus-ring" aria-label={`Manage subscription: ${membershipLabel}`}>{membershipLabel}</Link>
                {upgrade ? <Link href={upgrade.href} onClick={() => setIsOpen(false)} className="rounded-full border border-red-500/40 px-3 py-2 text-xs font-bold text-red-100 focus-ring">{upgrade.label}</Link> : null}
              </div>
          </div> : null}
          <div className="grid border-b border-zinc-800 p-2">
            {instructorMenuItems.map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setIsOpen(false)} className={`${mainMenuItemClass} rounded hover:bg-red-500/15 hover:ring-1 hover:ring-brand`} data-lda-menu-row="true">
                {item.label}
              </Link>
            ))}
          </div>
          {hideAccountLink ? null : (
            <Link href="/account" onClick={() => setIsOpen(false)} className={`${mainMenuItemClass} flex items-center justify-between px-6 py-4 hover:bg-red-500/15`} data-lda-menu-row="true">
              Account <ChevronRight size={17} />
            </Link>
          )}
          {accountName ? <div className="border-t border-zinc-800 lg:hidden"><FastSignOutButton className={`${mainMenuItemClass} min-h-11`} /></div> : null}
        </div>
      ) : null}
    </div>
  );
}
