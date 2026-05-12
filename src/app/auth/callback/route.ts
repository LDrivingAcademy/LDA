import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

function safeNextPath(value: string | null, role: string) {
  const fallback = `/auth/verify?role=${role === "instructor" ? "instructor" : "learner"}`;
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  return value;
}

function withMessage(request: NextRequest, path: string, message: string) {
  const url = new URL(path, request.nextUrl.origin);
  url.searchParams.set("message", message);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const role = request.nextUrl.searchParams.get("role") === "instructor" ? "instructor" : "learner";
  const nextPath = safeNextPath(request.nextUrl.searchParams.get("next"), role);

  if (!supabase) {
    return withMessage(request, "/auth/login", "Supabase environment variables are not configured yet.");
  }

  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return withMessage(request, `/auth/login?role=${role}`, error.message);
    }

    return NextResponse.redirect(new URL(nextPath, request.nextUrl.origin));
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) {
      return withMessage(request, `/auth/login?role=${role}`, error.message);
    }

    return NextResponse.redirect(new URL(nextPath, request.nextUrl.origin));
  }

  return withMessage(request, `/auth/login?role=${role}`, "The email login link was missing its verification token. Please request a fresh link.");
}
