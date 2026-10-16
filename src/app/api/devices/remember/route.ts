import { cookies } from "next/headers";
import { isRateLimited, jsonNoStore, rateLimitResponse, readJsonBody, safeText } from "@/lib/security";

const REMEMBER_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function normaliseIdentifier(value: unknown) {
  if (typeof value !== "string") return "";

  const trimmed = value.trim();
  if (!trimmed) return "";

  if (trimmed.includes("@")) {
    return trimmed.toLowerCase();
  }

  return trimmed.replace(/\s+/g, "");
}

export async function POST(request: Request) {
  if (isRateLimited(request, "remember-device", 20)) {
    return rateLimitResponse();
  }

  try {
    const body = await readJsonBody<{ identifier?: unknown; deviceName?: unknown }>(request);
    if (!body) {
      return jsonNoStore({ ok: false, error: "invalid_request" }, { status: 400 });
    }

    const identifier = normaliseIdentifier(body.identifier);

    if (!identifier) {
      return jsonNoStore({ ok: false, error: "identifier_required" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const existingDeviceId = cookieStore.get("lda_remembered_device_id")?.value;
    const deviceId = existingDeviceId || crypto.randomUUID();
    const secure = process.env.NODE_ENV === "production";

    // Never store passwords here. Supabase and the browser password manager handle secrets.
    cookieStore.set("lda_remember_identifier", identifier, {
      httpOnly: true,
      maxAge: REMEMBER_MAX_AGE_SECONDS,
      path: "/",
      sameSite: "lax",
      secure
    });
    cookieStore.set("lda_remembered_device_id", deviceId, {
      httpOnly: true,
      maxAge: REMEMBER_MAX_AGE_SECONDS,
      path: "/",
      sameSite: "lax",
      secure
    });
    cookieStore.set("lda_remembered_device_name", safeText(body.deviceName, "Remembered device", 160), {
      httpOnly: true,
      maxAge: REMEMBER_MAX_AGE_SECONDS,
      path: "/",
      sameSite: "lax",
      secure
    });

    return jsonNoStore({ ok: true });
  } catch {
    return jsonNoStore({ ok: false, error: "invalid_request" }, { status: 400 });
  }
}
