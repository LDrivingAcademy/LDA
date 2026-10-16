export const accountDeletionDeletes = [
  "Account profile identifiers: name, email, phone number, avatar, marketing consent, and recovery contact data held in the LDA profile.",
  "Learner profile eligibility details including date of birth, provisional licence verification status, referral code, and learner subscription identifiers.",
  "Instructor profile identifiers including display name, biography, ADI number, vehicle registration, postcode, location coordinates, subscription identifiers, and learner-facing availability.",
  "In-app notifications, live location shares, future availability slots, and learner/instructor progress notes that identify the account.",
  "Uploaded instructor verification document records and matching files in LDA document storage where those files can be removed by the platform."
];

export const accountDeletionRetains = [
  "Booking ledger rows needed for accounting, platform reporting, refund handling, dispute evidence, fraud-prevention, and legal claims, with pickup/contact details stripped where possible.",
  "Payment records and Stripe references needed for tax, chargebacks, refunds, financial reconciliation, fraud-prevention, and regulatory obligations.",
  "Minimal pseudonymous internal IDs and timestamps needed to keep retained booking, payment, and review records consistent without showing the deleted account's identity.",
  "Backups until overwritten under the normal backup retention schedule, with deleted data treated as beyond active use."
];

export const accountDeletionResponseWindow =
  "LDA deactivates the account after confirmation and emails a 30-day restart link. If the account is not restarted within that window, LDA permanently deletes or anonymises removable personal data, subject to legal obligations, permitted retention, and case-by-case exemptions.";
