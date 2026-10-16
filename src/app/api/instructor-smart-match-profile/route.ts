import { canUseMarketplaceRole, getMarketplaceRoleState } from "@/lib/account-route-guard";
import { isRateLimited, jsonNoStore, rateLimitResponse, readJsonBody, safeText } from "@/lib/security";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SmartMatchProfileRequest = {
  inclusiveLearningEnabled?: boolean;
  teachingStyles?: string[];
  specialisms?: string[];
  inclusiveLessonRatePence?: number | null;
};

function isMissingSmartMatchColumnError(error: unknown) {
  const candidate = error as { code?: string; message?: string } | null;
  return candidate?.code === "42703" || /smart_match_|column .* does not exist/i.test(candidate?.message ?? "");
}

function cleanList(value: unknown, limit: number) {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map((item) => safeText(item, "", 80))
        .filter(Boolean)
        .slice(0, limit)
    )
  );
}

function cleanRate(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.min(Math.max(Math.round(parsed), 1000), 12000);
}

function toClientProfile(row: {
  smart_match_inclusive_enabled?: boolean | null;
  smart_match_teaching_styles?: string[] | null;
  smart_match_specialisms?: string[] | null;
  smart_match_inclusive_rate_pence?: number | null;
} | null) {
  return {
    inclusiveLearningEnabled: Boolean(row?.smart_match_inclusive_enabled),
    teachingStyles: row?.smart_match_teaching_styles ?? [],
    specialisms: row?.smart_match_specialisms ?? [],
    inclusiveLessonRatePence: row?.smart_match_inclusive_rate_pence ?? null
  };
}

async function requireInstructor() {
  const supabase = await createClient();
  if (!supabase) {
    return { supabase: null, userId: "", response: jsonNoStore({ error: "Account access is temporarily unavailable." }, { status: 503 }) };
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, userId: "", response: jsonNoStore({ error: "Sign in as an instructor." }, { status: 401 }) };
  }

  const roleState = await getMarketplaceRoleState(supabase, user.id);
  if (!canUseMarketplaceRole(roleState, "instructor")) {
    return { supabase, userId: user.id, response: jsonNoStore({ error: "Use an instructor account to edit Smart Match profile settings." }, { status: 403 }) };
  }

  return { supabase, userId: user.id, response: null };
}

export async function GET() {
  const { supabase, userId, response } = await requireInstructor();
  if (response) return response;
  if (!supabase) return jsonNoStore({ error: "Account access is temporarily unavailable." }, { status: 503 });

  const { data, error } = await supabase
    .from("instructor_profiles")
    .select("smart_match_inclusive_enabled,smart_match_teaching_styles,smart_match_specialisms,smart_match_inclusive_rate_pence")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (isMissingSmartMatchColumnError(error)) {
      return jsonNoStore({ error: "Smart Match instructor profile settings are temporarily unavailable." }, { status: 503 });
    }
    return jsonNoStore({ error: "Smart Match profile could not be loaded." }, { status: 500 });
  }

  return jsonNoStore({ profile: toClientProfile(data) });
}

export async function POST(request: Request) {
  if (isRateLimited(request, "instructor-smart-match-profile", 20)) {
    return rateLimitResponse();
  }

  const body = await readJsonBody<SmartMatchProfileRequest>(request);
  if (!body) {
    return jsonNoStore({ error: "Invalid Smart Match profile request." }, { status: 400 });
  }

  const { supabase, userId, response } = await requireInstructor();
  if (response) return response;
  if (!supabase) return jsonNoStore({ error: "Account access is temporarily unavailable." }, { status: 503 });

  const payload = {
    smart_match_inclusive_enabled: Boolean(body.inclusiveLearningEnabled),
    smart_match_teaching_styles: cleanList(body.teachingStyles, 12),
    smart_match_specialisms: cleanList(body.specialisms, 16),
    smart_match_inclusive_rate_pence: cleanRate(body.inclusiveLessonRatePence),
    smart_match_updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from("instructor_profiles")
    .update(payload)
    .eq("user_id", userId)
    .select("smart_match_inclusive_enabled,smart_match_teaching_styles,smart_match_specialisms,smart_match_inclusive_rate_pence")
    .maybeSingle();

  if (error) {
    if (isMissingSmartMatchColumnError(error)) {
      return jsonNoStore({ error: "Smart Match instructor profile settings are temporarily unavailable." }, { status: 503 });
    }
    return jsonNoStore({ error: "Smart Match profile could not be saved." }, { status: 500 });
  }

  if (!data) {
    return jsonNoStore({ error: "Instructor profile setup must exist before Smart Match settings can be saved." }, { status: 404 });
  }

  return jsonNoStore({ profile: toClientProfile(data) });
}
