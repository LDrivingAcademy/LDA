import { NextResponse } from "next/server";

import { requireAdminDashboardClient } from "@/lib/admin-dashboard";
import { readAdminActiveDriverLocations } from "@/lib/admin-active-driver-locations";
import { recordAuthAudit } from "@/lib/auth-sessions";
import { applyAdminSecurityHeaders, isRateLimited, rateLimitResponse } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function adminJson(body: Record<string, unknown>, status = 200) {
  return applyAdminSecurityHeaders(
    NextResponse.json(body, {
      status,
      headers: {
        "Cache-Control": "private, no-store, max-age=0, must-revalidate"
      }
    })
  );
}

export async function GET(request: Request) {
  if (isRateLimited(request, "admin-active-driver-locations", 180)) {
    return applyAdminSecurityHeaders(rateLimitResponse());
  }

  const { supabase, user } = await requireAdminDashboardClient();
  const admin = createAdminClient();
  const readClient = admin ?? supabase;
  const payload = await readAdminActiveDriverLocations(readClient);

  await recordAuthAudit({
    adminClient: admin,
    actorUserId: user.id,
    subjectUserId: user.id,
    role: "admin",
    action: "admin.live_location.refresh",
    targetType: "instructor_live_locations",
    metadata: {
      driverCount: payload.drivers.length,
      staleSignedOnCount: payload.staleSignedOnInstructors.length,
      liveWindowSeconds: payload.liveWindowSeconds
    }
  });

  return adminJson({
    ok: true,
    ...payload
  });
}
