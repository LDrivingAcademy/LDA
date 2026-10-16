import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { requireActiveLdaAuthSession } from "@/lib/auth-sessions";
import { getMarketplaceRoleState, type MarketplaceRole } from "@/lib/account-route-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export async function requireSignedInPage(message: string, role?: MarketplaceRole) {
  const supabase = await createClient();
  const requestedRole = role ?? "learner";

  if (!hasSupabaseConfig() || !supabase) {
    redirect(`/auth/login?role=${requestedRole}&message=${encodeURIComponent(message)}`);
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth/login?role=${requestedRole}&message=${encodeURIComponent(message)}`);
  }

  const roleState = await getMarketplaceRoleState(supabase, user.id);
  const sessionRole = role ?? (roleState.effectiveRole === "instructor" ? "instructor" : "learner");
  const activeSession = await requireActiveLdaAuthSession({
    adminClient: createAdminClient(),
    cookieStore: await cookies(),
    headers: await headers(),
    userId: user.id,
    role: sessionRole,
    readOnly: true
  });

  if (!activeSession.ok) {
    redirect(`/auth/login?role=${sessionRole}&message=${encodeURIComponent(message)}`);
  }

  return { supabase, user, roleState, activeSession };
}
