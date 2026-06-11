export type StripeRuntimeMode = "legacy" | "test" | "live";

const modeAliases: Record<string, StripeRuntimeMode> = {
  live: "live",
  prod: "live",
  production: "live",
  test: "test",
  sandbox: "test",
  testing: "test"
};

export type StripeEnvValue = {
  envName: string;
  mode: StripeRuntimeMode;
  modeLabel: string;
  value?: string;
};

export function getStripeRuntimeMode(): StripeRuntimeMode {
  const rawMode = String(process.env.STRIPE_MODE ?? process.env.STRIPE_ENVIRONMENT ?? process.env.STRIPE_ENV ?? "")
    .trim()
    .toLowerCase();

  return modeAliases[rawMode] ?? "legacy";
}

export function getStripeModeLabel(mode = getStripeRuntimeMode()) {
  if (mode === "test") return "test/sandbox";
  if (mode === "live") return "live";
  return "legacy";
}

export function getModeSpecificStripeEnvName(baseEnvName: string, mode = getStripeRuntimeMode()) {
  if (mode === "legacy") {
    return baseEnvName;
  }

  const suffix = baseEnvName.replace(/^STRIPE_/, "");
  return mode === "test" ? `STRIPE_TEST_${suffix}` : `STRIPE_LIVE_${suffix}`;
}

export function getStripeEnvValue(baseEnvName: string): StripeEnvValue {
  const mode = getStripeRuntimeMode();
  const envName = getModeSpecificStripeEnvName(baseEnvName, mode);
  const value = process.env[envName]?.trim();

  return {
    envName,
    mode,
    modeLabel: getStripeModeLabel(mode),
    value: value || undefined
  };
}

export function getStripeSecretKey() {
  return getStripeEnvValue("STRIPE_SECRET_KEY");
}

export function getStripePriceId(basePriceEnvName?: string | null) {
  return basePriceEnvName ? getStripeEnvValue(basePriceEnvName) : null;
}
