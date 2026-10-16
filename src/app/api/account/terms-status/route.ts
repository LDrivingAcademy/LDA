import { isDirectorAdminEmail } from "@/lib/admin-access";
import { jsonNoStore } from "@/lib/security";
import { createClient } from "@/lib/supabase/server";
import { hasAcceptedCurrentTerms } from "@/lib/terms-version";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();

  if (!supabase) {
    return jsonNoStore({
      needsTermsAcceptance: false,
      dashboardHref: "/"
    });
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user || isDirectorAdminEmail(user.email)) {
    return jsonNoStore({
      needsTermsAcceptance: false,
      dashboardHref: "/"
    });
  }

  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("terms_version_accepted").eq("id", user.id).maybeSingle(),
    supabase.from("account_roles").select("role").eq("user_id", user.id)
  ]);
  const roleNames = roles?.map((role) => String(role.role)) ?? [];
  const isInstructor = roleNames.includes("instructor");

  return jsonNoStore({
    needsTermsAcceptance: !hasAcceptedCurrentTerms(profile),
    dashboardHref: isInstructor ? "/instructor-dashboard" : "/learner-dashboard"
  });
}
