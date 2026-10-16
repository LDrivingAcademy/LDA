"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { scheduleAccountDeletionWithRecovery } from "@/lib/account-erasure";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function accountRedirect(message: string): never {
  redirect(`/account?message=${encodeURIComponent(message)}`);
}

export async function requestAccountDeletion(formData: FormData) {
  const confirmation = String(formData.get("deleteConfirmation") ?? "").trim().toUpperCase();
  const yesConfirmed = formData.get("confirmAccountDeletion") === "yes";
  const acknowledged = formData.get("deletionAcknowledged") === "on" || yesConfirmed;
  const retentionAcknowledged = formData.get("retentionAcknowledged") === "on" || yesConfirmed;

  if (!acknowledged || !retentionAcknowledged || (confirmation && confirmation !== "DELETE")) {
    accountRedirect("Confirm that you understand account deletion before continuing.");
  }

  const supabase = await createClient();
  if (!supabase) {
    redirect("/auth/login?message=Sign in before requesting account deletion.");
  }

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/auth/login?message=Sign in before requesting account deletion.");
  }

  const admin = createAdminClient();
  if (!admin) {
    accountRedirect("Account deletion is temporarily unavailable. Please try again later or contact LDA support.");
  }

  const userId = user.id;
  const requestHeaders = await headers();
  const origin =
    requestHeaders.get("origin") ||
    process.env.APP_WEBSITE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://ldrivingacademy.co.uk";
  let result;
  try {
    result = await scheduleAccountDeletionWithRecovery({ admin, userId, origin });
  } catch (error) {
    accountRedirect(error instanceof Error ? error.message : "Account deletion could not be scheduled. Please contact LDA support.");
  }

  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  const warningSuffix = result.warnings.length
    ? " Some retention/removal steps need owner review; LDA has logged this for follow-up."
    : "";
  redirect(`/auth/login?message=${encodeURIComponent(`Your LDA account deletion request has been scheduled. Your account has been deactivated, and LDA has emailed you a restart link that works for 30 days. If you do not restart within 30 days, removable personal data will be permanently deleted or anonymised.${warningSuffix}`)}`);
}
