import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const accountCentre = readFileSync("src/components/account-centre.tsx", "utf8");
const loginActivityPanel = readFileSync("src/components/account-login-activity-panel.tsx", "utf8");
const loginActivitiesPage = readFileSync("src/app/account/login-activities/page.tsx", "utf8");
const trustedDevicesPage = readFileSync("src/app/account/trusted-devices/page.tsx", "utf8");
const trustedDevicesActions = readFileSync("src/app/account/trusted-devices/actions.ts", "utf8");
const loginPage = readFileSync("src/app/auth/login/page.tsx", "utf8");

const mixedAccountCopy = [
  "Active lessons and instructor working sessions",
  "active learner tracking or while an instructor is logged on for work",
  "During a booked lesson, learner tracking turns live for that booking. During instructor work time",
  "Every successful learner or instructor sign-in"
];

for (const phrase of mixedAccountCopy) {
  assert.equal(accountCentre.includes(phrase), false, `Account centre still has mixed-role copy: ${phrase}`);
  assert.equal(loginActivityPanel.includes(phrase), false, `Login activity panel still has mixed-role copy: ${phrase}`);
}

assert.match(accountCentre, /isInstructorAccount \? null : <AccountSmartMatchPreferences \/>/);
assert.match(accountCentre, /"Your Log In Activities", "\/account\/login-activities"/);
assert.doesNotMatch(accountCentre, /id="log-in-activities"/);
assert.match(loginActivityPanel, /Every successful \{roleLabel\} sign-in/);
assert.match(loginActivitiesPage, /AccountLoginActivityPanel/);
assert.match(accountCentre, /booked lesson tracking will ask for it when needed/);
assert.match(accountCentre, /instructor work sessions will ask for it when needed/);

assert.equal(trustedDevicesPage.includes("remembered learner or instructor devices"), false);
assert.equal(trustedDevicesPage.includes("remembered for learner or instructor access"), false);
assert.equal(trustedDevicesPage.includes("log in as a learner or instructor"), false);
assert.match(trustedDevicesPage, /remembered for your \{roleLabel\} account access/);
assert.match(trustedDevicesPage, /log in to your \{roleLabel\} account/);

assert.equal(trustedDevicesActions.includes("learner and instructor accounts only"), false);
assert.match(trustedDevicesActions, /Trusted devices are not available for this account type/);

assert.equal(loginPage.includes("trusted device session for learner or instructor access"), false);
assert.match(loginPage, /trusted device session for \{isInstructor \? "instructor" : "learner"\} access/);

console.log("Role-specific account copy checks passed.");
