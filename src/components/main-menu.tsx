"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { signOut } from "@/app/auth/actions";
import { LanguageSelector } from "@/components/language-selector";

const menuLinks = [
  { href: "/about", label: "About" },
  { href: "/instructor", label: "Become an Instructor" },
  { href: "/cancellation-policy", label: "Cancellation policy" },
  { href: "/feedback?from=home", label: "Feedback" },
  { href: "/support?from=menu", label: "Support" },
  { href: "/auth/login?role=instructor", label: "Instructor log in" },
  { href: "/auth/sign-up?role=instructor", label: "Instructor sign up" },
  { href: "/auth/login?role=learner", label: "Learner log in" },
  { href: "/auth/sign-up?role=learner", label: "Learner sign up" },
  { href: "/safety", label: "Safety" },
  { href: "/roadworthy", label: "Driving tips & refresher" }
];

export const mainMenuItemClass =
  "block w-full px-4 py-3 text-left font-sans text-base font-black leading-[1.25] tracking-normal text-white hover:bg-red-500/10 hover:text-brand";

export const mainMenuTriggerClass =
  "grid h-11 w-11 cursor-pointer place-items-center rounded border border-zinc-700 bg-zinc-950 text-white hover:border-red-500 focus-ring";

type MainMenuAccount = {
  dashboardHref: string;
  name: string;
  role: "instructor" | "learner" | "admin" | "support";
  privilegedMenuLinks?: Array<{ href: string; label: string }>;
  subscriptionHref: string;
  subscriptionLabel: string;
  upgradeHref?: string;
  upgradeLabel?: string;
};

type HomeSummaryResponse = {
  account?: MainMenuAccount | null;
};

function sortLinksByLabel<T extends { label: string }>(links: T[]) {
  return [...links].sort((first, second) => first.label.localeCompare(second.label));
}

export function MainMenu({ account }: { account?: MainMenuAccount | null }) {
  const [isOpen, setIsOpen] = useState(false);
  const [resolvedAccount, setResolvedAccount] = useState<MainMenuAccount | null | undefined>(account);
  const menuRef = useRef<HTMLDivElement>(null);
  const feedbackHref = resolvedAccount ? `/feedback?from=${resolvedAccount.role}` : "/feedback?from=home";
  const instructorStatusHref =
    resolvedAccount?.role === "instructor" && resolvedAccount.subscriptionLabel === "In progress"
      ? resolvedAccount.subscriptionHref
      : resolvedAccount?.dashboardHref;
  const publicLinks = account === undefined ? menuLinks.filter((link) => !link.href.startsWith("/auth/")) : menuLinks;
  const activeLinks = resolvedAccount
    ? [
        { href: "/account", label: resolvedAccount.name },
        ...(resolvedAccount.role !== "admin"
          ? [
              {
                href: instructorStatusHref ?? resolvedAccount.dashboardHref,
                label:
                  resolvedAccount.role === "support"
                    ? "Technical Operations Centre"
                    : resolvedAccount.role === "instructor"
                      ? resolvedAccount.subscriptionLabel === "In progress"
                        ? "Check status"
                        : "Instructor Dashboard"
                      : "Learner Dashboard"
              }
            ]
          : []),
        ...(resolvedAccount.role === "admin"
          ? resolvedAccount.privilegedMenuLinks ?? []
          : sortLinksByLabel([
              ...(resolvedAccount.role === "learner" ? [{ href: "/account/instructor-transfer", label: "Become an instructor" }] : []),
              ...(resolvedAccount.role === "learner" ? [{ href: "/roadworthy", label: "Driving tips & refresher" }] : []),
              { href: "/safety", label: "Safety" },
              { href: "/cancellation-policy", label: "Cancellation policy" },
              { href: feedbackHref, label: "Feedback" },
              { href: "/about", label: "About" },
              { href: "/support?from=menu", label: "Support" }
            ]))
      ]
    : publicLinks;

  useEffect(() => {
    setResolvedAccount(account);
  }, [account]);

  useEffect(() => {
    if (account !== undefined) {
      return;
    }

    let active = true;

    fetch("/api/account/home-summary", {
      cache: "no-store",
      credentials: "same-origin"
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: HomeSummaryResponse | null) => {
        if (active) {
          setResolvedAccount(data?.account ?? null);
        }
      })
      .catch(() => {
        if (active) {
          setResolvedAccount(null);
        }
      });

    return () => {
      active = false;
    };
  }, [account]);

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
        className={mainMenuTriggerClass}
      >
        <span className="lda-main-menu-lines" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </button>
      {isOpen ? (
        <div className="absolute right-0 top-full z-50 mt-2 max-h-[min(80dvh,34rem)] w-[min(92vw,18rem)] overflow-y-auto overflow-x-hidden rounded border border-zinc-800 bg-zinc-950 py-2 text-white shadow-2xl">
          <div className="border-b border-zinc-800 px-4 py-3">
            <LanguageSelector menuBounded />
          </div>
          {activeLinks.map((link) => (
            <Link
              key={`${link.href}-${link.label}`}
              href={link.href}
              onClick={() => {
                setIsOpen(false);
              }}
              className={mainMenuItemClass}
              data-lda-menu-row="true"
            >
              {link.label}
            </Link>
          ))}
          {resolvedAccount && resolvedAccount.role !== "admin" ? (
            <form action={signOut} className="m-0">
              <button
                type="submit"
                className={`${mainMenuItemClass} m-0 appearance-none border-0 bg-transparent`}
                data-lda-menu-row="true"
              >
                Log out
              </button>
            </form>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
