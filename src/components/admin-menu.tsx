"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { MouseEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { adminSignedOutAccessPath } from "@/lib/privileged-access-paths";

const adminMenuLinks = [
  { href: "/admin", label: "Admin dashboard" },
  { href: "/technical-support", label: "Tech Support Dashboard" },
  { href: "/admin/support-escalations", label: "Tech Support Escalations" },
  { href: "/admin/active-drivers", label: "Active drivers map" },
  { href: "/owner-dashboard", label: "Owner analytics" },
  { href: "/admin-preview", label: "Site preview selector" },
  { href: "/admin-mfa?manage=1", label: "Authenticator MFA" }
];

export function AdminMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

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

  function handleMenuNavigation(event: MouseEvent<HTMLAnchorElement>, href: string) {
    event.preventDefault();
    setIsOpen(false);

    const currentPath = `${pathname}${searchParams.size ? `?${searchParams.toString()}` : ""}`;
    if (href === currentPath || href === pathname) {
      router.refresh();
      return;
    }

    router.push(href);
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-label={isOpen ? "Close admin menu" : "Open admin menu"}
        onClick={() => setIsOpen((open) => !open)}
        className="lda-admin-menu-button flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded border border-zinc-600 p-0 text-white shadow-none hover:border-zinc-400 focus-ring"
        style={{
          appearance: "none",
          background: "#000000",
          backgroundColor: "#000000",
          borderColor: "#52525b",
          color: "#ffffff",
          WebkitAppearance: "none",
          WebkitTextFillColor: "#ffffff"
        }}
      >
        <span
          className="lda-admin-menu-lines flex h-5 w-6 flex-col justify-center gap-1"
          aria-hidden="true"
          style={{ color: "#ffffff", WebkitTextFillColor: "#ffffff" }}
        >
          <span className="block h-0.5 w-6 rounded-full bg-white" style={{ background: "#ffffff", backgroundColor: "#ffffff" }} />
          <span className="block h-0.5 w-6 rounded-full bg-white" style={{ background: "#ffffff", backgroundColor: "#ffffff" }} />
          <span className="block h-0.5 w-6 rounded-full bg-white" style={{ background: "#ffffff", backgroundColor: "#ffffff" }} />
        </span>
      </button>
      {isOpen ? (
        <div className="lda-admin-menu-panel absolute right-0 top-full z-50 mt-2 max-h-[80vh] w-[min(92vw,17rem)] overflow-y-auto rounded border border-zinc-800 bg-black py-2 text-white shadow-2xl">
          <div className="lda-admin-menu-heading border-b border-zinc-800 px-4 py-3">
            <div className="text-xs font-black uppercase text-red-200">Admin menu</div>
            <div className="mt-1 text-sm font-bold text-zinc-400">LDA control centre</div>
          </div>
          {adminMenuLinks.map((link) => (
            <Link
              key={`${link.href}-${link.label}`}
              href={link.href}
              onClick={(event) => handleMenuNavigation(event, link.href)}
              className="lda-admin-menu-link block px-4 py-2.5 text-sm font-black text-white"
            >
              {link.label}
            </Link>
          ))}
          <form action="/api/auth/sign-out" method="post" className="m-0 border-t border-zinc-800 pt-2">
            <input type="hidden" name="returnTo" value={adminSignedOutAccessPath} />
            <button
              type="submit"
              className="lda-admin-menu-link block w-full appearance-none border-0 bg-transparent px-4 py-2.5 text-left text-sm font-black text-white"
            >
              Logout
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
