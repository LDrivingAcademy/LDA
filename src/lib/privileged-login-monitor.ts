import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordAuthAudit, type LdaAuthSessionRole } from "@/lib/auth-sessions";
import { sendPrivilegedLoginPriorityAlertEmail } from "@/lib/email";
import { buildLoginActivityFromHeaders } from "@/lib/login-activity";

export type PrivilegedLoginRole = "admin" | "support";

export const privilegedFailedLoginMessage = "We could not sign you in. Check your details and try again.";
export const privilegedLoginFailureWindowMinutes = 15;
export const privilegedLoginFailureThreshold = 4;
export const privilegedLoginLockoutMinutes = 30;
export const privilegedLoginAlertThrottleMinutes = 60;

const targetType = "privileged_login_identifier";
const failedAction = "auth.privileged_login.failed";
const thresholdAction = "auth.privileged_login.threshold_reached";
const lockoutAction = "auth.privileged_login.lockout_started";
const lockoutBlockedAction = "auth.privileged_login.lockout_blocked";
const alertSentAction = "auth.privileged_login.priority_alert_sent";
const alertFailedAction = "auth.privileged_login.priority_alert_failed";

type AuditMetadata = Record<string, unknown>;

export type PrivilegedLoginAuditEvent = {
  role: PrivilegedLoginRole;
  action: string;
  targetId: string;
  headers: Headers;
  metadata?: AuditMetadata;
};

export type PrivilegedLoginAuditStore = {
  countFailures(targetId: string, sinceIso: string): Promise<number>;
  latestEvent(action: string, targetId: string, sinceIso: string): Promise<string | null>;
  record(event: PrivilegedLoginAuditEvent): Promise<void>;
};

export type PrivilegedLoginFailureInput = {
  store: PrivilegedLoginAuditStore;
  role: PrivilegedLoginRole;
  identifier: string;
  route: string;
  headers: Headers;
  reason: string;
  now?: Date;
  sendAlert?: (input: {
    role: PrivilegedLoginRole;
    attemptedIdentifier: string;
    ipAddress?: string | null;
    deviceSummary: string;
    route: string;
    failuresInWindow: number;
    windowMinutes: number;
    lockoutMinutes: number;
    occurredAt: string;
    idempotencyKey: string;
  }) => Promise<unknown>;
};

export type PrivilegedLoginMonitorInput = Omit<PrivilegedLoginFailureInput, "store" | "sendAlert"> & {
  adminClient: SupabaseClient | null;
};

function monitoringSecret() {
  return (
    process.env.LDA_AUTH_SESSION_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.LDA_ADMIN_ENTRY_SECRET?.trim() ||
    "lda-privileged-login-monitor-development-secret"
  );
}

function dateMinusMinutes(now: Date, minutes: number) {
  return new Date(now.getTime() - minutes * 60 * 1000).toISOString();
}

function addMinutes(dateIso: string, minutes: number) {
  const timestamp = new Date(dateIso).getTime();
  if (Number.isNaN(timestamp)) return null;
  return new Date(timestamp + minutes * 60 * 1000);
}

function normaliseIdentifier(value: string) {
  return String(value ?? "").trim().toLowerCase().slice(0, 254);
}

export function maskPrivilegedIdentifier(value: string) {
  const identifier = normaliseIdentifier(value);
  if (!identifier) return "not-provided";

  if (identifier.includes("@")) {
    const [local = "", domain = ""] = identifier.split("@");
    return `${local.slice(0, 2)}***@${domain}`;
  }

  return `${identifier.slice(0, 3)}***${identifier.slice(-2)}`;
}

export function hashPrivilegedLoginIdentifier(role: PrivilegedLoginRole, identifier: string) {
  const normalised = normaliseIdentifier(identifier) || "not-provided";
  return createHash("sha256")
    .update(`${monitoringSecret()}:privileged-login:${role}:${normalised}`, "utf8")
    .digest("hex");
}

function safeRoute(value: string) {
  const route = String(value || "").trim();
  if (!route || !route.startsWith("/") || route.startsWith("//")) return "/privileged-sign-in";
  return route.slice(0, 180);
}

function safeReason(value: string) {
  return String(value || "unknown_failure").replace(/[^a-z0-9_.:-]/gi, "_").slice(0, 80);
}

function getDeviceSummary(headers: Headers) {
  const activity = buildLoginActivityFromHeaders(headers);
  return [activity.deviceLabel, activity.browserName].filter(Boolean).join(" / ") || "Unknown device";
}

function getIpAddress(headers: Headers) {
  return buildLoginActivityFromHeaders(headers).ipAddress;
}

function baseMetadata(input: {
  role: PrivilegedLoginRole;
  identifier: string;
  route: string;
  headers: Headers;
  reason?: string;
  failuresInWindow?: number;
  lockedUntil?: string;
}) {
  const activity = buildLoginActivityFromHeaders(input.headers);
  return {
    role: input.role,
    attemptedIdentifier: normaliseIdentifier(input.identifier) || "not-provided",
    identifierMasked: maskPrivilegedIdentifier(input.identifier),
    route: safeRoute(input.route),
    reason: input.reason ? safeReason(input.reason) : undefined,
    deviceSummary: getDeviceSummary(input.headers),
    ipAddress: activity.ipAddress,
    approximateLocation: activity.approximateLocation,
    countryCode: activity.countryCode,
    failuresInWindow: input.failuresInWindow,
    windowMinutes: privilegedLoginFailureWindowMinutes,
    lockoutMinutes: privilegedLoginLockoutMinutes,
    lockedUntil: input.lockedUntil
  };
}

function isMissingAuditStore(error: { code?: string; message?: string } | null | undefined) {
  return (
    error?.code === "42P01" ||
    error?.code === "42704" ||
    /auth_audit_logs/i.test(error?.message ?? "")
  );
}

export function createSupabasePrivilegedLoginAuditStore(adminClient: SupabaseClient): PrivilegedLoginAuditStore {
  return {
    async countFailures(targetId, sinceIso) {
      const { count, error } = await adminClient
        .from("auth_audit_logs")
        .select("id", { count: "exact", head: true })
        .eq("action", failedAction)
        .eq("target_type", targetType)
        .eq("target_id", targetId)
        .gte("created_at", sinceIso);

      if (error) {
        if (!isMissingAuditStore(error)) {
          console.warn("[privileged-login-monitor] failure count query failed", { message: error.message });
        }
        return 0;
      }

      return count ?? 0;
    },
    async latestEvent(action, targetId, sinceIso) {
      const { data, error } = await adminClient
        .from("auth_audit_logs")
        .select("created_at")
        .eq("action", action)
        .eq("target_type", targetType)
        .eq("target_id", targetId)
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        if (!isMissingAuditStore(error)) {
          console.warn("[privileged-login-monitor] latest event query failed", { action, message: error.message });
        }
        return null;
      }

      return typeof data?.created_at === "string" ? data.created_at : null;
    },
    async record(event) {
      await recordAuthAudit({
        adminClient,
        role: event.role as LdaAuthSessionRole,
        action: event.action,
        targetType,
        targetId: event.targetId,
        headers: event.headers,
        metadata: event.metadata ?? {}
      });
    }
  };
}

export async function checkPrivilegedLoginLockout({
  store,
  role,
  identifier,
  route,
  headers,
  now = new Date()
}: {
  store: PrivilegedLoginAuditStore;
  role: PrivilegedLoginRole;
  identifier: string;
  route: string;
  headers: Headers;
  now?: Date;
}) {
  const targetId = hashPrivilegedLoginIdentifier(role, identifier);
  const sinceIso = dateMinusMinutes(now, privilegedLoginLockoutMinutes);
  const lockoutStartedAt = await store.latestEvent(lockoutAction, targetId, sinceIso);
  if (!lockoutStartedAt) return null;

  const lockedUntil = addMinutes(lockoutStartedAt, privilegedLoginLockoutMinutes);
  if (!lockedUntil || lockedUntil.getTime() <= now.getTime()) return null;

  const secondsRemaining = Math.max(1, Math.ceil((lockedUntil.getTime() - now.getTime()) / 1000));
  await store.record({
    role,
    action: lockoutBlockedAction,
    targetId,
    headers,
    metadata: baseMetadata({
      role,
      identifier,
      route,
      headers,
      reason: "temporary_lockout_active",
      lockedUntil: lockedUntil.toISOString()
    })
  });

  return {
    lockedUntil: lockedUntil.toISOString(),
    secondsRemaining
  };
}

export async function handlePrivilegedLoginFailure({
  store,
  role,
  identifier,
  route,
  headers,
  reason,
  now = new Date(),
  sendAlert = sendPrivilegedLoginPriorityAlertEmail
}: PrivilegedLoginFailureInput) {
  const targetId = hashPrivilegedLoginIdentifier(role, identifier);
  const routeLabel = safeRoute(route);
  const failureMetadata = baseMetadata({ role, identifier, route: routeLabel, headers, reason });

  await store.record({
    role,
    action: failedAction,
    targetId,
    headers,
    metadata: failureMetadata
  });

  const failuresInWindow = await store.countFailures(
    targetId,
    dateMinusMinutes(now, privilegedLoginFailureWindowMinutes)
  );
  const locked = failuresInWindow >= privilegedLoginFailureThreshold;

  if (!locked) {
    return { failuresInWindow, locked: false };
  }

  const existingLockout = await store.latestEvent(lockoutAction, targetId, dateMinusMinutes(now, privilegedLoginLockoutMinutes));
  const lockedUntil = new Date(now.getTime() + privilegedLoginLockoutMinutes * 60 * 1000).toISOString();

  if (!existingLockout) {
    const metadata = baseMetadata({
      role,
      identifier,
      route: routeLabel,
      headers,
      reason: "threshold_reached",
      failuresInWindow,
      lockedUntil
    });

    await store.record({ role, action: thresholdAction, targetId, headers, metadata });
    await store.record({ role, action: lockoutAction, targetId, headers, metadata });
  }

  const recentAlert = await store.latestEvent(alertSentAction, targetId, dateMinusMinutes(now, privilegedLoginAlertThrottleMinutes));
  if (recentAlert) {
    return { failuresInWindow, locked: true };
  }

  try {
    await sendAlert({
      role,
      attemptedIdentifier: normaliseIdentifier(identifier) || "not-provided",
      ipAddress: getIpAddress(headers),
      deviceSummary: getDeviceSummary(headers),
      route: routeLabel,
      failuresInWindow,
      windowMinutes: privilegedLoginFailureWindowMinutes,
      lockoutMinutes: privilegedLoginLockoutMinutes,
      occurredAt: now.toISOString(),
      idempotencyKey: `privileged-login-alert-${targetId}-${Math.floor(now.getTime() / (privilegedLoginAlertThrottleMinutes * 60 * 1000))}`
    });

    await store.record({
      role,
      action: alertSentAction,
      targetId,
      headers,
      metadata: baseMetadata({
        role,
        identifier,
        route: routeLabel,
        headers,
        reason: "priority_alert_sent",
        failuresInWindow,
        lockedUntil
      })
    });
  } catch (error) {
    await store.record({
      role,
      action: alertFailedAction,
      targetId,
      headers,
      metadata: {
        ...baseMetadata({
          role,
          identifier,
          route: routeLabel,
          headers,
          reason: "priority_alert_failed",
          failuresInWindow,
          lockedUntil
        }),
        errorMessage: error instanceof Error ? error.message.slice(0, 180) : "Unknown email error"
      }
    });
  }

  return { failuresInWindow, locked: true };
}

export async function getPrivilegedLoginLockout(input: Omit<PrivilegedLoginMonitorInput, "reason">) {
  if (!input.adminClient) return null;
  return checkPrivilegedLoginLockout({
    store: createSupabasePrivilegedLoginAuditStore(input.adminClient),
    role: input.role,
    identifier: input.identifier,
    route: input.route,
    headers: input.headers,
    now: input.now
  });
}

export async function recordPrivilegedLoginFailure(input: PrivilegedLoginMonitorInput) {
  if (!input.adminClient) return { failuresInWindow: 0, locked: false };
  return handlePrivilegedLoginFailure({
    store: createSupabasePrivilegedLoginAuditStore(input.adminClient),
    role: input.role,
    identifier: input.identifier,
    route: input.route,
    headers: input.headers,
    reason: input.reason,
    now: input.now
  });
}
