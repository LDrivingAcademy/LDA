"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { canSendTransactionalEmail, sendAuthMagicLinkEmail } from "@/lib/email";
import { createHandoffSecret, hashHandoffSecret, setHandoffCookie } from "@/lib/auth-handoff";
import { isAtLeast17 } from "@/lib/learner-eligibility";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function authError(message: string): never {
  redirect(`/auth/login?message=${encodeURIComponent(message)}`);
}

function safeNextPath(value: FormDataEntryValue | null) {
  const nextPath = String(value ?? "/dashboard");
  return nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/dashboard";
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

async function getAppOrigin() {
  if (process.env.APP_WEBSITE_URL) {
    return process.env.APP_WEBSITE_URL.trim();
  }

  const requestOrigin = (await headers()).get("origin");
  return requestOrigin || "https://ldrivingacademy.co.uk";
}

function normalizePhone(value: FormDataEntryValue | null) {
  const phone = String(value ?? "").trim().replace(/\s+/g, "");

  if (phone.startsWith("07") && phone.length === 11) {
    return `+44${phone.slice(1)}`;
  }

  return phone;
}

function passwordRedirect(message: string, role: "learner" | "instructor" = "learner"): never {
  redirect(`/auth/login?role=${role}&message=${encodeURIComponent(message)}`);
}

function verifyRedirect(role: "learner" | "instructor", message: string): never {
  redirect(`/auth/verify?role=${role}&message=${encodeURIComponent(message)}`);
}

function dashboardPathForRole(role: "learner" | "instructor") {
  return role === "instructor" ? "/instructor-dashboard" : "/learner-dashboard";
}

export async function sendMagicLink(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = getSubmittedFullName(formData);
  const role = safeRole(formData.get("accountIntent"));
  const nextPath = `/auth/verify?role=${role}`;

  if (!email) {
    authError("Enter your email address to receive the secure login link.");
  }

  const redirectTo = new URL("/auth/callback", await getAppOrigin());
  redirectTo.searchParams.set("role", role);
  redirectTo.searchParams.set("next", nextPath);

  const adminClient = createAdminClient();
  const missingConfig = [];

  if (!adminClient) {
    missingConfig.push("SUPABASE_SERVICE_ROLE_KEY");
  }

  if (!canSendTransactionalEmail()) {
    missingConfig.push("RESEND_API_KEY");
  }

  if (missingConfig.length) {
    authError(`Cross-device email login is not fully configured. Add ${missingConfig.join(" and ")} in Vercel, then redeploy. LDA has stopped sending the old same-device magic link.`);
  }

  if (!adminClient) {
    authError("Cross-device email login is not fully configured. Add SUPABASE_SERVICE_ROLE_KEY in Vercel, then redeploy.");
  }

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

  const confirmUrl = new URL("/auth/confirm", await getAppOrigin());
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

export async function completeVerification(formData: FormData) {
  const supabase = await createClient();
  if (!supabase) {
    authError("Supabase environment variables are not configured yet.");
  }

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    authError("Your secure email link has expired. Request a new login link.");
  }

  const role = safeRole(formData.get("accountIntent"));
  const fullName = getSubmittedFullName(formData);
  const phone = String(formData.get("phone") ?? "").trim();
  const marketingOptIn = formData.get("marketingOptIn") === "on";
  const termsAccepted = formData.get("termsAccepted") === "on";
  const writeClient = createAdminClient() ?? supabase;

  if (!termsAccepted) {
    verifyRedirect(role, "Accept the platform terms and privacy notices before continuing.");
  }

  if (role === "learner") {
    const dateOfBirth = String(formData.get("dateOfBirth") ?? "").trim();
    const ageConfirmed = formData.get("ageConfirmed") === "on";
    const provisionalConfirmed = formData.get("provisionalLicenceConfirmed") === "on";

    if (!dateOfBirth || !isAtLeast17(dateOfBirth)) {
      verifyRedirect("learner", "Incorrect date of birth.");
    }

    if (!ageConfirmed) {
      verifyRedirect("learner", "Confirm that you are 17 or over before continuing to booking.");
    }

    if (!provisionalConfirmed) {
      verifyRedirect("learner", "Confirm that you hold a valid provisional licence before booking.");
    }
  }

  await writeClient.from("profiles").upsert({
    id: user.id,
    email: user.email,
    full_name: fullName || user.user_metadata?.full_name || "",
    phone: phone || null,
    marketing_opt_in: marketingOptIn
  });

  await writeClient.from("account_roles").upsert({
    user_id: user.id,
    role
  });

  if (role === "instructor") {
    const adiPdiStatus = String(formData.get("adiPdiStatus") ?? "ADI");
    const adiPdiNumber = String(formData.get("adiPdiNumber") ?? "").trim();
    const basePostcode = String(formData.get("basePostcode") ?? "").trim().toUpperCase();
    const hourlyRatePence = Math.round(Number(formData.get("hourlyRate") ?? "0") * 100);
    const areasCovered = String(formData.get("areasCovered") ?? "")
      .split(",")
      .map((area) => area.trim())
      .filter(Boolean);

    await writeClient.from("instructor_profiles").upsert({
      user_id: user.id,
      display_name: fullName || user.email,
      adi_pdi_status: adiPdiStatus === "PDI" ? "PDI" : "ADI",
      adi_pdi_number: adiPdiNumber || null,
      verification_status: "pending",
      hourly_rate_pence: hourlyRatePence > 0 ? hourlyRatePence : null,
      transmission: String(formData.get("transmission") ?? "manual") === "automatic" ? "automatic" : "manual",
      car_make: String(formData.get("carMake") ?? "").trim() || null,
      car_model: String(formData.get("carModel") ?? "").trim() || null,
      areas_covered: areasCovered,
      base_postcode: basePostcode || null
    });

    revalidatePath("/", "layout");
    redirect("/instructor-dashboard?verification=pending");
  }

  const dateOfBirth = String(formData.get("dateOfBirth") ?? "").trim();

  await writeClient.from("learner_profiles").upsert({
    user_id: user.id,
    date_of_birth: dateOfBirth,
    provisional_licence_confirmed_at: new Date().toISOString(),
    terms_accepted_at: new Date().toISOString()
  });

  revalidatePath("/", "layout");
  redirect("/learner-dashboard?verified=1");
}

export async function signIn(formData: FormData) {
  const identifier = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = safeRole(formData.get("accountIntent"));
  const nextPath = safeNextPath(formData.get("next") ?? dashboardPathForRole(role));

  const supabase = await createClient();
  if (!supabase) {
    authError("Supabase environment variables are not configured yet.");
  }

  if (!identifier || !password) {
    passwordRedirect("Enter your email or mobile number and password.", role);
  }

  const signInPayload = identifier.includes("@")
    ? { email: identifier.toLowerCase(), password }
    : { phone: normalizePhone(identifier), password };

  const { error } = await supabase.auth.signInWithPassword(signInPayload);

  if (error) {
    passwordRedirect(error.message, role);
  }

  revalidatePath("/", "layout");
  redirect(nextPath);
}

export async function signUp(formData: FormData) {
  const supabase = await createClient();
  if (!supabase) {
    authError("Supabase environment variables are not configured yet.");
  }

  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const fullName = getSubmittedFullName(formData);
  const accountIntent = String(formData.get("accountIntent") ?? "learner");
  const role = safeRole(formData.get("accountIntent"));
  const appOrigin = await getAppOrigin();
  const emailRedirectTo = new URL("/auth/callback", appOrigin);
  emailRedirectTo.searchParams.set("role", role);
  emailRedirectTo.searchParams.set("next", `/auth/verify?role=${role}`);

  if (accountIntent === "admin") {
    authError("Admin accounts must be created manually by the site owner.");
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: emailRedirectTo.toString(),
      data: { account_intent: accountIntent, full_name: fullName }
    }
  });

  if (error) {
    authError(error.message);
  }

  revalidatePath("/", "layout");
  redirect(`/auth/check-email?email=${encodeURIComponent(email)}&role=${role}`);
}

export async function requestPasswordReset(formData: FormData) {
  const identifier = String(formData.get("identifier") ?? "").trim();
  const role = safeRole(formData.get("accountIntent"));
  const supabase = await createClient();

  if (!supabase) {
    passwordRedirect("Supabase environment variables are not configured yet.", role);
  }

  if (!identifier) {
    passwordRedirect("Enter your account email or mobile number first.", role);
  }

  if (!identifier.includes("@")) {
    passwordRedirect("SMS password reset needs the SMS provider recovery flow connected. For now, use email reset or contact LDA support so we can verify the account safely.", role);
  }

  const redirectTo = new URL("/auth/callback", await getAppOrigin());
  redirectTo.searchParams.set("role", role);
  redirectTo.searchParams.set("next", "/auth/update-password");

  const { error } = await supabase.auth.resetPasswordForEmail(identifier.toLowerCase(), {
    redirectTo: redirectTo.toString()
  });

  if (error) {
    passwordRedirect(error.message, role);
  }

  passwordRedirect("Password reset sent. Check your email and follow the secure reset link.", role);
}

export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const supabase = await createClient();

  if (!supabase) {
    authError("Supabase environment variables are not configured yet.");
  }

  if (password.length < 8) {
    redirect(`/auth/update-password?message=${encodeURIComponent("Use a password with at least 8 characters.")}`);
  }

  if (password !== confirmPassword) {
    redirect(`/auth/update-password?message=${encodeURIComponent("The two passwords do not match.")}`);
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(`/auth/update-password?message=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");
  redirect(`/auth/login?message=${encodeURIComponent("Password updated. Log in with your new password.")}`);
}

export async function signOut() {
  const cookieStore = await cookies();
  cookieStore.delete("lda_demo_role");

  const supabase = await createClient();
  if (supabase) {
    await supabase.auth.signOut();
  }

  revalidatePath("/", "layout");
  redirect("/");
}
