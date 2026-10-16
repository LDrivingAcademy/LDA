"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminDashboardClient } from "@/lib/admin-dashboard";
import { sendAdminNoticeEmail } from "@/lib/email";
import { getLearnerPackage } from "@/lib/learner-packages";
import { createStripePromotionCode } from "@/lib/stripe-promotion-codes";
import { createAdminClient } from "@/lib/supabase/admin";

type LearnerPackageId = "learner" | "learner-plus" | "learner-pro";

const learnerPackages = new Set<LearnerPackageId>(["learner", "learner-plus", "learner-pro"]);

function adminLearnersRedirect(message: string): never {
  redirect(`/admin/learners?message=${encodeURIComponent(message)}`);
}

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function getInteger(formData: FormData, key: string, fallback: number, min: number, max: number) {
  const value = Number(getString(formData, key) || fallback);
  if (!Number.isInteger(value) || value < min || value > max) {
    return fallback;
  }

  return value;
}

function getMoneyPence(formData: FormData, key: string, fallbackPence: number) {
  const value = Number(getString(formData, key) || fallbackPence / 100);
  if (!Number.isFinite(value) || value < 1 || value > 1000) {
    return fallbackPence;
  }

  return Math.round(value * 100);
}

function getAppUrl() {
  return process.env.APP_WEBSITE_URL ?? "https://ldrivingacademy.co.uk";
}

function getPackageName(packageId: LearnerPackageId) {
  return getLearnerPackage(packageId)?.name ?? packageId;
}

function getPackageFeatureLines(packageId: LearnerPackageId) {
  const learnerPackage = getLearnerPackage(packageId);
  const features = learnerPackage?.features ?? [];

  if (!features.length) {
    return "Your learner dashboard permissions have been updated to match this tier.";
  }

  return features.slice(0, 5).map((feature) => `- ${feature}`).join("\n");
}

function buildTierGrantNotice(packageId: LearnerPackageId, expiresAt: string | null) {
  const packageName = getPackageName(packageId);
  const learnerPackage = getLearnerPackage(packageId);
  const expiryLine = expiresAt
    ? `This admin-granted access is currently valid until ${new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "Europe/London" }).format(new Date(expiresAt))}.`
    : "Your account is now on the standard Learner tier.";

  if (packageId === "learner") {
    return {
      subject: "Your LDA learner tier has changed",
      title: "Your learner tier has been updated",
      notificationTitle: "Your LDA learner tier has changed",
      body: [
        "Your LDA learner account has been moved to the Learner tier.",
        "",
        "You still have core access to search approved instructors, book lessons, manage bookings, and use standard learner tools.",
        "",
        expiryLine
      ].join("\n")
    };
  }

  return {
    subject: `Congratulations, ${packageName} is active`,
    title: `Congratulations, ${packageName} is active`,
    notificationTitle: `${packageName} is now active`,
    body: [
      `Congratulations, LDA has given your learner account ${packageName}.`,
      "",
      learnerPackage?.summary ?? "Your learner account permissions have been upgraded.",
      "",
      "Your new features include:",
      getPackageFeatureLines(packageId),
      "",
      expiryLine,
      "",
      `Open your learner dashboard to use your updated ${packageName} permissions.`
    ].join("\n")
  };
}

function revalidateLearnerAdminChange() {
  revalidatePath("/admin/learners");
  revalidatePath("/learner-dashboard");
  revalidatePath("/dashboard");
  revalidatePath("/learner-plus");
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}

function requireLearnerId(formData: FormData) {
  const learnerId = getString(formData, "learnerId");
  if (!/^[0-9a-f-]{36}$/i.test(learnerId)) {
    adminLearnersRedirect("Learner account was not recognised.");
  }
  return learnerId;
}

function getBanDuration(value: string) {
  switch (value) {
    case "2-months":
      return "1460h";
    case "1-year":
      return "8760h";
    case "indefinite":
      return "876000h";
    default:
      return "168h";
  }
}

async function getLearnerProfile(learnerId: string) {
  const { supabase } = await requireAdminDashboardClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id,full_name,email,phone,marketing_opt_in")
    .eq("id", learnerId)
    .maybeSingle();

  if (error) {
    adminLearnersRedirect(error.message);
  }

  if (!data) {
    adminLearnersRedirect("Learner profile was not found.");
  }

  return { supabase, profile: data };
}

async function hasFollowLdaConsent(
  supabase: NonNullable<Awaited<ReturnType<typeof requireAdminDashboardClient>>["supabase"]>,
  email?: string | null
) {
  if (!email) {
    return false;
  }

  const { data, error } = await supabase
    .from("marketing_subscribers")
    .select("email")
    .eq("email", email.trim().toLowerCase())
    .is("unsubscribed_at", null)
    .maybeSingle();

  if (error) {
    adminLearnersRedirect(error.message);
  }

  return Boolean(data);
}

async function createLearnerNotification(
  supabase: NonNullable<Awaited<ReturnType<typeof requireAdminDashboardClient>>["supabase"]>,
  learnerId: string,
  notificationType: string,
  title: string,
  body: string
) {
  const { error } = await supabase.from("notifications").insert({
    user_id: learnerId,
    notification_type: notificationType,
    title,
    body
  });

  if (error) {
    adminLearnersRedirect(error.message);
  }
}

async function maybeCreatePromotionCode(formData: FormData, name: string, fallbackMaxRedemptions: number | null) {
  if (formData.get("generateStripePromo") !== "on") {
    return null;
  }

  const discountType = getString(formData, "promoDiscountType") === "amount" ? "amount" : "percent";
  const validDays = getInteger(formData, "promoValidDays", 30, 1, 365);
  const requestedMaxRedemptions = getInteger(formData, "promoMaxRedemptions", fallbackMaxRedemptions ?? 1, 1, 100000);
  const maxRedemptions = formData.get("promoNoRedemptionLimit") === "on" ? null : requestedMaxRedemptions;
  const promotion = await createStripePromotionCode({
    amountOffPence: getMoneyPence(formData, "promoAmountOffPounds", 500),
    code: getString(formData, "promoCode"),
    discountType,
    duration: getString(formData, "promoDuration") === "forever" ? "forever" : "once",
    maxRedemptions,
    name,
    percentOff: getInteger(formData, "promoPercentOff", 10, 1, 95),
    validDays
  });

  const expiresLine = promotion.expiresAt
    ? `Valid until ${new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "Europe/London" }).format(new Date(promotion.expiresAt))}.`
    : "No fixed expiry date.";
  const limitLine = maxRedemptions ? `Limited to ${maxRedemptions} redemption${maxRedemptions === 1 ? "" : "s"}.` : "No fixed redemption limit.";

  return {
    ...promotion,
    message: `Use promo code ${promotion.code} at Stripe checkout. ${expiresLine} ${limitLine}`
  };
}

export async function upgradeLearnerTierAction(formData: FormData) {
  const learnerId = requireLearnerId(formData);
  const nextPackage = getString(formData, "package") as LearnerPackageId;

  if (!learnerPackages.has(nextPackage)) {
    adminLearnersRedirect("Choose a valid learner tier.");
  }

  const { supabase, profile } = await getLearnerProfile(learnerId);
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  const isPaidTier = nextPackage !== "learner";
  const packageExpiresAt = isPaidTier ? expiresAt : null;
  const notice = buildTierGrantNotice(nextPackage, packageExpiresAt);

  const { error } = await supabase.from("learner_profiles").upsert({
    user_id: learnerId,
    learner_package: nextPackage,
    learner_subscription_status: "admin_granted",
    learner_package_started_at: isPaidTier ? now : null,
    learner_package_expires_at: packageExpiresAt,
    learner_plus_active: isPaidTier,
    learner_plus_started_at: isPaidTier ? now : null,
    learner_plus_expires_at: isPaidTier ? expiresAt : null,
    learner_plus_source: isPaidTier ? "admin_grant" : null
  }, { onConflict: "user_id" });

  if (error) {
    adminLearnersRedirect(error.message);
  }

  await createLearnerNotification(
    supabase,
    learnerId,
    "admin_tier_update",
    notice.notificationTitle,
    notice.body
  );

  if (profile.email) {
    await sendAdminNoticeEmail({
      to: profile.email,
      subject: notice.subject,
      title: notice.title,
      body: notice.body
    });
  }

  revalidateLearnerAdminChange();
  adminLearnersRedirect(`${profile.full_name || profile.email || "Learner"} was updated to ${getPackageName(nextPackage)}.`);
}

export async function sendLearnerPromoAction(formData: FormData) {
  const learnerId = requireLearnerId(formData);
  const subject = getString(formData, "subject") || "LDA learner offer";
  const body = getString(formData, "body") || "A selected L Driving Academy offer is available on your learner account.";
  const { supabase, profile } = await getLearnerProfile(learnerId);
  const hasMarketingConsent = Boolean(profile.marketing_opt_in) || await hasFollowLdaConsent(supabase, profile.email);

  if (!hasMarketingConsent) {
    adminLearnersRedirect("Promo was blocked because that learner has not consented to marketing or Follow LDA emails.");
  }

  let promoBody = body;

  try {
    const promotion = await maybeCreatePromotionCode(formData, subject, 1);
    if (promotion) {
      promoBody = `${body}\n\n${promotion.message}`;
    }
  } catch (error) {
    adminLearnersRedirect(error instanceof Error ? error.message : "Stripe promotion code could not be created.");
  }

  await createLearnerNotification(supabase, learnerId, "admin_promo", subject, promoBody);

  if (profile.email) {
    await sendAdminNoticeEmail({ to: profile.email, subject, title: subject, body: promoBody });
  }

  revalidateLearnerAdminChange();
  adminLearnersRedirect(`Promo sent to ${profile.full_name || profile.email || "learner"}.`);
}

export async function sendLearnerWarningAction(formData: FormData) {
  const learnerId = requireLearnerId(formData);
  const subject = getString(formData, "subject") || "Important update about your LDA account";
  const body = getString(formData, "body") || "Following a review of recent account activity, we have identified booking, cancellation, refund, or account-use patterns that may not meet LDA platform standards. Please review your recent activity and ensure future bookings, cancellations, and refund requests are made in line with LDA policy. Continued activity outside these standards may result in temporary account restrictions or suspension of learner booking access.";
  const { supabase, profile } = await getLearnerProfile(learnerId);

  await createLearnerNotification(supabase, learnerId, "admin_warning", subject, body);

  if (profile.email) {
    await sendAdminNoticeEmail({ to: profile.email, subject, title: subject, body });
  }

  revalidateLearnerAdminChange();
  adminLearnersRedirect(`Warning sent to ${profile.full_name || profile.email || "learner"}.`);
}

export async function sendLearnerCampaignAction(formData: FormData) {
  const learnerIds = getString(formData, "learnerIds").split(",").filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  const subject = getString(formData, "subject") || "LDA learner update";
  const body = getString(formData, "body") || "A new L Driving Academy learner update is available.";
  const { supabase } = await requireAdminDashboardClient();

  const { data: subscribers, error: subscriberError } = await supabase
    .from("marketing_subscribers")
    .select("email")
    .is("unsubscribed_at", null);

  if (subscriberError) {
    adminLearnersRedirect(subscriberError.message);
  }

  const subscriberEmails = Array.from(new Set((subscribers ?? []).map((subscriber) => String(subscriber.email ?? "").trim().toLowerCase()).filter(Boolean)));

  if (!learnerIds.length && !subscriberEmails.length) {
    adminLearnersRedirect("No consented learners or Follow LDA subscribers are available for that campaign.");
  }

  const { data: profiles, error } = learnerIds.length
    ? await supabase
        .from("profiles")
        .select("id,full_name,email,marketing_opt_in")
        .in("id", learnerIds)
    : { data: [], error: null };

  if (error) {
    adminLearnersRedirect(error.message);
  }

  const consentedProfiles = (profiles ?? []).filter((profile) => profile.marketing_opt_in || subscriberEmails.includes(String(profile.email ?? "").trim().toLowerCase()));
  let campaignBody = body;

  try {
    const promotion = await maybeCreatePromotionCode(formData, subject, consentedProfiles.length);
    if (promotion) {
      campaignBody = `${body}\n\n${promotion.message}`;
    }
  } catch (error) {
    adminLearnersRedirect(error instanceof Error ? error.message : "Stripe promotion code could not be created.");
  }

  const sentEmails = new Set<string>();

  for (const profile of consentedProfiles) {
    await createLearnerNotification(supabase, profile.id, "admin_promo", subject, campaignBody);
    if (profile.email) {
      sentEmails.add(profile.email.trim().toLowerCase());
      await sendAdminNoticeEmail({ to: profile.email, subject, title: subject, body: campaignBody });
    }
  }

  const extraSubscriberEmails = subscriberEmails.filter((email) => !sentEmails.has(email));

  for (const email of extraSubscriberEmails) {
    await sendAdminNoticeEmail({ to: email, subject, title: subject, body: campaignBody });
  }

  revalidateLearnerAdminChange();
  adminLearnersRedirect(
    `Campaign sent to ${consentedProfiles.length} learner account${consentedProfiles.length === 1 ? "" : "s"} and ${extraSubscriberEmails.length} Follow LDA email subscriber${extraSubscriberEmails.length === 1 ? "" : "s"}.`
  );
}

export async function suspendLearnerAccountAction(formData: FormData) {
  const learnerId = requireLearnerId(formData);
  const duration = getString(formData, "duration");
  const reason = getString(formData, "reason") || "Account suspended by LDA admin for policy or fraud review.";
  const { supabase, profile } = await getLearnerProfile(learnerId);
  const adminClient = createAdminClient();

  if (!adminClient) {
    adminLearnersRedirect("Supabase service role is not configured, so account suspension cannot be applied.");
  }

  const banDuration = getBanDuration(duration);
  const { error } = await adminClient.auth.admin.updateUserById(learnerId, {
    ban_duration: banDuration
  } as { ban_duration: string });

  if (error) {
    adminLearnersRedirect(error.message);
  }

  await createLearnerNotification(supabase, learnerId, "admin_suspension", "Your LDA account has been suspended", reason);

  if (profile.email) {
    await sendAdminNoticeEmail({
      to: profile.email,
      subject: "Your LDA account has been suspended",
      title: "Your LDA account has been suspended",
      body: reason
    });
  }

  revalidateLearnerAdminChange();
  adminLearnersRedirect(`${profile.full_name || profile.email || "Learner"} has been suspended.`);
}
