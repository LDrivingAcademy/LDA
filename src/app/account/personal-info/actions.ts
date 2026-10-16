"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function updatePersonalInfo(formData: FormData) {
  const supabase = await createClient();

  if (!supabase) {
    redirect("/auth/login?message=Sign in before updating your account.");
  }

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/auth/login?message=Sign in before updating your account.");
  }

  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

  if (!firstName || !lastName) {
    redirect("/account/personal-info?message=Enter your first name and last name.");
  }

  if (!email || !email.includes("@")) {
    redirect("/account/personal-info?message=Enter a valid email address.");
  }

  const { error: authUpdateError } = await supabase.auth.updateUser(
    email !== (user.email ?? "").toLowerCase()
      ? { email, data: { full_name: fullName } }
      : { data: { full_name: fullName } }
  );

  if (authUpdateError) {
    redirect(`/account/personal-info?message=${encodeURIComponent(authUpdateError.message)}`);
  }

  const writeClient = createAdminClient() ?? supabase;
  const { error: profileError } = await writeClient.from("profiles").upsert({
    id: user.id,
    email,
    full_name: fullName
  });

  if (profileError) {
    redirect(`/account/personal-info?message=${encodeURIComponent(profileError.message)}`);
  }

  revalidatePath("/account");
  revalidatePath("/account/personal-info");
  revalidatePath("/dashboard");
  revalidatePath("/", "layout");
  redirect("/account/personal-info?message=Personal information updated.");
}
