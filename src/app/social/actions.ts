"use server";

import { sendLdaBrandedEmail } from "@/lib/email";
import { createFollowLdaWelcomeEmailContent } from "@/lib/follow-lda-welcome-email";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function normaliseEmail(value: string) {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function sendFollowLdaWelcomeEmail(input: { to: string; fullName?: string | null }) {
  return sendLdaBrandedEmail({
    ...createFollowLdaWelcomeEmailContent(),
    to: input.to,
    idempotencyKey: `follow-lda-welcome:${input.to}`
  });
}

export async function subscribeToFollowLdaAction(email: string) {
  const requestedEmail = normaliseEmail(email);

  if (!isValidEmail(requestedEmail)) {
    return { ok: false, message: "Enter a valid email address.", email: requestedEmail };
  }

  const adminClient = createAdminClient();

  if (!adminClient) {
    return {
      ok: false,
      message: "LDA mailing consent storage is not configured yet.",
      email: requestedEmail
    };
  }

  const supabase = await createClient();
  let userData: Awaited<ReturnType<NonNullable<typeof supabase>["auth"]["getUser"]>>["data"] = { user: null };

  try {
    userData = supabase ? (await supabase.auth.getUser()).data : { user: null };
  } catch {
    userData = { user: null };
  }

  const user = userData.user;
  const { data: profile, error: profileReadError } = user?.id
    ? await adminClient.from("profiles").select("email,full_name").eq("id", user.id).maybeSingle()
    : { data: null, error: null };

  if (profileReadError) {
    return {
      ok: false,
      message: "We could not read your account details just now. Please try again.",
      email: requestedEmail
    };
  }

  const accountEmail = normaliseEmail(profile?.email ?? user?.email ?? "");
  const cleanEmail = user?.id ? accountEmail : requestedEmail;
  const fullName =
    profile?.full_name ??
    (typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null);

  if (!isValidEmail(cleanEmail)) {
    return {
      ok: false,
      message: "Your account does not have a valid email address. Please contact LDA support.",
      email: requestedEmail
    };
  }

  const { data: existingSubscriber, error: existingSubscriberError } = await adminClient
    .from("marketing_subscribers")
    .select("email,user_id,unsubscribed_at")
    .eq("email", cleanEmail)
    .maybeSingle();

  if (existingSubscriberError) {
    return {
      ok: false,
      message: "We could not check your subscription just now. Please try again.",
      email: cleanEmail
    };
  }

  if (user?.id) {
    const { error: profileUpdateError } = await adminClient
      .from("profiles")
      .update({ marketing_opt_in: true, updated_at: new Date().toISOString() })
      .eq("id", user.id);

    if (profileUpdateError) {
      return {
        ok: false,
        message: "We could not save this to your account just now. Please try again.",
        email: cleanEmail
      };
    }
  }

  const now = new Date().toISOString();
  const { error } = await adminClient.from("marketing_subscribers").upsert(
    user?.id
      ? {
          email: cleanEmail,
          user_id: user.id,
          full_name: fullName,
          source: "follow_lda",
          consented_at: now,
          unsubscribed_at: null,
          updated_at: now
        }
      : {
          email: cleanEmail,
          source: "follow_lda",
          consented_at: now,
          unsubscribed_at: null,
          updated_at: now
        },
    { onConflict: "email" }
  );

  if (error) {
    return { ok: false, message: error.message, email: cleanEmail };
  }

  const wasAlreadySubscribed = Boolean(existingSubscriber && !existingSubscriber.unsubscribed_at);

  if (!wasAlreadySubscribed) {
    try {
      await sendFollowLdaWelcomeEmail({ to: cleanEmail, fullName });
    } catch (error) {
      console.warn(
        JSON.stringify({
          level: "warn",
          msg: "follow lda welcome email failed",
          route: "/social",
          email: cleanEmail,
          error: error instanceof Error ? error.message : "Unknown email error"
        })
      );
    }
  }

  return {
    ok: true,
    message: wasAlreadySubscribed ? "This email is already subscribed." : "You've now been signed up.",
    email: cleanEmail
  };
}
