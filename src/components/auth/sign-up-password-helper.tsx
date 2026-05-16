"use client";

import { useEffect } from "react";

const TRUSTED_DEVICE_KEY = "lda_trusted_device";
const TRUSTED_DEVICES_KEY = "lda_trusted_devices";
const REMEMBERED_IDENTIFIER_KEY = "lda_remember_identifier";

type PasswordCredentialStoreOptions = {
  id: string;
  password: string;
  name?: string;
};

declare global {
  interface Window {
    PasswordCredential?: new (data: HTMLFormElement | PasswordCredentialStoreOptions) => Credential;
  }
}

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

export function SignUpPasswordHelper({ formId }: { formId: string }) {
  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;
    const signUpForm = form;

    async function handleSubmit() {
      const emailInput = signUpForm.elements.namedItem("email") as HTMLInputElement | null;
      const passwordInput = signUpForm.elements.namedItem("password") as HTMLInputElement | null;
      const email = emailInput?.value.trim().toLowerCase() ?? "";
      const password = passwordInput?.value ?? "";

      if (!email) return;
      rememberCurrentDevice(email);

      if (!password || !window.PasswordCredential || !("credentials" in navigator)) {
        return;
      }

      try {
        await navigator.credentials.store(
          new window.PasswordCredential({
            id: email,
            password,
            name: "L Driving Academy"
          })
        );
      } catch {
        // The browser owns the password vault prompt; sign-up should continue even if it declines.
      }
    }

    signUpForm.addEventListener("submit", handleSubmit);

    return () => {
      signUpForm.removeEventListener("submit", handleSubmit);
    };
  }, [formId]);

  return null;
}
