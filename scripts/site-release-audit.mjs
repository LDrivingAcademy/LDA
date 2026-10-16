#!/usr/bin/env node

import { spawn } from "node:child_process";

const target = normaliseTarget(process.env.LDA_RELEASE_AUDIT_TARGET || process.env.LDA_MONITOR_TARGET || "https://ldrivingacademy.co.uk");
const loadRequests = String(toPositiveInt(process.env.LDA_RELEASE_LOAD_REQUESTS, 1000));
const loadConcurrency = String(toPositiveInt(process.env.LDA_RELEASE_LOAD_CONCURRENCY, 75));
const loadTimeoutMs = String(toPositiveInt(process.env.LDA_RELEASE_LOAD_TIMEOUT_MS, 12000));
const enforceServerTargets = process.env.LDA_RELEASE_ENFORCE_SERVER_TARGETS ?? "true";

const steps = [
  {
    name: "security and health monitor",
    command: packageManagerCommand(),
    args: ["run", "monitor:once"],
    env: {
      LDA_MONITOR_TARGET: target
    }
  },
  {
    name: "internal link crawl",
    command: packageManagerCommand(),
    args: ["run", "links:check"],
    env: {
      LINK_CHECK_BASE_URL: target
    }
  },
  {
    name: "brand icon availability",
    command: packageManagerCommand(),
    args: ["run", "brand-icons:check"],
    env: {
      LDA_BRAND_ICON_CHECK_TARGET: target
    }
  },
  {
    name: "traffic load smoke",
    command: packageManagerCommand(),
    args: ["run", "load:smoke"],
    env: {
      LOAD_BASE_URL: target,
      REQUESTS: loadRequests,
      CONCURRENCY: loadConcurrency,
      TIMEOUT_MS: loadTimeoutMs,
      SLOW_RESPONSE_MS: "300",
      SERVER_P50_MS: "100",
      SERVER_P90_MS: "200",
      SERVER_P95_MS: "300",
      SERVER_P99_MS: "500",
      ENFORCE_SERVER_TARGETS: enforceServerTargets
    }
  }
];

console.log(`LDA release audit target: ${target}`);

for (const step of steps) {
  console.log(`\n== ${step.name} ==`);
  const result = await runCommand(step.command, step.args, step.env);

  if (result.exitCode !== 0) {
    console.error(`\nLDA release audit failed during ${step.name}.`);
    process.exit(result.exitCode);
  }
}

console.log("\nLDA release audit passed.");

function runCommand(command, args, extraEnv) {
  return new Promise((resolve) => {
    const windows = process.platform === "win32";
    const child = spawn(windows ? process.env.ComSpec || "cmd.exe" : command, windows ? ["/d", "/s", "/c", quoteCommand([command, ...args])] : args, {
      env: {
        ...process.env,
        ...extraEnv
      },
      shell: false,
      stdio: "inherit",
      windowsHide: true
    });

    child.on("close", (exitCode) => {
      resolve({ exitCode: exitCode ?? 1 });
    });

    child.on("error", (error) => {
      console.error(error.message);
      resolve({ exitCode: 1 });
    });
  });
}

function quoteCommand(parts) {
  return parts
    .map((part) => {
      if (/^[A-Za-z0-9_./:=@-]+$/.test(part)) {
        return part;
      }

      return `"${part.replace(/"/g, '\\"')}"`;
    })
    .join(" ");
}

function normaliseTarget(value) {
  try {
    return new URL(value).origin;
  } catch {
    return new URL(`https://${value}`).origin;
  }
}

function toPositiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function packageManagerCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}
