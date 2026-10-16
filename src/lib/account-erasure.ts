import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { accountDeletionDeletes, accountDeletionResponseWindow, accountDeletionRetains } from "@/lib/account-deletion-policy";
import { sendAccountDeletionRecoveredEmail, sendAccountDeletionScheduledEmail, sendSubscriptionCancellationEmail } from "@/lib/email";
import { getInstructorPackage, type InstructorPackageId } from "@/lib/instructor-packages";
import { getLearnerPackage, type LearnerPackageId } from "@/lib/learner-packages";
import { getStripeSecretKey } from "@/lib/stripe-env";
import { cancelStripeSubscription } from "@/lib/stripe-subscription-updates";
import { createAdminClient } from "@/lib/supabase/admin";

type SupabaseAdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

type DeletionStepResult = { error?: { message?: string } | null } | void;

export type AccountErasureResult = {
  anonymisedEmail: string;
  deleted: readonly string[];
  retained: readonly string[];
  responseWindow: string;
  warnings: string[];
};

export type AccountDeletionScheduleResult = {
  email: string;
  recoveryExpiresAt: string;
  warnings: string[];
};

type DeletionRecoveryPayload = {
  userId: string;
  expiresAt: string;
  nonce: string;
};

type RecoverableProfile = {
  full_name?: string | null;
  email?: string | null;
};

type DeletionSubscriptionProfile = {
  packageId?: string | null;
  customerId?: string | null;
  subscriptionId?: string | null;
};

async function runErasureStep(step: string, task: () => PromiseLike<DeletionStepResult> | DeletionStepResult) {
  const result = await task();
  const error = result && "error" in result ? result.error : null;

  if (error) {
    console.warn("[account.erasure] step failed", { step, message: error.message });
    return `${step}: ${error.message ?? "failed"}`;
  }

  return null;
}

function getErasureSubjectHash(userId: string) {
  return createHash("sha256").update(`lda-account-erasure:${userId}`).digest("hex");
}

function getAnonymisedEmail(userId: string) {
  return `deleted-${userId}@deleted.lda.invalid`;
}

function getDeletionSigningSecret() {
  return process.env.ACCOUNT_DELETION_RECOVERY_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? null;
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signDeletionPayload(encodedPayload: string, secret: string) {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function createAccountDeletionRecoveryToken(userId: string, expiresAt: string) {
  const secret = getDeletionSigningSecret();
  if (!secret) return null;

  const payload: DeletionRecoveryPayload = {
    userId,
    expiresAt,
    nonce: randomBytes(18).toString("base64url")
  };
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  return `${encodedPayload}.${signDeletionPayload(encodedPayload, secret)}`;
}

export function readAccountDeletionRecoveryToken(token: string | null | undefined) {
  const secret = getDeletionSigningSecret();
  if (!secret || !token) return null;

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  const expectedSignature = signDeletionPayload(encodedPayload, secret);
  if (!safeEqual(signature, expectedSignature)) return null;

  try {
    const payload = JSON.parse(decodeBase64Url(encodedPayload)) as Partial<DeletionRecoveryPayload>;
    if (!payload.userId || !payload.expiresAt || !payload.nonce) return null;
    const expiresAt = new Date(payload.expiresAt);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) return null;
    return payload as DeletionRecoveryPayload;
  } catch {
    return null;
  }
}

function getRecoveryUrl(origin: string, token: string) {
  const url = new URL("/account/recover-deleted", origin);
  url.searchParams.set("token", token);
  return url.toString();
}

function isPaidLearnerPackage(packageId?: string | null): packageId is Exclude<LearnerPackageId, "learner"> {
  return packageId === "learner-plus" || packageId === "learner-pro";
}

function isPaidInstructorPackage(packageId?: string | null): packageId is Exclude<InstructorPackageId, "instructor"> {
  return packageId === "instructor-plus" || packageId === "instructor-pro";
}

async function cancelDeletionSubscription({
  admin,
  userId,
  email,
  role,
  profile
}: {
  admin: SupabaseAdminClient;
  userId: string;
  email: string;
  role: "learner" | "instructor";
  profile: DeletionSubscriptionProfile | null | undefined;
}) {
  const packageId = profile?.packageId;
  const subscriptionId = profile?.subscriptionId;
  const customerId = profile?.customerId ?? null;
  const isPaidPackage = role === "learner" ? isPaidLearnerPackage(packageId) : isPaidInstructorPackage(packageId);

  if (!isPaidPackage && !subscriptionId) {
    return null;
  }

  if (!subscriptionId) {
    const now = new Date().toISOString();
    if (role === "learner") {
      const { error } = await admin
        .from("learner_profiles")
        .update({
          learner_package: "learner",
          learner_subscription_status: "cancelled",
          learner_package_started_at: null,
          learner_package_expires_at: null,
          learner_plus_active: false,
          learner_plus_started_at: null,
          learner_plus_expires_at: null,
          learner_plus_source: "account_deletion",
          stripe_subscription_id: null,
          updated_at: now
        })
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await admin
        .from("instructor_profiles")
        .update({
          instructor_package: "instructor",
          instructor_subscription_status: "cancelled",
          instructor_package_started_at: null,
          instructor_package_expires_at: null,
          instructor_package_source: "account_deletion",
          stripe_subscription_id: null,
          updated_at: now
        })
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
    }
    return `${role} subscription: paid package had no Stripe subscription id; local package was downgraded only.`;
  }

  const stripeSecret = getStripeSecretKey();
  if (!stripeSecret.value) {
    throw new Error(`LDA could not cancel the ${role} subscription before account deletion because Stripe is not configured.`);
  }

  const subscription = await cancelStripeSubscription(stripeSecret.value, subscriptionId);
  const now = new Date().toISOString();

  if (role === "learner") {
    const { error } = await admin
      .from("learner_profiles")
      .update({
        learner_package: "learner",
        learner_subscription_status: subscription.status,
        learner_package_started_at: null,
        learner_package_expires_at: subscription.currentPeriodEnd,
        learner_plus_active: false,
        learner_plus_started_at: null,
        learner_plus_expires_at: subscription.currentPeriodEnd,
        learner_plus_source: "account_deletion",
        stripe_customer_id: customerId,
        stripe_subscription_id: null,
        updated_at: now
      })
      .eq("user_id", userId);
    if (error) throw new Error(error.message);

    await sendSubscriptionCancellationEmail({
      to: email,
      role: "learner",
      previousPackageName: getLearnerPackage(packageId ?? "")?.name,
      freePackageName: "Learner",
      dashboardUrl: `${process.env.APP_WEBSITE_URL ?? "https://ldrivingacademy.co.uk"}/auth/login`,
      idempotencyKey: `account-deletion-subscription-cancellation-${subscription.id}-learner`
    });
    return null;
  }

  const { error } = await admin
    .from("instructor_profiles")
    .update({
      instructor_package: "instructor",
      instructor_subscription_status: subscription.status,
      instructor_package_started_at: null,
      instructor_package_expires_at: subscription.currentPeriodEnd,
      instructor_package_source: "account_deletion",
      stripe_customer_id: customerId,
      stripe_subscription_id: null,
      updated_at: now
    })
    .eq("user_id", userId);
  if (error) throw new Error(error.message);

  await sendSubscriptionCancellationEmail({
    to: email,
    role: "instructor",
    previousPackageName: getInstructorPackage(packageId ?? "")?.name,
    freePackageName: "Instructor",
    dashboardUrl: `${process.env.APP_WEBSITE_URL ?? "https://ldrivingacademy.co.uk"}/auth/login`,
    idempotencyKey: `account-deletion-subscription-cancellation-${subscription.id}-instructor`
  });
  return null;
}

async function clearAccountDeletionAuthBan({
  admin,
  userId,
  metadata
}: {
  admin: SupabaseAdminClient;
  userId: string;
  metadata: Record<string, unknown>;
}) {
  const nextMetadata = {
    ...metadata,
    account_deletion_scheduled: false,
    account_deletion_recovered_at: new Date().toISOString(),
    account_deletion_requested_at: null,
    account_deletion_recovery_expires_at: null
  };
  const result = await admin.auth.admin.updateUserById(userId, {
    ban_duration: "none",
    user_metadata: nextMetadata
  } as Parameters<typeof admin.auth.admin.updateUserById>[1]);

  if (result.error) {
    return { ok: false as const, message: result.error.message };
  }

  const bannedUntil = result.data.user?.banned_until ? new Date(result.data.user.banned_until).getTime() : 0;
  if (Number.isFinite(bannedUntil) && bannedUntil > Date.now()) {
    return { ok: false as const, message: "Supabase did not clear the account ban. Contact LDA support before signing in." };
  }

  return { ok: true as const };
}

export async function scheduleAccountDeletionWithRecovery({
  admin,
  userId,
  origin
}: {
  admin: SupabaseAdminClient;
  userId: string;
  origin: string;
}): Promise<AccountDeletionScheduleResult> {
  const now = new Date();
  const recoveryExpiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const warnings: string[] = [];
  const token = createAccountDeletionRecoveryToken(userId, recoveryExpiresAt);

  if (!token) {
    throw new Error("Account deletion recovery signing is not configured.");
  }

  const [{ data: profile }, { data: learnerProfile }, { data: instructorProfile }, { data: authUser }] = await Promise.all([
    admin.from("profiles").select("full_name,email").eq("id", userId).maybeSingle(),
    admin
      .from("learner_profiles")
      .select("learner_package,stripe_customer_id,stripe_subscription_id")
      .eq("user_id", userId)
      .maybeSingle(),
    admin
      .from("instructor_profiles")
      .select("instructor_package,stripe_customer_id,stripe_subscription_id,learner_availability_paused,learner_availability_pause_reason")
      .eq("user_id", userId)
      .maybeSingle(),
    admin.auth.admin.getUserById(userId)
  ]);
  const email = typeof profile?.email === "string" ? profile.email : "";

  if (!email || email.endsWith("@deleted.lda.invalid")) {
    throw new Error("This account does not have a recoverable email address.");
  }

  const existingMetadata = (authUser?.user?.user_metadata ?? {}) as Record<string, unknown>;
  const metadata = {
    ...existingMetadata,
    account_deletion_scheduled: true,
    account_deletion_requested_at: now.toISOString(),
    account_deletion_recovery_expires_at: recoveryExpiresAt,
    account_deletion_previous_availability_paused: Boolean(instructorProfile?.learner_availability_paused),
    account_deletion_previous_availability_pause_reason: instructorProfile?.learner_availability_pause_reason ?? null
  };

  const subscriptionWarnings = (
    await Promise.all([
      cancelDeletionSubscription({
        admin,
        userId,
        email,
        role: "learner",
        profile: learnerProfile
          ? {
              packageId: learnerProfile.learner_package,
              customerId: learnerProfile.stripe_customer_id,
              subscriptionId: learnerProfile.stripe_subscription_id
            }
          : null
      }),
      cancelDeletionSubscription({
        admin,
        userId,
        email,
        role: "instructor",
        profile: instructorProfile
          ? {
              packageId: instructorProfile.instructor_package,
              customerId: instructorProfile.stripe_customer_id,
              subscriptionId: instructorProfile.stripe_subscription_id
            }
          : null
      })
    ])
  ).filter((warning): warning is string => Boolean(warning));
  warnings.push(...subscriptionWarnings);

  const steps = [
    runErasureStep("Mark profile pending deletion", () =>
      admin
        .from("profiles")
        .update({
          deleted_at: now.toISOString(),
          marketing_opt_in: false,
          updated_at: now.toISOString()
        })
        .eq("id", userId)
    ),
    runErasureStep("Delete active in-app notifications", () => admin.from("notifications").delete().eq("user_id", userId)),
    runErasureStep("Delete active live location shares", () =>
      admin.from("location_shares").delete().or(`learner_id.eq.${userId},instructor_id.eq.${userId}`)
    ),
    runErasureStep("Delete instructor working-day live locations", () =>
      admin.from("instructor_live_locations").delete().eq("instructor_id", userId)
    ),
    runErasureStep("Hide instructor learner-facing availability", () =>
      admin
        .from("instructor_profiles")
        .update({
          learner_availability_paused: true,
          learner_availability_pause_reason: "Account deletion requested. Reactivation required before learner-facing availability returns.",
          updated_at: now.toISOString()
        })
        .eq("user_id", userId)
    ),
    runErasureStep("Deactivate authentication during recovery window", () =>
      admin.auth.admin.updateUserById(userId, {
        ban_duration: "720h",
        user_metadata: metadata
      } as Parameters<typeof admin.auth.admin.updateUserById>[1])
    )
  ];
  const settledWarnings = (await Promise.all(steps)).filter((failure): failure is string => Boolean(failure));
  warnings.push(...settledWarnings);

  await sendAccountDeletionScheduledEmail({
    to: email,
    fullName: typeof profile?.full_name === "string" ? profile.full_name : undefined,
    recoveryUrl: getRecoveryUrl(origin, token),
    expiresAt: recoveryExpiresAt
  });

  return {
    email,
    recoveryExpiresAt,
    warnings
  };
}

export async function recoverScheduledAccountDeletion({
  admin,
  token,
  origin
}: {
  admin: SupabaseAdminClient;
  token: string | null | undefined;
  origin?: string;
}) {
  const payload = readAccountDeletionRecoveryToken(token);
  if (!payload) {
    return { ok: false as const, message: "This account restart link is invalid or has expired." };
  }

  const { data: authUser, error: authLookupError } = await admin.auth.admin.getUserById(payload.userId);
  if (authLookupError || !authUser.user) {
    return { ok: false as const, message: "This account could not be found." };
  }

  const metadata = (authUser.user.user_metadata ?? {}) as Record<string, unknown>;
  const expiresAt = typeof metadata.account_deletion_recovery_expires_at === "string" ? metadata.account_deletion_recovery_expires_at : payload.expiresAt;
  if (new Date(expiresAt).getTime() < Date.now()) {
    return { ok: false as const, message: "This account restart window has expired." };
  }

  const previousPaused = Boolean(metadata.account_deletion_previous_availability_paused);
  const previousReason =
    typeof metadata.account_deletion_previous_availability_pause_reason === "string"
      ? metadata.account_deletion_previous_availability_pause_reason
      : null;
  const { data: profile } = await admin.from("profiles").select("full_name,email").eq("id", payload.userId).maybeSingle<RecoverableProfile>();
  const recoveryEmail = typeof profile?.email === "string" ? profile.email : authUser.user.email ?? "";
  const recoveryName = typeof profile?.full_name === "string" ? profile.full_name : undefined;

  const [profileRestore, instructorRestore] = await Promise.all([
    admin.from("profiles").update({ deleted_at: null, updated_at: new Date().toISOString() }).eq("id", payload.userId),
    admin
      .from("instructor_profiles")
      .update({
        learner_availability_paused: previousPaused,
        learner_availability_pause_reason: previousReason,
        updated_at: new Date().toISOString()
      })
      .eq("user_id", payload.userId)
  ]);
  if (profileRestore.error) {
    return { ok: false as const, message: "LDA could not restart this account profile. Contact LDA support." };
  }
  if (instructorRestore.error) {
    console.warn("[account.erasure] instructor availability restore failed", {
      userId: payload.userId,
      message: instructorRestore.error.message
    });
  }

  const authRestore = await clearAccountDeletionAuthBan({ admin, userId: payload.userId, metadata });
  if (!authRestore.ok) {
    return { ok: false as const, message: authRestore.message };
  }

  if (recoveryEmail && !recoveryEmail.endsWith("@deleted.lda.invalid")) {
    try {
      await sendAccountDeletionRecoveredEmail({
        to: recoveryEmail,
        fullName: recoveryName,
        signInUrl: origin ? new URL("/auth/login", origin).toString() : undefined,
        idempotencyKey: `account-recovered:${payload.userId}:${expiresAt}`
      });
    } catch (error) {
      console.warn("[account.erasure] recovery email failed", {
        userId: payload.userId,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return { ok: true as const, message: "Your LDA account has been restarted. You can sign in again." };
}

export async function permanentlyEraseExpiredDeletionAccounts({
  admin,
  limit = 100
}: {
  admin: SupabaseAdminClient;
  limit?: number;
}) {
  const erased: string[] = [];
  const warnings: string[] = [];
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: limit });

  if (error) {
    throw new Error(error.message);
  }

  for (const user of data.users) {
    const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
    const scheduled = metadata.account_deletion_scheduled === true;
    const expiresAt = typeof metadata.account_deletion_recovery_expires_at === "string" ? metadata.account_deletion_recovery_expires_at : null;

    if (!scheduled || !expiresAt || new Date(expiresAt).getTime() > Date.now()) {
      continue;
    }

    const result = await eraseAccountPersonalData({ admin, userId: user.id, requestedBy: "self_service" });
    erased.push(user.id);
    warnings.push(...result.warnings);
  }

  return { erased, warnings };
}

/**
 * Permanently removes or anonymises account-linked personal data from live LDA systems.
 *
 * Deleted/anonymised: profile identifiers, learner eligibility details, instructor identity
 * and verification details, live locations, notifications, future availability, uploaded
 * verification documents, written progress notes, pickup location details, reviews, roles,
 * and active authentication identifiers.
 *
 * Retained: booking/payment ledgers, Stripe references, timestamps, dispute/refund evidence,
 * fraud-prevention signals, and a pseudonymous erasure audit hash where necessary for tax,
 * regulatory, legal-claims, chargeback, or platform-abuse obligations. These retained rows
 * must not expose the user's name, email, phone, document files, postcode, live location, or
 * other direct identifiers once this function completes.
 */
export async function eraseAccountPersonalData({
  admin,
  userId,
  requestedBy = "self_service"
}: {
  admin: SupabaseAdminClient;
  userId: string;
  requestedBy?: "self_service" | "admin";
}): Promise<AccountErasureResult> {
  const now = new Date().toISOString();
  const anonymisedEmail = getAnonymisedEmail(userId);
  const subjectHash = getErasureSubjectHash(userId);
  const warnings: string[] = [];

  const { data: profile } = await admin
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle();
  const accountEmail = typeof profile?.email === "string" ? profile.email : null;

  const { data: documents } = await admin
    .from("instructor_documents")
    .select("storage_path")
    .or(`instructor_id.eq.${userId},uploaded_by.eq.${userId}`);
  const storagePaths = (documents ?? [])
    .map((document) => document.storage_path)
    .filter((path): path is string => Boolean(path));

  if (storagePaths.length) {
    const storageFailure = await runErasureStep("Delete instructor verification files", () =>
      admin.storage.from("instructor-documents").remove(storagePaths)
    );
    if (storageFailure) warnings.push(storageFailure);
  }

  const steps = [
    runErasureStep("Record non-identifying erasure audit", () =>
      admin
        .from("account_erasure_events")
        .upsert(
          {
            subject_hash: subjectHash,
            requested_by: requestedBy,
            deleted_categories: accountDeletionDeletes,
            retained_categories: accountDeletionRetains,
            processed_at: now
          },
          { onConflict: "subject_hash" }
        )
    ),
    runErasureStep("Delete cross-device auth handoff rows by user", () =>
      admin.from("auth_handoff_requests").delete().eq("verified_user_id", userId)
    ),
    accountEmail
      ? runErasureStep("Delete cross-device auth handoff rows by email", () =>
          admin.from("auth_handoff_requests").delete().eq("email", accountEmail)
        )
      : null,
    runErasureStep("Delete in-app notifications", () => admin.from("notifications").delete().eq("user_id", userId)),
    runErasureStep("Delete live location shares", () =>
      admin.from("location_shares").delete().or(`learner_id.eq.${userId},instructor_id.eq.${userId}`)
    ),
    runErasureStep("Delete instructor working-day live locations", () =>
      admin.from("instructor_live_locations").delete().eq("instructor_id", userId)
    ),
    runErasureStep("Delete future availability slots", () => admin.from("availability_slots").delete().eq("instructor_id", userId)),
    runErasureStep("Delete instructor document rows", () =>
      admin.from("instructor_documents").delete().or(`instructor_id.eq.${userId},uploaded_by.eq.${userId}`)
    ),
    runErasureStep("Anonymise learner progress records", () =>
      admin
        .from("lesson_progress_records")
        .update({
          learner_name: "Deleted learner",
          learner_email: anonymisedEmail,
          instructor_name: "Deleted instructor",
          completed_skills: [],
          instructor_notes: "[Deleted after account erasure request]",
          next_lesson_focus: "[Deleted after account erasure request]",
          recommended_videos: ""
        })
        .or(`learner_id.eq.${userId},instructor_id.eq.${userId}`)
    ),
    runErasureStep("Strip account transfer request identifiers", () =>
      admin
        .from("account_role_transfer_requests")
        .update({
          full_licence_held_since: null,
          adi_pdi_number: null,
          notes: null,
          decision_note: null,
          status: "cancelled",
          updated_at: now
        })
        .eq("user_id", userId)
    ),
    runErasureStep("Strip booking pickup details", () =>
      admin
        .from("bookings")
        .update({
          pickup_postcode: "Deleted",
          pickup_latitude: null,
          pickup_longitude: null,
          cancellation_reason: null,
          updated_at: now
        })
        .or(`learner_id.eq.${userId},instructor_id.eq.${userId}`)
    ),
    runErasureStep("Strip written reviews", () =>
      admin.from("reviews").update({ comment: null }).or(`learner_id.eq.${userId},instructor_id.eq.${userId}`)
    ),
    runErasureStep("Delete learner profile details", () => admin.from("learner_profiles").delete().eq("user_id", userId)),
    runErasureStep("Anonymise instructor profile details", () =>
      admin
        .from("instructor_profiles")
        .update({
          display_name: "Deleted instructor",
          bio: null,
          adi_pdi_number: null,
          verification_status: "draft",
          rejection_reason: null,
          hourly_rate_pence: null,
          car_make: null,
          car_model: null,
          car_registration: null,
          areas_covered: [],
          base_postcode: null,
          latitude: null,
          longitude: null,
          auto_accept_bookings: false,
          stripe_account_id: null,
          approved_at: null,
          instructor_package: "instructor",
          instructor_subscription_status: null,
          instructor_package_started_at: null,
          instructor_package_expires_at: null,
          instructor_package_source: null,
          stripe_customer_id: null,
          stripe_subscription_id: null,
          compliance_status: "blocked",
          learner_availability_paused: true,
          learner_availability_pause_reason: "Account deleted after user erasure request.",
          compliance_reviewed_at: now,
          compliance_blocked_at: now,
          updated_at: now
        })
        .eq("user_id", userId)
    ),
    runErasureStep("Remove account roles", () => admin.from("account_roles").delete().eq("user_id", userId)),
    runErasureStep("Anonymise profile", () =>
      admin
        .from("profiles")
        .update({
          full_name: "Deleted LDA account",
          email: anonymisedEmail,
          phone: null,
          avatar_url: null,
          marketing_opt_in: false,
          deleted_at: now,
          updated_at: now
        })
        .eq("id", userId)
    ),
    runErasureStep("Disable authentication identity", () =>
      admin.auth.admin.updateUserById(userId, {
        email: anonymisedEmail,
        phone: undefined,
        ban_duration: "876000h",
        user_metadata: {
          account_deleted_at: now,
          account_deleted_by: requestedBy,
          account_erasure_subject_hash: subjectHash,
          deletion_policy_deleted: accountDeletionDeletes,
          deletion_policy_retained: accountDeletionRetains,
          deletion_response_window: accountDeletionResponseWindow
        }
      } as Parameters<typeof admin.auth.admin.updateUserById>[1])
    )
  ];

  const settledWarnings = (await Promise.all(steps)).filter((failure): failure is string => Boolean(failure));
  warnings.push(...settledWarnings);

  if (warnings.length) {
    console.warn("[account.erasure] completed with warnings", { subjectHash, warnings });
  }

  return {
    anonymisedEmail,
    deleted: accountDeletionDeletes,
    retained: accountDeletionRetains,
    responseWindow: accountDeletionResponseWindow,
    warnings
  };
}
