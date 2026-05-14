"use client";

import Link from "next/link";
import { ChevronRight, Menu } from "lucide-react";

const learnerMenuItems = [
  { label: "After Lesson Revision", href: "/dashboard#after-lesson-revision" },
  { label: "Rate Your Instructor", href: "/dashboard#rate-your-instructor" },
  { label: "Your Booking History", href: "/dashboard#booking-history" },
  { label: "Notification Hub", href: "/dashboard#notification-hub" }
];

const accountItems = [
  "Invite Friends and Family",
  "Promotional Codes",
  "Manage Your Profile",
  "Settings"
];

export function LearnerDashboardMenu() {
  return (
    <details className="group relative">
      <summary className="lda-pill lda-pill-sm cursor-pointer list-none">
        <Menu size={17} /> Menu
      </summary>
      <div className="absolute right-0 z-30 mt-3 w-[min(92vw,360px)] overflow-hidden rounded border border-zinc-800 bg-zinc-950 text-white shadow-2xl">
        <div className="grid border-b border-zinc-800 p-2">
          {learnerMenuItems.map((item) => (
            <Link key={item.href} href={item.href} className="rounded px-4 py-3 text-sm font-black hover:bg-red-500/15 hover:ring-1 hover:ring-brand">
              {item.label}
            </Link>
          ))}
        </div>
        <Link href="/account" className="flex items-center justify-between px-6 py-4 text-sm font-black hover:bg-red-500/15">
          Account <ChevronRight size={17} />
        </Link>
        <div className="grid gap-2 border-t border-zinc-800 bg-black/40 p-4 text-xs font-bold text-zinc-300">
          {accountItems.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </div>
    </details>
  );
}
