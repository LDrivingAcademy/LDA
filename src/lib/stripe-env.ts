import {
  getModeSpecificEnvCandidates,
  getRuntimeEnvMode,
  getRuntimeEnvModeLabel,
  getRuntimeEnvValue,
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
  return getStripeEnvValue("STRIPE_SECRET_KEY");
}

export function getStripePriceId(basePriceEnvName?: string | null) {
  return basePriceEnvName ? getStripeEnvValue(basePriceEnvName) : null;
}
