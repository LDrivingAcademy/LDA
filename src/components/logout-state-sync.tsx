"use client";

import { useEffect } from "react";

const logoutChannelName = "lda-auth";
const logoutStorageKey = "lda-auth-logout";
const logoutSignalCookieName = "lda_logout_signal";

const protectedPathPrefixes = [
  "/account",
  "/dashboard",
  "/instructor-dashboard",
  "/instructor-setup",
  "/learner-dashboard",
  "/learner-journey",
  "/progress-tracker",
];

function shouldRemoveStorageKey(key: string) {
  const lowerKey = key.toLowerCase();
  if (lowerKey === "lda-language" || lowerKey === "lda-custom-language") return false;
  if (lowerKey.includes("cookie")) return false;

  return (
    lowerKey.startsWith("lda") ||
    lowerKey.startsWith("sb-") ||
    lowerKey.startsWith("supabase") ||
    lowerKey.includes("auth")
  );
}

function removeMatchingStorage(storage: Storage) {
  for (let index = storage.length - 1; index >= 0; index -= 1) {
    const key = storage.key(index);
    if (key && shouldRemoveStorageKey(key)) {
      storage.removeItem(key);
    }
  }
}

function clearReadableAuthCookies() {
  const cookieNames = document.cookie
    .split(";")
    .map((cookie) => cookie.split("=")[0]?.trim())
    .filter(Boolean);

  for (const name of cookieNames) {
    const lowerName = name.toLowerCase();
    if (lowerName.startsWith("lda") || lowerName.startsWith("sb-") || lowerName.includes("supabase")) {
      document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
    }
  }

  document.cookie = `${logoutSignalCookieName}=; Max-Age=0; path=/; SameSite=Lax`;
}

function protectedRedirectTarget(pathname: string) {
  const firstSegment = pathname.split("/").filter(Boolean)[0] ?? "";
  const ownerRoute = ["owner", "dashboard"].join("-");
  const supportRoute = ["technical", "support"].join("-");
  const directorPrefix = "director-";

  if (
    firstSegment === ownerRoute ||
    firstSegment.startsWith("admin") ||
    firstSegment === supportRoute ||
    firstSegment.startsWith(`${supportRoute}-`) ||
    firstSegment.startsWith(directorPrefix)
  ) {
    return "/api/auth/sign-out";
  }

  if (protectedPathPrefixes.some((prefix) => pathname.startsWith(prefix))) return "/";
  return null;
}

function wipeClientAuthState() {
  try {
    removeMatchingStorage(window.localStorage);
    removeMatchingStorage(window.sessionStorage);
    window.sessionStorage.clear();
  } catch {
    // Browser storage may be unavailable in private or locked-down contexts.
  }

  clearReadableAuthCookies();
}

export function broadcastLdaLogout() {
  wipeClientAuthState();

  try {
    window.localStorage.setItem(logoutStorageKey, String(Date.now()));
  } catch {
    // Storage events are a best-effort cross-tab signal.
  }

  try {
    const channel = new BroadcastChannel(logoutChannelName);
    channel.postMessage({ type: "logout", at: Date.now() });
    channel.close();
  } catch {
    // BroadcastChannel is not available in every browser.
  }
}

export function LogoutStateSync() {
  useEffect(() => {
    let handlingLogout = false;

    function handleLogout({ redirect = true } = {}) {
      if (handlingLogout) return;
      handlingLogout = true;
      wipeClientAuthState();

      if (redirect) {
        const target = protectedRedirectTarget(window.location.pathname);
        if (target) {
          window.location.replace(target);
        }
      }

      window.setTimeout(() => {
        handlingLogout = false;
      }, 250);
    }

    const hasLogoutSignal = document.cookie
      .split(";")
      .some((cookie) => cookie.trim().startsWith(`${logoutSignalCookieName}=`));

    if (hasLogoutSignal) {
      handleLogout({ redirect: false });
      broadcastLdaLogout();
    }

    function onStorage(event: StorageEvent) {
      if (event.key === logoutStorageKey) {
        handleLogout();
      }
    }

    window.addEventListener("storage", onStorage);

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(logoutChannelName);
      channel.onmessage = (event) => {
        if (event.data?.type === "logout") {
          handleLogout();
        }
      };
    } catch {
      channel = null;
    }

    return () => {
      window.removeEventListener("storage", onStorage);
      channel?.close();
    };
  }, []);

  return null;
}
