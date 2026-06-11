export type RuntimeEnvMode = "legacy" | "test" | "live";

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

export function getRuntimeEnvMode(): RuntimeEnvMode {
  const rawMode = String(
    process.env.NEXT_PUBLIC_LDA_ENV_MODE ??
      process.env.LDA_ENV_MODE ??
      process.env.APP_RUNTIME_MODE ??
      process.env.STRIPE_MODE ??
      process.env.STRIPE_ENVIRONMENT ??
      process.env.STRIPE_ENV ??
      ""
  )
    .trim()
    .toLowerCase();

  return modeAliases[rawMode] ?? "legacy";
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
    candidates.unshift(`STRIPE_${label}_${suffix}`);
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
  const value = (modeSpecificValue || values.neutral || "").trim();
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
    value: value || undefined
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
    const value = process.env[envName]?.trim();
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
