import { canUseMarketplaceRole, getMarketplaceRoleState } from "@/lib/account-route-guard";
import { getInstructorSetupReadiness, refreshInstructorSetupAvailability } from "@/lib/instructor-setup-readiness";
import type { InstructorFinanceProfile } from "@/lib/instructor-finance-profile";
import { jsonNoStore, readJsonBody } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type HourlyRateRequest = {
  hourlyRate?: unknown;
};

function parseHourlyRatePence(value: unknown) {
  const text = String(value ?? "").trim().replace(/^£/, "");
  const amount = Number(text);

  if (!Number.isFinite(amount) || amount <= 0 || amount > 500) {
    return null;
  }

  return Math.round(amount * 100);
}

export async function POST(request: Request) {
  const input = await readJsonBody<HourlyRateRequest>(request);
  const hourlyRatePence = parseHourlyRatePence(input?.hourlyRate);

  if (!hourlyRatePence) {
    return jsonNoStore({ error: "Enter a valid hourly rate between £1 and £500." }, { status: 400 });
  }

  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) {
    return jsonNoStore({ error: "Finance profile storage is not configured." }, { status: 503 });
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonNoStore({ error: "Sign in as an instructor before setting your hourly rate." }, { status: 401 });
  }

  const roleState = await getMarketplaceRoleState(supabase, user.id);
  if (!canUseMarketplaceRole(roleState, "instructor")) {
    return jsonNoStore({ error: "Use an approved instructor account before setting your hourly rate." }, { status: 403 });
  }

  const { error: updateError } = await admin
    .from("instructor_profiles")
    .update({
      hourly_rate_pence: hourlyRatePence,
      updated_at: new Date().toISOString()
    })
    .eq("user_id", user.id);

  if (updateError) {
    return jsonNoStore({ error: "Hourly rate could not be saved." }, { status: 503 });
  }

  const [{ data: refreshedInstructorProfile }, { data: adminUser }] = await Promise.all([
    admin
      .from("instructor_profiles")
      .select("verification_status,hourly_rate_pence,base_postcode,areas_covered,transmission,car_make,car_model,stripe_account_id,learner_availability_paused,learner_availability_pause_reason")
      .eq("user_id", user.id)
      .maybeSingle(),
    admin.auth.admin.getUserById(user.id)
  ]);
  const finance = (adminUser?.user?.user_metadata?.lda_instructor_finance ?? {}) as InstructorFinanceProfile;

  await refreshInstructorSetupAvailability({
    db: admin,
    userId: user.id,
    profile: refreshedInstructorProfile,
    finance
  });
  const setupReadiness = getInstructorSetupReadiness(refreshedInstructorProfile, finance);

  return jsonNoStore({
    ok: true,
    hourlyRatePence,
    hourlyRateLabel: `£${(hourlyRatePence / 100).toFixed(2)}/hr`,
    setupComplete: setupReadiness.complete,
    message: setupReadiness.complete
      ? "Hourly rate saved. Instructor setup is complete."
      : "Hourly rate saved and ready to show on your instructor profile."
  });
}
