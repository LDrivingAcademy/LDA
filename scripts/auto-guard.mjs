#!/usr/bin/env node

import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const target = process.env.LDA_MONITOR_TARGET || "http://localhost:3000";
const intervalMs = toPositiveInt(process.env.LDA_AUTO_GUARD_INTERVAL_MS, 60_000);
const diagnosticsSetting = process.env.LDA_AUTO_GUARD_DIAGNOSTICS ?? "build";
const diagnostics =
  diagnosticsSetting.trim().toLowerCase() === "none"
    ? []
    : diagnosticsSetting
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
const repairCommand = process.env.LDA_AUTO_REPAIR_COMMAND || "";
const maxRepairAttempts = toPositiveInt(process.env.LDA_AUTO_REPAIR_MAX_ATTEMPTS, 3);
const incidentDir = resolve(process.env.LDA_AUTO_GUARD_INCIDENT_DIR || ".monitor/incidents");
const logFile = resolve(process.env.LDA_AUTO_GUARD_LOG_FILE || ".monitor/auto-guard.log");
const monitorLogFile = resolve(process.env.LDA_MONITOR_LOG_FILE || ".monitor/website-monitor.log");
const runOnce = process.argv.includes("--once");

await mkdir(incidentDir, { recursive: true });
await mkdir(dirname(logFile), { recursive: true });

console.log(`LDA auto-guard watching ${target}`);
console.log(`Interval: ${intervalMs}ms. Incidents: ${incidentDir}`);
console.log(repairCommand ? "Automatic repair command is enabled." : "Automatic repair command is not configured.");
console.log(`Max repair attempts per incident: ${maxRepairAttempts}`);

let cycle = 0;

do {
  cycle += 1;
  const result = await runCommand(process.execPath, ["scripts/monitor-website.mjs", "--once"], {
    env: {
      ...process.env,
      LDA_MONITOR_TARGET: target,
      LDA_MONITOR_LOG_FILE: monitorLogFile
    }
  });

  if (result.exitCode === 0) {
    await writeGuardLog({ type: "cycle_ok", cycle, target });
    console.log(`[${new Date().toLocaleTimeString()}] OK cycle=${cycle}`);
  } else {
    const incident = await createIncident(cycle, result);
    console.log(`[${new Date().toLocaleTimeString()}] FAILURE cycle=${cycle} incident=${incident.path}`);

    if (repairCommand) {
      const repairLoop = await runRepairLoop(incident.path);
      await writeGuardLog({ type: "repair_loop_completed", cycle, incident: incident.path, ...repairLoop });
    } else {
      const diagnosticResults = await runDiagnostics();
      await appendIncident(incident.path, renderDiagnosticResults(diagnosticResults, "Initial Diagnostics"));
      await writeGuardLog({ type: "incident_created", cycle, incident: incident.path });
    }
  }

  if (runOnce) {
    break;
  }

  await delay(intervalMs);
} while (true);

async function createIncident(cycle, monitorResult) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = resolve(incidentDir, `${stamp}-cycle-${cycle}.md`);
  const latestMonitorEntry = await readLatestLine(monitorLogFile);
  const body = [
    "# LDA Auto-Guard Incident",
    "",
    `- Time: ${new Date().toISOString()}`,
    `- Target: ${target}`,
    `- Cycle: ${cycle}`,
    `- Monitor exit code: ${monitorResult.exitCode}`,
    "",
    "## Monitor Output",
    "",
    "```txt",
    trimForReport(monitorResult.output),
    "```",
    "",
    "## Latest Monitor Log Entry",
    "",
    "```json",
    latestMonitorEntry || "{}",
    "```",
    ""
  ].join("\n");

  await writeFile(path, body, "utf8");
  return { path };
}

async function appendIncident(path, text) {
  await appendFile(path, `\n${text}\n`, "utf8");
}

async function runDiagnostic(name) {
  if (name === "build") {
    return {
      name,
      result: await runCommand(packageManagerCommand(), ["run", "build"], { timeoutMs: 180_000 })
    };
  }

  if (name === "lint") {
    return {
      name,
      result: await runCommand(packageManagerCommand(), ["run", "lint"], { timeoutMs: 180_000 })
    };
  }

  return {
    name,
    result: { exitCode: 1, output: `Unknown diagnostic: ${name}` }
  };
}

async function runDiagnostics() {
  const diagnosticResults = [];
  for (const diagnostic of diagnostics) {
    diagnosticResults.push(await runDiagnostic(diagnostic));
  }
  return diagnosticResults;
}

async function runMonitorOnce() {
  return runCommand(process.execPath, ["scripts/monitor-website.mjs", "--once"], {
    env: {
      ...process.env,
      LDA_MONITOR_TARGET: target,
      LDA_MONITOR_LOG_FILE: monitorLogFile
    }
  });
}

async function runRepairLoop(incidentPath) {
  let lastRepairExitCode = null;
  let lastVerificationExitCode = null;

  for (let attempt = 1; attempt <= maxRepairAttempts; attempt += 1) {
    await appendIncident(incidentPath, `## Repair Attempt ${attempt}\n`);

    const preDiagnostics = await runDiagnostics();
    await appendIncident(incidentPath, renderDiagnosticResults(preDiagnostics, `Diagnostics Before Attempt ${attempt}`));

    const repairResult = await runRepairCommand(repairCommand);
    lastRepairExitCode = repairResult.exitCode;
    await appendIncident(incidentPath, renderRepairResult(repairResult, attempt));

    const postDiagnostics = await runDiagnostics();
    await appendIncident(incidentPath, renderDiagnosticResults(postDiagnostics, `Diagnostics After Attempt ${attempt}`));

    const verification = await runMonitorOnce();
    lastVerificationExitCode = verification.exitCode;
    await appendIncident(incidentPath, renderVerificationResult(verification, attempt));

    await writeGuardLog({
      type: "repair_attempt_completed",
      incident: incidentPath,
      attempt,
      repairExitCode: repairResult.exitCode,
      verificationExitCode: verification.exitCode
    });

    if (verification.exitCode === 0 && postDiagnostics.every(({ result }) => result.exitCode === 0)) {
      await appendIncident(incidentPath, "## Result\n\nThe website monitor and diagnostics passed after this repair attempt.\n");
      return {
        resolved: true,
        attempts: attempt,
        lastRepairExitCode,
        lastVerificationExitCode
      };
    }
  }

  await appendIncident(
    incidentPath,
    [
      "## Result",
      "",
      `Auto-guard stopped after ${maxRepairAttempts} repair attempts because failures remained.`,
      "Review this incident before allowing further automatic repair attempts.",
      ""
    ].join("\n")
  );

  return {
    resolved: false,
    attempts: maxRepairAttempts,
    lastRepairExitCode,
    lastVerificationExitCode
  };
}

async function runRepairCommand(command) {
  const shell = process.platform === "win32" ? "powershell.exe" : "sh";
  const args = process.platform === "win32" ? ["-NoProfile", "-Command", command] : ["-lc", command];
  return runCommand(shell, args, { timeoutMs: 600_000 });
}

function renderDiagnosticResults(results, heading = "Diagnostics") {
  return [
    `## ${heading}`,
    "",
    ...(results.length
      ? []
      : ["No diagnostics configured.", ""]),
    ...results.flatMap(({ name, result }) => [
      `### ${name}`,
      "",
      `Exit code: ${result.exitCode}`,
      "",
      "```txt",
      trimForReport(result.output),
      "```",
      ""
    ])
  ].join("\n");
}

function renderRepairResult(result, attempt) {
  return [
    `## Automatic Repair${attempt ? ` Attempt ${attempt}` : ""}`,
    "",
    `Exit code: ${result.exitCode}`,
    "",
    "```txt",
    trimForReport(result.output),
    "```",
    ""
  ].join("\n");
}

function renderVerificationResult(result, attempt) {
  return [
    `## Post-Repair Verification${attempt ? ` Attempt ${attempt}` : ""}`,
    "",
    `Exit code: ${result.exitCode}`,
    "",
    "```txt",
    trimForReport(result.output),
    "```",
    ""
  ].join("\n");
}

function runCommand(command, args, options = {}) {
  return new Promise((resolveResult) => {
    const timeoutMs = options.timeoutMs || 60_000;
    let output = "";
    let child;

    try {
      child = spawn(command, args, {
        env: options.env || process.env,
        shell: false,
        windowsHide: true
      });
    } catch (error) {
      resolveResult({ exitCode: 1, output: error instanceof Error ? error.message : "command failed" });
      return;
    }

    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      output += `\nCommand timed out after ${timeoutMs}ms.`;
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.on("close", (exitCode) => {
      clearTimeout(timeout);
      resolveResult({ exitCode: exitCode ?? 1, output });
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      resolveResult({ exitCode: 1, output: error.message });
    });
  });
}

function packageManagerCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

async function readLatestLine(path) {
  try {
    const text = await readFile(path, "utf8");
    return text.trim().split(/\r?\n/).pop() || "";
  } catch {
    return "";
  }
}

async function writeGuardLog(entry) {
  await appendFile(logFile, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`, "utf8");
}

function trimForReport(value) {
  const maxLength = 20_000;
  return value.length > maxLength ? `${value.slice(-maxLength)}\n[trimmed to last ${maxLength} chars]` : value;
}

function toPositiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
