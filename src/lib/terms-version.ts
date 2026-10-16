export const CURRENT_TERMS_VERSION = "2026-10-16-verification-and-responsibilities";

export const CURRENT_TERMS_LABEL = "October 2026 verification and responsibilities update";

export const CURRENT_TERMS_MESSAGE =
  "Accept the updated LDA Terms and Conditions before booking lessons or going live for work.";

export type TermsVersionProfile = {
  terms_version_accepted?: string | null;
};

export function hasAcceptedCurrentTerms(profile?: TermsVersionProfile | null) {
  return profile?.terms_version_accepted === CURRENT_TERMS_VERSION;
}
