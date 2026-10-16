"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { revokeTrustedDeviceSession } from "@/lib/auth-sessions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function trustedDevicesRedirect(message: string): never {
  redirect(`/account/trusted-devices?message=${encodeURIComponent(message)}`);
}

export async function revokeTrustedDevice(formData: FormData) {
  const sessionId = String(formData.get("sessionId") ?? "").trim();
  const supabase = await createClient();

  if (!supabase) {
    redirect("/auth/login?message=Sign in before managing trusted devices.");
  }

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/auth/login?message=Sign in before managing trusted devices.");
  }

  const { data: roles, error: roleError } = await supabase
    .from("account_roles")
    .select("role")
    .eq("user_id", user.id);

  if (roleError) {
    trustedDevicesRedirect(roleError.message);
  }

  const roleNames = roles?.map((item) => String(item.role)) ?? [];
  if (roleNames.includes("admin") || roleNames.includes("support") || (!roleNames.includes("learner") && !roleNames.includes("instructor"))) {
    redirect("/account?message=Trusted devices are not available for this account type.");
  }

  if (!sessionId) {
    trustedDevicesRedirect("Choose a trusted device to revoke.");
  }

  const result = await revokeTrustedDeviceSession({
    adminClient: createAdminClient(),
    userId: user.id,
    actorUserId: user.id,
    sessionId,
    headers: await headers()
  });

  if (!result.ok) {
    trustedDevicesRedirect("LDA could not revoke that trusted device. Try again.");
  }

  revalidatePath("/account/trusted-devices");
  revalidatePath("/account");
  trustedDevicesRedirect("Trusted device revoked.");
}
