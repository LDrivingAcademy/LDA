import { jsonNoStore, readJsonBody, safeText } from "@/lib/security";
import {
  maskEnding,
  validateNationalInsurance,
  validateUtr,
  validateVatNumber,
  type InstructorFinanceProfile
} from "@/lib/instructor-finance-profile";
import { getInstructorSetupReadiness, refreshInstructorSetupAvailability } from "@/lib/instructor-setup-readiness";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { canUseMarketplaceRole, getMarketplaceRoleState } from "@/lib/account-route-guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type TaxRequest = {
  tradingStatus?: string;
  utr?: string;
  nationalInsurance?: string;
  taxCode?: string;
  vatStatus?: string;
  vatNumber?: string;
};

const allowedTradingStatuses = new Set(["Sole trader", "Limited company", "Partnership"]);
const allowedVatStatuses = new Set(["Not VAT registered", "VAT registered", "Registration pending"]);

async function runHmrcValidationIfConfigured(input: { utr: string; nationalInsurance: string }) {
  const endpoint = process.env.HMRC_TAX_VALIDATION_API_URL?.trim();
  const token = process.env.HMRC_TAX_VALIDATION_API_TOKEN?.trim();

  if (!endpoint) {
    return {
      ok: true,
      status: "format_checked_hmrc_manual_review_required",
      message: "Format checks passed. LDA will review the evidence manually."
    };
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(input)
  });
  const result = await response.json().catch(() => ({}));

  if (!response.ok || result.valid !== true) {
    return {
      ok: false,
      status: "hmrc_validation_failed",
      message: result.error ?? "HMRC validation did not confirm these tax details."
    };
  }

  return {
    ok: true,
    status: "hmrc_validated",
    message: "Tax details passed configured HMRC validation."
  };
}

export async function POST(request: Request) {
  const input = await readJsonBody<TaxRequest>(request);
  if (!input) {
    return jsonNoStore({ error: "Invalid tax profile." }, { status: 400 });
  }

  const tradingStatus = allowedTradingStatuses.has(safeText(input.tradingStatus, "", 40))
    ? safeText(input.tradingStatus, "", 40)
    : "Sole trader";
  const vatStatus = allowedVatStatuses.has(safeText(input.vatStatus, "", 40))
    ? safeText(input.vatStatus, "", 40)
    : "Not VAT registered";
  const taxCode = safeText(input.taxCode, "", 30);
  const utr = validateUtr(input.utr ?? "");
  const nationalInsurance = validateNationalInsurance(input.nationalInsurance ?? "");
  const vatNumber = validateVatNumber(input.vatNumber ?? "");

  if (!utr.ok) {
    return jsonNoStore({ error: utr.message }, { status: 400 });
  }

  if (!nationalInsurance.ok) {
    return jsonNoStore({ error: nationalInsurance.message }, { status: 400 });
  }

  if (vatStatus === "VAT registered" && !vatNumber.digits) {
    return jsonNoStore({ error: "VAT number is required when VAT registered is selected." }, { status: 400 });
  }

  if (!vatNumber.ok) {
    return jsonNoStore({ error: vatNumber.message }, { status: 400 });
  }

  const hmrcCheck = await runHmrcValidationIfConfigured({
    utr: utr.digits,
    nationalInsurance: nationalInsurance.normalised
  });

  if (!hmrcCheck.ok) {
    return jsonNoStore({ error: hmrcCheck.message }, { status: 409 });
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
    return jsonNoStore({ error: "Sign in as an instructor before saving tax details." }, { status: 401 });
  }

  const roleState = await getMarketplaceRoleState(supabase, user.id);
  if (!canUseMarketplaceRole(roleState, "instructor")) {
    return jsonNoStore({ error: "Use an approved instructor account before saving tax details." }, { status: 403 });
  }

  const { data: adminUser, error: loadError } = await admin.auth.admin.getUserById(user.id);
  if (loadError) {
    return jsonNoStore({ error: "Existing finance profile could not be loaded." }, { status: 503 });
  }

  const currentMetadata = adminUser.user?.user_metadata ?? {};
  const currentFinance = (currentMetadata.lda_instructor_finance ?? {}) as InstructorFinanceProfile;
  const nextFinance: InstructorFinanceProfile = {
    ...currentFinance,
    tax: {
      tradingStatus,
      utrEnding: maskEnding(utr.digits),
      nationalInsuranceEnding: maskEnding(nationalInsurance.normalised),
      taxCode,
      vatStatus,
      vatNumberEnding: vatNumber.digits ? maskEnding(vatNumber.digits) : "",
      utrCheckStatus: "format_valid",
      nationalInsuranceCheckStatus: "format_valid",
      hmrcCheckStatus: hmrcCheck.status,
      savedAt: new Date().toISOString()
    }
  };

  const { error: saveError } = await admin.auth.admin.updateUserById(user.id, {
    user_metadata: {
      ...currentMetadata,
      lda_instructor_finance: nextFinance
    }
  });

  if (saveError) {
    return jsonNoStore({ error: "Tax profile passed checking, but could not be saved." }, { status: 503 });
  }

  const { data: refreshedInstructorProfile } = await admin
    .from("instructor_profiles")
    .select("verification_status,hourly_rate_pence,base_postcode,areas_covered,transmission,car_make,car_model,stripe_account_id,learner_availability_paused,learner_availability_pause_reason")
    .eq("user_id", user.id)
    .maybeSingle();

  await refreshInstructorSetupAvailability({
    db: admin,
    userId: user.id,
    profile: refreshedInstructorProfile,
    finance: nextFinance
  });
  const setupReadiness = getInstructorSetupReadiness(refreshedInstructorProfile, nextFinance);

  return jsonNoStore({
    ok: true,
    tax: nextFinance.tax,
    setupComplete: setupReadiness.complete,
    message: setupReadiness.complete ? `${hmrcCheck.message} Instructor setup is complete.` : hmrcCheck.message
  });
}
