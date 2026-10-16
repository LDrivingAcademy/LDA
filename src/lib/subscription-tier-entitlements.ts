import type { InstructorPackageId } from "@/lib/instructor-packages";
import type { LearnerPackageId } from "@/lib/learner-packages";

export type LearnerPremiumFeatureKey =
  | "learner-plus-topic-allowance"
  | "learner-plus-weak-areas"
  | "learner-pro-test-readiness"
  | "learner-pro-first-car"
  | "learner-pro-insurance";

export type InstructorPremiumFeatureKey =
  | "instructor-plus-profile"
  | "instructor-plus-availability"
  | "instructor-plus-growth"
  | "instructor-pro-demand"
  | "instructor-pro-exports";

export type SubscriptionResetCadence = "daily" | "weekly";

export type LearnerAllowanceKey =
  | "topicQuizzesPerDay"
  | "fullTheoryMocksPerDay"
  | "individualHazardClipsPerDay"
  | "fullHazardMocksPerWeek";

export type LearnerPackageEntitlements = {
  packageId: LearnerPackageId;
  allowances: Record<LearnerAllowanceKey, number>;
  reset: Record<LearnerAllowanceKey, SubscriptionResetCadence>;
  resetTimezone: "Europe/London";
  essentialFeatures: string[];
  premiumFeatures: LearnerPremiumFeatureKey[];
};

export type InstructorPackageEntitlements = {
  packageId: InstructorPackageId;
  essentialFeatures: string[];
  premiumFeatures: InstructorPremiumFeatureKey[];
};

export type PremiumFeature<TPackageId extends string, TFeatureKey extends string> = {
  key: TFeatureKey;
  title: string;
  description: string;
  minimumPackageId: TPackageId;
};

export const learnerPackageRank: Record<LearnerPackageId, number> = {
  learner: 1,
  "learner-plus": 2,
  "learner-pro": 3,
};

export const instructorPackageRank: Record<InstructorPackageId, number> = {
  instructor: 1,
  "instructor-plus": 2,
  "instructor-pro": 3,
};

export const learnerPremiumFeatures: PremiumFeature<LearnerPackageId, LearnerPremiumFeatureKey>[] = [
  {
    key: "learner-plus-topic-allowance",
    title: "Larger theory and hazard practice allowance",
    description: "Learner Plus unlocks more topic quizzes, mock theory tests, individual hazard clips, and full hazard mocks for heavier revision days.",
    minimumPackageId: "learner-plus",
  },
  {
    key: "learner-plus-weak-areas",
    title: "Detailed weak-area recommendations",
    description: "See clearer topic and hazard categories to revisit after practice, without changing the official-learning source links.",
    minimumPackageId: "learner-plus",
  },
  {
    key: "learner-pro-test-readiness",
    title: "Advanced test-readiness tracker",
    description: "Track stronger readiness signals across theory, hazard awareness, lesson confidence, and practical-test preparation.",
    minimumPackageId: "learner-pro",
  },
  {
    key: "learner-pro-first-car",
    title: "First-car checklist",
    description: "Build a safety, running-cost, and ownership checklist for first-car decisions. Live listings are not connected.",
    minimumPackageId: "learner-pro",
  },
  {
    key: "learner-pro-insurance",
    title: "Insurance preparation pack",
    description: "Prepare the details usually needed for insurance quotes. This is preparation support, not a live broker or quote service.",
    minimumPackageId: "learner-pro",
  },
];

export const instructorPremiumFeatures: PremiumFeature<InstructorPackageId, InstructorPremiumFeatureKey>[] = [
  {
    key: "instructor-plus-profile",
    title: "Enhanced profile presentation",
    description: "Add clearer teaching-strength, accessibility-support, and service-detail sections once LDA has approved the instructor profile.",
    minimumPackageId: "instructor-plus",
  },
  {
    key: "instructor-plus-availability",
    title: "Availability templates and quiet-hour tools",
    description: "Use stronger scheduling controls for repeated availability patterns, booking boundaries, and learner-contact expectations.",
    minimumPackageId: "instructor-plus",
  },
  {
    key: "instructor-plus-growth",
    title: "Basic growth insights",
    description: "See practical profile and booking signals without promising guaranteed bookings or paid queue priority.",
    minimumPackageId: "instructor-plus",
  },
  {
    key: "instructor-pro-demand",
    title: "Advanced demand and multi-area planning",
    description: "Review area and time-of-week booking patterns to plan coverage. Suitability, safety, availability, and learner need still come first.",
    minimumPackageId: "instructor-pro",
  },
  {
    key: "instructor-pro-exports",
    title: "Exportable records and specialist operations",
    description: "Prepare high-volume learner records, specialist-service presentation, and reporting support for larger instructor operations.",
    minimumPackageId: "instructor-pro",
  },
];

const learnerEssentialFeatures = [
  "Find and compare approved instructors",
  "Use Smart Match preferences, including accessibility and communication needs",
  "Book scheduled and on-demand lessons",
  "Pay, cancel, review receipts, and manage lesson records",
  "Message instructors about confirmed bookings",
  "Use official theory learning links and essential LDA support",
];

const instructorEssentialFeatures = [
  "Apply for verification and maintain an approved profile",
  "Receive, accept, decline, and manage booking requests",
  "Manage availability, lesson records, learner communication, and reviews",
  "View earnings, payout records, cancellations, refunds, and support records",
  "Use core safety, compliance, and account support features",
];

export const learnerPackageEntitlements: Record<LearnerPackageId, LearnerPackageEntitlements> = {
  learner: {
    packageId: "learner",
    allowances: {
      topicQuizzesPerDay: 5,
      fullTheoryMocksPerDay: 1,
      individualHazardClipsPerDay: 3,
      fullHazardMocksPerWeek: 1,
    },
    reset: {
      topicQuizzesPerDay: "daily",
      fullTheoryMocksPerDay: "daily",
      individualHazardClipsPerDay: "daily",
      fullHazardMocksPerWeek: "weekly",
    },
    resetTimezone: "Europe/London",
    essentialFeatures: learnerEssentialFeatures,
    premiumFeatures: [],
  },
  "learner-plus": {
    packageId: "learner-plus",
    allowances: {
      topicQuizzesPerDay: 20,
      fullTheoryMocksPerDay: 5,
      individualHazardClipsPerDay: 15,
      fullHazardMocksPerWeek: 3,
    },
    reset: {
      topicQuizzesPerDay: "daily",
      fullTheoryMocksPerDay: "daily",
      individualHazardClipsPerDay: "daily",
      fullHazardMocksPerWeek: "weekly",
    },
    resetTimezone: "Europe/London",
    essentialFeatures: learnerEssentialFeatures,
    premiumFeatures: ["learner-plus-topic-allowance", "learner-plus-weak-areas"],
  },
  "learner-pro": {
    packageId: "learner-pro",
    allowances: {
      topicQuizzesPerDay: 50,
      fullTheoryMocksPerDay: 10,
      individualHazardClipsPerDay: 40,
      fullHazardMocksPerWeek: 7,
    },
    reset: {
      topicQuizzesPerDay: "daily",
      fullTheoryMocksPerDay: "daily",
      individualHazardClipsPerDay: "daily",
      fullHazardMocksPerWeek: "weekly",
    },
    resetTimezone: "Europe/London",
    essentialFeatures: learnerEssentialFeatures,
    premiumFeatures: [
      "learner-plus-topic-allowance",
      "learner-plus-weak-areas",
      "learner-pro-test-readiness",
      "learner-pro-first-car",
      "learner-pro-insurance",
    ],
  },
};

export const instructorPackageEntitlements: Record<InstructorPackageId, InstructorPackageEntitlements> = {
  instructor: {
    packageId: "instructor",
    essentialFeatures: instructorEssentialFeatures,
    premiumFeatures: [],
  },
  "instructor-plus": {
    packageId: "instructor-plus",
    essentialFeatures: instructorEssentialFeatures,
    premiumFeatures: ["instructor-plus-profile", "instructor-plus-availability", "instructor-plus-growth"],
  },
  "instructor-pro": {
    packageId: "instructor-pro",
    essentialFeatures: instructorEssentialFeatures,
    premiumFeatures: [
      "instructor-plus-profile",
      "instructor-plus-availability",
      "instructor-plus-growth",
      "instructor-pro-demand",
      "instructor-pro-exports",
    ],
  },
};

export function learnerPackageIncludesFeature(packageId: LearnerPackageId, requiredPackageId: LearnerPackageId) {
  return learnerPackageRank[packageId] >= learnerPackageRank[requiredPackageId];
}

export function instructorPackageIncludesFeature(packageId: InstructorPackageId, requiredPackageId: InstructorPackageId) {
  return instructorPackageRank[packageId] >= instructorPackageRank[requiredPackageId];
}

export function normaliseSubscriptionReturnPath(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;

  const trimmed = value.trim();
  if (!trimmed || !trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.startsWith("/api/")) {
    return fallback;
  }

  return trimmed;
}
