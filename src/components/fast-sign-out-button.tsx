"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { broadcastLdaLogout } from "@/components/logout-state-sync";

type FastSignOutButtonProps = {
  className?: string;
  children?: ReactNode;
};

export function FastSignOutButton({ className = "lda-pill lda-pill-sm", children = "Sign out" }: FastSignOutButtonProps) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    router.prefetch("/");
  }, [router]);

  async function handleSignOut() {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);

    try {
      const response = await fetch("/api/auth/sign-out", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store"
      });
      const result = await response.json().catch(() => ({ redirectTo: "/" }));
      broadcastLdaLogout();
      router.replace(typeof result.redirectTo === "string" ? result.redirectTo : "/");
    } finally {
      router.refresh();
    }
  }

  return (
    <button type="button" className={className} onClick={handleSignOut} disabled={isSigningOut} aria-busy={isSigningOut}>
      {isSigningOut ? "Signing out..." : children}
    </button>
  );
}
