"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { InstructorFinanceProfile } from "@/lib/instructor-finance-profile";
import { getInstructorSetupReadiness, refreshInstructorSetupAvailability } from "@/lib/instructor-setup-readiness";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { canUseMarketplaceRole, getMarketplaceRoleState } from "@/lib/account-route-guard";

function setupRedirect(message: string): never {
  redirect(`/instructor-setup?message=${encodeURIComponent(message)}`);
}

function setupStepRedirect(step: "finance" | "tax", message: string): never {
  redirect(`/instructor-setup/${step}?message=${encodeURIComponent(message)}`);
}

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function normalisePostcode(value: string) {
  return value.toUpperCase().replace(/\s+/g, " ").slice(0, 16);
}

function parseAreas(value: string) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((area) => area.trim())
        .filter(Boolean)
        .slice(0, 12)
    )
  );
}

async function requireApprovedInstructor() {
  const supabase = await createClient();
  const admin = createAdminClient();

  if (!supabase || !admin) {
    setupRedirect("Instructor setup storage is not configured.");
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?role=instructor");
  }

  const roleState = await getMarketplaceRoleState(supabase, user.id);
  if (!canUseMarketplaceRole(roleState, "instructor")) {
    redirect(roleState.effectiveRole === "instructor" ? "/instructor-verification?from=dashboard" : "/learner-dashboard");
  }

  return { supabase, admin, user };
}

async function markSetupPromptMetadata(
  userId: string,
  values: Record<string, string | boolean | null>
) {
  const admin = createAdminClient();
  if (!admin) {
    return;
  }

  const { data } = await admin.auth.admin.getUserById(userId);
  const currentMetadata = data.user?.user_metadata ?? {};
  await admin.auth.admin.updateUserById(userId, {
    user_metadata: {
      ...currentMetadata,
      ...values
    }
  });
}

export async function dismissInstructorSetupPromptAction() {
  const { user } = await requireApprovedInstructor();
  await markSetupPromptMetadata(user.id, {
    lda_instructor_setup_prompt_dismissed_at: new Date().toISOString(),
    lda_instructor_setup_guide_enabled_at: null,
    lda_instructor_setup_guide_closed_at: new Date().toISOString()
  });
  revalidatePath("/instructor-dashboard");
  return { ok: true };
}

export async function enableInstructorSetupGuideAction() {
  const { user } = await requireApprovedInstructor();
  await markSetupPromptMetadata(user.id, {
    lda_instructor_setup_guide_enabled_at: new Date().toISOString(),
    lda_instructor_setup_guide_closed_at: null,
    lda_instructor_setup_prompt_dismissed_at: new Date().toISOString()
  });
  revalidatePath("/instructor-dashboard");
  return { ok: true };
}

export async function closeInstructorSetupGuideAction() {
  const { user } = await requireApprovedInstructor();
  await markSetupPromptMetadata(user.id, {
    lda_instructor_setup_guide_closed_at: new Date().toISOString()
  });
  revalidatePath("/instructor-dashboard");
  return { ok: true };
}

export async function saveInstructorSetupProfileAction(formData: FormData) {
  const { admin, user } = await requireApprovedInstructor();
  const firstName = getString(formData, "firstName").replace(/\s+/g, " ").slice(0, 60);
  const lastName = getString(formData, "lastName").replace(/\s+/g, " ").slice(0, 60);
  const displayName = `${firstName} ${lastName}`.trim().slice(0, 120);
  const basePostcode = normalisePostcode(getString(formData, "basePostcode"));
  const areasCovered = parseAreas(getString(formData, "areasCovered"));
  const transmissionInput = getString(formData, "transmission");
  const transmission = transmissionInput === "manual" ? "manual" : "automatic";
  const carMake = getString(formData, "carMake").slice(0, 60);
  const carModel = getString(formData, "carModel").slice(0, 80);
  const pricePounds = Number(getString(formData, "hourlyRate").replace(/[^\d.]/g, ""));
  const hourlyRatePence = Number.isFinite(pricePounds) ? Math.round(pricePounds * 100) : 0;

  if (!firstName || !lastName || !basePostcode || !areasCovered.length || !carMake || !carModel || hourlyRatePence <= 0) {
    setupRedirect("Complete legal first name, legal last name, home postcode, covered areas, vehicle, transmission, and hourly price before saving.");
  }

  if (hourlyRatePence < 1000 || hourlyRatePence > 15000) {
    setupRedirect("Hourly price must be between GBP 10.00 and GBP 150.00.");
  }

  const { error } = await admin.from("instructor_profiles").update({
    display_name: displayName,
    base_postcode: basePostcode,
    areas_covered: areasCovered,
    transmission,
    car_make: carMake,
    car_model: carModel,
    hourly_rate_pence: hourlyRatePence,
    updated_at: new Date().toISOString()
  }).eq("user_id", user.id);

  if (error) {
    setupRedirect(error.message);
  }

  await admin.from("profiles").update({
    full_name: displayName,
    updated_at: new Date().toISOString()
  }).eq("id", user.id);

  const [{ data: profile }, { data: adminUser }] = await Promise.all([
    admin
      .from("instructor_profiles")
      .select("verification_status,hourly_rate_pence,base_postcode,areas_covered,transmission,car_make,car_model,stripe_account_id,learner_availability_paused,learner_availability_pause_reason")
      .eq("user_id", user.id)
      .maybeSingle(),
    admin.auth.admin.getUserById(user.id)
  ]);
  const finance = (adminUser.user?.user_metadata?.lda_instructor_finance ?? {}) as InstructorFinanceProfile;

  await refreshInstructorSetupAvailability({
    db: admin,
    userId: user.id,
    profile,
    finance
  });

  const readiness = getInstructorSetupReadiness(profile, finance);
  if (readiness.complete) {
    const completedAt = new Date().toISOString();
    await markSetupPromptMetadata(user.id, {
      lda_instructor_setup_completed_at: completedAt,
      lda_instructor_setup_prompt_eligible_at: null,
      lda_instructor_setup_prompt_dismissed_at: completedAt,
      lda_instructor_setup_guide_closed_at: completedAt,
      lda_instructor_setup_guide_enabled_at: null
    });
  }

  revalidatePath("/instructor-setup");
  revalidatePath("/instructor-setup/finance");
  revalidatePath("/instructor-setup/tax");
  revalidatePath("/instructor-dashboard");
  revalidatePath("/learner-dashboard");
  setupStepRedirect("finance", "Step 1 saved to your instructor profile. Continue with finance and payouts.");
}
