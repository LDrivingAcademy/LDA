"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createHandoffSecret, hashHandoffSecret, setHandoffCookie } from "@/lib/auth-handoff";
import { canSendTransactionalEmail, sendAuthMagicLinkEmail } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function authError(message: string): never {
  redirect(`/auth/login?message=${encodeURIComponent(message)}`);
}

function safeRole(value: FormDataEntryValue | null) {
  const role = String(value ?? "learner");
  return role === "instructor" ? "instructor" : "learner";
}

function getSubmittedFullName(formData: FormData) {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  return fullName || [firstName, lastName].filter(Boolean).join(" ").trim();
}

function normalizePhone(value: FormDataEntryValue | null) {
  const phone = String(value ?? "").trim().replace(/\s+/g, "");

  if (phone.startsWith("07") && phone.length === 11) {
    return `+44${phone.slice(1)}`;
  }

  return phone;
}

async function getAppOrigin() {
  if (process.env.APP_WEBSITE_URL) {
    return process.env.APP_WEBSITE_URL.trim();
  }

  const requestOrigin = (await headers()).get("origin");
  return requestOrigin || "https://ldrivingacademy.co.uk";
}

export async function sendMagicLink(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = getSubmittedFullName(formData);
  const role = safeRole(formData.get("accountIntent"));
  const nextPath = `/auth/verify?role=${role}`;

  if (!email) {
    authError("Enter your email address to receive the secure login link.");
  }

  const adminClient = createAdminClient();
  const missingConfig = [];

  if (!adminClient) {
    missingConfig.push("SUPABASE_SERVICE_ROLE_KEY");
  }

  if (!canSendTransactionalEmail()) {
    missingConfig.push("RESEND_API_KEY");
  }

  if (missingConfig.length) {
    authError(`Cross-device email login is not fully configured. Add ${missingConfig.join(" and ")} in Vercel, then redeploy.`);
  }

  if (!adminClient) {
    authError("Cross-device email login is not fully configured. Add SUPABASE_SERVICE_ROLE_KEY in Vercel, then redeploy.");
  }

  const appOrigin = await getAppOrigin();
  const redirectTo = new URL("/auth/callback", appOrigin);
  redirectTo.searchParams.set("role", role);
  redirectTo.searchParams.set("next", nextPath);

  const handoffId = crypto.randomUUID();
  const handoffSecret = createHandoffSecret();
  const secretHash = await hashHandoffSecret(handoffSecret);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const { error: handoffError } = await adminClient.from("auth_handoff_requests").insert({
    id: handoffId,
    email,
    full_name: fullName || null,
    role,
    next_path: nextPath,
    secret_hash: secretHash,
    expires_at: expiresAt
  });

  if (handoffError) {
    authError(`LDA could not start cross-device login. Run the latest Supabase migration, then try again. ${handoffError.message}`);
  }

  const { data, error } = await adminClient.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      redirectTo: redirectTo.toString(),
      data: {
        account_intent: role,
        full_name: fullName
      }
    }
  });

  if (error) {
    authError(error.message);
  }

  const confirmUrl = new URL("/auth/confirm", appOrigin);
  confirmUrl.searchParams.set("token_hash", data.properties.hashed_token);
  confirmUrl.searchParams.set("type", data.properties.verification_type || "magiclink");
  confirmUrl.searchParams.set("redirect_to", data.properties.redirect_to || redirectTo.toString());
  confirmUrl.searchParams.set("role", role);
  confirmUrl.searchParams.set("handoff", handoffId);
  confirmUrl.searchParams.set("handoff_secret", handoffSecret);

  try {
    await sendAuthMagicLinkEmail({
      to: email,
      fullName,
      role,
      confirmUrl: confirmUrl.toString()
    });
  } catch (sendError) {
    authError(sendError instanceof Error ? sendError.message : "LDA could not send the secure email link. Check the Resend API key and domain verification.");
  }

  await setHandoffCookie(handoffId, handoffSecret);
  redirect(`/auth/check-email?email=${encodeURIComponent(email)}&role=${role}&request=${handoffId}`);
}

export async function sendPhoneOtp(formData: FormData) {
  const phone = normalizePhone(formData.get("phone"));
  const fullName = getSubmittedFullName(formData);
  const role = safeRole(formData.get("accountIntent"));
  const supabase = await createClient();

  if (!phone || !phone.startsWith("+")) {
    redirect(`/auth/login?role=${role}&message=${encodeURIComponent("Enter your mobile number in UK format, for example 07123 456789, or international format with +44.")}`);
  }

  if (!supabase) {
    redirect(`/auth/login?role=${role}&message=${encodeURIComponent("Supabase is not configured yet. Add the Supabase URL and publishable key in Vercel before text-message login can run.")}`);
  }

  const { error } = await supabase.auth.signInWithOtp({
    phone,
    options: {
      data: {
        account_intent: role,
        full_name: fullName
      }
    }
  });

  if (error) {
    redirect(`/auth/login?role=${role}&message=${encodeURIComponent(`LDA could not send the text-message code. Check Supabase Phone Auth and SMS provider settings. ${error.message}`)}`);
  }

  redirect(`/auth/phone/verify?phone=${encodeURIComponent(phone)}&role=${role}&name=${encodeURIComponent(fullName)}`);
}

export async function verifyPhoneOtp(formData: FormData) {
  const phone = normalizePhone(formData.get("phone"));
  const token = String(formData.get("token") ?? "").trim();
  const role = safeRole(formData.get("accountIntent"));
  const supabase = await createClient();

  if (!supabase) {
    redirect(`/auth/login?role=${role}&message=${encodeURIComponent("Supabase is not configured yet. Add the Supabase URL and publishable key in Vercel before text-message login can run.")}`);
  }

  if (!phone || !token) {
    redirect(`/auth/phone/verify?phone=${encodeURIComponent(phone)}&role=${role}&message=${encodeURIComponent("Enter the text-message code sent to your phone.")}`);
  }

  const { error } = await supabase.auth.verifyOtp({
    phone,
    token,
    type: "sms"
  });

  if (error) {
    redirect(`/auth/phone/verify?phone=${encodeURIComponent(phone)}&role=${role}&message=${encodeURIComponent(error.message)}`);
  }

  redirect(`/auth/verify?role=${role}`);
}
