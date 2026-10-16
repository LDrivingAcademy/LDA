import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

const sharedHeader = read("src/components/admin-page-header.tsx");

assert.match(sharedHeader, /fallbackHref="\/admin"/, "Shared admin back link must point to /admin.");
assert.match(sharedHeader, /fallbackLabel="Back to admin dashboard"/, "Shared admin back link text must stay consistent.");
assert.match(sharedHeader, /bg-black/, "Shared admin back link must be black.");
assert.match(sharedHeader, /text-white/, "Shared admin back link must use readable contrasting text.");
assert.match(sharedHeader, /sm:items-end/, "Shared admin header must right-align the action area on wider screens.");

const adminPages = [
  "src/app/admin/active-drivers/page.tsx",
  "src/app/admin/analytics/page.tsx",
  "src/app/admin/bookings/page.tsx",
  "src/app/admin/disputes/page.tsx",
  "src/app/admin/instructors/page.tsx",
  "src/app/admin/learners/page.tsx",
  "src/app/admin/payments/page.tsx",
  "src/app/admin/refunds/page.tsx",
  "src/app/admin/revenue/page.tsx",
  "src/app/admin/support-escalations/page.tsx",
  "src/app/owner-dashboard/page.tsx"
];

for (const page of adminPages) {
  const source = read(page);
  assert.match(source, /AdminPageHeader/, `${page} must use the shared admin page header.`);
  assert.doesNotMatch(source, /DynamicBackLink/, `${page} must not define a one-off dynamic back link.`);
}

const technicalSupport = read("src/app/technical-support/page.tsx");
const technicalSupportHeader = read("src/components/technical-support-page-header.tsx");
assert.match(technicalSupport, /TechnicalSupportPageHeader/, "Admin-entered support console must use the shared support page header.");
assert.match(technicalSupport, /showAdminBack=\{accessRole === "admin"\}/, "Support console admin back link must be hidden from support-only users.");
assert.match(technicalSupportHeader, /AdminBackToDashboardLink/, "Support page header must reuse the shared admin back link.");

const allSources = [
  sharedHeader,
  ...adminPages.map(read),
  technicalSupport
].join("\n");

const backLabelCount = (allSources.match(/Back to admin dashboard/g) ?? []).length;
assert.equal(backLabelCount, 1, "The back label should only be defined in the shared component.");

console.log("Admin back-navigation layout checks passed.");
