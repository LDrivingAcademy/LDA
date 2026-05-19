"use client";

import { useEffect } from "react";
import { readStoredJson } from "@/lib/browser-storage";

const TRUSTED_DEVICE_KEY = "lda_trusted_device";
const TRUSTED_DEVICES_KEY = "lda_trusted_devices";
const REMEMBERED_IDENTIFIER_KEY = "lda_remember_identifier";
const SAVED_LOGIN_BUTTON_SELECTOR = "[data-lda-use-saved-login]";

type PasswordCredentialLike = Credential & {
  id: string;
  password?: string;
  name?: string;
};

type PasswordCredentialRequestOptions = CredentialRequestOptions & {
  password: boolean;
  mediation?: CredentialMediationRequirement;
};

declare global {
  interface Window {
    PasswordCredential?: new (data: HTMLFormElement | { id: string; password: string; name?: string }) => Credential;
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
  const devices = readStoredJson<typeof device[]>(TRUSTED_DEVICES_KEY, []);
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

    const identifierInput = (loginForm.elements.namedItem("username") ?? loginForm.elements.namedItem("identifier")) as HTMLInputElement | null;
    const identifierMirror = loginForm.querySelector<HTMLInputElement>("[data-lda-identifier-mirror]");
    const passwordInput = loginForm.elements.namedItem("password") as HTMLInputElement | null;
    const rememberInput = loginForm.elements.namedItem("rememberMe") as HTMLInputElement | null;
    const savedLoginButton = loginForm.querySelector<HTMLButtonElement>(SAVED_LOGIN_BUTTON_SELECTOR);
    const localIdentifier = localStorage.getItem(REMEMBERED_IDENTIFIER_KEY);

    function syncIdentifierMirror() {
      if (identifierMirror && identifierInput) {
        identifierMirror.value = identifierInput.value.trim();
      }
    }

    if (identifierInput && !identifierInput.value && (rememberedIdentifier || localIdentifier)) {
      identifierInput.value = rememberedIdentifier || localIdentifier || "";
    }
    syncIdentifierMirror();

    if (rememberInput && isTrustedDevice()) {
      rememberInput.checked = true;
    }

    if (identifierInput?.value && !passwordInput?.value) {
      passwordInput?.focus({ preventScroll: true });
    }

    async function requestSavedCredential(mediation: CredentialMediationRequirement = "optional") {
      if (!("credentials" in navigator)) {
        passwordInput?.focus();
        return;
      }

      try {
        const credential = (await navigator.credentials.get({
          password: true,
          mediation
        } as PasswordCredentialRequestOptions)) as PasswordCredentialLike | null;

        if (!credential) {
          passwordInput?.focus();
          return;
        }

        if (identifierInput && credential.id && !identifierInput.value) {
          identifierInput.value = credential.id;
        }
        syncIdentifierMirror();

        if (passwordInput && credential.password && !passwordInput.value) {
          passwordInput.value = credential.password;
        }

        if (rememberInput) {
          rememberInput.checked = true;
        }
      } catch {
        // Browsers may block silent credential reads; autocomplete still handles Face ID/Touch ID prompts.
        passwordInput?.focus();
      }
    }

    async function storeSavedCredential() {
      if (!rememberInput?.checked || !identifierInput?.value || !passwordInput?.value || !window.PasswordCredential || !("credentials" in navigator)) {
        return;
      }

      try {
        await navigator.credentials.store(
          new window.PasswordCredential({
            id: identifierInput.value.trim(),
            password: passwordInput.value,
            name: "L Driving Academy"
          })
        );
      } catch {
        // Password managers can decline storage; the login still proceeds normally.
      }
    }

    function handleSubmit(event: SubmitEvent) {
      syncIdentifierMirror();
      if (!identifierInput?.value.trim() || !passwordInput?.value) {
        event.preventDefault();
        if (!identifierInput?.value.trim()) {
          identifierInput?.focus();
        } else {
          passwordInput?.focus();
        }
        return;
      }

      if (rememberInput?.checked && identifierInput?.value) {
        rememberCurrentDevice(identifierInput.value.trim());
        void storeSavedCredential();
      }
    }

    async function handleSavedLoginClick() {
      if (rememberInput) {
        rememberInput.checked = true;
      }
      await requestSavedCredential("required");
      syncIdentifierMirror();

      if (!passwordInput?.value) {
        passwordInput?.focus();
      }
    }

    identifierInput?.addEventListener("input", syncIdentifierMirror);
    identifierInput?.addEventListener("change", syncIdentifierMirror);
    loginForm.addEventListener("submit", handleSubmit);
    savedLoginButton?.addEventListener("click", handleSavedLoginClick);

    return () => {
      identifierInput?.removeEventListener("input", syncIdentifierMirror);
      identifierInput?.removeEventListener("change", syncIdentifierMirror);
      loginForm.removeEventListener("submit", handleSubmit);
      savedLoginButton?.removeEventListener("click", handleSavedLoginClick);
    };
  }, [formId, rememberedIdentifier]);

  return null;
}
