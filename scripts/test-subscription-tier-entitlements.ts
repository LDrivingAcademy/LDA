import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { instructorPackages } from "../src/lib/instructor-packages";
import { learnerPackages } from "../src/lib/learner-packages";
import {
  instructorPackageIncludesFeature,
  learnerPackageEntitlements,
  learnerPackageIncludesFeature,
  normaliseSubscriptionReturnPath,
} from "../src/lib/subscription-tier-entitlements";
import {
  getEntitledLearnerPackageId,
  hasInactiveSubscriptionStatus,
} from "../src/lib/subscription-entitlements";

function learnerPackage(id: string) {
  const plan = learnerPackages.find((item) => item.id === id);
  assert.ok(plan, `Missing learner package ${id}`);
  return plan;
}

function instructorPackage(id: string) {
  const plan = instructorPackages.find((item) => item.id === id);
  assert.ok(plan, `Missing instructor package ${id}`);
  return plan;
}

assert.equal(learnerPackage("learner-plus").yearlyPrice, "£59.88 per year");
assert.equal(learnerPackage("learner-plus").yearlyPricePence, 5988);
assert.equal(learnerPackage("learner-pro").yearlyPrice, "£119.88 per year");
assert.equal(learnerPackage("learner-pro").yearlyPricePence, 11988);
assert.equal(instructorPackage("instructor-plus").yearlyPrice, "£59.88 per year");
assert.equal(instructorPackage("instructor-plus").yearlyPricePence, 5988);
assert.equal(instructorPackage("instructor-pro").yearlyPrice, "£119.88 per year");
assert.equal(instructorPackage("instructor-pro").yearlyPricePence, 11988);

assert.deepEqual(learnerPackageEntitlements.learner.allowances, {
  topicQuizzesPerDay: 5,
  fullTheoryMocksPerDay: 1,
  individualHazardClipsPerDay: 3,
  fullHazardMocksPerWeek: 1,
});
assert.deepEqual(learnerPackageEntitlements["learner-plus"].allowances, {
  topicQuizzesPerDay: 20,
  fullTheoryMocksPerDay: 5,
  individualHazardClipsPerDay: 15,
  fullHazardMocksPerWeek: 3,
});
assert.deepEqual(learnerPackageEntitlements["learner-pro"].allowances, {
  topicQuizzesPerDay: 50,
  fullTheoryMocksPerDay: 10,
  individualHazardClipsPerDay: 40,
  fullHazardMocksPerWeek: 7,
});

assert.equal(learnerPackageIncludesFeature("learner", "learner-plus"), false);
assert.equal(learnerPackageIncludesFeature("learner-plus", "learner-plus"), true);
assert.equal(learnerPackageIncludesFeature("learner-pro", "learner-plus"), true);
assert.equal(instructorPackageIncludesFeature("instructor", "instructor-pro"), false);
assert.equal(instructorPackageIncludesFeature("instructor-pro", "instructor-plus"), true);
assert.equal(hasInactiveSubscriptionStatus("canceled"), true);
assert.equal(hasInactiveSubscriptionStatus("cancelled"), true);
assert.equal(getEntitledLearnerPackageId({ packageId: "learner-pro", status: "canceled", expiresAt: new Date(Date.now() + 86_400_000).toISOString() }), null);
assert.equal(getEntitledLearnerPackageId({ packageId: "learner", status: "canceled" }), "learner");

assert.equal(normaliseSubscriptionReturnPath("/learner-plus/learner-pro", "/learner-dashboard"), "/learner-plus/learner-pro");
assert.equal(normaliseSubscriptionReturnPath("https://evil.example/path", "/learner-dashboard"), "/learner-dashboard");
assert.equal(normaliseSubscriptionReturnPath("//evil.example/path", "/learner-dashboard"), "/learner-dashboard");
assert.equal(normaliseSubscriptionReturnPath("/api/private", "/learner-dashboard"), "/learner-dashboard");

const learnerCopy = readFileSync(new URL("../src/lib/learner-packages.ts", import.meta.url), "utf8");
const instructorCopy = readFileSync(new URL("../src/lib/instructor-packages.ts", import.meta.url), "utf8");
const stripeCheckout = readFileSync(new URL("../src/lib/stripe-checkout.ts", import.meta.url), "utf8");
const theorySuite = readFileSync(new URL("../src/components/theory-test-suite.tsx", import.meta.url), "utf8");
const hazardTest = readFileSync(new URL("../src/components/lda-hazard-video-test.tsx", import.meta.url), "utf8");
const learnerDashboardJourney = readFileSync(new URL("../src/components/learner-dashboard-journey.tsx", import.meta.url), "utf8");
const dashboardPage = readFileSync(new URL("../src/app/dashboard/page.tsx", import.meta.url), "utf8");
const learnerPackageDetailPage = readFileSync(new URL("../src/app/learner-plus/[packageId]/page.tsx", import.meta.url), "utf8");
const firstCarPage = readFileSync(new URL("../src/app/first-car-guidance/page.tsx", import.meta.url), "utf8");
const insurancePage = readFileSync(new URL("../src/app/insurance-support/page.tsx", import.meta.url), "utf8");
const sitemap = readFileSync(new URL("../src/app/sitemap.ts", import.meta.url), "utf8");
const routePrefetcher = readFileSync(new URL("../src/components/route-prefetcher.tsx", import.meta.url), "utf8");
const accountPackageState = readFileSync(new URL("../src/lib/account-package-state.ts", import.meta.url), "utf8");
const currentAccount = readFileSync(new URL("../src/lib/current-account.ts", import.meta.url), "utf8");

assert.doesNotMatch(learnerCopy, /Premium LDA SmartMatch weighting|connector-ready|insurance quote support/);
assert.doesNotMatch(learnerCopy, /No paid queue jump/);
assert.doesNotMatch(instructorCopy, /Priority placement|Premium matching|leakage-risk|connector-ready/);
assert.doesNotMatch(stripeCheckout, /payment_method_types/);
assert.match(theorySuite, /fullTheoryMocksPerDay/);
assert.match(theorySuite, /topicQuizzesPerDay/);
assert.match(theorySuite, /individualHazardClipsPerDay/);
assert.match(theorySuite, /allowanceSnapshots\.topicQuizzesPerDay\.remaining/);
assert.match(theorySuite, /allowanceSnapshots\.fullTheoryMocksPerDay\.remaining/);
assert.match(theorySuite, /allowanceSnapshots\.individualHazardClipsPerDay\.remaining/);
assert.match(theorySuite, /allowanceSnapshots\.fullHazardMocksPerWeek\.remaining/);
assert.match(theorySuite, /function consumeTheoryAllowance/);
assert.match(theorySuite, /if \(!consumeTheoryAllowance\("topicQuizzesPerDay"\)\) return;/);
assert.match(theorySuite, /if \(!consumeTheoryAllowance\("fullTheoryMocksPerDay"\)\) return;/);
assert.match(theorySuite, /onAllowanceConsumed=\{refreshAllowanceSnapshots\}/);
assert.match(hazardTest, /fullHazardMocksPerWeek/);
assert.match(hazardTest, /individualHazardClipsPerDay/);
assert.match(hazardTest, /onAllowanceConsumed\?\.\(\)/);
assert.match(hazardTest, /learnerPackageIncludesFeature\(currentLearnerPackageId, 'learner-plus'\)/);
assert.match(hazardTest, /Upgrade to Learner Plus/);
assert.match(learnerDashboardJourney, /minimumPackageId: "learner-pro"/);
assert.match(learnerDashboardJourney, /Upgrade to \$\{packageLabel\(requiredPackageId\)\}/);
assert.match(learnerDashboardJourney, /function packageIncludedCopy/);
assert.match(learnerDashboardJourney, /Included with Learner Pro\./);
assert.match(learnerDashboardJourney, /Included with \$\{packageLabel\(packageId\)\} and above\./);
assert.match(dashboardPage, /currentLearnerPackageId=\{learnerPackageId\}/);
assert.doesNotMatch(learnerPackageDetailPage, /SubscriptionLockedFeatureGrid/);
assert.match(learnerPackageDetailPage, /This is the practical value included with/);
assert.match(firstCarPage, /learnerPackageIncludesFeature\(learnerPackageId, "learner-pro"\)/);
assert.match(firstCarPage, /Upgrade to Learner Pro/);
assert.match(insurancePage, /learnerPackageIncludesFeature\(learnerPackageId, "learner-pro"\)/);
assert.match(insurancePage, /Upgrade to Learner Pro/);
assert.doesNotMatch(sitemap, /\/first-car-guidance|\/insurance-support/);
assert.doesNotMatch(routePrefetcher, /"\/first-car-guidance"|"\/insurance-support"/);
assert.match(accountPackageState, /subscriptionIsInactive/);
assert.match(currentAccount, /learnerSubscriptionIsInactive/);
assert.match(dashboardPage, /learnerSubscriptionIsInactive/);

console.log("Subscription tier entitlement checks passed.");
