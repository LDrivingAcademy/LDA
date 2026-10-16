import { jsonNoStore } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { InstructorFinanceProfile } from "@/lib/instructor-finance-profile";
import { canUseMarketplaceRole, getMarketplaceRoleState } from "@/lib/account-route-guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  if (!supabase) {
    return jsonNoStore({ error: "Authentication is not configured." }, { status: 503 });
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonNoStore({ error: "Sign in as an instructor to view finance details." }, { status: 401 });
  }

  const roleState = await getMarketplaceRoleState(supabase, user.id);
  if (!canUseMarketplaceRole(roleState, "instructor")) {
    return jsonNoStore({ error: "Use an approved instructor account to view finance details." }, { status: 403 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return jsonNoStore({ error: "Finance profile storage is not configured." }, { status: 503 });
  }

  const { data: adminUser, error } = await admin.auth.admin.getUserById(user.id);
  if (error) {
    return jsonNoStore({ error: "Finance profile could not be loaded." }, { status: 503 });
  }

  const { data: instructorProfile } = await admin
    .from("instructor_profiles")
    .select("hourly_rate_pence")
    .eq("user_id", user.id)
    .maybeSingle();

  const profile = (adminUser.user?.user_metadata?.lda_instructor_finance ?? {}) as InstructorFinanceProfile;
  return jsonNoStore({
    payout: profile.payout ?? null,
    tax: profile.tax ?? null,
    hourlyRatePence: instructorProfile?.hourly_rate_pence ?? null
  });
}
