import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";
import {
  checkPrivilegedLoginLockout,
  handlePrivilegedLoginFailure,
  hashPrivilegedLoginIdentifier,
  privilegedFailedLoginMessage,
  privilegedLoginFailureThreshold,
  type PrivilegedLoginAuditEvent,
  type PrivilegedLoginAuditStore,
  type PrivilegedLoginRole
} from "../src/lib/privileged-login-monitor";

type StoredEvent = PrivilegedLoginAuditEvent & { createdAt: string };

class MemoryAuditStore implements PrivilegedLoginAuditStore {
  now = new Date("2026-09-06T12:00:00.000Z");
  records: StoredEvent[] = [];

  async countFailures(targetId: string, sinceIso: string) {
    const since = new Date(sinceIso).getTime();
    return this.records.filter(
      (record) =>
        record.action === "auth.privileged_login.failed" &&
        record.targetId === targetId &&
        new Date(record.createdAt).getTime() >= since
    ).length;
  }

  async latestEvent(action: string, targetId: string, sinceIso: string) {
    const since = new Date(sinceIso).getTime();
    const match = this.records
      .filter(
        (record) =>
          record.action === action &&
          record.targetId === targetId &&
          new Date(record.createdAt).getTime() >= since
      )
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0];

    return match?.createdAt ?? null;
  }

  async record(event: PrivilegedLoginAuditEvent) {
    this.records.push({ ...event, createdAt: this.now.toISOString() });
  }
}

function headers() {
  return new Headers({
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0.0.0",
    "x-forwarded-for": "203.0.113.19"
  });
}

async function runFailure(
  store: MemoryAuditStore,
  role: PrivilegedLoginRole,
  identifier: string,
  alerts: unknown[],
  attempt: number
) {
  store.now = new Date(`2026-09-06T12:0${attempt}:00.000Z`);
  return handlePrivilegedLoginFailure({
    store,
    role,
    identifier,
    route: role === "admin" ? "/admin-access" : "/technical-support-access",
    headers: headers(),
    reason: "invalid_password",
    now: store.now,
    sendAlert: async (input) => {
      alerts.push(input);
      return { id: "email-test" };
    }
  });
}

async function assertFourthFailureAlertsAndLocks(role: PrivilegedLoginRole, identifier: string) {
  const store = new MemoryAuditStore();
  const alerts: unknown[] = [];

  for (let attempt = 1; attempt < privilegedLoginFailureThreshold; attempt += 1) {
    const result = await runFailure(store, role, identifier, alerts, attempt);
    assert.equal(result.locked, false, `${role} should not lock before the threshold`);
  }

  assert.equal(alerts.length, 0, `${role} should not send the priority alert for attempts 1-3`);

  const result = await runFailure(store, role, identifier, alerts, privilegedLoginFailureThreshold);
  assert.equal(result.locked, true, `${role} should lock on the threshold attempt`);
  assert.equal(alerts.length, 1, `${role} should send one priority alert on the threshold attempt`);

  const alertPayload = JSON.stringify(alerts[0]);
  assert.doesNotMatch(alertPayload, /correct-horse-battery-staple/i, `${role} alert must never contain a password`);
  assert.match(alertPayload, new RegExp(identifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));

  const targetId = hashPrivilegedLoginIdentifier(role, identifier);
  assert.ok(
    store.records.some((record) => record.action === "auth.privileged_login.failed" && record.targetId === targetId),
    `${role} failed login audit record missing`
  );
  assert.ok(
    store.records.some((record) => record.action === "auth.privileged_login.threshold_reached" && record.targetId === targetId),
    `${role} threshold audit record missing`
  );
  assert.ok(
    store.records.some((record) => record.action === "auth.privileged_login.lockout_started" && record.targetId === targetId),
    `${role} lockout audit record missing`
  );
  assert.ok(
    store.records.some((record) => record.action === "auth.privileged_login.priority_alert_sent" && record.targetId === targetId),
    `${role} priority alert audit record missing`
  );

  const lockout = await checkPrivilegedLoginLockout({
    store,
    role,
    identifier,
    route: role === "admin" ? "/admin-access" : "/technical-support-access",
    headers: headers(),
    now: new Date("2026-09-06T12:05:00.000Z")
  });
  assert.ok(lockout?.secondsRemaining && lockout.secondsRemaining > 0, `${role} lockout should be active`);

  await runFailure(store, role, identifier, alerts, 5);
  assert.equal(alerts.length, 1, `${role} alert should be rate-limited after the first alert`);
}

await assertFourthFailureAlertsAndLocks("admin", "info@ldrivingacademy.co.uk");
await assertFourthFailureAlertsAndLocks("support", "support@ldrivingacademy.co.uk");

const authActionSource = await readFile(new URL("../src/app/auth/actions.ts", import.meta.url), "utf8");
const supportRouteSource = await readFile(new URL("../src/app/api/auth/technical-support-sign-in/route.ts", import.meta.url), "utf8");

assert.ok(authActionSource.includes("privilegedFailedLoginMessage"));
assert.ok(supportRouteSource.includes("privilegedFailedLoginMessage"));
assert.equal(privilegedFailedLoginMessage, "We could not sign you in. Check your details and try again.");
assert.doesNotMatch(authActionSource, /Admin login failed|Technical support login failed|not authorised for LDA admin access|not authorised for LDA technical support/);
assert.doesNotMatch(supportRouteSource, /Technical support login failed|not authorised for LDA technical support|Enter your authorised technical support email address/);

console.log("Privileged login alert monitoring tests passed.");
