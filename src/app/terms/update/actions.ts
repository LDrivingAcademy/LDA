"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { CURRENT_TERMS_VERSION } from "@/lib/terms-version";

function safeNextPath(value: FormDataEntryValue | null) {
  const nextPath = String(value ?? "/dashboard");
  return nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/dashboard";
}

export async function acceptCurrentTerms(formData: FormData) {
  const supabase = await createClient();
  if (!supabase) {
    redirect("/auth/login?message=Authentication is not configured.");
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?message=Sign in before accepting the updated LDA terms.");
  }

  const accepted = formData.get("acceptCurrentTerms") === "on";
  const nextPath = safeNextPath(formData.get("next"));

  if (!accepted) {
    redirect(`/terms/update?next=${encodeURIComponent(nextPath)}&message=${encodeURIComponent("Accept the updated Terms and Conditions before continuing.")}`);
  }

  const acceptedAt = new Date().toISOString();
  const writeClient = createAdminClient() ?? supabase;

  const { error: profileError } = await writeClient
    .from("profiles")
    .upsert({
      id: user.id,
      email: user.email ?? null,
      terms_accepted_at: acceptedAt,
      terms_version_accepted: CURRENT_TERMS_VERSION,
      updated_at: acceptedAt
    }, { onConflict: "id" });

  if (profileError) {
    redirect(`/terms/update?next=${encodeURIComponent(nextPath)}&message=${encodeURIComponent(profileError.message)}`);
  }

  const { error: learnerProfileError } = await writeClient
    .from("learner_profiles")
    .update({
      terms_accepted_at: acceptedAt
    })
    .eq("user_id", user.id);

  if (learnerProfileError) {
    console.warn("[terms.update] learner profile terms timestamp sync failed", {
      userId: user.id,
      message: learnerProfileError.message
    });
  }

  revalidatePath("/", "layout");
  redirect(nextPath);
}
