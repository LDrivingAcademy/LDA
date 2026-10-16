import { canUseMarketplaceRole, getMarketplaceRoleState } from "@/lib/account-route-guard";
import { recordInstructorArrivalAndCredit } from "@/lib/lesson-punctuality";
import { isRateLimited, jsonNoStore, rateLimitResponse, readJsonBody, safeText } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type ArrivalRequest = {
  bookingId?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  accuracy?: unknown;
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function optionalNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function POST(request: Request) {
  if (isRateLimited(request, "booking-arrival", 40)) {
    return rateLimitResponse();
  }

  const signedInSupabase = await createClient();
  if (!signedInSupabase) {
    return jsonNoStore({ error: "Secure account access is temporarily unavailable." }, { status: 503 });
  }

  const {
    data: { user }
  } = await signedInSupabase.auth.getUser();
  if (!user) {
    return jsonNoStore({ error: "Sign in as an instructor to record arrival." }, { status: 401 });
  }

  const roleState = await getMarketplaceRoleState(signedInSupabase, user.id);
  if (!canUseMarketplaceRole(roleState, "instructor")) {
    return jsonNoStore({ error: "Only approved instructor accounts can record lesson arrival." }, { status: 403 });
  }

  const body = await readJsonBody<ArrivalRequest>(request);
  if (!body) {
    return jsonNoStore({ error: "A valid booking reference is required." }, { status: 400 });
  }

  const bookingId = safeText(body.bookingId, "", 80);
  if (!bookingId || !isUuid(bookingId)) {
    return jsonNoStore({ error: "A valid booking reference is required." }, { status: 400 });
  }

  const supabase = createAdminClient() ?? signedInSupabase;

  try {
    const result = await recordInstructorArrivalAndCredit({
      supabase,
      bookingId,
      instructorId: user.id,
      latitude: optionalNumber(body.latitude),
      longitude: optionalNumber(body.longitude),
      accuracy: optionalNumber(body.accuracy)
    });

    return jsonNoStore({
      ...result,
      message:
        result.lateMinutes > 0
          ? `${result.lateMinutes} minute${result.lateMinutes === 1 ? "" : "s"} added to the learner time bank.`
          : "Arrival recorded on time."
    });
  } catch (error) {
    return jsonNoStore(
      { error: error instanceof Error ? error.message : "Arrival could not be recorded." },
      { status: 400 }
    );
  }
}
