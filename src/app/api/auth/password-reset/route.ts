import { NextResponse, type NextRequest } from "next/server";
import { HANDOFF_COOKIE_NAME, HANDOFF_TTL_SECONDS, createHandoffSecret, hashHandoffSecret } from "@/lib/auth-handoff";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function safeRole(value: FormDataEntryValue | string | null) {
  return String(value ?? "learner") === "instructor" ? "instructor" : "learner";
}

function safeReturnTo(value: FormDataEntryValue | string | null, role: "learner" | "instructor") {
  const fallback = `/auth/forgot-password?role=${role}`;
  const target = String(value ?? fallback);
  return target.startsWith("/") && !target.startsWith("//") ? target : fallback;
}

function redirectWithMessage(request: NextRequest, target: string, message: string) {
  const url = new URL(target, request.nextUrl.origin);
  url.searchParams.set("message", message);
  return NextResponse.redirect(url);
}

function getSenderAddress() {
  const from = process.env.RESEND_FROM_EMAIL ?? "info@ldrivingacademy.co.uk";
  if (from.includes("<") && from.includes(">")) {
    return from;
  }

  return `L Driving Academy <${from}>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function sendPasswordResetEmail(to: string, role: "learner" | "instructor", confirmUrl: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is missing in Vercel.");
  }

  const roleLabel = role === "instructor" ? "instructor" : "learner";
  const safeUrl = escapeHtml(confirmUrl);
  const replyTo = process.env.RESEND_REPLY_TO_EMAIL ?? process.env.APP_SUPPORT_EMAIL ?? "info@ldrivingacademy.co.uk";
  const text = [
    "Hello,",
    "",
    `Use this secure link to reset your LDA ${roleLabel} account password:`,
    confirmUrl,
    "",
    "The link opens the LDA new-password page after your email has been confirmed.",
    "",
    "If you did not request this reset, you can ignore this email."
  ].join("\n");
  const html = `
    <div style="font-family: Arial, sans-serif; color: #111; line-height: 1.6;">
      <h1>Reset your LDA password</h1>
      <p>Hello,</p>
      <p>Click the button below to confirm your email and choose a new password for your ${roleLabel} account.</p>
      <p style="margin: 28px 0;">
        <a href="${safeUrl}" style="display:inline-block;background:#ed1b24;color:#fff;text-decoration:none;font-weight:800;padding:14px 22px;border-radius:999px;">
          Reset Password
        </a>
      </p>
      <p>This secure link can be opened on your phone, laptop, or tablet. It will take you straight to the LDA password reset page.</p>
      <p>If the button does not work, copy and paste this link into your browser:</p>
      <p><a href="${safeUrl}">${safeUrl}</a></p>
      <p>If you did not request this reset, you can safely ignore this email.</p>
    </div>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: getSenderAddress(),
      to,
      subject: "Reset your L Driving Academy password",
      html,
      text,
      reply_to: replyTo
    })
  });

  if (!response.ok) {
    throw new Error(`Resend email failed with status ${response.status}`);
  }
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const role = safeRole(formData.get("accountIntent"));
  const returnTo = safeReturnTo(formData.get("returnTo"), role);
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!email || !email.includes("@")) {
    return redirectWithMessage(request, returnTo, "Enter the email on your LDA account. Password reset links are sent by email.");
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
    return redirectWithMessage(request, returnTo, `Password reset email is not fully configured. Add ${missingConfig.join(" and ")} in Vercel, then redeploy. LDA has stopped sending the old same-device reset link.`);
  }
  if (!adminClient) {
    return redirectWithMessage(request, returnTo, "Password reset email is not fully configured. Add SUPABASE_SERVICE_ROLE_KEY in Vercel, then redeploy.");
  }

  const appOrigin = process.env.APP_WEBSITE_URL?.trim() || request.nextUrl.origin;
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
    return redirectWithMessage(request, returnTo, handoffError.message);
  }

  const { data, error } = await adminClient.auth.admin.generateLink({
    type: "recovery",
    email,
    options: {
      redirectTo: redirectTo.toString()
    }
  });

  if (error) {
    return redirectWithMessage(request, returnTo, error.message);
  }

  const confirmUrl = new URL("/auth/confirm", appOrigin);
  confirmUrl.searchParams.set("token_hash", data.properties.hashed_token);
  confirmUrl.searchParams.set("type", data.properties.verification_type || "recovery");
  confirmUrl.searchParams.set("redirect_to", data.properties.redirect_to || redirectTo.toString());
  confirmUrl.searchParams.set("role", role);
  confirmUrl.searchParams.set("handoff", handoffId);
  confirmUrl.searchParams.set("handoff_secret", handoffSecret);

  try {
    await sendPasswordResetEmail(email, role, confirmUrl.toString());
  } catch (sendError) {
    return redirectWithMessage(request, returnTo, sendError instanceof Error ? sendError.message : "LDA could not send the reset email. Check the Resend API key and domain verification.");
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
