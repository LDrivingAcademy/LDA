import { createHash } from "crypto";

export type InstructorFinanceProfile = {
  payout?: {
    payeeName: string;
    bankName: string;
    accountEnding: string;
    sortCodeEnding: string;
    schedule: string;
    stripeExternalAccountId?: string | null;
    verificationStatus: string;
    savedAt: string;
  };
  tax?: {
    tradingStatus: string;
    utrEnding: string;
    nationalInsuranceEnding: string;
    taxCode?: string;
    vatStatus: string;
    vatNumberEnding?: string;
    utrCheckStatus: string;
    nationalInsuranceCheckStatus: string;
    hmrcCheckStatus: string;
    savedAt: string;
  };
};

const forbiddenNiPrefixes = new Set(["BG", "GB", "NK", "KN", "TN", "NT", "ZZ"]);

export function cleanDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function normaliseNiNumber(value: string) {
  return value.toUpperCase().replace(/\s/g, "");
}

export function maskEnding(value: string, length = 4) {
  const cleaned = value.replace(/\s/g, "");
  return cleaned ? cleaned.slice(-length).padStart(length, "*") : "";
}

export function hashSensitiveValue(value: string) {
  return createHash("sha256").update(value.trim().toUpperCase()).digest("hex");
}

export function validateUkSortCode(value: string) {
  const digits = cleanDigits(value);
  return {
    ok: /^\d{6}$/.test(digits),
    digits,
    message: "Sort code must be 6 digits."
  };
}

export function validateUkAccountNumber(value: string) {
  const digits = cleanDigits(value);
  return {
    ok: /^\d{8}$/.test(digits),
    digits,
    message: "Account number must be 8 digits."
  };
}

export function validateUtr(value: string) {
  const digits = cleanDigits(value);
  return {
    ok: /^\d{10}$/.test(digits),
    digits,
    message: "UTR must be a 10-digit HMRC reference."
  };
}

export function validateNationalInsurance(value: string) {
  const normalised = normaliseNiNumber(value);
  const match = normalised.match(/^([A-CEGHJ-PR-TW-Z]{2})(\d{6})([A-D])$/);
  const prefix = match?.[1] ?? "";
  const ok = Boolean(match) && !forbiddenNiPrefixes.has(prefix);

  return {
    ok,
    normalised,
    message: "National Insurance number must use the official 2 letters, 6 numbers, final letter format."
  };
}

export function validateVatNumber(value: string) {
  const digits = cleanDigits(value);
  return {
    ok: !digits || /^\d{9}$/.test(digits) || /^\d{12}$/.test(digits),
    digits,
    message: "UK VAT number should normally be 9 digits, or 12 digits for branch registrations."
  };
}

