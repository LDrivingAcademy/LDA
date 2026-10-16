import { jsonNoStore, readJsonBody, safeText } from "@/lib/security";
import {
  hashSensitiveValue,
  maskEnding,
  validateUkAccountNumber,
  validateUkSortCode,
  type InstructorFinanceProfile
} from "@/lib/instructor-finance-profile";
import { getStripeSecretKey } from "@/lib/stripe-env";
import { getInstructorSetupReadiness, refreshInstructorSetupAvailability } from "@/lib/instructor-setup-readiness";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { canUseMarketplaceRole, getMarketplaceRoleState } from "@/lib/account-route-guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PayoutRequest = {
  payeeName?: string;
  bankName?: string;
  sortCode?: string;
  accountNumber?: string;
  schedule?: string;
};

const allowedSchedules = new Set(["Weekly", "Fortnightly", "Monthly"]);

async function attachStripeExternalAccount({
  stripeAccountId,
  payeeName,
  sortCode,
  accountNumber
}: {
  stripeAccountId: string;
  payeeName: string;
  sortCode: string;
  accountNumber: string;
}) {
  const stripeSecret = getStripeSecretKey();
  if (!stripeSecret.value) {
    return { ok: false, error: "Stripe live payout checking is not configured." };
  }

  const body = new URLSearchParams({
    "external_account[object]": "bank_account",
    "external_account[country]": "GB",
    "external_account[currency]": "gbp",
    "external_account[account_holder_name]": payeeName,
    "external_account[account_holder_type]": "individual",
    "external_account[routing_number]": sortCode,
    "external_account[account_number]": accountNumber
  });

  const response = await fetch(
    `https://api.stripe.com/v1/accounts/${encodeURIComponent(stripeAccountId)}/external_accounts`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecret.value}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": `lda-payout-account-${stripeAccountId}-${hashSensitiveValue(`${sortCode}:${accountNumber}`)}`
      },
      body
    }
  );
  const result = await response.json();

  if (!response.ok) {
    return { ok: false, error: result.error?.message ?? "Stripe could not verify this payout account." };
  }

  return {
    ok: true,
    externalAccountId: String(result.id ?? ""),
    status: String(result.status ?? "validated")
  };
}

export async function POST(request: Request) {
  const input = await readJsonBody<PayoutRequest>(request);
  if (!input) {
    return jsonNoStore({ error: "Invalid payout details." }, { status: 400 });
  }

  const payeeName = safeText(input.payeeName, "", 120);
  const bankName = safeText(input.bankName, "", 120);
  const schedule = allowedSchedules.has(safeText(input.schedule, "", 30)) ? safeText(input.schedule, "", 30) : "Weekly";
  const sortCode = validateUkSortCode(input.sortCode ?? "");
  const accountNumber = validateUkAccountNumber(input.accountNumber ?? "");

  if (!payeeName || !bankName) {
    return jsonNoStore({ error: "Payee name and bank name are required." }, { status: 400 });
  }

  if (!sortCode.ok) {
    return jsonNoStore({ error: sortCode.message }, { status: 400 });
  }

  if (!accountNumber.ok) {
    return jsonNoStore({ error: accountNumber.message }, { status: 400 });
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
    return jsonNoStore({ error: "Sign in as an instructor before saving payout details." }, { status: 401 });
  }

  const roleState = await getMarketplaceRoleState(supabase, user.id);
  if (!canUseMarketplaceRole(roleState, "instructor")) {
    return jsonNoStore({ error: "Use an approved instructor account before saving payout details." }, { status: 403 });
  }

  const { data: instructorProfile } = await admin
    .from("instructor_profiles")
    .select("stripe_account_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const stripeAccountId = safeText(instructorProfile?.stripe_account_id, "", 120);
  if (!stripeAccountId) {
    return jsonNoStore(
      {
        error:
          "Payout setup is not linked to this instructor account yet. Complete instructor payout onboarding before saving bank payout details."
      },
      { status: 409 }
    );
  }

  const stripeCheck = await attachStripeExternalAccount({
    stripeAccountId,
    payeeName,
    sortCode: sortCode.digits,
    accountNumber: accountNumber.digits
  });

  if (!stripeCheck.ok) {
    return jsonNoStore({ error: stripeCheck.error }, { status: 409 });
  }

  const { data: adminUser, error: loadError } = await admin.auth.admin.getUserById(user.id);
  if (loadError) {
    return jsonNoStore({ error: "Existing finance profile could not be loaded." }, { status: 503 });
  }

  const currentMetadata = adminUser.user?.user_metadata ?? {};
  const currentFinance = (currentMetadata.lda_instructor_finance ?? {}) as InstructorFinanceProfile;
  const nextFinance: InstructorFinanceProfile = {
    ...currentFinance,
    payout: {
      payeeName,
      bankName,
      accountEnding: maskEnding(accountNumber.digits),
      sortCodeEnding: maskEnding(sortCode.digits, 2),
      schedule,
      stripeExternalAccountId: stripeCheck.externalAccountId ?? null,
      verificationStatus: stripeCheck.status ?? "validated",
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
    return jsonNoStore({ error: "Payout details passed checking, but could not be saved." }, { status: 503 });
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
    payout: nextFinance.payout,
    setupComplete: setupReadiness.complete,
    message: setupReadiness.complete
      ? "Payout details verified and saved. Instructor setup is complete."
      : "Payout details verified through Stripe and saved."
  });
}
