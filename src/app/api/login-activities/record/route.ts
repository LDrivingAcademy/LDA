import { cookies, headers } from "next/headers";
import { isRateLimited, jsonNoStore, rateLimitResponse, readJsonBody, safeText } from "@/lib/security";
import { clientLoginActivityPendingCookieName, recordLoginActivityDetails } from "@/lib/login-activity";
import { createClient } from "@/lib/supabase/server";

type ClientLoginActivityRequest = {
  deviceLabel?: unknown;
  browserName?: unknown;
  approximateLocation?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  accuracy?: unknown;
};

function safeNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export async function POST(request: Request) {
  if (isRateLimited(request, "client-login-activity", 15)) {
    return rateLimitResponse();
  }

  const body = await readJsonBody<ClientLoginActivityRequest>(request);
  if (!body) {
    return jsonNoStore({ ok: false, error: "invalid_request" }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) {
    return jsonNoStore({ ok: false, error: "supabase_not_configured" }, { status: 503 });
  }

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return jsonNoStore({ ok: false, error: "not_authenticated" }, { status: 401 });
  }

  const { data: roles } = await supabase
    .from("account_roles")
    .select("role")
    .eq("user_id", user.id)
    .in("role", ["learner", "instructor"]);
  const role = roles?.some((accountRole) => accountRole.role === "instructor") ? "instructor" : "learner";

  const recordResult = await recordLoginActivityDetails({
    supabase,
    userId: user.id,
    role,
    headers: await headers(),
    deviceLabel: safeText(body.deviceLabel, "", 120),
    browserName: safeText(body.browserName, "", 80),
    approximateLocation: safeText(body.approximateLocation, "", 180),
    latitude: safeNumber(body.latitude),
    longitude: safeNumber(body.longitude),
    accuracy: safeNumber(body.accuracy)
  });

  if (!recordResult.ok) {
    return jsonNoStore(
      {
        ok: false,
        error: "login_activity_store_failed",
        message: recordResult.message,
        code: recordResult.code ?? null
      },
      { status: 503 }
    );
  }

  const cookieStore = await cookies();
  cookieStore.delete(clientLoginActivityPendingCookieName);

  return jsonNoStore({ ok: true });
}
