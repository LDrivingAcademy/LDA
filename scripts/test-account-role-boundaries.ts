import assert from "node:assert/strict";
import { isDirectorAdminEmail, isMarketplaceTestInstructorEmail } from "../src/lib/admin-access";
import { getMarketplaceRoleState } from "../src/lib/account-route-guard";

const testInstructorEmail = "JoshuaMN1@Hotmail.com";

assert.equal(isMarketplaceTestInstructorEmail(testInstructorEmail), true);
assert.equal(
  isDirectorAdminEmail(testInstructorEmail),
  false,
  "The instructor test account must never pass the admin email allowlist."
);

const tableData = {
  account_roles: [{ role: "admin" }, { role: "instructor" }],
  instructor_profiles: { verification_status: "approved" },
  profiles: { email: testInstructorEmail }
};

function queryFor(table: keyof typeof tableData) {
  const result = tableData[table];
  const builder = {
    select() {
      return builder;
    },
    eq() {
      return builder;
    },
    maybeSingle() {
      return Promise.resolve({ data: Array.isArray(result) ? result[0] ?? null : result, error: null });
    },
    then(resolve: (value: { data: typeof result; error: null }) => unknown) {
      return Promise.resolve(resolve({ data: result, error: null }));
    }
  };
  return builder;
}

const roleState = await getMarketplaceRoleState({
  from(table: string) {
    return queryFor(table as keyof typeof tableData);
  }
}, "test-instructor-user-id");

assert.equal(roleState.isAdmin, false);
assert.equal(roleState.isSupport, false);
assert.equal(roleState.isInstructor, true);
assert.equal(roleState.effectiveRole, "instructor");
assert.equal(roleState.isApprovedInstructor, true);

const supportTableData = {
  account_roles: [{ role: "support" }],
  instructor_profiles: null,
  profiles: { email: "info@ldrivingacademy.co.uk" }
};

function supportQueryFor(table: keyof typeof supportTableData) {
  const result = supportTableData[table];
  const builder = {
    select() {
      return builder;
    },
    eq() {
      return builder;
    },
    maybeSingle() {
      return Promise.resolve({ data: Array.isArray(result) ? result[0] ?? null : result, error: null });
    },
    then(resolve: (value: { data: typeof result; error: null }) => unknown) {
      return Promise.resolve(resolve({ data: result, error: null }));
    }
  };
  return builder;
}

const supportRoleState = await getMarketplaceRoleState({
  from(table: string) {
    return supportQueryFor(table as keyof typeof supportTableData);
  }
}, "support-user-id");

assert.equal(supportRoleState.isAdmin, false);
assert.equal(supportRoleState.isSupport, true);
assert.equal(supportRoleState.isLearner, false);
assert.equal(supportRoleState.isInstructor, false);
assert.equal(supportRoleState.effectiveRole, "support");
assert.equal(supportRoleState.isApprovedInstructor, false);

console.log("Account role boundary tests passed.");
