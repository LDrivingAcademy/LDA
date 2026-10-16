"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function normaliseRecoveryPhone(value: FormDataEntryValue | null) {
  const compact = String(value ?? "")
    .trim()
    .replace(/[()\-\s]/g, "");

  if (compact.startsWith("07") && compact.length === 11) {
    return `+44${compact.slice(1)}`;
  }

  if (compact.startsWith("0044")) {
    return `+44${compact.slice(4)}`;
  }

  return compact;
}

function isValidRecoveryPhone(value: string) {
  return /^\+44[1-9]\d{8,9}$/.test(value) || /^\+[1-9]\d{7,14}$/.test(value);
}

export async function updateRecoveryPhone(formData: FormData) {
  const supabase = await createClient();

  if (!supabase) {
    redirect("/auth/login?message=Sign in before updating your recovery phone number.");
  }

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/auth/login?message=Sign in before updating your recovery phone number.");
  }

  const phone = normaliseRecoveryPhone(formData.get("recoveryPhone"));

  if (!phone) {
    redirect("/account/recovery-phone?message=Enter a recovery phone number.");
  }

  if (!isValidRecoveryPhone(phone)) {
    redirect("/account/recovery-phone?message=Enter a real phone number with the country code, or a UK number starting 07.");
  }

  const writeClient = createAdminClient() ?? supabase;
  const { error } = await writeClient.from("profiles").upsert({
    id: user.id,
    email: user.email ?? null,
    phone
  });

  if (error) {
    redirect(`/account/recovery-phone?message=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/account");
  revalidatePath("/account/recovery-phone");
  revalidatePath("/account/personal-info");
  revalidatePath("/dashboard");
  redirect("/account/recovery-phone?message=Recovery phone number saved.");
}
