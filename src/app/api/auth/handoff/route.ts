import { type EmailOtpType, createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { type NextRequest } from "next/server";
import { HANDOFF_COOKIE_NAME, hashHandoffSecret, parseHandoffCookie } from "@/lib/auth-handoff";
import { getRuntimeEnvValue } from "@/lib/runtime-env";
import { isRateLimited, jsonNoStore, rateLimitResponse } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

type HandoffRecord = {
  id: string;
  email: string;
  role: "learner" | "instructor" | "admin";
  next_path: string;
  secret_hash: string;
  status: "pending" | "approved" | "consumed" | "expired";
  expires_at: string;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return jsonNoStore(body, { status });
}

function safeRole(role: string) {
  return role === "instructor" ? "instructor" : "learner";
}

function safeNextPath(value?: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }

  return value;
}

export async function GET(request: NextRequest) {
  if (isRateLimited(request, "auth-handoff", 60)) {
    return rateLimitResponse();
  }

  const requestId = request.nextUrl.searchParams.get("request");
  const cookieHandoff = parseHandoffCookie(request.cookies.get(HANDOFF_COOKIE_NAME)?.value);

  if (!requestId || !cookieHandoff || cookieHandoff.id !== requestId) {
    return jsonResponse({ status: "missing_request" }, 401);
  }

  const adminClient = createAdminClient();

  if (!adminClient || !supabaseUrl || !supabasePublishableKey) {
    return jsonResponse({ status: "not_configured" }, 500);
  }

  const secretHash = await hashHandoffSecret(cookieHandoff.secret);
  const { data: record, error } = await adminClient
    .from("auth_handoff_requests")
    .select("id,email,role,next_path,secret_hash,status,expires_at")
    .eq("id", requestId)
    .eq("secret_hash", secretHash)
    .maybeSingle<HandoffRecord>();

  if (error) {
    return jsonResponse({ status: "error", message: error.message }, 500);
  }

  if (!record) {
    return jsonResponse({ status: "not_found" }, 404);
  }

  const now = Date.now();
  const expiresAt = new Date(record.expires_at).getTime();

  if (record.status === "pending" && expiresAt <= now) {
    await adminClient
      .from("auth_handoff_requests")
      .update({ status: "expired" })
      .eq("id", requestId)
      .eq("status", "pending");
    return jsonResponse({ status: "expired" }, 410);
  }

  if (record.status !== "approved") {
    return jsonResponse({ status: record.status });
  }

  const role = safeRole(record.role);
  const nextPath = safeNextPath(record.next_path || `/auth/verify?role=${role}`);
  const redirectTo = new URL("/auth/callback", request.nextUrl.origin);
  redirectTo.searchParams.set("role", role);
  redirectTo.searchParams.set("next", nextPath);

  const serviceRoleKey = getRuntimeEnvValue("SUPABASE_SERVICE_ROLE_KEY").value;

  if (!serviceRoleKey) {
    return jsonResponse({ status: "not_configured" }, 500);
  }

  const privilegedAuth = createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  const { data: linkData, error: linkError } = await privilegedAuth.auth.admin.generateLink({
    type: "magiclink",
    email: record.email,
    options: {
      redirectTo: redirectTo.toString()
    }
  });

  if (linkError) {
    return jsonResponse({ status: "error", message: linkError.message }, 500);
  }

  const response = jsonResponse({ status: "authenticated", redirectTo: nextPath });
  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      }
    }
  });

  const { error: otpError } = await supabase.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: (linkData.properties.verification_type || "magiclink") as EmailOtpType
  });

  if (otpError) {
    return jsonResponse({ status: "error", message: otpError.message }, 500);
  }

  await adminClient
    .from("auth_handoff_requests")
    .update({ status: "consumed", consumed_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("status", "approved");

  response.cookies.delete(HANDOFF_COOKIE_NAME);
  return response;
}
