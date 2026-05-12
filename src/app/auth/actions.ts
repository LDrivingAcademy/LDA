"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
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
  const requestOrigin = (await headers()).get("origin");
  return requestOrigin || process.env.APP_WEBSITE_URL || "http://localhost:3000";
}

export async function sendMagicLink(formData: FormData) {
  const supabase = await createClient();
  if (!supabase) {
    authError("Supabase environment variables are not configured yet.");
  }

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

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: redirectTo.toString(),
      data: {
        account_intent: role,
        full_name: fullName
      }
    }
  });

  if (error) {
    authError(error.message);
  }

  redirect(`/auth/check-email?email=${encodeURIComponent(email)}&role=${role}`);
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
    redirect(`/auth/verify?role=${role}&message=${encodeURIComponent("Accept the platform terms and privacy notices before continuing.")}`);
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

  const provisionalConfirmed = formData.get("provisionalLicenceConfirmed") === "on";
  if (!provisionalConfirmed) {
    redirect(`/auth/verify?role=learner&message=${encodeURIComponent("Confirm that you hold a valid provisional licence before booking.")}`);
  }

  await writeClient.from("learner_profiles").upsert({
    user_id: user.id,
    date_of_birth: String(formData.get("dateOfBirth") ?? "") || null,
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
