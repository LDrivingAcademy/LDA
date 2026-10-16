"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Activity, LayoutDashboard, MessageSquareText, ShieldCheck } from "lucide-react";
import { technicalSupportSignedOutAccessPath } from "@/lib/privileged-access-paths";

const links = [
  { href: "/technical-support", label: "Overview", icon: LayoutDashboard },
  { href: "/technical-support/feedback", label: "Support queue", icon: MessageSquareText },
  { href: "/technical-support/incidents", label: "Incidents", icon: ShieldCheck },
  { href: "/technical-support/health", label: "Site health", icon: Activity }
];

export function TechnicalSupportMenu({ canAccessAdmin = false }: { canAccessAdmin?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

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
    <div ref={menuRef} className="relative md:hidden">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-label={isOpen ? "Close technical support menu" : "Open technical support menu"}
        onClick={() => setIsOpen((open) => !open)}
        className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded border border-zinc-700 bg-zinc-950 text-white hover:border-red-500 focus-ring"
      >
        <span className="lda-main-menu-lines" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </button>
      {isOpen ? (
        <div className="absolute right-0 top-full z-50 mt-2 max-h-[80vh] w-[min(92vw,20rem)] overflow-y-auto rounded border border-zinc-800 bg-zinc-950 py-2 text-white shadow-2xl">
          <div className="border-b border-zinc-800 px-4 py-3">
            <div className="text-xs font-black uppercase text-red-200">TOC menu</div>
            <div className="mt-1 text-sm font-bold text-zinc-400">Technical Operations Centre</div>
          </div>
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-black text-white hover:bg-red-500/10 hover:text-red-100"
              >
                <Icon className="shrink-0 text-brand" size={17} />
                <span className="min-w-0 truncate">{link.label}</span>
              </Link>
            );
          })}
          {canAccessAdmin ? (
            <Link
              href="/admin"
              onClick={() => setIsOpen(false)}
              className="block border-t border-zinc-800 px-4 py-3 text-sm font-black text-white hover:bg-red-500/10 hover:text-red-100"
            >
              Back to admin dashboard
            </Link>
          ) : null}
          <form action="/api/auth/sign-out" method="post" className="m-0 border-t border-zinc-800 pt-2">
            <input type="hidden" name="returnTo" value={technicalSupportSignedOutAccessPath} />
            <button type="submit" className="block w-full appearance-none border-0 bg-transparent px-4 py-3 text-left text-sm font-black text-white hover:bg-red-500/10 hover:text-red-100">
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
