import { createHash, randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildLoginActivityFromHeaders } from "@/lib/login-activity";
import {
  createPrivilegedSessionCookieValue,
  privilegedSessionCookieName,
  privilegedSessionCookieOptions
} from "@/lib/privileged-session-cookie";

export const ldaAuthSessionCookieName = "lda_secure_session";

export type LdaAuthSessionRole = "learner" | "instructor" | "admin" | "support";

type CookieStore = {
  get(name: string): { value: string } | undefined;
  getAll(): Array<{ name: string; value: string }>;
  set(name: string, value: string, options?: Record<string, unknown>): void;
  delete(name: string): void;
};

type IssueSessionInput = {
  adminClient: SupabaseClient | null;
  cookieStore: CookieStore;
  headers: Headers;
  userId: string;
  role: LdaAuthSessionRole;
  rememberMe?: boolean;
};

type RequireSessionInput = {
  adminClient: SupabaseClient | null;
  cookieStore: CookieStore;
  headers: Headers;
  userId: string;
  role: LdaAuthSessionRole;
  readOnly?: boolean;
};

type AuditInput = {
  adminClient: SupabaseClient | null;
  actorUserId?: string | null;
  subjectUserId?: string | null;
  role?: LdaAuthSessionRole | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  sessionId?: string | null;
  headers?: Headers | null;
  metadata?: Record<string, unknown>;
};

export type TrustedDeviceSession = {
  id: string;
  deviceLabel: string;
  browserName: string;
  approximateLocation: string;
  ipAddress: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  isCurrent: boolean;
};

const trustedDeviceMaxAgeSeconds = 60 * 60 * 24 * 30;
const marketplaceSessionMaxAgeSeconds = 60 * 60 * 12;
const privilegedSessionMaxAgeSeconds = 60 * 60 * 8;
export const adminIdleTimeoutSeconds = 60 * 10;
export const technicalSupportIdleTimeoutSeconds = 60 * 15;

function privilegedIdleTimeoutSecondsForRole(role: LdaAuthSessionRole) {
  if (role === "admin") return adminIdleTimeoutSeconds;
  if (role === "support") return technicalSupportIdleTimeoutSeconds;
  return 0;
}

function authSessionSecret() {
  return (
    process.env.LDA_AUTH_SESSION_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.LDA_ADMIN_ENTRY_SECRET?.trim() ||
    "lda-auth-session-development-secret"
  );
}

function nowIso() {
  return new Date().toISOString();
}

function addSeconds(seconds: number) {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

function hashValue(value: string) {
  return createHash("sha256")
    .update(`${authSessionSecret()}:${value}`, "utf8")
    .digest("hex");
}

export function hashSessionToken(value: string) {
  return hashValue(`session:${value}`);
}

function hashUserAgent(headers: Headers) {
  const userAgent = headers.get("user-agent") ?? headers.get("User-Agent") ?? "";
  return userAgent ? hashValue(`ua:${userAgent}`) : null;
}

function newSessionToken() {
  return randomBytes(32).toString("base64url");
}

function isMissingAuthSessionStore(error: { code?: string; message?: string } | null | undefined) {
  return (
    error?.code === "42P01" ||
    error?.code === "42704" ||
    /auth_sessions|auth_audit_logs|lda_auth_session/i.test(error?.message ?? "")
  );
}

function sessionCookieOptions({ persistent }: { persistent: boolean }) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    ...(persistent ? { maxAge: trustedDeviceMaxAgeSeconds } : {})
  };
}

function expireSessionCookieOptions() {
  return {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production"
  };
}

export function applySupabaseAuthCookiePersistence(
  cookieStore: CookieStore,
  { persistent }: { persistent: boolean }
) {
  for (const cookie of cookieStore.getAll()) {
    if (!cookie.name.startsWith("sb-")) continue;
    cookieStore.set(cookie.name, cookie.value, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      ...(persistent ? { maxAge: trustedDeviceMaxAgeSeconds } : {})
    });
  }
}

export function clearLdaAuthSessionCookie(cookieStore: CookieStore) {
  cookieStore.set(ldaAuthSessionCookieName, "", expireSessionCookieOptions());
  cookieStore.set(privilegedSessionCookieName, "", expireSessionCookieOptions());
}

export async function recordAuthAudit({
  adminClient,
  actorUserId = null,
  subjectUserId = null,
  role = null,
  action,
  targetType = null,
  targetId = null,
  sessionId = null,
  headers = null,
  metadata = {}
}: AuditInput) {
  if (!adminClient) return { ok: false, message: "admin_client_unavailable" };

  const activity = headers ? buildLoginActivityFromHeaders(headers) : null;
  const { error } = await adminClient.from("auth_audit_logs").insert({
    actor_user_id: actorUserId,
    subject_user_id: subjectUserId,
    role,
    action,
    target_type: targetType,
    target_id: targetId,
    session_id: sessionId,
    ip_address: activity?.ipAddress ?? null,
    user_agent_hash: headers ? hashUserAgent(headers) : null,
    metadata
  });

  if (error && !isMissingAuthSessionStore(error)) {
    console.warn("[auth-sessions] audit insert failed", { action, message: error.message });
  }

  return error ? { ok: false, message: error.message } : { ok: true };
}

export async function issueLdaAuthSession({
  adminClient,
  cookieStore,
  headers,
  userId,
  role,
  rememberMe = false
}: IssueSessionInput) {
  if (!adminClient) {
    return { ok: false, message: "SUPABASE_SERVICE_ROLE_KEY is required for enterprise sessions." };
  }

  const marketplaceRole = role === "learner" || role === "instructor";
  const persistent = marketplaceRole && rememberMe;
  const trustedDevice = persistent;
  const maxAgeSeconds = persistent
    ? trustedDeviceMaxAgeSeconds
    : marketplaceRole
      ? marketplaceSessionMaxAgeSeconds
      : privilegedSessionMaxAgeSeconds;
  const token = newSessionToken();
  const activity = buildLoginActivityFromHeaders(headers);

  const { data, error } = await adminClient
    .from("auth_sessions")
    .insert({
      user_id: userId,
      role,
      session_token_hash: hashSessionToken(token),
      trusted_device: trustedDevice,
      persistent,
      device_label: activity.deviceLabel,
      browser_name: activity.browserName,
      ip_address: activity.ipAddress,
      country_code: activity.countryCode,
      approximate_location: activity.approximateLocation,
      user_agent_hash: hashUserAgent(headers),
      expires_at: addSeconds(maxAgeSeconds)
    })
    .select("id")
    .single();

  if (error) {
    console.warn("[auth-sessions] session issue failed", {
      userId,
      role,
      message: error.message
    });
    return { ok: false, message: error.message };
  }

  cookieStore.set(ldaAuthSessionCookieName, token, sessionCookieOptions({ persistent }));
  if (role === "admin" || role === "support") {
    const privilegedSessionValue = createPrivilegedSessionCookieValue(role);
    if (privilegedSessionValue) {
      cookieStore.set(privilegedSessionCookieName, privilegedSessionValue, privilegedSessionCookieOptions());
    }
  }
  applySupabaseAuthCookiePersistence(cookieStore, { persistent });

  await recordAuthAudit({
    adminClient,
    actorUserId: userId,
    subjectUserId: userId,
    role,
    action: "auth.session.created",
    targetType: "auth_session",
    targetId: String(data.id),
    sessionId: String(data.id),
    headers,
    metadata: {
      trustedDevice,
      persistent
    }
  });

  return { ok: true, sessionId: String(data.id), persistent };
}

export async function requireActiveLdaAuthSession({
  adminClient,
  cookieStore,
  headers,
  userId,
  role,
  readOnly = false
}: RequireSessionInput) {
  if (!adminClient) {
    return { ok: false, reason: "admin_client_unavailable" as const };
  }

  const rawToken = cookieStore.get(ldaAuthSessionCookieName)?.value;
  if (!rawToken) {
    return { ok: false, reason: "missing_session" as const };
  }

  const tokenHash = hashSessionToken(rawToken);
  const { data: session, error } = await adminClient
    .from("auth_sessions")
    .select("id,role,persistent,trusted_device,last_seen_at,expires_at,status,revoked_at")
    .eq("session_token_hash", tokenHash)
    .eq("user_id", userId)
    .eq("role", role)
    .maybeSingle();

  if (error) {
    console.warn("[auth-sessions] session lookup failed", {
      userId,
      role,
      message: error.message
    });
    return { ok: false, reason: isMissingAuthSessionStore(error) ? "store_missing" as const : "lookup_failed" as const };
  }

  if (!session || session.status !== "active" || session.revoked_at) {
    if (!readOnly) {
      clearLdaAuthSessionCookie(cookieStore);
    }
    return { ok: false, reason: "inactive_session" as const };
  }

  const expiresAt = new Date(String(session.expires_at)).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    if (!readOnly) {
      await adminClient
        .from("auth_sessions")
        .update({ status: "expired", revoked_at: nowIso(), revoke_reason: "expired" })
        .eq("id", session.id);
      clearLdaAuthSessionCookie(cookieStore);
    }
    return { ok: false, reason: "expired_session" as const };
  }

  if (role === "admin" || role === "support") {
    const privilegedIdleTimeoutSeconds = privilegedIdleTimeoutSecondsForRole(role);
    const lastSeenAt = new Date(String(session.last_seen_at)).getTime();
    if (Number.isFinite(lastSeenAt) && Date.now() - lastSeenAt > privilegedIdleTimeoutSeconds * 1000) {
      if (!readOnly) {
        await adminClient
          .from("auth_sessions")
          .update({ status: "revoked", revoked_at: nowIso(), revoke_reason: "privileged_idle_timeout" })
          .eq("id", session.id);
        clearLdaAuthSessionCookie(cookieStore);
      }
      return { ok: false, reason: "idle_timeout" as const };
    }
  }

  if (readOnly) {
    return { ok: true, sessionId: String(session.id), persistent: Boolean(session.persistent) };
  }

  const nextToken = newSessionToken();
  const persistent = Boolean(session.persistent) && (role === "learner" || role === "instructor");
  const nextExpiresAt = persistent ? addSeconds(trustedDeviceMaxAgeSeconds) : String(session.expires_at);

  const { error: rotateError } = await adminClient
    .from("auth_sessions")
    .update({
      session_token_hash: hashSessionToken(nextToken),
      last_seen_at: nowIso(),
      expires_at: nextExpiresAt
    })
    .eq("id", session.id);

  if (rotateError) {
    console.warn("[auth-sessions] session rotation failed", {
      userId,
      role,
      sessionId: session.id,
      message: rotateError.message
    });
    return { ok: false, reason: "rotation_failed" as const };
  }

  cookieStore.set(ldaAuthSessionCookieName, nextToken, sessionCookieOptions({ persistent }));
  applySupabaseAuthCookiePersistence(cookieStore, { persistent });

  return { ok: true, sessionId: String(session.id), persistent };
}

export async function revokeCurrentLdaAuthSession({
  adminClient,
  cookieStore,
  headers,
  userId,
  reason = "signed_out"
}: {
  adminClient: SupabaseClient | null;
  cookieStore: CookieStore;
  headers?: Headers | null;
  userId?: string | null;
  reason?: string;
}) {
  if (!adminClient) {
    clearLdaAuthSessionCookie(cookieStore);
    return { ok: false, message: "admin_client_unavailable" };
  }

  const rawToken = cookieStore.get(ldaAuthSessionCookieName)?.value;
  if (!rawToken) {
    clearLdaAuthSessionCookie(cookieStore);
    return { ok: true };
  }

  let query = adminClient
    .from("auth_sessions")
    .update({ status: "revoked", revoked_at: nowIso(), revoke_reason: reason })
    .eq("session_token_hash", hashSessionToken(rawToken))
    .eq("status", "active");

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { error } = await query;
  clearLdaAuthSessionCookie(cookieStore);

  if (userId) {
    await recordAuthAudit({
      adminClient,
      actorUserId: userId,
      subjectUserId: userId,
      action: "auth.session.revoked",
      headers: headers ?? null,
      metadata: { reason, currentSession: true }
    });
  }

  return error ? { ok: false, message: error.message } : { ok: true };
}

export async function revokeUserAuthSessions({
  adminClient,
  userId,
  actorUserId = userId,
  exceptCurrentToken,
  reason,
  headers
}: {
  adminClient: SupabaseClient | null;
  userId: string;
  actorUserId?: string | null;
  exceptCurrentToken?: string | null;
  reason: string;
  headers?: Headers | null;
}) {
  if (!adminClient) return { ok: false, message: "admin_client_unavailable" };

  let query = adminClient
    .from("auth_sessions")
    .update({
      status: "revoked",
      revoked_at: nowIso(),
      revoke_reason: reason,
      revoked_by: actorUserId
    })
    .eq("user_id", userId)
    .eq("status", "active");

  if (exceptCurrentToken) {
    query = query.neq("session_token_hash", hashSessionToken(exceptCurrentToken));
  }

  const { error } = await query;
  await recordAuthAudit({
    adminClient,
    actorUserId,
    subjectUserId: userId,
    action: "auth.sessions.revoked",
    headers: headers ?? null,
    metadata: { reason, exceptCurrent: Boolean(exceptCurrentToken) }
  });

  return error ? { ok: false, message: error.message } : { ok: true };
}

export async function getTrustedDeviceSessions({
  adminClient,
  cookieStore,
  userId
}: {
  adminClient: SupabaseClient | null;
  cookieStore: CookieStore;
  userId: string;
}): Promise<TrustedDeviceSession[]> {
  if (!adminClient) return [];

  const currentHash = cookieStore.get(ldaAuthSessionCookieName)?.value
    ? hashSessionToken(cookieStore.get(ldaAuthSessionCookieName)?.value ?? "")
    : "";
  const now = nowIso();

  const { error: expireError } = await adminClient
    .from("auth_sessions")
    .update({ status: "expired", revoked_at: now, revoke_reason: "expired" })
    .eq("user_id", userId)
    .in("role", ["learner", "instructor"])
    .eq("trusted_device", true)
    .eq("status", "active")
    .is("revoked_at", null)
    .lte("expires_at", now);

  if (expireError && !isMissingAuthSessionStore(expireError)) {
    console.warn("[auth-sessions] trusted devices expiry cleanup failed", {
      userId,
      message: expireError.message
    });
  }

  const { data, error } = await adminClient
    .from("auth_sessions")
    .select("id,session_token_hash,device_label,browser_name,approximate_location,ip_address,created_at,last_seen_at,expires_at")
    .eq("user_id", userId)
    .in("role", ["learner", "instructor"])
    .eq("trusted_device", true)
    .eq("status", "active")
    .is("revoked_at", null)
    .gt("expires_at", now)
    .order("last_seen_at", { ascending: false })
    .limit(50);

  if (error) {
    console.warn("[auth-sessions] trusted devices load failed", {
      userId,
      message: error.message
    });
    return [];
  }

  return (data ?? []).map((session) => ({
    id: String(session.id),
    deviceLabel: String(session.device_label ?? "Trusted device"),
    browserName: String(session.browser_name ?? "Browser"),
    approximateLocation: String(session.approximate_location ?? "Approximate location unavailable"),
    ipAddress: String(session.ip_address ?? ""),
    createdAt: String(session.created_at ?? ""),
    lastSeenAt: String(session.last_seen_at ?? ""),
    expiresAt: String(session.expires_at ?? ""),
    isCurrent: String(session.session_token_hash ?? "") === currentHash
  }));
}

export async function syncCurrentRememberedDeviceSession({
  adminClient,
  cookieStore,
  headers,
  userId,
  writeCookies = true
}: {
  adminClient: SupabaseClient | null;
  cookieStore: CookieStore;
  headers: Headers;
  userId: string;
  writeCookies?: boolean;
}) {
  if (!adminClient) return { ok: false, message: "admin_client_unavailable" };

  const rawToken = cookieStore.get(ldaAuthSessionCookieName)?.value;
  const rememberedIdentifier = cookieStore.get("lda_remember_identifier")?.value;
  const rememberedDeviceId = cookieStore.get("lda_remembered_device_id")?.value;
  const rememberedDeviceName = cookieStore.get("lda_remembered_device_name")?.value;
  if (!rawToken || (!rememberedIdentifier && !rememberedDeviceId)) {
    return { ok: true, synced: false };
  }

  const tokenHash = hashSessionToken(rawToken);
  const { data: session, error: lookupError } = await adminClient
    .from("auth_sessions")
    .select("id,role,status,revoked_at,trusted_device,persistent")
    .eq("session_token_hash", tokenHash)
    .eq("user_id", userId)
    .in("role", ["learner", "instructor"])
    .maybeSingle();

  if (lookupError) {
    console.warn("[auth-sessions] remembered device sync lookup failed", {
      userId,
      message: lookupError.message
    });
    return { ok: false, message: lookupError.message };
  }

  if (!session || session.status !== "active" || session.revoked_at) {
    return { ok: true, synced: false };
  }

  const activity = buildLoginActivityFromHeaders(headers);
  const { error: updateError } = await adminClient
    .from("auth_sessions")
    .update({
      trusted_device: true,
      persistent: true,
      device_label: rememberedDeviceName || activity.deviceLabel,
      browser_name: activity.browserName,
      ip_address: activity.ipAddress,
      country_code: activity.countryCode,
      approximate_location: activity.approximateLocation,
      user_agent_hash: hashUserAgent(headers),
      last_seen_at: nowIso(),
      expires_at: addSeconds(trustedDeviceMaxAgeSeconds)
    })
    .eq("id", session.id)
    .eq("user_id", userId)
    .in("role", ["learner", "instructor"]);

  if (updateError) {
    console.warn("[auth-sessions] remembered device sync failed", {
      userId,
      sessionId: session.id,
      message: updateError.message
    });
    return { ok: false, message: updateError.message };
  }

  if (writeCookies) {
    cookieStore.set(ldaAuthSessionCookieName, rawToken, sessionCookieOptions({ persistent: true }));
    applySupabaseAuthCookiePersistence(cookieStore, { persistent: true });
  }

  await recordAuthAudit({
    adminClient,
    actorUserId: userId,
    subjectUserId: userId,
    role: session.role as LdaAuthSessionRole,
    action: "auth.trusted_device.synced",
    targetType: "auth_session",
    targetId: String(session.id),
    sessionId: String(session.id),
    headers,
    metadata: {
      rememberedDeviceId: rememberedDeviceId ?? null,
      alreadyTrusted: Boolean(session.trusted_device),
      alreadyPersistent: Boolean(session.persistent)
    }
  });

  return { ok: true, synced: true };
}

export async function revokeTrustedDeviceSession({
  adminClient,
  userId,
  actorUserId,
  sessionId,
  headers
}: {
  adminClient: SupabaseClient | null;
  userId: string;
  actorUserId: string;
  sessionId: string;
  headers?: Headers | null;
}) {
  if (!adminClient) return { ok: false, message: "admin_client_unavailable" };

  const { error } = await adminClient
    .from("auth_sessions")
    .update({
      status: "revoked",
      revoked_at: nowIso(),
      revoked_by: actorUserId,
      revoke_reason: "trusted_device_revoked"
    })
    .eq("id", sessionId)
    .eq("user_id", userId)
    .in("role", ["learner", "instructor"])
    .eq("trusted_device", true);

  await recordAuthAudit({
    adminClient,
    actorUserId,
    subjectUserId: userId,
    action: "auth.trusted_device.revoked",
    targetType: "auth_session",
    targetId: sessionId,
    headers: headers ?? null
  });

  return error ? { ok: false, message: error.message } : { ok: true };
}
