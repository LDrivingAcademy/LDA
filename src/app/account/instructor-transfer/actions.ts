"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getMarketplaceRolesForUser } from "@/lib/account-role-guard";
import { createClient } from "@/lib/supabase/server";

function isLicenceHeldForTwoYears(value: string) {
  const heldSince = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(heldSince.getTime())) {
    return false;
  }

  const eligibleFrom = new Date(heldSince);
  eligibleFrom.setUTCFullYear(eligibleFrom.getUTCFullYear() + 2);
  return eligibleFrom.getTime() <= Date.now();
}

function transferRedirect(message: string): never {
  redirect(`/account/instructor-transfer?message=${encodeURIComponent(message)}`);
}

export async function requestInstructorTransfer(formData: FormData) {
  const supabase = await createClient();

  if (!supabase) {
    transferRedirect("Supabase is not configured yet.");
  }

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/auth/login?role=learner&message=Log in to your learner account before requesting an instructor transfer.");
  }

  const roles = await getMarketplaceRolesForUser(supabase, user.id);

  if (roles.includes("instructor")) {
    redirect("/instructor-dashboard");
  }

  if (!roles.includes("learner")) {
    redirect("/auth/verify?role=learner&message=Complete learner setup before requesting an instructor transfer.");
  }

  const fullLicenceHeldSince = String(formData.get("fullLicenceHeldSince") ?? "").trim();
  const adiPdiStatus = String(formData.get("adiPdiStatus") ?? "PDI");
  const adiPdiNumber = String(formData.get("adiPdiNumber") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!isLicenceHeldForTwoYears(fullLicenceHeldSince)) {
    transferRedirect("Your full licence date is not eligible for an instructor transfer yet.");
  }

  const { error: learnerError } = await supabase
    .from("learner_profiles")
    .update({
      full_licence_held_since: fullLicenceHeldSince,
      full_licence_confirmed_at: new Date().toISOString()
    })
    .eq("user_id", user.id);

  if (learnerError) {
    transferRedirect(learnerError.message);
  }

  const { error: requestError } = await supabase.from("account_role_transfer_requests").insert({
    user_id: user.id,
    from_role: "learner",
    to_role: "instructor",
    full_licence_held_since: fullLicenceHeldSince,
    adi_pdi_status: adiPdiStatus === "ADI" ? "ADI" : "PDI",
    adi_pdi_number: adiPdiNumber || null,
    notes: notes || null,
    status: "requested"
  });

  if (requestError) {
    transferRedirect(requestError.message);
  }

  revalidatePath("/account/instructor-transfer");
  redirect("/account/instructor-transfer?message=Instructor transfer request submitted for LDA admin review.");
}
