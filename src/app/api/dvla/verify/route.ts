import { isRateLimited, jsonNoStore, rateLimitResponse, readJsonBody } from "@/lib/security";
import { verifyAndSaveProvisionalLicence, verifyProvisionalLicenceNumber } from "@/lib/dvla-provisional-verification";
import { createClient } from "@/lib/supabase/server";
import { canUseMarketplaceRole, getMarketplaceRoleState } from "@/lib/account-route-guard";

type DvlaVerifyRequest = {
  drivingLicenceNumber?: string;
  permissionConfirmed?: boolean;
};

export async function POST(request: Request) {
  if (isRateLimited(request, "dvla-verify", 10)) {
    return rateLimitResponse();
  }

  const body = await readJsonBody<DvlaVerifyRequest>(request);
  if (!body) {
    return jsonNoStore({ valid: false, message: "Invalid DVLA verification request." }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) {
    const result = await verifyProvisionalLicenceNumber({
      drivingLicenceNumber: body.drivingLicenceNumber,
      permissionConfirmed: body.permissionConfirmed
    });

    return jsonNoStore(
      {
        valid: result.valid,
        mode: result.mode,
        message: result.valid
          ? "Licence check passed for this on-demand checkout. Create or sign in to an LDA learner account if you want this saved for future bookings."
          : result.message
      },
      { status: result.status }
    );
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    const result = await verifyProvisionalLicenceNumber({
      drivingLicenceNumber: body.drivingLicenceNumber,
      permissionConfirmed: body.permissionConfirmed
    });

    return jsonNoStore(
      {
        valid: result.valid,
        mode: result.mode,
        message: result.valid
          ? "Licence check passed for this on-demand checkout. Create or sign in to an LDA learner account if you want this saved for future bookings."
          : result.message
      },
      { status: result.status }
    );
  }

  const roleState = await getMarketplaceRoleState(supabase, user.id);
  if (!canUseMarketplaceRole(roleState, "learner")) {
    return jsonNoStore(
      {
        valid: false,
        message: "Use a learner account before saving provisional licence verification."
      },
      { status: 403 }
    );
  }

  const result = await verifyAndSaveProvisionalLicence({
    supabase,
    userId: user.id,
    drivingLicenceNumber: body.drivingLicenceNumber,
    permissionConfirmed: body.permissionConfirmed
  });

  return jsonNoStore(
    {
      valid: result.valid,
      mode: result.mode,
      message: result.message
    },
    { status: result.status }
  );
}
