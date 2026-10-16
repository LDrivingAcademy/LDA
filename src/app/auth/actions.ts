"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { ensureDirectorAdminRole, isDirectorAdminEmail } from "@/lib/admin-access";
import {
  adminEntryCookieName,
  adminEntryCookieOptions,
  createAdminEntryCookieValue,
  hasValidAdminEntry
} from "@/lib/admin-entry";
import { clearAdminLoginGuard, getAdminLoginLockout as getCookieAdminLoginLockout, recordAdminLoginFailure } from "@/lib/admin-login-guard";
import { canSendTransactionalEmail, sendAuthMagicLinkEmail, sendInstructorVerificationSubmittedEmail } from "@/lib/email";
import { createHandoffSecret, hashHandoffSecret, setHandoffCookie } from "@/lib/auth-handoff";
import { ensureEmailCanUseRole, ensureEmailDoesNotHaveDifferentRole, ensureUserCanUseRole, getMarketplaceRolesForUser, roleConflictMessage, type MarketplaceRole } from "@/lib/account-role-guard";
import { createInstructorDocumentAiVerification } from "@/lib/instructor-document-ai-verification";
import {
  issueLdaAuthSession,
  recordAuthAudit
} from "@/lib/auth-sessions";
import { buildInstructorApplicationDocumentPath, instructorDocumentsBucket } from "@/lib/instructor-document-storage";
import { recordInstructorVerificationAudit } from "@/lib/instructor-verification-audit";
import { validateInstructorVerificationFile } from "@/lib/instructor-verification-file-security";
import { isLdaQaBypassInstructorEmail } from "@/lib/lda-demo-accounts";
import { hasCompletedLearnerEligibility, hasCompletedLearnerSetup, isAtLeast17 } from "@/lib/learner-eligibility";
import { createLearnerVerificationToken, learnerVerificationCookieName } from "@/lib/learner-verification-session";
import { clientLoginActivityPendingCookieName, recordLoginActivity } from "@/lib/login-activity";
import {
  getPrivilegedLoginLockout,
  privilegedFailedLoginMessage,
  recordPrivilegedLoginFailure,
  type PrivilegedLoginRole
} from "@/lib/privileged-login-monitor";
import { getAppOrigin as getSafeAppOrigin } from "@/lib/security";
import { verifyAndSaveProvisionalLicence } from "@/lib/dvla-provisional-verification";
import { createAdminClient } from "@/lib/supabase/admin";
import { authServiceErrorMessage } from "@/lib/supabase/errors";
import { createClient } from "@/lib/supabase/server";
import { secureSignOut } from "@/lib/secure-sign-out";
import { getCurrentTermsStatus } from "@/lib/terms-acceptance";
import { CURRENT_TERMS_VERSION } from "@/lib/terms-version";
import {
  createTechnicalSupportEntryCookieValue,
  technicalSupportEntryCookieName,
  technicalSupportEntryCookieOptions
} from "@/lib/technical-support-entry";
import {
  ensureTechnicalSupportRole,
  isTechnicalSupportEmail
} from "@/lib/technical-support-access";

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

type SignInRole = MarketplaceRole | "admin" | "support";

const adminMarketplaceBlockMessage = "This account must use the secure LDA admin access portal.";

function setClientLoginActivityPending(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  cookieStore.set(clientLoginActivityPendingCookieName, "1", {
    httpOnly: true,
    maxAge: 60 * 10,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });
}

function safeSignInRole(value: FormDataEntryValue | null): SignInRole {
  const role = String(value ?? "learner");
  return role === "admin" || role === "support" || role === "instructor" ? role : "learner";
}

function safePasswordResetRole(value: FormDataEntryValue | null): SignInRole {
  const role = String(value ?? "learner");
  return role === "admin" || role === "support" || role === "instructor" ? role : "learner";
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

function maskedIdentifier(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "not-provided";

  if (trimmed.includes("@")) {
    const [name = "", domain = ""] = trimmed.toLowerCase().split("@");
    return `${name.slice(0, 2)}***@${domain}`;
  }

  return `${trimmed.slice(0, 3)}***${trimmed.slice(-2)}`;
}

function getHeaderValue(headerStore: Awaited<ReturnType<typeof headers>>, name: string) {
  return headerStore.get(name) ?? "";
}

function getAdminRequestMeta(headerStore: Awaited<ReturnType<typeof headers>>, identifier: string) {
  return {
    identifier: maskedIdentifier(identifier),
    ip: getHeaderValue(headerStore, "x-forwarded-for").split(",")[0]?.trim() || getHeaderValue(headerStore, "x-real-ip") || "unknown",
    userAgent: getHeaderValue(headerStore, "user-agent").slice(0, 180) || "missing"
  };
}

function privilegedRouteForRole(role: PrivilegedLoginRole) {
  return role === "admin" ? "/admin-access" : "/technical-support-access";
}

function privilegedGuardIdentifier(role: PrivilegedLoginRole, identifier: string) {
  return role === "support" ? `support:${identifier}` : identifier;
}

async function recordPrivilegedFailure({
  role,
  identifier,
  route,
  headerStore,
  cookieStore,
  reason
}: {
  role: PrivilegedLoginRole;
  identifier: string;
  route: string;
  headerStore: Awaited<ReturnType<typeof headers>>;
  cookieStore: Awaited<ReturnType<typeof cookies>>;
  reason: string;
}) {
  const guard = recordAdminLoginFailure(cookieStore, privilegedGuardIdentifier(role, identifier));
  const monitor = await recordPrivilegedLoginFailure({
    adminClient: createAdminClient(),
    role,
    identifier,
    route,
    headers: headerStore,
    reason
  });

  return { guard, monitor };
}

function padDatePart(value: string) {
  return value ? value.padStart(2, "0") : "";
}

function getLearnerDateOfBirth(formData: FormData) {
  const submittedDateOfBirth = String(formData.get("dateOfBirth") ?? "").trim();
  if (submittedDateOfBirth) {
    return submittedDateOfBirth;
  }

  const year = String(formData.get("dateOfBirthYear") ?? "").trim();
  const month = padDatePart(String(formData.get("dateOfBirthMonth") ?? "").trim());
  const day = padDatePart(String(formData.get("dateOfBirthDay") ?? "").trim());

  return year && month && day ? `${year}-${month}-${day}` : "";
}

type InstructorDocumentField = {
  fieldName: string;
  documentType: "adi_pdi_badge" | "driving_licence";
  label: string;
};

type UploadedFileLike = Blob & {
  name?: string;
  size: number;
};

type SupabaseWriteClient = NonNullable<ReturnType<typeof createAdminClient>> | NonNullable<Awaited<ReturnType<typeof createClient>>>;

const instructorDocumentFields: InstructorDocumentField[] = [
  { fieldName: "adiPdiDocument", documentType: "adi_pdi_badge", label: "ADI badge or certificate" },
  { fieldName: "drivingLicenceDocument", documentType: "driving_licence", label: "Full UK driving licence evidence" }
];

function getUploadedFile(formData: FormData, fieldName: string): UploadedFileLike | null {
  const value = formData.get(fieldName);

  if (!value || typeof value === "string" || !("arrayBuffer" in value) || !("size" in value) || value.size <= 0) {
    return null;
  }

  return value as UploadedFileLike;
}

async function uploadInstructorVerificationDocuments(writeClient: SupabaseWriteClient, userId: string, userEmail: string | null | undefined, formData: FormData) {
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

    const scan = await validateInstructorVerificationFile(file);
    if (!scan.ok) {
      verifyRedirect("instructor", scan.reason || `${label} could not be accepted for verification.`);
    }

    const storagePath = buildInstructorApplicationDocumentPath(userId, file.name);
    const aiVerification = createInstructorDocumentAiVerification({
      documentType,
      file,
      isDemoAccount: isLdaQaBypassInstructorEmail(userEmail)
    });
    const { error: uploadError } = await writeClient.storage.from(instructorDocumentsBucket).upload(storagePath, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false
    });

    if (uploadError) {
      verifyRedirect("instructor", `${label} could not be uploaded. ${uploadError.message}`);
    }

    const { data: insertedDocument, error: documentError } = await writeClient
      .from("instructor_documents")
      .insert({
        instructor_id: userId,
        uploaded_by: userId,
        document_type: documentType,
        storage_path: storagePath,
        status: "pending",
        ...aiVerification
      })
      .select("id")
      .single();

    if (documentError) {
      await writeClient.storage.from(instructorDocumentsBucket).remove([storagePath]);
      verifyRedirect("instructor", `${label} could not be saved for review. ${documentError.message}`);
    }

    await recordInstructorVerificationAudit({
      client: writeClient,
      instructorId: userId,
      actorUserId: userId,
      documentId: insertedDocument?.id,
      documentType,
      action: "upload",
      outcome: "success",
      notes: "Instructor uploaded verification evidence during account setup."
    });
  }
}

function passwordRedirect(message: string, role: SignInRole = "learner"): never {
  if (role === "admin") {
    redirect(`/admin-access?message=${encodeURIComponent(message)}`);
  }

  if (role === "support") {
    redirect(`/technical-support-access?message=${encodeURIComponent(message)}`);
  }

  redirect(`/auth/login?role=${role}&message=${encodeURIComponent(message)}`);
}

function signUpRedirect(message: string, role: "learner" | "instructor" = "learner"): never {
  redirect(`/auth/sign-up?role=${role}&message=${encodeURIComponent(message)}`);
}

function verifyRedirect(role: "learner" | "instructor", message: string, nextPath?: string): never {
  const params = new URLSearchParams({ role, message });
  if (nextPath) {
    params.set("next", nextPath);
  }
  redirect(`/auth/verify?${params.toString()}`);
}

function adminPortalRedirect(message = adminMarketplaceBlockMessage): never {
  redirect(`/admin-access?message=${encodeURIComponent(message)}`);
}

function blockAdminEmailFromMarketplace(email: string | null | undefined): void {
  if (isDirectorAdminEmail(email)) {
    adminPortalRedirect();
  }
}

function dashboardPathForRole(role: SignInRole) {
  if (role === "admin") return "/admin-mfa";
  if (role === "support") return "/technical-support-mfa";
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

  blockAdminEmailFromMarketplace(email);

  const appOrigin = getSafeAppOrigin();
  const redirectTo = new URL("/auth/callback", appOrigin);
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
    authError("Secure email login is temporarily unavailable. Please try again later.");
  }

  if (!adminClient) {
    authError("Secure email login is temporarily unavailable. Please try again later.");
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
    authError("LDA could not start secure email login. Please try again later.");
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
    authError("LDA could not send the secure email link. Please try again later.");
  }

  await setHandoffCookie(handoffId, handoffSecret);
  redirect(`/auth/check-email?email=${encodeURIComponent(email)}&role=${role}&request=${handoffId}`);
}

export async function completeVerification(formData: FormData) {
  const supabase = await createClient();
  if (!supabase) {
    authError("Secure account access is temporarily unavailable. Please try again later.");
  }

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    authError("Your secure email link has expired. Request a new login link.");
  }
  const verifiedUserId = user.id;

  const role = safeRole(formData.get("accountIntent"));
  const nextPath = safeNextPath(formData.get("next") ?? dashboardPathForRole(role));
  const verifyAgain = (message: string): never => verifyRedirect(role, message, nextPath);
  const verifyLearnerAgain = (message: string): never => verifyRedirect("learner", message, nextPath);
  const verifyInstructorAgain = (message: string): never => verifyRedirect("instructor", message, nextPath);
  if (isDirectorAdminEmail(user.email)) {
    await signOutLocalSession(supabase);
    adminPortalRedirect();
  }

  const fullName = getSubmittedFullName(formData);
  const phone = String(formData.get("phone") ?? "").trim();
  const marketingOptIn = formData.get("marketingOptIn") === "on";
  const termsAccepted = formData.get("termsAccepted") === "on";
  const acceptedTermsAt = new Date().toISOString();
  const writeClient = createAdminClient() ?? supabase;

  if (!termsAccepted) {
    verifyAgain("Accept the platform terms and privacy notices before continuing.");
  }

  if (role === "learner") {
    const dateOfBirth = getLearnerDateOfBirth(formData);
    const ageConfirmed = formData.get("ageConfirmed") === "on";
    const provisionalLicenceNumber = String(formData.get("provisionalLicenceNumber") ?? "").trim();
    const provisionalLicencePermission = formData.get("provisionalLicencePermission") === "on";

    if (!dateOfBirth || !isAtLeast17(dateOfBirth)) {
      verifyLearnerAgain("Incorrect date of birth.");
    }

    if (!ageConfirmed) {
      verifyLearnerAgain("Confirm that you are 17 or over before continuing to booking.");
    }

    if (!provisionalLicenceNumber) {
      verifyLearnerAgain("Enter your provisional driving licence number before opening your learner account.");
    }

    if (!provisionalLicencePermission) {
      verifyLearnerAgain("Give LDA permission to check your provisional driving licence number before opening your learner account.");
    }
  }

  const { error: profileError } = await writeClient.from("profiles").upsert({
    id: user.id,
    email: user.email,
    full_name: fullName || user.user_metadata?.full_name || "",
    phone: phone || null,
    marketing_opt_in: marketingOptIn,
    terms_accepted_at: acceptedTermsAt,
    terms_version_accepted: CURRENT_TERMS_VERSION
  }, { onConflict: "id" });

  if (profileError) {
    verifyAgain(`LDA could not save your profile details. ${profileError.message}`);
  }

  try {
    await ensureUserCanUseRole(writeClient, verifiedUserId, role);
  } catch (error) {
    verifyAgain(error instanceof Error ? error.message : "This account is already linked to another LDA account type.");
  }

  async function saveAccountRole() {
    const { error: roleError } = await writeClient.from("account_roles").upsert({
      user_id: verifiedUserId,
      role
    }, { onConflict: "user_id,role" });

    if (roleError) {
      verifyAgain(`LDA could not save your account role. ${roleError.message}`);
    }
  }

  async function issueVerificationSession() {
    const verificationCookieStore = await cookies();
    const verificationHeaderStore = await headers();
    const sessionResult = await issueLdaAuthSession({
      adminClient: createAdminClient(),
      cookieStore: verificationCookieStore,
      headers: verificationHeaderStore,
      userId: verifiedUserId,
      role,
      rememberMe: false
    });

    if (!sessionResult.ok) {
      await signOutLocalSession(supabase);
      verifyAgain("LDA could not create your secure account session. Please sign in again.");
    }
  }

  if (role === "instructor") {
    await saveAccountRole();

    const adiPdiStatus = "ADI";
    const adiPdiNumber = String(formData.get("adiPdiNumber") ?? "").trim();
    const { data: existingInstructorProfile, error: existingInstructorProfileError } = await writeClient
      .from("instructor_profiles")
      .select("verification_status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingInstructorProfileError) {
      verifyInstructorAgain(existingInstructorProfileError.message);
    }

    if (existingInstructorProfile?.verification_status === "approved") {
      await recordLoginActivity({
        supabase,
        userId: user.id,
        role,
        headers: await headers()
      });
      await issueVerificationSession();

      revalidatePath("/", "layout");
      redirect("/instructor-dashboard");
    }

    const { error: instructorProfileError } = await writeClient.from("instructor_profiles").upsert({
      user_id: user.id,
      display_name: fullName || user.email,
      adi_pdi_status: adiPdiStatus,
      adi_pdi_number: adiPdiNumber || null,
      verification_status: "in_progress",
      instructor_package: "instructor",
      instructor_subscription_status: "in_progress",
      instructor_package_started_at: null,
      instructor_package_expires_at: null,
      instructor_package_source: "application"
    }, { onConflict: "user_id" });

    if (instructorProfileError) {
      verifyInstructorAgain(`LDA could not save your instructor profile. ${instructorProfileError.message}`);
    }

    await uploadInstructorVerificationDocuments(writeClient, user.id, user.email, formData);
    if (user.email) {
      try {
        await sendInstructorVerificationSubmittedEmail({
          to: user.email,
          fullName: fullName || user.user_metadata?.full_name || "",
          statusUrl: `${getSafeAppOrigin()}/instructor-verification?from=email`
        });
      } catch (emailError) {
        console.error("[auth.verify] instructor verification status email failed", {
          userId: user.id,
          error: emailError
        });
      }
    }
    await recordLoginActivity({
      supabase,
      userId: user.id,
      role,
      headers: await headers()
    });
    await issueVerificationSession();

    revalidatePath("/", "layout");
    redirect("/instructor-dashboard?verification=in_progress");
  }

  const dateOfBirth = getLearnerDateOfBirth(formData);

  const { data: learnerProfile, error: learnerProfileError } = await writeClient.from("learner_profiles").upsert({
    user_id: user.id,
    date_of_birth: dateOfBirth,
    terms_accepted_at: acceptedTermsAt
  }, { onConflict: "user_id" }).select("date_of_birth,provisional_licence_confirmed_at,terms_accepted_at").single();

  if (learnerProfileError) {
    console.error("[auth.verify] learner eligibility save failed", {
      userId: user.id,
      message: learnerProfileError.message
    });
    verifyLearnerAgain(`LDA could not save your learner eligibility. ${learnerProfileError.message}`);
  }

  if (!hasCompletedLearnerSetup(learnerProfile)) {
    console.warn("[auth.verify] learner setup saved but incomplete", {
      userId: user.id,
      hasLearnerProfile: Boolean(learnerProfile),
      hasDateOfBirth: Boolean(learnerProfile?.date_of_birth),
      hasTermsAcceptance: Boolean(learnerProfile?.terms_accepted_at)
    });
    verifyLearnerAgain("LDA could not confirm your learner setup. Check your date of birth and confirmations, then try again.");
  }

  const optionalProvisionalLicenceNumber = String(formData.get("provisionalLicenceNumber") ?? "").trim();
  const provisionalLicencePermission = formData.get("provisionalLicencePermission") === "on";

  if (!optionalProvisionalLicenceNumber) {
    verifyLearnerAgain("Enter your provisional driving licence number before opening your learner account.");
  }

  if (!provisionalLicencePermission) {
    verifyLearnerAgain("Give LDA permission to check your provisional driving licence number before opening your learner account.");
  }

  const licenceResult = await verifyAndSaveProvisionalLicence({
    supabase,
    userId: user.id,
    drivingLicenceNumber: optionalProvisionalLicenceNumber,
    permissionConfirmed: provisionalLicencePermission
  });

  if (!licenceResult.valid) {
    verifyLearnerAgain(`${licenceResult.message} Correct the licence number before opening your learner account.`);
  }

  await saveAccountRole();

  const learnerVerificationToken = createLearnerVerificationToken(user.id);
  if (learnerVerificationToken) {
    const cookieStore = await cookies();
    cookieStore.set(learnerVerificationCookieName, learnerVerificationToken, {
      httpOnly: true,
      maxAge: 60 * 60 * 24,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production"
    });
  } else {
    console.warn("[auth.verify] learner verification token unavailable", { userId: user.id });
  }

  await recordLoginActivity({
    supabase,
    userId: user.id,
    role,
    headers: await headers()
  });
  await issueVerificationSession();
  setClientLoginActivityPending(await cookies());

  revalidatePath("/", "layout");
  redirect(nextPath);
}

export async function signIn(formData: FormData) {
  const visibleIdentifier = String(formData.get("username") ?? "").trim();
  const mirroredIdentifier = String(formData.get("identifier") ?? "").trim();
  const identifier = visibleIdentifier || mirroredIdentifier;
  const password = String(formData.get("password") ?? "");
  const role = safeSignInRole(formData.get("accountIntent"));
  const nextPath = safeNextPath(formData.get("next") ?? dashboardPathForRole(role));
  const rememberMe = formData.get("rememberMe") === "on";
  const cookieStore = await cookies();
  const headerStore = await headers();
  const isPrivilegedRole = role === "admin" || role === "support";
  const adminRequestMeta = isPrivilegedRole ? getAdminRequestMeta(headerStore, identifier) : null;
  const privilegedRoute = isPrivilegedRole ? privilegedRouteForRole(role) : "";
  const privilegedAdminClient = isPrivilegedRole ? createAdminClient() : null;

  if ((role === "learner" || role === "instructor") && identifier.includes("@")) {
    blockAdminEmailFromMarketplace(identifier);
  }

  if (isPrivilegedRole) {
    const centralLockout = await getPrivilegedLoginLockout({
      adminClient: privilegedAdminClient,
      role,
      identifier,
      route: privilegedRoute,
      headers: headerStore
    });
    const cookieLockout = getCookieAdminLoginLockout(cookieStore, privilegedGuardIdentifier(role, identifier));
    if (centralLockout || cookieLockout) {
      console.warn(`[${role}.auth] blocked by temporary privileged lockout`, {
        ...adminRequestMeta,
        secondsRemaining: centralLockout?.secondsRemaining ?? cookieLockout?.secondsRemaining
      });
      passwordRedirect(privilegedFailedLoginMessage, role);
    }

    if (role === "support" && !identifier.includes("@")) {
      const { guard, monitor } = await recordPrivilegedFailure({
        role,
        identifier,
        route: privilegedRoute,
        headerStore,
        cookieStore,
        reason: "non_email_identifier"
      });
      console.warn("[support.auth] rejected non-email identifier", {
        ...adminRequestMeta,
        failures: guard.failures,
        locked: Boolean(guard.lockedUntil) || monitor.locked
      });
      passwordRedirect(privilegedFailedLoginMessage, "support");
    }
  }

  const supabase = await createClient();
  if (!supabase) {
    authError("Secure account access is temporarily unavailable. Please try again later.");
  }

  if (!identifier || !password) {
    if (isPrivilegedRole) {
      const { guard, monitor } = await recordPrivilegedFailure({
        role,
        identifier,
        route: privilegedRoute,
        headerStore,
        cookieStore,
        reason: "missing_credentials"
      });
      console.warn(`[${role}.auth] missing credentials`, {
        ...adminRequestMeta,
        failures: guard.failures,
        locked: Boolean(guard.lockedUntil) || monitor.locked
      });
      passwordRedirect(privilegedFailedLoginMessage, role);
    }
    passwordRedirect(
      "Enter your email or mobile number and password.",
      role
    );
  }

  const signInPayload = identifier.includes("@")
    ? { email: identifier.toLowerCase(), password }
    : { phone: normalizePhone(identifier), password };

  let signInError: { message?: string } | null = null;

  try {
    const { error } = await supabase.auth.signInWithPassword(signInPayload);
    signInError = error;
  } catch (error) {
    if (isPrivilegedRole) {
      const { guard, monitor } = await recordPrivilegedFailure({
        role,
        identifier,
        route: privilegedRoute,
        headerStore,
        cookieStore,
        reason: "password_sign_in_exception"
      });
      console.warn(`[${role}.auth] sign-in exception`, {
        ...adminRequestMeta,
        failures: guard.failures,
        locked: Boolean(guard.lockedUntil) || monitor.locked
      });
      passwordRedirect(privilegedFailedLoginMessage, role);
    }
    passwordRedirect(authServiceErrorMessage(error), role);
  }

  if (signInError) {
    if (isPrivilegedRole) {
      const { guard, monitor } = await recordPrivilegedFailure({
        role,
        identifier,
        route: privilegedRoute,
        headerStore,
        cookieStore,
        reason: "invalid_password"
      });
      console.warn(`[${role}.auth] sign-in failed`, {
        ...adminRequestMeta,
        failures: guard.failures,
        locked: Boolean(guard.lockedUntil) || monitor.locked
      });
      passwordRedirect(privilegedFailedLoginMessage, role);
    }

    passwordRedirect(signInError.message || "LDA could not complete login. Please try again.", role);
  }

  let user = null;

  try {
    const { data, error: userError } = await supabase.auth.getUser();
    if (userError) {
      if (isPrivilegedRole) {
        console.warn(`[${role}.auth] user read failed after password verification`, adminRequestMeta);
        passwordRedirect(privilegedFailedLoginMessage, role);
      }
      passwordRedirect(userError.message, role);
    }
    user = data.user;
  } catch (error) {
    if (isPrivilegedRole) {
      console.warn(`[${role}.auth] user read exception after password verification`, {
        ...adminRequestMeta,
        message: error instanceof Error ? error.message : String(error)
      });
      passwordRedirect(privilegedFailedLoginMessage, role);
    }
    passwordRedirect(authServiceErrorMessage(error), role);
  }

  if (user) {
    if (role === "admin") {
      if (!isDirectorAdminEmail(user.email)) {
        await signOutLocalSession(supabase);
        const { guard, monitor } = await recordPrivilegedFailure({
          role: "admin",
          identifier,
          route: privilegedRouteForRole("admin"),
          headerStore,
          cookieStore,
          reason: "admin_email_allowlist_rejected"
        });
        console.warn("[admin.auth] authenticated account rejected by admin email allowlist", {
          ...adminRequestMeta,
          failures: guard.failures,
          locked: Boolean(guard.lockedUntil) || monitor.locked
        });
        passwordRedirect(privilegedFailedLoginMessage, "admin");
      }

      const adminClient = createAdminClient();

      if (adminClient) {
        try {
          await ensureDirectorAdminRole(adminClient, user);
        } catch (adminGrantError) {
          await signOutLocalSession(supabase);
          passwordRedirect(privilegedFailedLoginMessage, "admin");
        }
      }

      const roleReadClient = adminClient ?? supabase;
      const { data: adminRole, error: adminRoleError } = await roleReadClient
        .from("account_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (adminRoleError) {
        await signOutLocalSession(supabase);
        passwordRedirect(privilegedFailedLoginMessage, "admin");
      }

      if (!adminRole) {
        await signOutLocalSession(supabase);
        const { guard, monitor } = await recordPrivilegedFailure({
          role: "admin",
          identifier,
          route: privilegedRouteForRole("admin"),
          headerStore,
          cookieStore,
          reason: "admin_role_missing"
        });
        console.warn("[admin.auth] authenticated account rejected for missing admin role", {
          ...adminRequestMeta,
          failures: guard.failures,
          locked: Boolean(guard.lockedUntil) || monitor.locked
        });
        passwordRedirect(privilegedFailedLoginMessage, "admin");
      }

      if (!hasValidAdminEntry(cookieStore.get(adminEntryCookieName)?.value)) {
        const adminEntryValue = createAdminEntryCookieValue();
        if (!adminEntryValue) {
          await signOutLocalSession(supabase);
          passwordRedirect(privilegedFailedLoginMessage, "admin");
        }
        cookieStore.set(adminEntryCookieName, adminEntryValue, adminEntryCookieOptions());
      }

      const sessionResult = await issueLdaAuthSession({
        adminClient,
        cookieStore,
        headers: headerStore,
        userId: user.id,
        role: "admin",
        rememberMe: false
      });
      if (!sessionResult.ok) {
        await signOutLocalSession(supabase);
        passwordRedirect(privilegedFailedLoginMessage, "admin");
      }
      await recordAuthAudit({
        adminClient,
        actorUserId: user.id,
        subjectUserId: user.id,
        role: "admin",
        action: "admin.login.password_verified",
        headers: headerStore
      });
      clearAdminLoginGuard(cookieStore);
    } else if (role === "support") {
      let supportAdminClient = createAdminClient();

      if (!isTechnicalSupportEmail(user.email)) {
        await signOutLocalSession(supabase);
        const { guard, monitor } = await recordPrivilegedFailure({
          role: "support",
          identifier,
          route: privilegedRouteForRole("support"),
          headerStore,
          cookieStore,
          reason: "support_email_allowlist_rejected"
        });
        console.warn("[support.auth] authenticated account rejected by support allowlist", {
          ...adminRequestMeta,
          failures: guard.failures,
          locked: Boolean(guard.lockedUntil) || monitor.locked
        });
        passwordRedirect(privilegedFailedLoginMessage, "support");
      }

      if (supportAdminClient) {
        try {
          await ensureTechnicalSupportRole(supportAdminClient, user);
        } catch (supportGrantError) {
          await signOutLocalSession(supabase);
          passwordRedirect(privilegedFailedLoginMessage, "support");
        }
      }

      const roleReadClient = supportAdminClient ?? supabase;
      const { data: supportRole, error: supportRoleError } = await roleReadClient
        .from("account_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "support")
        .maybeSingle();

      if (supportRoleError || !supportRole) {
        await signOutLocalSession(supabase);
        const { guard, monitor } = await recordPrivilegedFailure({
          role: "support",
          identifier,
          route: privilegedRouteForRole("support"),
          headerStore,
          cookieStore,
          reason: "support_role_missing"
        });
        console.warn("[support.auth] authenticated account rejected for missing support role", {
          ...adminRequestMeta,
          failures: guard.failures,
          locked: Boolean(guard.lockedUntil) || monitor.locked
        });
        passwordRedirect(privilegedFailedLoginMessage, "support");
      }

      const supportEntryValue = createTechnicalSupportEntryCookieValue();
      if (!supportEntryValue) {
        await signOutLocalSession(supabase);
        passwordRedirect(privilegedFailedLoginMessage, "support");
      }

      cookieStore.set(
        technicalSupportEntryCookieName,
        supportEntryValue,
        technicalSupportEntryCookieOptions()
      );
      const sessionResult = await issueLdaAuthSession({
        adminClient: supportAdminClient,
        cookieStore,
        headers: headerStore,
        userId: user.id,
        role: "support",
        rememberMe: false
      });
      if (!sessionResult.ok) {
        await signOutLocalSession(supabase);
        passwordRedirect(privilegedFailedLoginMessage, "support");
      }
      await recordAuthAudit({
        adminClient: supportAdminClient,
        actorUserId: user.id,
        subjectUserId: user.id,
        role: "support",
        action: "support.login.password_verified",
        headers: headerStore
      });
      clearAdminLoginGuard(cookieStore);
    } else {
      if (isDirectorAdminEmail(user.email)) {
        await signOutLocalSession(supabase);
        adminPortalRedirect();
      }

      let marketplaceRoles: MarketplaceRole[] = [];

      try {
        marketplaceRoles = await getMarketplaceRolesForUser(supabase, user.id);
      } catch (roleError) {
        await signOutLocalSession(supabase);
        passwordRedirect(authServiceErrorMessage(roleError), role);
      }

      if (marketplaceRoles.length === 0) {
        const writeClient = createAdminClient() ?? supabase;

        if (role === "learner") {
          const { data: savedLearnerProfile, error: savedLearnerProfileError } = await supabase
            .from("learner_profiles")
            .select("date_of_birth,provisional_licence_confirmed_at,terms_accepted_at")
            .eq("user_id", user.id)
            .maybeSingle();

          if (savedLearnerProfileError) {
            await signOutLocalSession(supabase);
            passwordRedirect(savedLearnerProfileError.message, role);
          }

          if (hasCompletedLearnerEligibility(savedLearnerProfile)) {
            const { error: roleRepairError } = await writeClient.from("account_roles").upsert({ user_id: user.id, role: "learner" }, { onConflict: "user_id,role" });

            if (!roleRepairError) {
              marketplaceRoles = ["learner"];
            }
          }
        } else if (role === "instructor") {
          const { data: savedInstructorProfile, error: savedInstructorProfileError } = await supabase
            .from("instructor_profiles")
            .select("user_id")
            .eq("user_id", user.id)
            .maybeSingle();

          if (savedInstructorProfileError) {
            await signOutLocalSession(supabase);
            passwordRedirect(savedInstructorProfileError.message, role);
          }

          if (savedInstructorProfile) {
            const { error: roleRepairError } = await writeClient.from("account_roles").upsert({ user_id: user.id, role: "instructor" }, { onConflict: "user_id,role" });

            if (!roleRepairError) {
              marketplaceRoles = ["instructor"];
            }
          }
        }
      }

      const needsVerification = marketplaceRoles.length === 0;
      const effectiveMarketplaceRole = marketplaceRoles.includes("instructor") ? "instructor" : marketplaceRoles[0];
      if (!needsVerification && effectiveMarketplaceRole !== role) {
        await signOutLocalSession(supabase);
        passwordRedirect(roleConflictMessage(effectiveMarketplaceRole, role), role);
      }

      if (needsVerification) {
        const params = new URLSearchParams({
          role,
          message: "Finish your LDA account setup before continuing.",
          next: nextPath
        });
        redirect(`/auth/verify?${params.toString()}`);
      }

      await recordLoginActivity({
        supabase,
        userId: user.id,
        role,
        headers: headerStore
      });
      const sessionResult = await issueLdaAuthSession({
        adminClient: createAdminClient(),
        cookieStore,
        headers: headerStore,
        userId: user.id,
        role,
        rememberMe
      });
      if (!sessionResult.ok) {
        await signOutLocalSession(supabase);
        passwordRedirect("LDA could not create your secure account session. Please try again.", role);
      }
      setClientLoginActivityPending(cookieStore);
    }
  }

  if (isPrivilegedRole) {
    cookieStore.delete("lda_remember_identifier");
    cookieStore.delete("lda_remembered_device_id");
    cookieStore.delete("lda_remembered_device_name");
  } else if (rememberMe) {
    const rememberedIdentifier = identifier.includes("@") ? identifier.toLowerCase() : normalizePhone(identifier);
    cookieStore.set("lda_remember_identifier", rememberedIdentifier, {
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production"
    });
  } else {
    cookieStore.delete("lda_remember_identifier");
  }

  if (user && (role === "learner" || role === "instructor")) {
    const termsStatus = await getCurrentTermsStatus(supabase, user.id);

    if (!termsStatus.accepted) {
      revalidatePath("/", "layout");
      redirect(`/terms/update?next=${encodeURIComponent(nextPath)}`);
    }
  }

  revalidatePath("/", "layout");
  redirect(nextPath);
}

export async function signUp(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const accountIntent = String(formData.get("accountIntent") ?? "learner");
  const role = safeRole(formData.get("accountIntent"));
  const requestedNextPath = safeNextPath(formData.get("next") ?? dashboardPathForRole(role));
  const nextPath = `/auth/verify?role=${role}&next=${encodeURIComponent(requestedNextPath)}`;
  const termsAccepted = formData.get("termsAccepted") === "on";

  if (accountIntent === "admin") {
    signUpRedirect("Admin accounts must be created manually by the site owner.", role);
  }

  if (!email || !email.includes("@")) {
    signUpRedirect("Enter a valid email address to create your account.", role);
  }

  blockAdminEmailFromMarketplace(email);

  if (password.length < 8) {
    signUpRedirect("Use a password with at least 8 characters.", role);
  }

  if (!termsAccepted) {
    signUpRedirect("Accept the LDA Terms of Use, including live location and tracking terms, before creating your account.", role);
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
    signUpRedirect("Secure email sign-up is temporarily unavailable. Please try again later.", role);
  }

  if (!adminClient) {
    signUpRedirect("Secure email sign-up is temporarily unavailable. Please try again later.", role);
  }

  try {
    await ensureEmailCanUseRole(adminClient, email, role);
  } catch (error) {
    signUpRedirect(error instanceof Error ? error.message : "This email is already linked to another LDA account type.", role);
  }

  const appOrigin = getSafeAppOrigin();
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
    signUpRedirect("LDA could not start email verification. Please try again later.", role);
  }

  let { data, error } = await adminClient.auth.admin.generateLink({
    type: "signup",
    options: {
      redirectTo: redirectTo.toString(),
      data: {
        account_intent: accountIntent
      }
    },
    email,
    password
  });

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
    signUpRedirect("LDA could not send the secure email confirmation. Please try again later.", role);
  }

  await setHandoffCookie(handoffId, handoffSecret);
  revalidatePath("/", "layout");
  redirect(`/auth/check-email?email=${encodeURIComponent(email)}&role=${role}&request=${handoffId}`);
}

export async function updatePassword(formData: FormData) {
  const role = safePasswordResetRole(formData.get("role"));
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
    authError("Secure account access is temporarily unavailable. Please try again later.");
  }

  if (!identifier) {
    updateUrl("Enter the email linked to your account first.");
  }

  if (role !== "admin" && isDirectorAdminEmail(identifier)) {
    await signOutLocalSession(supabase);
    adminPortalRedirect();
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

  if (role === "admin") {
    await signOutLocalSession(supabase);
  }

  revalidatePath("/", "layout");
  if (role === "admin") {
    redirect(`/admin-access?identifier=${encodeURIComponent(identifier)}&message=${encodeURIComponent("Password changed. Sign in with your new password, then complete authenticator verification.")}`);
  }

  const params = new URLSearchParams({
    role,
    message: "Password changed. Log in with your new password."
  });
  params.set("identifier", identifier);
  redirect(`/auth/login?${params.toString()}`);
}

export async function signOut() {
  const cookieStore = await cookies();
  const supabase = await createClient();
  const result = await secureSignOut({
    supabase,
    cookieStore,
    headers: await headers(),
    reason: "manual_sign_out"
  });

  if (result.role === "admin") {
    const value = createAdminEntryCookieValue();
    if (value) {
      cookieStore.set(adminEntryCookieName, value, adminEntryCookieOptions());
    }
  }

  if (result.role === "support") {
    const value = createTechnicalSupportEntryCookieValue();
    if (value) {
      cookieStore.set(technicalSupportEntryCookieName, value, technicalSupportEntryCookieOptions());
    }
  }

  revalidatePath("/", "layout");
  redirect(result.redirectTo);
}
