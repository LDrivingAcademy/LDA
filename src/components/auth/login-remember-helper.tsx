"use client";

import { useEffect } from "react";

const TRUSTED_DEVICE_KEY = "lda_trusted_device";
const TRUSTED_DEVICES_KEY = "lda_trusted_devices";
const REMEMBERED_IDENTIFIER_KEY = "lda_remember_identifier";
const AUTO_LOGIN_ATTEMPT_KEY = "lda_auto_login_attempted_at";

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

export function LoginRememberHelper({ formId, rememberedIdentifier }: { formId: string; rememberedIdentifier: string }) {
  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;

    const identifierInput = form.elements.namedItem("identifier") as HTMLInputElement | null;
    const passwordInput = form.elements.namedItem("password") as HTMLInputElement | null;
    const rememberInput = form.elements.namedItem("rememberMe") as HTMLInputElement | null;
    const localIdentifier = localStorage.getItem(REMEMBERED_IDENTIFIER_KEY);

    if (identifierInput && !identifierInput.value && (rememberedIdentifier || localIdentifier)) {
      identifierInput.value = rememberedIdentifier || localIdentifier || "";
    }

    if (rememberInput && localStorage.getItem(TRUSTED_DEVICE_KEY) === "true") {
      rememberInput.checked = true;
    }

    function handleSubmit() {
      if (rememberInput?.checked && identifierInput?.value) {
        rememberCurrentDevice(identifierInput.value.trim());
      }
    }

    form.addEventListener("submit", handleSubmit);

    const timer = window.setTimeout(() => {
      const attemptedAt = Number(localStorage.getItem(AUTO_LOGIN_ATTEMPT_KEY) ?? "0");
      const hasRecentlyTried = Date.now() - attemptedAt < 60_000;

      if (
        localStorage.getItem(TRUSTED_DEVICE_KEY) === "true" &&
        rememberInput?.checked &&
        identifierInput?.value &&
        passwordInput?.value &&
        !hasRecentlyTried
      ) {
        localStorage.setItem(AUTO_LOGIN_ATTEMPT_KEY, String(Date.now()));
        form.requestSubmit();
      }
    }, 900);

    return () => {
      window.clearTimeout(timer);
      form.removeEventListener("submit", handleSubmit);
    };
  }, [formId, rememberedIdentifier]);

  return null;
}
