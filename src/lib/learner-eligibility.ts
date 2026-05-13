export function latestEligibleDateOfBirth() {
  const today = new Date();
  const eligible = new Date(Date.UTC(today.getUTCFullYear() - 17, today.getUTCMonth(), today.getUTCDate()));
  return eligible.toISOString().slice(0, 10);
}

export function isAtLeast17(dateValue: string) {
  const [year, month, day] = dateValue.split("-").map(Number);

  if (!year || !month || !day) {
    return false;
  }

  const birthDate = new Date(Date.UTC(year, month - 1, day));

  if (
    birthDate.getUTCFullYear() !== year ||
    birthDate.getUTCMonth() !== month - 1 ||
    birthDate.getUTCDate() !== day
  ) {
    return false;
  }

  return dateValue <= latestEligibleDateOfBirth();
}

export function hasCompletedLearnerEligibility(profile?: {
  date_of_birth?: string | null;
  provisional_licence_confirmed_at?: string | null;
  terms_accepted_at?: string | null;
} | null) {
  return Boolean(
    profile?.date_of_birth &&
      isAtLeast17(profile.date_of_birth) &&
      profile.provisional_licence_confirmed_at &&
      profile.terms_accepted_at
  );
}
