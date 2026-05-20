"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

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
      const supabase = createClient();
      if (supabase) {
        await supabase.auth.signOut({ scope: "local" });
      }
    } finally {
      router.replace("/");
      router.refresh();
    }
  }

  return (
    <button type="button" className={className} onClick={handleSignOut} disabled={isSigningOut} aria-busy={isSigningOut}>
      {isSigningOut ? "Signing out..." : children}
    </button>
  );
}
