"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { LanguageSelector } from "@/components/language-selector";

const menuLinks = [
  { href: "/about", label: "About" },
  { href: "/instructor", label: "Become an Instructor" },
  { href: "/cancellation-policy", label: "Cancellation policy" },
  { href: "/#lda-feedback", label: "Feedback" },
  { href: "/contact", label: "Help" },
  { href: "/auth/login?role=instructor", label: "Instructor log in" },
  { href: "/auth/sign-up?role=instructor", label: "Instructor sign up" },
  { href: "/auth/login?role=learner", label: "Learner log in" },
  { href: "/auth/sign-up?role=learner", label: "Learner sign up" },
  { href: "/safety", label: "Safety" }
];

type MainMenuAccount = {
  dashboardHref: string;
  name: string;
  role: "instructor" | "learner";
  subscriptionHref: string;
  subscriptionLabel: string;
  upgradeHref?: string;
  upgradeLabel?: string;
};

function sortLinksByLabel<T extends { label: string }>(links: T[]) {
  return [...links].sort((first, second) => first.label.localeCompare(second.label));
}

export function MainMenu({ account }: { account?: MainMenuAccount | null }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const activeLinks = account
    ? [
        { href: "/account", label: account.name },
        ...sortLinksByLabel([
          { href: account.dashboardHref, label: account.role === "instructor" ? "Instructor Dashboard" : "Learner Dashboard" },
          ...(account.role === "learner" ? [{ href: "/account/instructor-transfer", label: "Become an instructor" }] : []),
          { href: "/safety", label: "Safety" },
          { href: "/cancellation-policy", label: "Cancellation policy" },
          { href: "/#lda-feedback", label: "Feedback" },
          { href: "/about", label: "About" },
          { href: "/contact", label: "Help" }
        ])
      ]
    : menuLinks;

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
        aria-label={isOpen ? "Close menu" : "Open menu"}
        onClick={() => setIsOpen((open) => !open)}
        className="grid h-11 w-11 cursor-pointer place-items-center rounded border border-zinc-700 bg-zinc-950 text-white hover:border-red-500 focus-ring"
      >
        <Menu size={24} />
      </button>
      {isOpen ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(92vw,18rem)] overflow-hidden rounded border border-zinc-800 bg-zinc-950 py-2 text-white shadow-2xl">
          <div className="border-b border-zinc-800 px-4 py-3">
            <LanguageSelector />
          </div>
          {activeLinks.map((link) => (
            <Link
              key={`${link.href}-${link.label}`}
              href={link.href}
              onClick={() => {
                if (link.href.includes("#lda-feedback")) {
                  window.dispatchEvent(new Event("lda:open-feedback"));
                }
                setIsOpen(false);
              }}
              className="block px-4 py-3 text-sm font-black hover:bg-red-500/10 hover:text-brand"
            >
              {link.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
