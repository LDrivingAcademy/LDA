import { NextResponse, type NextRequest } from "next/server";
import { HANDOFF_COOKIE_NAME, HANDOFF_TTL_SECONDS, createHandoffSecret, hashHandoffSecret } from "@/lib/auth-handoff";
import { isDirectorAdminEmail } from "@/lib/admin-access";
import { adminEntryCookieName, hasValidAdminEntry } from "@/lib/admin-entry";
import { sendPasswordResetEmail } from "@/lib/email";
import { getAppOrigin, isRateLimited } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type ResetRole = "learner" | "instructor" | "admin";

function safeRole(value: FormDataEntryValue | string | null) {
  const role = String(value ?? "learner");
  return role === "admin" || role === "instructor" ? role : "learner";
}

function safeReturnTo(value: FormDataEntryValue | string | null, role: ResetRole) {
  const fallback = role === "admin" ? "/admin-access/forgot-password" : `/auth/forgot-password?role=${role}`;
  const target = String(value ?? fallback);
  return target.startsWith("/") && !target.startsWith("//") ? target : fallback;
}

function redirectWithMessage(request: NextRequest, target: string, message: string) {
  const url = new URL(target, request.nextUrl.origin);
  url.searchParams.set("message", message);
  return NextResponse.redirect(url);
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const role = safeRole(formData.get("accountIntent"));
  const returnTo = safeReturnTo(formData.get("returnTo"), role);
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const genericAdminMessage = "If this is an authorised LDA admin email, a secure reset link has been sent.";

  if (role === "admin") {
    if (!hasValidAdminEntry(request.cookies.get(adminEntryCookieName)?.value)) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    if (isRateLimited(request, "admin-password-reset", 4)) {
      return redirectWithMessage(request, returnTo, "Too many admin reset requests. Wait a minute and try again.");
    }
  }

  if (!email || !email.includes("@")) {
    return redirectWithMessage(request, returnTo, "Enter the email on your LDA account. Password reset links are sent by email.");
  }

  if (role === "admin" && !isDirectorAdminEmail(email)) {
    return redirectWithMessage(request, returnTo, genericAdminMessage);
  }

  if (role !== "admin" && isDirectorAdminEmail(email)) {
    return redirectWithMessage(request, "/admin-access/forgot-password", "This account must use the secure LDA admin access portal.");
  }

  const adminClient = createAdminClient();
  const missingConfig = [];
  if (!adminClient) {
    missingConfig.push("SUPABASE_SERVICE_ROLE_KEY");
  }
  if (!process.env.RESEND_API_KEY) {
    missingConfig.push("RESEND_API_KEY");
  }
  if (missingConfig.length) {
    return redirectWithMessage(request, returnTo, "Password reset email is temporarily unavailable. Please try again later.");
  }
  if (!adminClient) {
    return redirectWithMessage(request, returnTo, "Password reset email is temporarily unavailable. Please try again later.");
  }

  const appOrigin = getAppOrigin(request);
  const nextPath = `/auth/update-password?role=${role}&email=${encodeURIComponent(email)}`;
  const redirectTo = new URL("/auth/callback", appOrigin);
  redirectTo.searchParams.set("role", role);
  redirectTo.searchParams.set("next", nextPath);

  const handoffId = crypto.randomUUID();
  const handoffSecret = createHandoffSecret();
  const secretHash = await hashHandoffSecret(handoffSecret);
  const expiresAt = new Date(Date.now() + HANDOFF_TTL_SECONDS * 1000).toISOString();

  const { error: handoffError } = await adminClient.from("auth_handoff_requests").insert({
    id: handoffId,
    email,
    full_name: null,
    role,
    next_path: nextPath,
    secret_hash: secretHash,
    expires_at: expiresAt
  });

  if (handoffError) {
    return redirectWithMessage(request, returnTo, "LDA could not start password reset. Please try again later.");
  }

  const { data, error } = await adminClient.auth.admin.generateLink({
    type: "recovery",
    email,
    options: {
      redirectTo: redirectTo.toString()
    }
  });

  if (error) {
    return redirectWithMessage(request, returnTo, "LDA could not start password reset. Please try again later.");
  }

  const confirmUrl = new URL("/auth/confirm", appOrigin);
  confirmUrl.searchParams.set("token_hash", data.properties.hashed_token);
  confirmUrl.searchParams.set("type", data.properties.verification_type || "recovery");
  confirmUrl.searchParams.set("redirect_to", data.properties.redirect_to || redirectTo.toString());
  confirmUrl.searchParams.set("role", role);
  confirmUrl.searchParams.set("handoff", handoffId);
  confirmUrl.searchParams.set("handoff_secret", handoffSecret);

  try {
    await sendPasswordResetEmail({
      to: email,
      role,
      confirmUrl: confirmUrl.toString()
    });
  } catch (sendError) {
    return redirectWithMessage(request, returnTo, "LDA could not send the reset email. Please try again later.");
  }

  if (role === "admin") {
    return redirectWithMessage(request, returnTo, genericAdminMessage);
  }

  const waitingUrl = new URL("/auth/check-email", request.nextUrl.origin);
  waitingUrl.searchParams.set("email", email);
  waitingUrl.searchParams.set("role", role);
  waitingUrl.searchParams.set("request", handoffId);
  waitingUrl.searchParams.set("purpose", "reset");

  const response = NextResponse.redirect(waitingUrl);
  response.cookies.set(HANDOFF_COOKIE_NAME, `${handoffId}.${handoffSecret}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: HANDOFF_TTL_SECONDS
  });
  return response;
}
