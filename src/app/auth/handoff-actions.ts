"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createHandoffSecret, hashHandoffSecret, setHandoffCookie } from "@/lib/auth-handoff";
import { ensureEmailDoesNotHaveDifferentRole, type MarketplaceRole } from "@/lib/account-role-guard";
import { canSendTransactionalEmail, sendAuthMagicLinkEmail } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";

function authError(message: string): never {
  redirect(`/auth/login?message=${encodeURIComponent(message)}`);
}

function safeRole(value: FormDataEntryValue | null): MarketplaceRole {
  const role = String(value ?? "learner");
  return role === "instructor" ? "instructor" : "learner";
}

function getSubmittedFullName(formData: FormData) {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  return fullName || [firstName, lastName].filter(Boolean).join(" ").trim();
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

  try {
    await ensureEmailDoesNotHaveDifferentRole(adminClient, email, role);
  } catch (error) {
    authError(error instanceof Error ? error.message : "This email is already linked to another LDA account type.");
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
