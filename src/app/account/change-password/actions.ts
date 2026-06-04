"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function changePasswordRedirect(message: string): never {
  redirect(`/account/change-password?message=${encodeURIComponent(message)}`);
}

export async function changeAccountPassword(formData: FormData) {
  const supabase = await createClient();

  if (!supabase) {
    redirect("/auth/login?message=Sign in before changing your password.");
  }

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/auth/login?message=Sign in before changing your password.");
  }

  const email = user.email?.trim().toLowerCase();
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!email) {
    changePasswordRedirect("This account does not have an email password login. Use password reset from the login page or contact LDA support.");
  }

  if (!currentPassword) {
    changePasswordRedirect("Enter your current password first.");
  }

  if (newPassword.length < 8) {
    changePasswordRedirect("Use a new password with at least 8 characters.");
  }

  if (newPassword !== confirmPassword) {
    changePasswordRedirect("New passwords do not match.");
  }

  if (currentPassword === newPassword) {
    changePasswordRedirect("Choose a new password that is different from your current password.");
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword
  });

  if (signInError) {
    changePasswordRedirect("Your current password was not correct.");
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword
  });

  if (updateError) {
    changePasswordRedirect(updateError.message);
  }

  revalidatePath("/account");
  revalidatePath("/account/change-password");
  revalidatePath("/", "layout");
  redirect("/account/change-password?message=Password changed successfully.");
}
