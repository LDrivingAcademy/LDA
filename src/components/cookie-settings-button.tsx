"use client";

import { Settings2 } from "lucide-react";
import { cookieSettingsOpenEvent } from "@/lib/cookie-consent";

export function CookieSettingsButton() {
  function openCookieSettings() {
    window.dispatchEvent(new Event(cookieSettingsOpenEvent));
  }

  return (
    <button
      type="button"
      onClick={openCookieSettings}
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-300 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
    >
      Cookie Settings <Settings2 size={14} />
    </button>
  );
}

