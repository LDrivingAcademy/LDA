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

async function getAppOrigin() {
  if (process.env.APP_WEBSITE_URL) {
    return process.env.APP_WEBSITE_URL;
  }

  const requestOrigin = (await headers()).get("origin");
  return requestOrigin || "https://ldrivingacademy.co.uk";
}

function verifyRedirect(role: "learner" | "instructor", message: string): never {
  redirect(`/auth/verify?role=${role}&message=${encodeURIComponent(message)}`);
}

export async function sendMagicLink(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = String(formData.get("fullName") ?? "").trim();
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
  const fullName = String(formData.get("fullName") ?? "").trim();
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
      verifyRedirect("learner", "Enter a valid date of birth showing you are 17 or over before booking.");
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
    redirect("/dashboard?verification=pending");
  }

  const dateOfBirth = String(formData.get("dateOfBirth") ?? "").trim();

  await writeClient.from("learner_profiles").upsert({
    user_id: user.id,
    date_of_birth: dateOfBirth,
    provisional_licence_confirmed_at: new Date().toISOString(),
    terms_accepted_at: new Date().toISOString()
  });

  revalidatePath("/", "layout");
  redirect("/dashboard?verified=1");
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const nextPath = safeNextPath(formData.get("next"));

  const demoCredentials: Record<string, { password: string; role: "learner" | "instructor" }> = {
    "learner@ldrivingacademy.co.uk": { password: "LDAlearner123!", role: "learner" },
    "instructor@ldrivingacademy.co.uk": { password: "LDAinstructor123!", role: "instructor" }
  };
  const demoAccount = demoCredentials[email.toLowerCase()];

  if (demoAccount && demoAccount.password === password) {
    redirect(`/demo/${demoAccount.role}`);
  }

  const supabase = await createClient();
  if (!supabase) {
    authError("Supabase environment variables are not configured yet.");
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    authError(error.message);
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
  const fullName = String(formData.get("fullName") ?? "");
  const accountIntent = String(formData.get("accountIntent") ?? "learner");
  const nextPath = safeNextPath(formData.get("next"));

  if (accountIntent === "admin") {
    authError("Admin accounts must be created manually by the site owner.");
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { account_intent: accountIntent, full_name: fullName }
    }
  });

  if (error) {
    authError(error.message);
  }

  revalidatePath("/", "layout");
  redirect(`${nextPath}?message=Check your email if confirmation is enabled.`);
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

export async function demoSignIn(formData: FormData) {
  const role = String(formData.get("demoRole") ?? "learner");
  const safeRole = ["learner", "instructor", "admin"].includes(role) ? role : "learner";

  revalidatePath("/", "layout");
  redirect(`/demo/${safeRole}`);
}
