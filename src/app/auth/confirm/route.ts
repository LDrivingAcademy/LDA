import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { hashHandoffSecret } from "@/lib/auth-handoff";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function safeRole(value: string | null) {
  return value === "instructor" ? "instructor" : "learner";
}

function safeLocalPath(value: string | null, role: string) {
  const fallback = `/auth/verify?role=${role}`;
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  return value;
}

function getVerifiedRedirect(request: NextRequest, redirectTo: string | null, role: string) {
  const fallback = new URL(`/auth/verify?role=${role}`, request.nextUrl.origin);

  if (!redirectTo) {
    return fallback;
  }

  try {
    const target = new URL(redirectTo, request.nextUrl.origin);
    const configuredOrigin = new URL(process.env.APP_WEBSITE_URL ?? request.nextUrl.origin).origin;
    const allowedOrigins = new Set([request.nextUrl.origin, configuredOrigin]);

    if (!allowedOrigins.has(target.origin)) {
      return fallback;
    }

    if (target.pathname === "/auth/callback") {
      return new URL(safeLocalPath(target.searchParams.get("next"), role), request.nextUrl.origin);
    }

    return new URL(`${target.pathname}${target.search}`, request.nextUrl.origin);
  } catch {
    return fallback;
  }
}

function loginRedirect(request: NextRequest, role: string, message: string) {
  const url = new URL(`/auth/login?role=${role}`, request.nextUrl.origin);
  url.searchParams.set("message", message);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const role = safeRole(request.nextUrl.searchParams.get("role"));
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") || "magiclink";
  const redirectTo = request.nextUrl.searchParams.get("redirect_to");
  const handoffId = request.nextUrl.searchParams.get("handoff");
  const handoffSecret = request.nextUrl.searchParams.get("handoff_secret");

  if (!tokenHash) {
    return loginRedirect(request, role, "The email login link was missing its verification token. Please request a fresh link.");
  }

  const supabase = await createClient();

  if (!supabase) {
    return loginRedirect(request, role, "Supabase environment variables are not configured yet.");
  }

  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as EmailOtpType
  });

  if (error) {
    return loginRedirect(request, role, error.message);
  }

  if (handoffId && handoffSecret) {
    const adminClient = createAdminClient();
    const userId = data.user?.id ?? data.session?.user.id ?? null;

    if (adminClient && userId) {
      const secretHash = await hashHandoffSecret(handoffSecret);
      await adminClient
        .from("auth_handoff_requests")
        .update({
          status: "approved",
          verified_user_id: userId,
          approved_at: new Date().toISOString()
        })
        .eq("id", handoffId)
        .eq("secret_hash", secretHash)
        .eq("status", "pending")
        .gt("expires_at", new Date().toISOString());
    }
  }

  return NextResponse.redirect(getVerifiedRedirect(request, redirectTo, role));
}
