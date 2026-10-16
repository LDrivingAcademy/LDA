"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MainMenu } from "@/components/main-menu";
import type { HeaderAccountSummary } from "@/lib/current-account";

type HomeSummaryResponse = {
  account?: HeaderAccountSummary | null;
};

type HomeAccountControlsProps = {
  compact?: boolean;
};

function useHomeAccount() {
  const [account, setAccount] = useState<HeaderAccountSummary | null | undefined>(undefined);

  useEffect(() => {
    let active = true;

    fetch("/api/account/home-summary", {
      cache: "no-store",
      credentials: "same-origin"
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: HomeSummaryResponse | null) => {
        if (active) {
          setAccount(data?.account ?? null);
        }
      })
      .catch(() => {
        if (active) {
          setAccount(null);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return account;
}

export function HomeAccountControls({ compact = false }: HomeAccountControlsProps) {
  const account = useHomeAccount();

  if (account === undefined) {
    return compact ? (
      <div className="h-10 w-11 shrink-0 rounded bg-white/10" aria-hidden="true" />
    ) : (
      <div className="flex items-center gap-3" aria-hidden="true">
        <div className="h-10 w-20 rounded-full bg-white/10" />
        <div className="h-10 w-24 rounded-full bg-white/10" />
      </div>
    );
  }

  if (account) {
    return (
      <>
        <HeaderAccountBlock account={account} compact={compact} />
        <MainMenu account={account} />
      </>
    );
  }

  if (compact) {
    return (
      <>
        <Link href="/auth/login" className="inline-flex min-h-11 items-center rounded-full border border-red-500/60 bg-red-600 px-4 text-sm font-bold whitespace-nowrap text-white hover:bg-red-700 focus-ring">
          Log in
        </Link>
        <Link href="/auth/sign-up" className="hidden min-h-11 items-center rounded-full bg-red-600 px-4 text-sm font-black whitespace-nowrap text-white focus-ring min-[480px]:inline-flex">
          Sign up
        </Link>
        <MainMenu account={null} />
      </>
    );
  }

  return (
    <>
      <Link href="/auth/login" className="rounded-full px-3 py-2 whitespace-nowrap text-sm font-bold text-white hover:ring-2 hover:ring-brand">
        Log in
      </Link>
      <Link href="/auth/sign-up" className="rounded-full border border-red-500/60 bg-red-600 px-4 py-2 whitespace-nowrap text-sm font-black text-white hover:ring-2 hover:ring-red-300">
        Sign up
      </Link>
    </>
  );
}

function HeaderAccountBlock({ account, compact = false }: { account: HeaderAccountSummary; compact?: boolean }) {
  const accountPillHref = account.subscriptionHref;
  const pillLabel = account.role === "support" ? "TOC" : account.subscriptionLabel;

  if (compact && (account.role === "learner" || account.role === "instructor")) {
    return (
      <div className="flex min-w-0 max-w-[36vw] flex-col items-end gap-0.5 leading-tight">
        <span className="max-w-full truncate text-[10px] font-bold text-red-200">{account.role === "instructor" ? "Instructor account" : "Learner account"}</span>
        <span className="max-w-full truncate text-sm font-black">{account.name.trim().split(/\s+/)[0]}</span>
        <Link href={account.subscriptionHref} className="inline-flex max-w-full items-center rounded-full border border-red-500/40 bg-red-500/10 px-2 py-1 text-[10px] font-black uppercase text-red-100 focus-ring" aria-label={`Manage subscription: ${account.subscriptionLabel}`}>
          <span className="truncate">{account.subscriptionLabel}</span>
        </Link>
      </div>
    );
  }

  return (
    <div
      data-lda-account-compact={compact ? "true" : undefined}
      className={`min-w-0 flex-col items-center text-center leading-tight ${compact ? "hidden max-w-[34vw] min-[390px]:flex sm:max-w-[150px]" : "flex max-w-[190px]"}`}
    >
      <div className="max-w-full truncate text-sm font-black text-white">{account.name}</div>
      {account.role === "admin" ? (
        <Link href={account.dashboardHref} className="mt-1 inline-flex max-w-full items-center justify-center truncate rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1 text-xs font-black uppercase text-red-100 transition hover:border-red-500/80 hover:text-white hover:ring-2 hover:ring-brand">
          Admin
        </Link>
      ) : (
        <Link href={accountPillHref} className="mt-1 inline-flex max-w-full items-center justify-center truncate rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1 text-xs font-black uppercase text-red-100 transition hover:border-red-500/80 hover:text-white hover:ring-2 hover:ring-brand">
          {pillLabel}
        </Link>
      )}
      {account.upgradeHref && account.upgradeLabel ? (
        <Link href={account.upgradeHref} className="mt-1 inline-flex max-w-full items-center justify-center truncate rounded-full border border-red-500/40 bg-transparent px-3 py-1 text-[11px] font-black uppercase text-red-100 transition hover:border-red-500/80 hover:text-white hover:ring-2 hover:ring-brand">
          {account.upgradeLabel}
        </Link>
      ) : null}
    </div>
  );
}
