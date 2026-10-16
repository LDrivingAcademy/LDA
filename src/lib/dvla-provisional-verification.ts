import type { SupabaseClient } from "@supabase/supabase-js";
import { isRuntimeStripeTestModeAllowed } from "@/lib/runtime-env";

type VerifyProvisionalLicenceInput = {
  supabase: SupabaseClient | null;
  userId: string;
  drivingLicenceNumber?: string;
  permissionConfirmed?: boolean;
};

type VerifyProvisionalLicenceNumberInput = {
  drivingLicenceNumber?: string;
  permissionConfirmed?: boolean;
};

export type ProvisionalLicenceVerificationResult = {
  valid: boolean;
  mode?: "configuration" | "demo" | "live";
  message: string;
  status: number;
  licenceDateOfBirth?: string | null;
};

export function normaliseDrivingLicenceNumber(value?: string) {
  return (value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function normaliseDateOnly(value?: string | null) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

export function getLicenceDateOfBirthFromNumber(value?: string | null) {
  const licenceNumber = normaliseDrivingLicenceNumber(value ?? "");
  if (!/^[A-Z0-9]{16}$/.test(licenceNumber)) return null;

  const decade = Number(licenceNumber[5]);
  const monthCode = Number(licenceNumber.slice(6, 8));
  const day = Number(licenceNumber.slice(8, 10));
  const yearUnit = Number(licenceNumber[10]);
  const month = monthCode > 50 ? monthCode - 50 : monthCode;

  if (!Number.isInteger(decade) || !Number.isInteger(yearUnit) || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const twoDigitYear = decade * 10 + yearUnit;
  const currentYear = new Date().getUTCFullYear();
  let fullYear = Math.floor(currentYear / 100) * 100 + twoDigitYear;
  if (fullYear > currentYear) fullYear -= 100;
  if (currentYear - fullYear > 120) fullYear += 100;

  const birthDate = new Date(Date.UTC(fullYear, month - 1, day));
  if (
    birthDate.getUTCFullYear() !== fullYear ||
    birthDate.getUTCMonth() !== month - 1 ||
    birthDate.getUTCDate() !== day
  ) {
    return null;
  }

  return birthDate.toISOString().slice(0, 10);
}

export function doesLicenceDateOfBirthMatchAccount(accountDateOfBirth?: string | null, licenceDateOfBirth?: string | null) {
  const accountDob = normaliseDateOnly(accountDateOfBirth);
  const licenceDob = normaliseDateOnly(licenceDateOfBirth);
  return Boolean(accountDob && licenceDob && accountDob === licenceDob);
}

function getConfiguredDemoLicenceNumbers() {
  return [
    process.env.LDA_PROVISIONAL_LICENCE_TEST_NUMBER,
    process.env.LDA_PROVISIONAL_LICENSE_TEST_NUMBER,
    process.env.LDA_PROVISIONAL_LICENCE_TEST_NUMBERS,
    process.env.LDA_PROVISIONAL_LICENSE_TEST_NUMBERS
  ]
    .flatMap((value) => (value ?? "").split(","))
    .map((value) => normaliseDrivingLicenceNumber(value))
    .filter(Boolean);
}

function isConfiguredDemoLicenceNumber(licenceNumber: string) {
  const configuredLicences = getConfiguredDemoLicenceNumbers();
  return configuredLicences.includes(licenceNumber);
}

function findDateOfBirthInPayload(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;

  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    if (/date.*birth|birth.*date/i.test(key) && typeof nestedValue === "string") {
      const date = normaliseDateOnly(nestedValue);
      if (date) return date;
    }

    if (nestedValue && typeof nestedValue === "object") {
      const nestedDate = findDateOfBirthInPayload(nestedValue);
      if (nestedDate) return nestedDate;
    }
  }

  return null;
}

export async function markProvisionalLicenceConfirmed(supabase: SupabaseClient | null, userId: string) {
  if (!supabase) {
    return { error: new Error("Secure account access is temporarily unavailable.") };
  }

  const { error } = await supabase.from("learner_profiles").upsert(
    {
      user_id: userId,
      provisional_licence_confirmed_at: new Date().toISOString()
    },
    { onConflict: "user_id" }
  );

  return { error };
}

async function saveLicenceVerificationMetadata({
  supabase,
  userId,
  drivingLicenceNumber,
  licenceDateOfBirth
}: {
  supabase: SupabaseClient | null;
  userId: string;
  drivingLicenceNumber: string;
  licenceDateOfBirth: string;
}) {
  const data = {
    provisional_licence_number: drivingLicenceNumber,
    provisional_licence_date_of_birth: licenceDateOfBirth,
    provisional_licence_dob_matched_at: new Date().toISOString()
  };
  const authClient = supabase?.auth as
    | {
        updateUser?: (attributes: { data: typeof data }) => Promise<{ error: Error | null }>;
        admin?: {
          updateUserById?: (id: string, attributes: { user_metadata: typeof data }) => Promise<{ error: Error | null }>;
        };
      }
    | undefined;

  if (authClient?.admin?.updateUserById) {
    return authClient.admin.updateUserById(userId, { user_metadata: data });
  }

  if (authClient?.updateUser) {
    return authClient.updateUser({ data });
  }

  return { error: new Error("Secure account updates are temporarily unavailable.") };
}

export async function verifyAndSaveProvisionalLicence({
  supabase,
  userId,
  drivingLicenceNumber,
  permissionConfirmed
}: VerifyProvisionalLicenceInput): Promise<ProvisionalLicenceVerificationResult> {
  const normalisedLicence = normaliseDrivingLicenceNumber(drivingLicenceNumber);
  const result = await verifyProvisionalLicenceNumber({
    drivingLicenceNumber: normalisedLicence,
    permissionConfirmed
  });

  if (!result.valid) {
    return result;
  }

  const { data: learnerProfile, error: learnerProfileError } = await supabase
    ?.from("learner_profiles")
    .select("date_of_birth")
    .eq("user_id", userId)
    .maybeSingle() ?? { data: null, error: new Error("Secure account access is temporarily unavailable.") };
  const accountDateOfBirth = normaliseDateOnly((learnerProfile as { date_of_birth?: string | null } | null)?.date_of_birth);
  const licenceDateOfBirth = normaliseDateOnly(result.licenceDateOfBirth);

  if (learnerProfileError) {
    return {
      valid: false,
      mode: result.mode,
      message: "LDA could not read your account date of birth before checking your licence.",
      status: 500
    };
  }

  if (!accountDateOfBirth) {
    return {
      valid: false,
      mode: result.mode,
      message: "Add your account date of birth before verifying your provisional licence.",
      status: 400
    };
  }

  if (!licenceDateOfBirth || !doesLicenceDateOfBirthMatchAccount(accountDateOfBirth, licenceDateOfBirth)) {
    return {
      valid: false,
      mode: result.mode,
      licenceDateOfBirth,
      message: "The date of birth on this licence does not match the date of birth saved to your LDA account.",
      status: 400
    };
  }

  const { error } = await markProvisionalLicenceConfirmed(supabase, userId);
  if (error) {
    console.error("[dvla.verify] licence confirmation could not be saved", {
      userId,
      message: error.message
    });
    return {
      valid: false,
      mode: result.mode,
      message: result.mode === "live"
        ? "DVLA live check passed, but LDA could not save the confirmation."
        : "Licence check passed in demo mode, but LDA could not save the confirmation.",
      status: 500
    };
  }

  const { error: metadataError } = await saveLicenceVerificationMetadata({
    supabase,
    userId,
    drivingLicenceNumber: normalisedLicence,
    licenceDateOfBirth
  });

  if (metadataError) {
    console.error("[dvla.verify] licence number could not be saved to auth metadata", {
      userId,
      message: metadataError.message
    });
  }

  return {
    ...result,
    licenceDateOfBirth,
    message: result.mode === "live"
      ? "DVLA live check passed, the licence date of birth matches your account, and provisional status was saved."
      : "Demo licence check passed, the licence date of birth matches your account, and provisional status was saved. Add authorised DVLA credentials before taking live bookings."
  };
}

export async function verifyProvisionalLicenceNumber({
  drivingLicenceNumber,
  permissionConfirmed
}: VerifyProvisionalLicenceNumberInput): Promise<ProvisionalLicenceVerificationResult> {
  const normalisedLicence = normaliseDrivingLicenceNumber(drivingLicenceNumber);
  const encodedLicenceDateOfBirth = getLicenceDateOfBirthFromNumber(normalisedLicence);

  if (!permissionConfirmed) {
    return {
      valid: false,
      message: "Permission is required before checking DVLA data.",
      status: 400
    };
  }

  if (!/^[A-Z0-9]{16}$/.test(normalisedLicence)) {
    return {
      valid: false,
      message: "Enter a valid 16-character GB photocard driving licence number.",
      status: 400
    };
  }

  if (!encodedLicenceDateOfBirth) {
    return {
      valid: false,
      message: "LDA could not read a valid date of birth from that GB photocard licence number.",
      status: 400
    };
  }

  const dvlaApiKey = process.env.DVLA_ACCESS_TO_DRIVER_DATA_API_KEY;
  const dvlaJwt = process.env.DVLA_ACCESS_TO_DRIVER_DATA_JWT;
  const allowDemoVerification = isRuntimeStripeTestModeAllowed();
  const endpoint =
    process.env.DVLA_ACCESS_TO_DRIVER_DATA_URL ??
    "https://driver-vehicle-licensing.api.gov.uk/full-driver-enquiry/v1/driving-licences/retrieve";

  if (!dvlaApiKey || !dvlaJwt) {
    if (!allowDemoVerification) {
      return {
        valid: false,
        mode: "configuration",
        message: "DVLA live verification is not configured. Demo licence checks are only available when STRIPE_MODE is test and STRIPE_ALLOW_TEST_MODE_IN_PRODUCTION is true.",
        status: 503
      };
    }

    if (!isConfiguredDemoLicenceNumber(normalisedLicence)) {
      return {
        valid: false,
        mode: "configuration",
        message: "This provisional licence number is not approved for LDA demo verification.",
        status: 400
      };
    }

    return {
      valid: true,
      mode: "demo",
      message: "Demo licence check passed. Add authorised DVLA credentials before taking live bookings.",
      status: 200,
      licenceDateOfBirth: encodedLicenceDateOfBirth
    };
  }

  let response: Response;
  let payload: unknown = null;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${dvlaJwt}`,
        "Content-Type": "application/json",
        "X-API-Key": dvlaApiKey
      },
      body: JSON.stringify({
        drivingLicenceNumber: normalisedLicence,
        includeCPC: false,
        includeTacho: false,
        acceptPartialResponse: false
      })
    });
    payload = await response.json().catch(() => null);
  } catch {
    return {
      valid: false,
      mode: "live",
      message: "DVLA verification could not be reached. Try again before booking.",
      status: 502
    };
  }

  if (!response.ok) {
    return {
      valid: false,
      mode: "live",
      message: "DVLA could not verify that licence number.",
      status: 400
    };
  }

  return {
    valid: true,
    mode: "live",
    message: "DVLA live check passed.",
    status: 200,
    licenceDateOfBirth: findDateOfBirthInPayload(payload) ?? encodedLicenceDateOfBirth
  };
}
