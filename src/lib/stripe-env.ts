import {
  getModeSpecificEnvCandidates,
  getRuntimeEnvMode,
  getRuntimeEnvModeLabel,
  getRuntimeEnvValue,
  isRuntimeStripeTestModeAllowed,
  type RuntimeEnvMode,
  type RuntimeEnvValue
} from "@/lib/runtime-env";

export type StripeRuntimeMode = RuntimeEnvMode;
export type StripeEnvValue = RuntimeEnvValue;

export function getStripeRuntimeMode(): StripeRuntimeMode {
  return getRuntimeEnvMode();
}

export function getStripeModeLabel(mode = getStripeRuntimeMode()) {
  return getRuntimeEnvModeLabel(mode);
}

export function getModeSpecificStripeEnvName(baseEnvName: string, mode = getStripeRuntimeMode()) {
  return getModeSpecificEnvCandidates(baseEnvName, mode)[0] ?? baseEnvName;
}

export function getStripeEnvValue(baseEnvName: string): StripeEnvValue {
  return getRuntimeEnvValue(baseEnvName, { mode: getStripeRuntimeMode() });
}

export function getStripeSecretKey() {
  const secret = getStripeEnvValue("STRIPE_SECRET_KEY");

  if (secret.mode === "test" && !isRuntimeStripeTestModeAllowed()) {
    return {
      ...secret,
      value: undefined
    };
  }

  if (secret.value && secret.mode === "live" && secret.value.startsWith("sk_test_")) {
    return {
      ...secret,
      envName: getModeSpecificStripeEnvName("STRIPE_SECRET_KEY", "live"),
      value: undefined
    };
  }

  if (secret.value && secret.mode === "test" && secret.value.startsWith("sk_live_")) {
    return {
      ...secret,
      envName: getModeSpecificStripeEnvName("STRIPE_SECRET_KEY", "test"),
      value: undefined
    };
  }

  return secret;
}

export function getStripePriceId(basePriceEnvName?: string | null) {
  return basePriceEnvName ? getStripeEnvValue(basePriceEnvName) : null;
}
