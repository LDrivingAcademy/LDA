"use client";

import { useEffect } from "react";

const TRUSTED_DEVICE_KEY = "lda_trusted_device";
const TRUSTED_DEVICES_KEY = "lda_trusted_devices";
const REMEMBERED_IDENTIFIER_KEY = "lda_remember_identifier";
const AUTO_LOGIN_ATTEMPT_KEY = "lda_auto_login_attempted_at";
const AUTO_LOGIN_WINDOW_MS = 15_000;

function currentDeviceName() {
  const platform = navigator.platform || "This device";
  const browser = navigator.userAgent.includes("Safari") && !navigator.userAgent.includes("Chrome") ? "Safari" : navigator.userAgent.includes("Chrome") ? "Chrome" : "Browser";
  return `${platform} · ${browser}`;
}

function rememberCurrentDevice(identifier: string) {
  const device = {
    id: crypto.randomUUID(),
    name: currentDeviceName(),
    identifier,
    addedAt: new Date().toISOString()
  };
  const stored = localStorage.getItem(TRUSTED_DEVICES_KEY);
  const devices = stored ? (JSON.parse(stored) as typeof device[]) : [];
  const nextDevices = [device, ...devices.filter((item) => item.name !== device.name)].slice(0, 8);

  localStorage.setItem(TRUSTED_DEVICE_KEY, "true");
  localStorage.setItem(REMEMBERED_IDENTIFIER_KEY, identifier);
  localStorage.setItem(TRUSTED_DEVICES_KEY, JSON.stringify(nextDevices));
}

function isTrustedDevice() {
  if (localStorage.getItem(TRUSTED_DEVICE_KEY) === "true") return true;

  const stored = localStorage.getItem(TRUSTED_DEVICES_KEY);
  if (!stored) return false;

  try {
    const devices = JSON.parse(stored) as Array<{ name?: string }>;
    return devices.some((device) => device.name === currentDeviceName());
  } catch {
    return false;
  }
}

export function LoginRememberHelper({ formId, rememberedIdentifier }: { formId: string; rememberedIdentifier: string }) {
  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;
    const loginForm = form;

    const identifierInput = loginForm.elements.namedItem("identifier") as HTMLInputElement | null;
    const passwordInput = loginForm.elements.namedItem("password") as HTMLInputElement | null;
    const rememberInput = loginForm.elements.namedItem("rememberMe") as HTMLInputElement | null;
    const localIdentifier = localStorage.getItem(REMEMBERED_IDENTIFIER_KEY);

    if (identifierInput && !identifierInput.value && (rememberedIdentifier || localIdentifier)) {
      identifierInput.value = rememberedIdentifier || localIdentifier || "";
    }

    if (rememberInput && isTrustedDevice()) {
      rememberInput.checked = true;
    }

    function handleSubmit() {
      if (rememberInput?.checked && identifierInput?.value) {
        rememberCurrentDevice(identifierInput.value.trim());
      }
    }

    loginForm.addEventListener("submit", handleSubmit);

    const autoLoginStartedAt = Date.now();
    const timer = window.setInterval(() => {
      const attemptedAt = Number(localStorage.getItem(AUTO_LOGIN_ATTEMPT_KEY) ?? "0");
      const hasRecentlyTried = Date.now() - attemptedAt < 60_000;
      const timedOut = Date.now() - autoLoginStartedAt > AUTO_LOGIN_WINDOW_MS;

      if (timedOut) {
        window.clearInterval(timer);
        return;
      }

      if (
        isTrustedDevice() &&
        rememberInput?.checked &&
        identifierInput?.value &&
        passwordInput?.value &&
        !hasRecentlyTried
      ) {
        localStorage.setItem(AUTO_LOGIN_ATTEMPT_KEY, String(Date.now()));
        window.clearInterval(timer);
        loginForm.requestSubmit();
      }
    }, 500);

    return () => {
      window.clearInterval(timer);
      loginForm.removeEventListener("submit", handleSubmit);
    };
  }, [formId, rememberedIdentifier]);

  return null;
}
