"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function authError(message: string): never {
  redirect(`/auth/login?message=${encodeURIComponent(message)}`);
}

function safeNextPath(value: FormDataEntryValue | null) {
  const nextPath = String(value ?? "/dashboard");
  return nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/dashboard";
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
