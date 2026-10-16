#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const args = new Set(process.argv.slice(2));
const writeReport = args.has("--write-report") || args.has("--online");
const online = args.has("--online");
const updateBaseline = args.has("--update-baseline");
const reportPath = resolve(process.env.LDA_POLICY_REVIEW_REPORT || ".monitor/legal-policy-review-report.md");
const baselinePath = resolve(process.env.LDA_POLICY_SOURCE_BASELINE || ".monitor/legal-source-watch-baseline.json");
const legalContentPath = resolve("src/lib/legal-content.ts");

const officialSources = [
  {
    name: "ICO right to be informed",
    url: "https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/right-to-be-informed/"
  },
  {
    name: "ICO cookies and similar technologies",
    url: "https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guide-to-pecr/cookies-and-similar-technologies/"
  },
  {
    name: "GOV.UK Data Use and Access Act 2025 factsheets",
    url: "https://www.gov.uk/government/publications/data-use-and-access-act-2025-factsheets"
  },
  {
    name: "GOV.UK accessibility requirements",
    url: "https://www.gov.uk/guidance/accessibility-requirements-for-public-sector-websites-and-apps"
  },
  {
    name: "Digital Markets, Competition and Consumers Act 2024",
    url: "https://www.legislation.gov.uk/ukpga/2024/13/contents"
  },
  {
    name: "GOV.UK subscription contracts regime response",
    url: "https://www.gov.uk/government/consultations/consultation-on-the-implementation-of-the-new-subscription-contracts-regime/outcome/government-response-to-consultation-on-the-implementation-of-the-new-subscription-contracts-regime-web-accessible-version"
  },
  {
    name: "CAP Code, misleading advertising",
    url: "https://www.asa.org.uk/type/non_broadcast/code_section/03.html"
  },
  {
    name: "GOV.UK ADI code of practice",
    url: "https://www.gov.uk/government/publications/driving-instructor-code-of-practice/approved-driving-instructor-adi-code-of-practice"
  },
  {
    name: "GOV.UK become a car driving instructor",
    url: "https://www.gov.uk/become-car-driving-instructor"
  },
  {
    name: "GOV.UK online reviews and endorsements advice",
    url: "https://www.gov.uk/government/publications/online-reviews-and-endorsements-advice-for-businesses"
  }
];

const requiredAnchors = [
  {
    label: "UK GDPR/data rights",
    patterns: ["UK data protection law", "Information Commissioner's Office", "without undue delay", "within one month"]
  },
  {
    label: "PECR/cookies consent",
    patterns: ["PECR", "strictly necessary cookies", "non-essential cookies", "consent"]
  },
  {
    label: "Data Use and Access Act watch",
    patterns: ["Data (Use and Access) Act 2025"]
  },
  {
    label: "Consumer pricing/refunds",
    patterns: ["no hidden mandatory fee", "statutory consumer rights", "reasonable care and skill"]
  },
  {
    label: "Fake reviews/marketing claims",
    patterns: ["fake or misleading reviews", "not likely to mislead users"]
  },
  {
    label: "Accessibility",
    patterns: ["WCAG 2.2 AA", "another format", "assistive technologies"]
  },
  {
    label: "Location/live tracking transparency",
    patterns: ["precise GPS coordinates", "pickup accuracy", "live tracking"]
  },
  {
    label: "Regulated insurance/FCA caution",
    patterns: ["regulated financial advice", "FCA regulatory position"]
  },
  {
    label: "Solicitor/legal escalation",
    patterns: ["professional review", "risky judgement call"]
  },
  {
    label: "Public review dating",
    patterns: ["Last reviewed 30 July 2026"]
  }
];

const legalContent = await readFile(legalContentPath, "utf8");
const baseline = await readBaseline(baselinePath);
const results = requiredAnchors.map((check) => {
  const missing = check.patterns.filter((pattern) => !legalContent.includes(pattern));
  return {
    ...check,
    ok: missing.length === 0,
    missing
  };
});

const sourceResults = online
  ? await checkSources(officialSources, baseline)
  : officialSources.map((source) => ({ ...source, ok: null, changed: null }));

if (online && updateBaseline) {
  const nextBaseline = Object.fromEntries(
    sourceResults
      .filter((source) => source.hash)
      .map((source) => [
        source.url,
        {
          name: source.name,
          hash: source.hash,
          checkedAt: new Date().toISOString()
        }
      ])
  );
  await mkdir(dirname(baselinePath), { recursive: true });
  await writeFile(baselinePath, `${JSON.stringify(nextBaseline, null, 2)}\n`, "utf8");
}

const failures = results.filter((result) => !result.ok);
const sourceFailures = sourceResults.filter((result) => result.ok === false);
const sourceChanges = sourceResults.filter((result) => result.changed === true);

const report = renderReport({
  generatedAt: new Date().toISOString(),
  results,
  sourceResults,
  failures,
  sourceFailures,
  sourceChanges,
  baselinePath,
  updateBaseline
});

if (writeReport || failures.length || sourceFailures.length) {
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, report, "utf8");
}

console.log(report);

if (failures.length || sourceFailures.length || sourceChanges.length) {
  process.exitCode = 1;
}

async function readBaseline(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return {};
  }
}

async function checkSources(sources, baseline) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    return await Promise.all(
      sources.map(async (source) => {
        try {
          const response = await fetch(source.url, { signal: controller.signal });
          const text = response.ok ? await response.text() : "";
          const hash = text ? hashText(text) : "";
          const expected = baseline[source.url]?.hash;
          return {
            ...source,
            ok: response.ok,
            status: response.status,
            hash,
            changed: Boolean(expected && hash && expected !== hash),
            hasBaseline: Boolean(expected)
          };
        } catch (error) {
          return {
            ...source,
            ok: false,
            status: 0,
            error: error instanceof Error ? error.message : "request failed"
          };
        }
      })
    );
  } finally {
    clearTimeout(timeout);
  }
}

function hashText(text) {
  const normalised = text
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return createHash("sha256").update(normalised).digest("hex");
}

function renderReport({ generatedAt, results, sourceResults, failures, sourceFailures, sourceChanges, baselinePath, updateBaseline }) {
  const status = failures.length || sourceFailures.length || sourceChanges.length ? "ACTION NEEDED" : "PASS";
  return [
    "# LDA Legal Policy Compliance Review",
    "",
    `- Generated: ${generatedAt}`,
    `- Status: ${status}`,
    `- Scope: Privacy Policy, Terms of Use, Cookie Policy, Accessibility, Data Requests, Contact/Support, Cancellation/Refund Policy`,
    `- Official-source baseline: ${baselinePath}`,
    `- Baseline update mode: ${updateBaseline ? "on" : "off"}`,
    "",
    "## Policy Anchor Checks",
    "",
    ...results.map((result) =>
      result.ok
        ? `- PASS ${result.label}`
        : `- FAIL ${result.label}: missing ${result.missing.map((item) => `\`${item}\``).join(", ")}`
    ),
    "",
    "## Official Source Watchlist",
    "",
    ...sourceResults.map((source) => {
      const prefix = source.ok === null ? "WATCH" : source.ok ? "PASS" : "FAIL";
      const suffix = source.ok === null ? "" : ` status=${source.status}`;
      const baseline = source.ok === null ? "" : source.hasBaseline ? " baseline=yes" : " baseline=no";
      const changed = source.changed ? " changed=yes" : "";
      const error = source.error ? ` error=${source.error}` : "";
      return `- ${prefix} ${source.name}: ${source.url}${suffix}${baseline}${changed}${error}`;
    }),
    "",
    "## Source Change Alerts",
    "",
    sourceChanges.length
      ? sourceChanges.map((source) => `- REVIEW ${source.name}: official source content changed since the saved baseline. Check the guidance before updating LDA wording.`).join("\n")
      : "- No official source changes detected against the saved baseline.",
    "",
    "## Legal Review Items",
    "",
    "- Confirm LDA legal entity name, trading address, company number if applicable, and data-controller contact before full public launch.",
    "- Confirm consumer cancellation/cooling-off wording with a solicitor before taking paid scheduled lesson packages or relying on recurring paid subscription terms.",
    "- Confirm any insurance quote, finance, broker, lead-generation, or first-car commercial arrangement before publishing live quote/referral flows.",
    "- Confirm cookie table against the production browser/storage inventory whenever analytics, marketing tags, chat, maps, payments, or messaging providers change.",
    "- Confirm whether any automated matching, fraud flagging, suspension, refund, or eligibility decision needs additional human-review wording.",
    "",
    "This script monitors required policy anchors, official source availability, and official-source text changes. It does not replace solicitor review and must not silently publish risky legal changes.",
    ""
  ].join("\n");
}
