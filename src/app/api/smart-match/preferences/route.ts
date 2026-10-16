import { isRateLimited, jsonNoStore, rateLimitResponse, readJsonBody } from "@/lib/security";
import { normaliseSmartMatchPreferences } from "@/lib/smart-match-preferences";
import { createClient } from "@/lib/supabase/server";
import type { SmartMatchInput } from "@/lib/smart-match";

export const dynamic = "force-dynamic";

type PreferenceRequest = {
  preferences?: SmartMatchInput;
};

function isMissingPreferencesTable(error: unknown) {
  const candidate = error as { code?: string; message?: string } | null;
  return candidate?.code === "42P01" || /smart_match_preferences|relation .* does not exist/i.test(candidate?.message ?? "");
}

async function requireUser() {
  const supabase = await createClient();
  if (!supabase) {
    return { supabase: null, userId: "", response: jsonNoStore({ error: "Account access is temporarily unavailable." }, { status: 503 }) };
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, userId: "", response: jsonNoStore({ mode: "guest", preferences: null }, { status: 401 }) };
  }

  return { supabase, userId: user.id, response: null };
}

export async function GET() {
  const { supabase, userId, response } = await requireUser();
  if (response) return response;
  if (!supabase) return jsonNoStore({ error: "Account access is temporarily unavailable." }, { status: 503 });

  const { data, error } = await supabase
    .from("smart_match_preferences")
    .select("preferences,updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (isMissingPreferencesTable(error)) {
      return jsonNoStore({ mode: "account", preferences: null, error: "Smart Match account preferences are temporarily unavailable." }, { status: 503 });
    }
    return jsonNoStore({ error: "Smart Match preferences could not be loaded." }, { status: 500 });
  }

  return jsonNoStore({
    mode: "account",
    preferences: data?.preferences ? normaliseSmartMatchPreferences(data.preferences) : null,
    updatedAt: data?.updated_at ?? null
  });
}

export async function PUT(request: Request) {
  if (isRateLimited(request, "smart-match-preferences", 20)) {
    return rateLimitResponse();
  }

  const body = await readJsonBody<PreferenceRequest>(request);
  if (!body) {
    return jsonNoStore({ error: "Invalid Smart Match preferences request." }, { status: 400 });
  }

  const { supabase, userId, response } = await requireUser();
  if (response) return response;
  if (!supabase) return jsonNoStore({ error: "Account access is temporarily unavailable." }, { status: 503 });

  const preferences = normaliseSmartMatchPreferences(body.preferences);
  const { data, error } = await supabase
    .from("smart_match_preferences")
    .upsert(
      {
        user_id: userId,
        preferences,
        updated_at: new Date().toISOString()
      },
      { onConflict: "user_id" }
    )
    .select("preferences,updated_at")
    .maybeSingle();

  if (error) {
    if (isMissingPreferencesTable(error)) {
      return jsonNoStore({ error: "Smart Match account preferences are temporarily unavailable." }, { status: 503 });
    }
    return jsonNoStore({ error: "Smart Match preferences could not be saved." }, { status: 500 });
  }

  return jsonNoStore({
    ok: true,
    preferences: normaliseSmartMatchPreferences(data?.preferences ?? preferences),
    updatedAt: data?.updated_at ?? null
  });
}

export async function DELETE(request: Request) {
  if (isRateLimited(request, "smart-match-preferences-reset", 12)) {
    return rateLimitResponse();
  }

  const { supabase, userId, response } = await requireUser();
  if (response) return response;
  if (!supabase) return jsonNoStore({ error: "Account access is temporarily unavailable." }, { status: 503 });

  const { error } = await supabase.from("smart_match_preferences").delete().eq("user_id", userId);

  if (error) {
    if (isMissingPreferencesTable(error)) {
      return jsonNoStore({ ok: true, warning: "Smart Match account preferences are temporarily unavailable." });
    }
    return jsonNoStore({ error: "Smart Match preferences could not be reset." }, { status: 500 });
  }

  return jsonNoStore({ ok: true });
}
