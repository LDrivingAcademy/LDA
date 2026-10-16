import { cookies } from "next/headers";
import { getMarketplaceRoleState } from "@/lib/account-route-guard";
import { hasCompletedLearnerEligibility } from "@/lib/learner-eligibility";
import { jsonNoStore } from "@/lib/security";
import { hasSupabaseAuthCookie } from "@/lib/supabase/auth-cookie";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!hasSupabaseAuthCookie((await cookies()).getAll())) {
    return jsonNoStore({ details: null });
  }

  const supabase = await createClient();

  if (!supabase) {
    return jsonNoStore({ details: null });
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonNoStore({ details: null });
  }

  const roleState = await getMarketplaceRoleState(supabase, user.id);

  if (roleState.effectiveRole === "instructor" && !roleState.isAdmin) {
    return jsonNoStore({
      details: null,
      redirectTo: roleState.isApprovedInstructor ? "/instructor-dashboard" : "/instructor-verification?from=dashboard"
    });
  }

  const [profileResult, learnerResult] = await Promise.all([
    supabase.from("profiles").select("full_name,email,phone").eq("id", user.id).maybeSingle(),
    supabase
      .from("learner_profiles")
      .select("date_of_birth,provisional_licence_confirmed_at,terms_accepted_at")
      .eq("user_id", user.id)
      .maybeSingle()
  ]);

  const profile = profileResult.data;
  const learnerProfile = learnerResult.data;

  return jsonNoStore({
    details: {
      fullName: profile?.full_name || user.user_metadata?.full_name || "",
      email: profile?.email || user.email || "",
      phone: profile?.phone || "",
      dateOfBirth: learnerProfile?.date_of_birth || "",
      homeAddress: "",
      provisionalLicenceConfirmed: Boolean(learnerProfile?.provisional_licence_confirmed_at),
      learnerEligibleForBooking: hasCompletedLearnerEligibility(learnerProfile)
    }
  });
}
