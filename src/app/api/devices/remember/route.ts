import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const REMEMBER_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

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
  try {
    const body = (await request.json()) as { identifier?: unknown; deviceName?: unknown };
    const identifier = normaliseIdentifier(body.identifier);

    if (!identifier) {
      return NextResponse.json({ ok: false, error: "identifier_required" }, { status: 400 });
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
    cookieStore.set("lda_remembered_device_name", typeof body.deviceName === "string" ? body.deviceName.slice(0, 160) : "Remembered device", {
      httpOnly: true,
      maxAge: REMEMBER_MAX_AGE_SECONDS,
      path: "/",
      sameSite: "lax",
      secure
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }
}
