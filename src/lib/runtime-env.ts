export type RuntimeEnvMode = "legacy" | "test" | "live";
export type VercelRuntimeEnvironment = "development" | "preview" | "production" | "local";

export type RuntimeEnvValue = {
  envName: string;
  mode: RuntimeEnvMode;
  modeLabel: string;
  value?: string;
};

const modeAliases: Record<string, RuntimeEnvMode> = {
  live: "live",
  prod: "live",
  production: "live",
  test: "test",
  sandbox: "test",
  testing: "test"
};

function hasRuntimeEnvValue(envNames: string[]) {
  return envNames.some((envName) => Boolean(normaliseRuntimeEnvValue(process.env[envName])));
}

export function normaliseBooleanEnv(value?: string) {
  const normalised = value?.trim().toLowerCase();
  return normalised === "1" || normalised === "true" || normalised === "yes" || normalised === "on";
}

function normaliseRuntimeEnvValue(value?: string) {
  const trimmed = value?.trim();

  if (!trimmed || trimmed === "\"\"" || trimmed === "''") {
    return undefined;
  }

  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];
  const unquoted =
    trimmed.length >= 2 && ((first === "\"" && last === "\"") || (first === "'" && last === "'"))
      ? trimmed.slice(1, -1).trim()
      : trimmed;

  return unquoted || undefined;
}

export function getVercelRuntimeEnvironment(): VercelRuntimeEnvironment {
  const vercelEnv = String(process.env.VERCEL_ENV ?? process.env.NEXT_PUBLIC_VERCEL_ENV ?? "")
    .trim()
    .toLowerCase();

  if (vercelEnv === "production" || vercelEnv === "preview" || vercelEnv === "development") {
    return vercelEnv;
  }

  return process.env.NODE_ENV === "development" ? "development" : "local";
}

export function isProductionRuntime() {
  return getVercelRuntimeEnvironment() === "production";
}

export function isQaRuntimeEnvironment() {
  const runtimeEnvironment = getVercelRuntimeEnvironment();
  return runtimeEnvironment === "development" || runtimeEnvironment === "preview" || runtimeEnvironment === "local";
}

export function isStripeTestModeProductionOverrideEnabled() {
  return normaliseBooleanEnv(process.env.STRIPE_ALLOW_TEST_MODE_IN_PRODUCTION);
}

export function getRuntimeEnvMode(): RuntimeEnvMode {
  const rawMode = String(
    process.env.STRIPE_MODE ??
      process.env.STRIPE_ENVIRONMENT ??
      process.env.STRIPE_ENV ??
      process.env.LDA_ENV_MODE ??
      process.env.APP_RUNTIME_MODE ??
      process.env.NEXT_PUBLIC_LDA_ENV_MODE ??
      ""
  )
    .trim()
    .toLowerCase();

  const configuredMode = modeAliases[rawMode];
  const productionRuntime = isProductionRuntime();
  const liveStripeConfigured = hasRuntimeEnvValue([
    ...getModeSpecificEnvCandidates("STRIPE_SECRET_KEY", "live"),
    ...getModeSpecificEnvCandidates("STRIPE_LEARNER_PLUS_MONTHLY_PRICE_ID", "live"),
    ...getModeSpecificEnvCandidates("STRIPE_LEARNER_PRO_MONTHLY_PRICE_ID", "live"),
    ...getModeSpecificEnvCandidates("STRIPE_INSTRUCTOR_PLUS_MONTHLY_PRICE_ID", "live"),
    ...getModeSpecificEnvCandidates("STRIPE_INSTRUCTOR_PRO_MONTHLY_PRICE_ID", "live")
  ]);

  if (productionRuntime && configuredMode === "test") {
    if (isStripeTestModeProductionOverrideEnabled()) {
      return "test";
    }

    return liveStripeConfigured ? "live" : "legacy";
  }

  if (productionRuntime && liveStripeConfigured) {
    return "live";
  }

  return configuredMode ?? "legacy";
}

export function isRuntimeStripeTestModeAllowed() {
  return getRuntimeEnvMode() === "test" && isStripeTestModeProductionOverrideEnabled();
}

export function getRuntimeEnvModeLabel(mode = getRuntimeEnvMode()) {
  if (mode === "test") return "test/sandbox";
  if (mode === "live") return "live";
  return "legacy";
}

export function getModeSpecificEnvCandidates(baseEnvName: string, mode = getRuntimeEnvMode()) {
  if (mode === "legacy") {
    return [];
  }

  const label = mode.toUpperCase();
  const candidates = [`${label}_${baseEnvName}`, `${baseEnvName}_${label}`];

  if (baseEnvName.startsWith("NEXT_PUBLIC_")) {
    const suffix = baseEnvName.replace(/^NEXT_PUBLIC_/, "");
    const [serviceName, ...suffixParts] = suffix.split("_");
    candidates.unshift(`NEXT_PUBLIC_${label}_${suffix}`);
    if (serviceName && suffixParts.length) {
      candidates.push(`NEXT_PUBLIC_${serviceName}_${label}_${suffixParts.join("_")}`);
    }
    candidates.push(`NEXT_PUBLIC_${suffix}_${label}`);
  }

  if (baseEnvName.startsWith("STRIPE_")) {
    const suffix = baseEnvName.replace(/^STRIPE_/, "");
    const compatibleSuffix = suffix
      .toLowerCase()
      .split("_")
      .map((part) => (part ? `${part[0].toUpperCase()}${part.slice(1)}` : part))
      .join("_");
    candidates.unshift(`STRIPE_${label}_${suffix}`);
    candidates.push(`Stripe_${compatibleSuffix}_${mode}`);
  }

  return [...new Set(candidates)];
}

export function selectRuntimeEnvValue(
  baseEnvName: string,
  values: {
    neutral?: string;
    test?: string;
    live?: string;
  },
  mode = getRuntimeEnvMode()
): RuntimeEnvValue {
  const modeSpecificValue = mode === "test" ? values.test : mode === "live" ? values.live : undefined;
  const value = normaliseRuntimeEnvValue(modeSpecificValue) ?? normaliseRuntimeEnvValue(values.neutral);
  const envName =
    mode === "test" && values.test
      ? getModeSpecificEnvCandidates(baseEnvName, mode)[0] ?? baseEnvName
      : mode === "live" && values.live
        ? getModeSpecificEnvCandidates(baseEnvName, mode)[0] ?? baseEnvName
        : baseEnvName;

  return {
    envName,
    mode,
    modeLabel: getRuntimeEnvModeLabel(mode),
    value
  };
}

export function getRuntimeEnvValue(
  baseEnvName: string,
  {
    allowNeutralFallback = true,
    mode = getRuntimeEnvMode()
  }: {
    allowNeutralFallback?: boolean;
    mode?: RuntimeEnvMode;
  } = {}
): RuntimeEnvValue {
  const candidates = [
    ...getModeSpecificEnvCandidates(baseEnvName, mode),
    ...(allowNeutralFallback ? [baseEnvName] : [])
  ];

  for (const envName of candidates) {
    const value = normaliseRuntimeEnvValue(process.env[envName]);
    if (value) {
      return {
        envName,
        mode,
        modeLabel: getRuntimeEnvModeLabel(mode),
        value
      };
    }
  }

  return {
    envName: candidates[0] ?? baseEnvName,
    mode,
    modeLabel: getRuntimeEnvModeLabel(mode)
  };
}
