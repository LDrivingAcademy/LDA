"use client";

import { useEffect } from "react";
import { readStoredJson } from "@/lib/browser-storage";

const TRUSTED_DEVICE_KEY = "lda_trusted_device";
const TRUSTED_DEVICES_KEY = "lda_trusted_devices";
const REMEMBERED_IDENTIFIER_KEY = "lda_remember_identifier";

type TrustedDevice = {
  id: string;
  name: string;
  identifier: string;
  addedAt: string;
};

function currentDeviceName() {
  const platform = navigator.platform || "This device";
  const browser = navigator.userAgent.includes("Safari") && !navigator.userAgent.includes("Chrome") ? "Safari" : navigator.userAgent.includes("Chrome") ? "Chrome" : "Browser";
  return `${platform} · ${browser}`;
}

function rememberCurrentDevice(identifier: string) {
  const deviceName = currentDeviceName();
  const device: TrustedDevice = {
    id: crypto.randomUUID(),
    name: deviceName,
    identifier,
    addedAt: new Date().toISOString()
  };
  const devices = readStoredJson<TrustedDevice[]>(TRUSTED_DEVICES_KEY, []);
  const nextDevices = [device, ...devices.filter((item) => item.name !== device.name)].slice(0, 8);

  localStorage.setItem(TRUSTED_DEVICE_KEY, "true");
  localStorage.setItem(REMEMBERED_IDENTIFIER_KEY, identifier);
  localStorage.setItem(TRUSTED_DEVICES_KEY, JSON.stringify(nextDevices));

  void fetch("/api/devices/remember", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, deviceName })
  }).catch(() => {
    // The browser still has the local identifier; server-side remember can refresh later.
  });
}

function forgetCurrentDevice() {
  const deviceName = currentDeviceName();
  const devices = readStoredJson<TrustedDevice[]>(TRUSTED_DEVICES_KEY, []);
  const nextDevices = devices.filter((item) => item.name !== deviceName);

  localStorage.removeItem(TRUSTED_DEVICE_KEY);
  localStorage.removeItem(REMEMBERED_IDENTIFIER_KEY);

  if (nextDevices.length > 0) {
    localStorage.setItem(TRUSTED_DEVICES_KEY, JSON.stringify(nextDevices));
  } else {
    localStorage.removeItem(TRUSTED_DEVICES_KEY);
  }
}

function isTrustedDevice() {
  if (localStorage.getItem(TRUSTED_DEVICE_KEY) === "true") return true;

  const devices = readStoredJson<Array<{ name?: string }>>(TRUSTED_DEVICES_KEY, []);
  return devices.some((device) => device.name === currentDeviceName());
}

export function LoginRememberHelper({ formId, rememberedIdentifier }: { formId: string; rememberedIdentifier: string }) {
  useEffect(() => {
    const loginForm = document.getElementById(formId) as HTMLFormElement | null;
    if (!loginForm) return;
    const form = loginForm;

    const identifierInput = form.elements.namedItem("username") as HTMLInputElement | null;
    const passwordInput = form.elements.namedItem("password") as HTMLInputElement | null;
    const rememberInput = form.elements.namedItem("rememberMe") as HTMLInputElement | null;
    const localIdentifier = localStorage.getItem(REMEMBERED_IDENTIFIER_KEY);
    const hasRememberedIdentifier = Boolean(rememberedIdentifier || localIdentifier);
    let manualPasswordEntry = false;
    let autoSubmitted = false;

    if (identifierInput && !identifierInput.value) {
      identifierInput.value = rememberedIdentifier || localIdentifier || "";
    }

    if (rememberInput && (hasRememberedIdentifier || isTrustedDevice())) {
      rememberInput.checked = true;
    }

    if (identifierInput?.value && !passwordInput?.value) {
      passwordInput?.focus({ preventScroll: true });
    }

    function shouldAutoSubmit() {
      const identifier = identifierInput?.value.trim() ?? "";
      const password = passwordInput?.value ?? "";
      const rememberedAccount = Boolean(rememberedIdentifier || localIdentifier || isTrustedDevice());

      return Boolean(
        identifier &&
          password &&
          rememberInput?.checked &&
          rememberedAccount &&
          !manualPasswordEntry &&
          !autoSubmitted
      );
    }

    function requestRememberedLoginSubmit() {
      if (!shouldAutoSubmit()) {
        return;
      }

      autoSubmitted = true;
      const submitButton = form.querySelector<HTMLButtonElement>('button[type="submit"], button:not([type])');
      window.setTimeout(() => {
        form.requestSubmit(submitButton ?? undefined);
      }, 80);
    }

    function checkForAutofilledPassword() {
      const hasPasswordNow = Boolean(passwordInput?.value);
      if (hasPasswordNow) {
        requestRememberedLoginSubmit();
      }
    }

    function handlePasswordBeforeInput(event: InputEvent) {
      const inputType = event.inputType || "";
      if (inputType === "insertText" || inputType === "insertFromPaste" || inputType === "insertCompositionText") {
        manualPasswordEntry = true;
      }
    }

    function handlePasswordKeyDown() {
      manualPasswordEntry = true;
    }

    function handlePasswordInput() {
      checkForAutofilledPassword();
    }

    function handleSubmit(event: SubmitEvent) {
      const identifier = identifierInput?.value.trim() ?? "";
      const password = passwordInput?.value ?? "";

      if (!identifier || !password) {
        event.preventDefault();
        if (!identifier) {
          identifierInput?.focus();
        } else {
          passwordInput?.focus();
        }
        return;
      }

      if (rememberInput?.checked) {
        rememberCurrentDevice(identifier);
      } else {
        forgetCurrentDevice();
      }
    }

    passwordInput?.addEventListener("beforeinput", handlePasswordBeforeInput as EventListener);
    passwordInput?.addEventListener("keydown", handlePasswordKeyDown);
    passwordInput?.addEventListener("input", handlePasswordInput);
    passwordInput?.addEventListener("change", checkForAutofilledPassword);
    document.addEventListener("visibilitychange", checkForAutofilledPassword);
    form.addEventListener("submit", handleSubmit);
    const autofillCheckIds = [100, 250, 500, 1000, 1800, 3000, 5000, 8000].map((delay) => window.setTimeout(checkForAutofilledPassword, delay));

    return () => {
      autofillCheckIds.forEach((id) => window.clearTimeout(id));
      passwordInput?.removeEventListener("beforeinput", handlePasswordBeforeInput as EventListener);
      passwordInput?.removeEventListener("keydown", handlePasswordKeyDown);
      passwordInput?.removeEventListener("input", handlePasswordInput);
      passwordInput?.removeEventListener("change", checkForAutofilledPassword);
      document.removeEventListener("visibilitychange", checkForAutofilledPassword);
      form.removeEventListener("submit", handleSubmit);
    };
  }, [formId, rememberedIdentifier]);

  return null;
}
