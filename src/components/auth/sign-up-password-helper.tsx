"use client";

import { useEffect } from "react";
import { readStoredJson } from "@/lib/browser-storage";

const TRUSTED_DEVICE_KEY = "lda_trusted_device";
const TRUSTED_DEVICES_KEY = "lda_trusted_devices";
const REMEMBERED_IDENTIFIER_KEY = "lda_remember_identifier";

function currentDeviceName() {
  const platform = navigator.platform || "This device";
  const browser = navigator.userAgent.includes("Safari") && !navigator.userAgent.includes("Chrome") ? "Safari" : navigator.userAgent.includes("Chrome") ? "Chrome" : "Browser";
  return `${platform} · ${browser}`;
}

function rememberCurrentDevice(identifier: string) {
  const deviceName = currentDeviceName();
  const device = {
    id: crypto.randomUUID(),
    name: deviceName,
    identifier,
    addedAt: new Date().toISOString()
  };
  const devices = readStoredJson<typeof device[]>(TRUSTED_DEVICES_KEY, []);
  const nextDevices = [device, ...devices.filter((item) => item.name !== device.name)].slice(0, 8);

  localStorage.setItem(TRUSTED_DEVICE_KEY, "true");
  localStorage.setItem(REMEMBERED_IDENTIFIER_KEY, identifier);
  localStorage.setItem(TRUSTED_DEVICES_KEY, JSON.stringify(nextDevices));

  void fetch("/api/devices/remember", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, deviceName })
  }).catch(() => {
    // Local remember still works; the server cookie will be refreshed on next login.
  });
}

export function SignUpPasswordHelper({ formId }: { formId: string }) {
  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;
    const signUpForm = form;

    function handleSubmit() {
      const emailInput = signUpForm.elements.namedItem("email") as HTMLInputElement | null;
      const email = emailInput?.value.trim().toLowerCase() ?? "";

      if (!email) return;
      rememberCurrentDevice(email);
    }

    signUpForm.addEventListener("submit", handleSubmit);

    return () => {
      signUpForm.removeEventListener("submit", handleSubmit);
    };
  }, [formId]);

  return null;
}
