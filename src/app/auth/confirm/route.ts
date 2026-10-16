import { type EmailOtpType } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { isDirectorAdminEmail } from "@/lib/admin-access";
import { issueLdaAuthSession } from "@/lib/auth-sessions";
import { hashHandoffSecret } from "@/lib/auth-handoff";
import { hasCompletedLearnerEligibility } from "@/lib/learner-eligibility";
import { recordLoginActivity } from "@/lib/login-activity";
import { getAppOrigin } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function safeRole(value: string | null) {
  if (value === "admin") return "admin";
  return value === "instructor" ? "instructor" : "learner";
}

function safeLocalPath(value: string | null, role: string) {
  const fallback = role === "admin" ? "/admin-access" : `/auth/verify?role=${role}`;
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  return value;
}

function getVerifiedRedirect(request: NextRequest, redirectTo: string | null, role: string) {
  const appOrigin = getAppOrigin(request);
  const fallback = new URL(role === "admin" ? "/admin-access" : `/auth/verify?role=${role}`, appOrigin);

  if (!redirectTo) {
    return fallback;
  }

  try {
    const target = new URL(redirectTo, appOrigin);
    const allowedOrigins = new Set([appOrigin]);

    if (!allowedOrigins.has(target.origin)) {
      return fallback;
    }

    if (target.pathname === "/auth/callback") {
      return new URL(safeLocalPath(target.searchParams.get("next"), role), appOrigin);
    }

    return new URL(`${target.pathname}${target.search}`, appOrigin);
  } catch {
    return fallback;
  }
}

function loginRedirect(request: NextRequest, role: string, message: string) {
  const url = new URL(`/auth/login?role=${role}`, getAppOrigin(request));
  url.searchParams.set("message", message);
  return NextResponse.redirect(url);
}

function adminPortalRedirect(request: NextRequest) {
  const url = new URL("/admin-access", getAppOrigin(request));
  url.searchParams.set("message", "This account must use the secure LDA admin access portal.");
  return NextResponse.redirect(url);
}

function isMarketplaceRole(role: string): role is "learner" | "instructor" {
  return role === "learner" || role === "instructor";
}

async function issueMarketplaceSessionIfAccountIsReady({
  userId,
  role,
  request
}: {
  userId: string;
  role: "learner" | "instructor";
  request: NextRequest;
}) {
  const adminClient = createAdminClient();

  if (!adminClient) {
    return;
  }

  const { data: roleRow } = await adminClient
    .from("account_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", role)
    .maybeSingle();

  if (!roleRow) {
    return;
  }

  if (role === "learner") {
    const { data: learnerProfile } = await adminClient
      .from("learner_profiles")
      .select("date_of_birth,provisional_licence_confirmed_at,terms_accepted_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (!hasCompletedLearnerEligibility(learnerProfile)) {
      return;
    }
  }

  if (role === "instructor") {
    const { data: instructorProfile } = await adminClient
      .from("instructor_profiles")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!instructorProfile) {
      return;
    }
  }

  await issueLdaAuthSession({
    adminClient,
    cookieStore: await cookies(),
    headers: request.headers,
    userId,
    role,
    rememberMe: false
  });
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
    return loginRedirect(request, role, "Secure account access is temporarily unavailable. Please try again later.");
  }

  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as EmailOtpType
  });

  if (error) {
    return loginRedirect(request, role, error.message);
  }

  const verifiedEmail = data.user?.email ?? data.session?.user.email;

  if (role !== "admin" && isDirectorAdminEmail(verifiedEmail)) {
    await supabase.auth.signOut({ scope: "local" });
    return adminPortalRedirect(request);
  }

  const verifiedUserId = data.user?.id ?? data.session?.user.id ?? null;

  if (verifiedUserId && isMarketplaceRole(role)) {
    await recordLoginActivity({
      supabase,
      userId: verifiedUserId,
      role,
      headers: request.headers
    });
    await issueMarketplaceSessionIfAccountIsReady({ userId: verifiedUserId, role, request });
  }

  if (handoffId && handoffSecret) {
    const adminClient = createAdminClient();

    if (adminClient && verifiedUserId) {
      const secretHash = await hashHandoffSecret(handoffSecret);
      await adminClient
        .from("auth_handoff_requests")
        .update({
          status: "approved",
          verified_user_id: verifiedUserId,
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
