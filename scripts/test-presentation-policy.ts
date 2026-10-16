import { readFileSync } from "fs";
import { join } from "path";
import assert from "assert";
import {
  containsInformationExposure,
  filterPresentationActions,
  publicSafeErrorMessage,
  sanitizePresentationObject,
  sanitizePresentationText
} from "../src/lib/presentation-policy";

const root = process.cwd();

function read(relativePath: string) {
  return readFileSync(join(root, relativePath), "utf8");
}

const publicLeakText =
  "Supabase returned a p95 platform health warning from Vercel. Stripe Connect needs a database migration.";
const sanitised = sanitizePresentationText(publicLeakText, "learner");
assert(!containsInformationExposure(sanitised, "learner"), `sanitised text still exposes internals: ${sanitised}`);

const objectResult = sanitizePresentationObject(
  {
    answer: publicLeakText,
    serviceStatus: { status: "ok", summary: "p95 300ms" },
    handoff: { summary: "internal" },
    tool_trace: [{ tool: "check_service_status" }],
    ticket: { id: "private-id", reference: "LDA-1234", status: "new" }
  },
  "learner"
) as Record<string, unknown>;

assert(!("serviceStatus" in objectResult), "public payload should drop serviceStatus");
assert(!("handoff" in objectResult), "public payload should drop handoff details");
assert(!("tool_trace" in objectResult), "public payload should drop tool traces");
assert.deepEqual(objectResult.ticket, { reference: "LDA-1234", status: "new" });

const actions = filterPresentationActions(
  [
    { label: "Open admin", href: "/admin" },
    { label: "Find instructor", href: "/find-instructors" },
    { label: "Health", href: "/technical-support/health" },
    { label: "API", href: "/api/internal" }
  ],
  "visitor"
);
assert.deepEqual(actions, [{ label: "Find instructor", href: "/find-instructors" }]);

assert.equal(
  publicSafeErrorMessage("Supabase schema cache failed", "learner"),
  "Something went wrong. Please try again. If it keeps happening, contact LDA support."
);

const publicFiles = [
  "src/components/support-assistant.tsx",
  "src/components/learner-payment-help.tsx",
  "src/components/instructor-support-content.tsx",
  "src/components/technical-error-page.tsx",
  "src/components/auth/email-callback-client.tsx",
  "src/app/auth/verify/page.tsx",
  "src/app/auth/actions.ts",
  "src/app/auth/handoff-actions.ts",
  "src/app/auth/confirm/route.ts",
  "src/app/auth/callback/route.ts",
  "src/app/api/auth/password-reset/route.ts",
  "src/app/dashboard/page.tsx",
  "src/app/instructor/page.tsx",
  "src/app/account/instructor-transfer/page.tsx",
  "src/app/account/actions.ts",
  "src/app/support/learner/payment-help/actions.ts",
  "src/app/api/bookings/checkout/route.ts",
  "src/app/api/bookings/confirm/route.ts",
  "src/app/api/instant-lessons/checkout/route.ts",
  "src/app/api/instant-lessons/cancel/route.ts",
  "src/app/api/instant-lessons/status/route.ts",
  "src/lib/marketplace-content.ts",
  "src/lib/instructor-packages.ts"
];

const bannedPublicPhrases = [
  "Supabase environment",
  "Supabase is not configured",
  "Add SUPABASE",
  "Add RESEND",
  "in Vercel",
  "latest Supabase migration",
  "database migration",
  "schema cache",
  "Stripe Checkout",
  "Stripe Connect",
  "Stripe checkout failed",
  "Stripe payment attempt",
  "Platform status:",
  "technical support queue"
];

const findings: string[] = [];
for (const file of publicFiles) {
  const source = read(file);
  for (const phrase of bannedPublicPhrases) {
    if (source.includes(phrase)) {
      findings.push(`${file}: ${phrase}`);
    }
  }
}

const supportRoute = read("src/app/api/support/assistant/route.ts");
assert(supportRoute.includes("sanitizePresentationObject"), "support assistant route must sanitize returned payloads");
assert(!/serviceStatus:\s*\{/.test(supportRoute), "support assistant route must not return serviceStatus to public clients");

assert.deepEqual(findings, []);
console.log("Presentation policy leak checks passed.");
