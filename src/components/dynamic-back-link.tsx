"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import {
  consumeBackNavigation,
  getBackLabelForHref,
  getCurrentInternalUrl,
  getInternalHref,
  getSourceBackHref,
  readPreviousInternalUrl,
} from "@/components/navigation-history";

type DynamicBackLinkProps = {
  fallbackHref?: string;
  fallbackLabel?: string;
  className: string;
  iconSize?: number;
  useNavigationHistory?: boolean;
};

export function DynamicBackLink({
  fallbackHref = "/",
  fallbackLabel = "Back to homepage",
  className,
  iconSize = 16,
  useNavigationHistory = false
}: DynamicBackLinkProps) {
  const [target, setTarget] = useState({ href: fallbackHref, label: fallbackLabel });
  const linkClassName = className.replace(/\s*hover:ring-\S+/g, "");

  useEffect(() => {
    if (!useNavigationHistory) {
      setTarget({ href: fallbackHref, label: fallbackLabel });
      return;
    }

    const source = new URLSearchParams(window.location.search).get("from");
    const sourceHref = getSourceBackHref(source);
    const currentHref = getCurrentInternalUrl();
    const previousHref = readPreviousInternalUrl();

    if (sourceHref && sourceHref !== currentHref) {
      setTarget({ href: sourceHref, label: getBackLabelForHref(sourceHref, fallbackLabel) });
    } else if (previousHref) {
      setTarget({ href: previousHref, label: getBackLabelForHref(previousHref, fallbackLabel) });
    } else {
      setTarget({ href: fallbackHref, label: fallbackLabel });
    }
  }, [fallbackHref, fallbackLabel, useNavigationHistory]);

  return (
    <Link
      href={target.href}
      className={linkClassName}
      data-lda-back-link="true"
      onClick={() => consumeBackNavigation(getInternalHref(target.href))}
    >
      <ArrowLeft size={iconSize} /> {target.label}
    </Link>
  );
}
