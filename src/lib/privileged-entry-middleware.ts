const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

type PrivilegedEntryRole = "admin" | "support";
type PrivilegedSessionRole = "admin" | "support";

function base64UrlToBytes(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;

  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return mismatch === 0;
}

async function signPayload(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(value));
  return bytesToBase64Url(new Uint8Array(signature));
}

function entrySecretForRole(role: PrivilegedEntryRole) {
  if (role === "support") {
    return process.env.LDA_TECHNICAL_SUPPORT_ENTRY_SECRET?.trim() || process.env.LDA_ADMIN_ENTRY_SECRET?.trim() || null;
  }

  return process.env.LDA_ADMIN_ENTRY_SECRET?.trim() || null;
}

function signingInputForRole(role: PrivilegedEntryRole, encodedPayload: string) {
  return role === "support" ? `technical-support:${encodedPayload}` : encodedPayload;
}

function privilegedSessionSecret() {
  return (
    process.env.LDA_PRIVILEGED_SESSION_SECRET?.trim() ||
    process.env.LDA_AUTH_SESSION_SECRET?.trim() ||
    process.env.LDA_ADMIN_ENTRY_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    null
  );
}

export async function hasValidPrivilegedEntryForMiddleware({
  role,
  value,
  maxAgeSeconds
}: {
  role: PrivilegedEntryRole;
  value?: string;
  maxAgeSeconds: number;
}) {
  const secret = entrySecretForRole(role);
  if (!secret || !value) return false;

  const [encodedPayload, signature] = value.split(".");
  if (!encodedPayload || !signature) return false;

  const expectedSignature = await signPayload(signingInputForRole(role, encodedPayload), secret);
  if (!safeEqual(signature, expectedSignature)) return false;

  try {
    const payload = JSON.parse(textDecoder.decode(base64UrlToBytes(encodedPayload))) as { issuedAt?: unknown };
    const issuedAt = typeof payload.issuedAt === "number" ? payload.issuedAt : 0;
    const now = Math.floor(Date.now() / 1000);

    return issuedAt > 0 && issuedAt <= now && now - issuedAt <= maxAgeSeconds;
  } catch {
    return false;
  }
}

export async function getValidPrivilegedSessionRoleForMiddleware(value?: string) {
  const secret = privilegedSessionSecret();
  if (!secret || !value) return null;

  const [encodedPayload, signature] = value.split(".");
  if (!encodedPayload || !signature) return null;

  const expectedSignature = await signPayload(`privileged-session:${encodedPayload}`, secret);
  if (!safeEqual(signature, expectedSignature)) return null;

  try {
    const payload = JSON.parse(textDecoder.decode(base64UrlToBytes(encodedPayload))) as {
      role?: unknown;
      issuedAt?: unknown;
    };
    const role: PrivilegedSessionRole | null =
      payload.role === "admin" || payload.role === "support" ? payload.role : null;
    const issuedAt = typeof payload.issuedAt === "number" ? payload.issuedAt : 0;
    const now = Math.floor(Date.now() / 1000);

    if (!role || issuedAt <= 0 || issuedAt > now || now - issuedAt > 60 * 60 * 8) {
      return null;
    }

    return role;
  } catch {
    return null;
  }
}
