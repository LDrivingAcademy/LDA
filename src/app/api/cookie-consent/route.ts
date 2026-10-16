import { createAdminClient } from "@/lib/supabase/admin";
import { normaliseCookieChoice, readConsentFromCookieHeader } from "@/lib/cookie-consent";
import { isRateLimited, jsonNoStore, rateLimitResponse, readJsonBody, safeText } from "@/lib/security";

type ConsentPayload = {
  consentId?: string;
  choice?: unknown;
  path?: string;
  viewportWidth?: number;
  viewportHeight?: number;
};

function safeId(value: unknown) {
  const id = safeText(value, "", 80);
  return /^[a-zA-Z0-9._:-]+$/.test(id) ? id : "";
}

function safePath(value: unknown) {
  const path = safeText(value, "/", 240);
  return path.startsWith("/") && !path.startsWith("//") ? path : "/";
}

function safeDimension(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 10000 ? Math.round(number) : null;
}

export async function POST(request: Request) {
  if (isRateLimited(request, "cookie-consent", 30)) {
    return rateLimitResponse();
  }

  const body = await readJsonBody<ConsentPayload>(request);
  const bodyChoice = normaliseCookieChoice(body?.choice);
  const cookieChoice = readConsentFromCookieHeader(request.headers.get("cookie"));
  const consentId = safeId(body?.consentId);

  if (
    !body ||
    !bodyChoice ||
    !cookieChoice ||
    !consentId ||
    bodyChoice.analytics !== cookieChoice.analytics ||
    bodyChoice.marketing !== cookieChoice.marketing
  ) {
    return jsonNoStore({ ok: false }, { status: 400 });
  }

  const adminClient = createAdminClient();
  if (!adminClient) {
    return jsonNoStore({ ok: false }, { status: 202 });
  }

  const action = bodyChoice.analytics && bodyChoice.marketing
    ? "accept_all"
    : bodyChoice.analytics || bodyChoice.marketing
      ? "customise"
      : "reject";

  const { error } = await adminClient.from("cookie_consent_events").insert({
    consent_id: consentId,
    action,
    analytics_enabled: bodyChoice.analytics,
    targeted_advertising_enabled: bodyChoice.marketing,
    path: safePath(body.path),
    viewport_width: safeDimension(body.viewportWidth),
    viewport_height: safeDimension(body.viewportHeight),
    user_agent: safeText(request.headers.get("user-agent"), "", 240) || null
  });

  if (error) {
    console.error(JSON.stringify({
      level: "error",
      msg: "cookie consent audit insert failed",
      route: "/api/cookie-consent",
      error: error.message
    }));
    return jsonNoStore({ ok: false }, { status: 202 });
  }

  return jsonNoStore({ ok: true });
}

