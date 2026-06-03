"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { headers } from "next/headers";
import { canSendTransactionalEmail, sendAuthMagicLinkEmail } from "@/lib/email";
import { createHandoffSecret, hashHandoffSecret, setHandoffCookie } from "@/lib/auth-handoff";
import { ensureEmailCanUseRole, ensureEmailDoesNotHaveDifferentRole, ensureUserCanUseRole, getMarketplaceRolesForUser, isDualMarketplaceRoleTestEmail, roleConflictMessage, type MarketplaceRole } from "@/lib/account-role-guard";
import { isAtLeast17 } from "@/lib/learner-eligibility";
import { createAdminClient } from "@/lib/supabase/admin";
import { authServiceErrorMessage } from "@/lib/supabase/errors";
import { createClient } from "@/lib/supabase/server";

function authError(message: string): never {
  redirect(`/auth/login?message=${encodeURIComponent(message)}`);
}

function safeNextPath(value: FormDataEntryValue | null) {
  const nextPath = String(value ?? "/dashboard");
  return nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/dashboard";
}

function safeRole(value: FormDataEntryValue | null): MarketplaceRole {
  const role = String(value ?? "learner");
  return role === "instructor" ? "instructor" : "learner";
}

function isAlreadyRegisteredAuthError(error: { message?: string } | null) {
  return /already|registered|exists/i.test(error?.message ?? "");
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

type InstructorDocumentField = {
  fieldName: string;
  documentType: "adi_pdi_badge" | "driving_licence" | "insurance";
  label: string;
};

type UploadedFileLike = Blob & {
  name?: string;
  size: number;
};

type SupabaseWriteClient = NonNullable<ReturnType<typeof createAdminClient>> | NonNullable<Awaited<ReturnType<typeof createClient>>>;

const instructorDocumentFields: InstructorDocumentField[] = [
  { fieldName: "adiPdiDocument", documentType: "adi_pdi_badge", label: "ADI/PDI badge or certificate" },
  { fieldName: "drivingLicenceDocument", documentType: "driving_licence", label: "Driving licence" },
  { fieldName: "insuranceDocument", documentType: "insurance", label: "Insurance certificate" }
];

function getUploadedFile(formData: FormData, fieldName: string): UploadedFileLike | null {
  const value = formData.get(fieldName);

  if (!value || typeof value === "string" || !("arrayBuffer" in value) || !("size" in value) || value.size <= 0) {
    return null;
  }

  return value as UploadedFileLike;
}

function safeFileName(value?: string) {
  return String(value || "document")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "document";
}

async function uploadInstructorVerificationDocuments(writeClient: SupabaseWriteClient, userId: string, formData: FormData) {
  for (const { fieldName, label } of instructorDocumentFields) {
    if (!getUploadedFile(formData, fieldName)) {
      verifyRedirect("instructor", `Upload your ${label.toLowerCase()} before submitting instructor verification.`);
    }
  }

  for (const { fieldName, documentType, label } of instructorDocumentFields) {
    const file = getUploadedFile(formData, fieldName);

    if (!file) {
      verifyRedirect("instructor", `Upload your ${label.toLowerCase()} before submitting instructor verification.`);
    }

    if (file.size > 8 * 1024 * 1024) {
      verifyRedirect("instructor", `${label} must be under 8MB.`);
    }

    const storagePath = `${userId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
    const { error: uploadError } = await writeClient.storage.from("instructor-documents").upload(storagePath, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false
    });

    if (uploadError) {
      verifyRedirect("instructor", `${label} could not be uploaded. ${uploadError.message}`);
    }

    const { error: documentError } = await writeClient.from("instructor_documents").insert({
      instructor_id: userId,
      uploaded_by: userId,
      document_type: documentType,
      storage_path: storagePath,
      status: "pending"
    });

    if (documentError) {
      verifyRedirect("instructor", `${label} could not be saved for review. ${documentError.message}`);
    }
  }
}

function passwordRedirect(message: string, role: "learner" | "instructor" = "learner"): never {
  redirect(`/auth/login?role=${role}&message=${encodeURIComponent(message)}`);
}

function signUpRedirect(message: string, role: "learner" | "instructor" = "learner"): never {
  redirect(`/auth/sign-up?role=${role}&message=${encodeURIComponent(message)}`);
}

function recoveryRedirect(message: string, role: "learner" | "instructor", returnTo?: string): never {
  const fallback = `/auth/forgot-password?role=${role}`;
  const target = returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : fallback;
  const separator = target.includes("?") ? "&" : "?";
  redirect(`${target}${separator}message=${encodeURIComponent(message)}`);
}

function verifyRedirect(role: "learner" | "instructor", message: string): never {
  redirect(`/auth/verify?role=${role}&message=${encodeURIComponent(message)}`);
}

function dashboardPathForRole(role: "learner" | "instructor") {
  return role === "instructor" ? "/instructor-dashboard" : "/learner-dashboard";
}

async function signOutLocalSession(supabase: Awaited<ReturnType<typeof createClient>>) {
  if (!supabase) {
    return;
  }

  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // Login error handling should not be replaced by a secondary sign-out failure.
  }
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

  try {
    await ensureEmailDoesNotHaveDifferentRole(adminClient, email, role);
  } catch (error) {
    authError(error instanceof Error ? error.message : "This email is already linked to another LDA account type.");
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

  try {
    await ensureUserCanUseRole(writeClient, user.id, role);
  } catch (error) {
    verifyRedirect(role, error instanceof Error ? error.message : "This account is already linked to another LDA account type.");
  }

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

    await uploadInstructorVerificationDocuments(writeClient, user.id, formData);

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
  const visibleIdentifier = String(formData.get("username") ?? "").trim();
  const mirroredIdentifier = String(formData.get("identifier") ?? "").trim();
  const identifier = visibleIdentifier || mirroredIdentifier;
  const password = String(formData.get("password") ?? "");
  const role = safeRole(formData.get("accountIntent"));
  const nextPath = safeNextPath(formData.get("next") ?? dashboardPathForRole(role));
  const rememberMe = formData.get("rememberMe") === "on";

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

  let signInError: { message?: string } | null = null;

  try {
    const { error } = await supabase.auth.signInWithPassword(signInPayload);
    signInError = error;
  } catch (error) {
    passwordRedirect(authServiceErrorMessage(error), role);
  }

  if (signInError) {
    passwordRedirect(signInError.message || "LDA could not complete login. Please try again.", role);
  }

  let user = null;

  try {
    const { data, error: userError } = await supabase.auth.getUser();
    if (userError) {
      passwordRedirect(userError.message, role);
    }
    user = data.user;
  } catch (error) {
    passwordRedirect(authServiceErrorMessage(error), role);
  }

  if (user) {
    let marketplaceRoles: MarketplaceRole[] = [];

    try {
      marketplaceRoles = await getMarketplaceRolesForUser(supabase, user.id);
    } catch (roleError) {
      await signOutLocalSession(supabase);
      passwordRedirect(authServiceErrorMessage(roleError), role);
    }

    const needsVerification = marketplaceRoles.length === 0;
    if (!needsVerification && !marketplaceRoles.includes(role)) {
      if (!isDualMarketplaceRoleTestEmail(user.email)) {
        await signOutLocalSession(supabase);
        passwordRedirect(roleConflictMessage(marketplaceRoles[0], role), role);
      }

      const writeClient = createAdminClient() ?? supabase;
      const { error: roleUpsertError } = await writeClient.from("account_roles").upsert({ user_id: user.id, role });

      if (roleUpsertError) {
        await signOutLocalSession(supabase);
        passwordRedirect(roleUpsertError.message, role);
      }

      if (role === "instructor") {
        const { error: instructorProfileError } = await writeClient.from("instructor_profiles").upsert({
          user_id: user.id,
          display_name: user.user_metadata?.full_name || user.email || "LDA instructor",
          verification_status: "pending"
        });

        if (instructorProfileError) {
          await signOutLocalSession(supabase);
          passwordRedirect(instructorProfileError.message, role);
        }
      }
    }

    if (needsVerification) {
      redirect(`/auth/verify?role=${role}&message=${encodeURIComponent("Finish your LDA account setup before continuing.")}`);
    }
  }

  const cookieStore = await cookies();
  if (rememberMe) {
    const rememberedIdentifier = identifier.includes("@") ? identifier.toLowerCase() : normalizePhone(identifier);
    cookieStore.set("lda_remember_identifier", rememberedIdentifier, {
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 180,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production"
    });
  } else {
    cookieStore.delete("lda_remember_identifier");
  }

  revalidatePath("/", "layout");
  redirect(nextPath);
}

export async function signUp(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const accountIntent = String(formData.get("accountIntent") ?? "learner");
  const role = safeRole(formData.get("accountIntent"));
  const nextPath = `/auth/verify?role=${role}`;

  if (accountIntent === "admin") {
    signUpRedirect("Admin accounts must be created manually by the site owner.", role);
  }

  if (!email || !email.includes("@")) {
    signUpRedirect("Enter a valid email address to create your account.", role);
  }

  if (password.length < 8) {
    signUpRedirect("Use a password with at least 8 characters.", role);
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
    signUpRedirect(`Cross-device email sign-up is not fully configured. Add ${missingConfig.join(" and ")} in Vercel, then redeploy.`, role);
  }

  if (!adminClient) {
    signUpRedirect("Cross-device email sign-up is not fully configured. Add SUPABASE_SERVICE_ROLE_KEY in Vercel, then redeploy.", role);
  }

  try {
    await ensureEmailCanUseRole(adminClient, email, role);
  } catch (error) {
    signUpRedirect(error instanceof Error ? error.message : "This email is already linked to another LDA account type.", role);
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
    full_name: null,
    role,
    next_path: nextPath,
    secret_hash: secretHash,
    expires_at: expiresAt
  });

  if (handoffError) {
    signUpRedirect(`LDA could not start email verification. Run the latest Supabase migration, then try again. ${handoffError.message}`, role);
  }

  let { data, error } = await adminClient.auth.admin.generateLink({
    type: "signup",
    options: {
      redirectTo: redirectTo.toString(),
      data: { account_intent: accountIntent }
    },
    email,
    password
  });

  if (error && isDualMarketplaceRoleTestEmail(email) && isAlreadyRegisteredAuthError(error)) {
    const fallbackLink = await adminClient.auth.admin.generateLink({
      type: "magiclink",
      options: {
        redirectTo: redirectTo.toString(),
        data: { account_intent: accountIntent }
      },
      email
    });

    data = fallbackLink.data;
    error = fallbackLink.error;
  }

  if (error) {
    signUpRedirect(error.message, role);
  }

  if (!data?.properties?.hashed_token) {
    signUpRedirect("LDA could not create the secure email confirmation. Please try again.", role);
  }

  const confirmUrl = new URL("/auth/confirm", appOrigin);
  confirmUrl.searchParams.set("token_hash", data.properties.hashed_token);
  confirmUrl.searchParams.set("type", data.properties.verification_type || "signup");
  confirmUrl.searchParams.set("redirect_to", data.properties.redirect_to || redirectTo.toString());
  confirmUrl.searchParams.set("role", role);
  confirmUrl.searchParams.set("handoff", handoffId);
  confirmUrl.searchParams.set("handoff_secret", handoffSecret);

  try {
    await sendAuthMagicLinkEmail({
      to: email,
      role,
      confirmUrl: confirmUrl.toString()
    });
  } catch (sendError) {
    signUpRedirect(sendError instanceof Error ? sendError.message : "LDA could not send the secure email confirmation. Check the Resend API key and domain verification.", role);
  }

  await setHandoffCookie(handoffId, handoffSecret);
  revalidatePath("/", "layout");
  redirect(`/auth/check-email?email=${encodeURIComponent(email)}&role=${role}&request=${handoffId}`);
}

export async function requestPasswordReset(formData: FormData) {
  const role = safeRole(formData.get("accountIntent"));
  const returnTo = String(formData.get("returnTo") ?? "");
  const identifier = String(formData.get("email") ?? formData.get("identifier") ?? "").trim();
  const supabase = await createClient();

  if (!supabase) {
    recoveryRedirect("Supabase environment variables are not configured yet.", role, returnTo);
  }

  if (!identifier) {
    recoveryRedirect("Enter your account email first.", role, returnTo);
  }

  if (!identifier.includes("@")) {
    recoveryRedirect("Enter the email on your LDA account. Phone recovery is used as a support check, but the reset link is sent by email.", role, returnTo);
  }

  const redirectTo = new URL("/auth/callback", await getAppOrigin());
  redirectTo.searchParams.set("role", role);
  redirectTo.searchParams.set("next", "/auth/update-password");

  const { error } = await supabase.auth.resetPasswordForEmail(identifier.toLowerCase(), {
    redirectTo: redirectTo.toString()
  });

  if (error) {
    recoveryRedirect(error.message, role, returnTo);
  }

  recoveryRedirect("Password reset sent. Check your email and follow the secure reset link.", role, returnTo);
}

export async function updatePassword(formData: FormData) {
  const role = safeRole(formData.get("role"));
  const identifier = String(formData.get("identifier") ?? formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const supabase = await createClient();
  const updateUrl = (message: string) => {
    const params = new URLSearchParams({ role, message });
    if (identifier) {
      params.set("email", identifier);
    }
    redirect(`/auth/update-password?${params.toString()}`);
  };

  if (!supabase) {
    authError("Supabase environment variables are not configured yet.");
  }

  if (!identifier) {
    updateUrl("Enter the email linked to your account first.");
  }

  if (password.length < 8) {
    updateUrl("Use a password with at least 8 characters.");
  }

  if (password !== confirmPassword) {
    updateUrl("passwords do not match");
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    updateUrl(error.message);
  }

  revalidatePath("/", "layout");
  const params = new URLSearchParams({
    role,
    message: "Password changed. Log in with your new password."
  });
  params.set("identifier", identifier);
  redirect(`/auth/login?${params.toString()}`);
}

export async function signOut() {
  const cookieStore = await cookies();
  cookieStore.delete("lda_demo_role");

  const supabase = await createClient();
  if (supabase) {
    await signOutLocalSession(supabase);
  }

  revalidatePath("/", "layout");
  redirect("/");
}
