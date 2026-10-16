export type LearnerPackageId = "learner" | "learner-plus" | "learner-pro";
export type BillingInterval = "monthly" | "yearly";

export type LearnerPackage = {
  id: LearnerPackageId;
  slug: string;
  rank: number;
  name: string;
  price: string;
  monthlyPrice: string;
  yearlyPrice: string;
  monthlyPricePence: number;
  yearlyPricePence: number;
  label: string;
  summary: string;
  highlighted?: boolean;
  stripePriceEnv?: Partial<Record<BillingInterval, string>>;
  features: string[];
  breakdown: {
    heading: string;
    body: string;
  }[];
};

export const currentLearnerPackageId: LearnerPackageId = "learner";

export const learnerPackages: LearnerPackage[] = [
  {
    id: "learner",
    slug: "learner",
    rank: 1,
    name: "Learner",
    price: "Free",
    monthlyPrice: "Free",
    yearlyPrice: "Free",
    monthlyPricePence: 0,
    yearlyPricePence: 0,
    label: "Core access",
    summary: "The essential LDA account for booking lessons and managing your learner record.",
    features: [
      "Search approved local instructors",
      "Book scheduled and on-demand lessons through LDA",
      "Pay securely and manage receipts, cancellations, and lesson records",
      "Booking history and cancellation tools",
      "Instructor ratings and written reviews",
      "Official theory learning links, daily practice allowance, and core learner support"
    ],
    breakdown: [
      {
        heading: "Booking essentials",
        body: "Compare nearby approved instructors, view availability, book lessons, and keep your booking history in one place."
      },
      {
        heading: "Transparent payments",
        body: "Pay through LDA Checkout with the full lesson price shown before payment and cancellation policy confirmation before checkout."
      },
      {
        heading: "Progress basics",
        body: "See lesson records, after-lesson notes when your instructor shares them, and review instructors after completed lessons."
      }
    ]
  },
  {
    id: "learner-plus",
    slug: "learner-plus",
    rank: 2,
    name: "Learner Plus",
    price: "From £4.99/month",
    monthlyPrice: "£4.99 per month",
    yearlyPrice: "£59.88 per year",
    monthlyPricePence: 499,
    yearlyPricePence: 5988,
    label: "Guided support",
    highlighted: true,
    summary: "Larger theory and hazard practice allowances with better weak-area guidance for active learners.",
    stripePriceEnv: {
      monthly: "STRIPE_LEARNER_PLUS_MONTHLY_PRICE_ID",
      yearly: "STRIPE_LEARNER_PLUS_YEARLY_PRICE_ID"
    },
    features: [
      "20 topic quizzes per day",
      "5 full mock theory tests per day",
      "15 individual hazard clips per day",
      "3 full mock hazard tests per week",
      "Detailed weak-area recommendations after practice"
    ],
    breakdown: [
      {
        heading: "Higher practice allowance",
        body: "Learner Plus gives heavier revision days more room without removing the core free booking and learning features."
      },
      {
        heading: "Weak-area guidance",
        body: "Topic and hazard results can be used to highlight the areas worth revisiting before taking another mock."
      },
      {
        heading: "Revision day support",
        body: "Keep theory, topic quiz, and hazard practice work together so heavier study days do not hit the free-plan limits too quickly."
      }
    ]
  },
  {
    id: "learner-pro",
    slug: "learner-pro",
    rank: 3,
    name: "Learner Pro",
    price: "From £9.99/month",
    monthlyPrice: "£9.99 per month",
    yearlyPrice: "£119.88 per year",
    monthlyPricePence: 999,
    yearlyPricePence: 11988,
    label: "Full support",
    stripePriceEnv: {
      monthly: "STRIPE_LEARNER_PRO_MONTHLY_PRICE_ID",
      yearly: "STRIPE_LEARNER_PRO_YEARLY_PRICE_ID"
    },
    summary: "The highest learner tier for heavier practice, test-readiness tracking, and post-pass preparation tools.",
    features: [
      "50 topic quizzes per day",
      "10 full mock theory tests per day",
      "40 individual hazard clips per day",
      "7 full mock hazard tests per week",
      "First-car checklist and insurance preparation pack"
    ],
    breakdown: [
      {
        heading: "Maximum practice allowance",
        body: "Learner Pro is designed for intensive revision while still keeping full hazard mock attempts separate from individual clip practice."
      },
      {
        heading: "Practical test readiness",
        body: "Use structured readiness checks for theory, hazard awareness, lesson confidence, and practical-test preparation."
      },
      {
        heading: "After passing",
        body: "Unlock first-car and insurance preparation tools. These are preparation checklists, not live broker quotes, listings, or referrals."
      },
      {
        heading: "Future-provider honesty",
        body: "Live insurance quotes, vehicle listings, finance, and broker referrals must stay hidden until approved partners and disclosures are connected."
      }
    ]
  }
];

export function getLearnerPackage(packageId: string) {
  return learnerPackages.find((learnerPackage) => learnerPackage.id === packageId || learnerPackage.slug === packageId);
}

export function getCurrentLearnerPackage(packageId: LearnerPackageId = currentLearnerPackageId) {
  return getLearnerPackage(packageId) ?? learnerPackages[0];
}

export function getPackageActionLabel(packageId: LearnerPackageId, currentPackageId: LearnerPackageId = currentLearnerPackageId) {
  const currentPackage = getCurrentLearnerPackage(currentPackageId);
  const targetPackage = getLearnerPackage(packageId);

  if (!targetPackage || targetPackage.id === currentPackage.id) {
    return "Current plan";
  }

  if (targetPackage.rank > currentPackage.rank) {
    return `Upgrade to ${targetPackage.name}`;
  }

  return `Select ${targetPackage.name}`;
}

export function getPackagePriceEnv(packageId: LearnerPackageId, billingInterval: BillingInterval) {
  return getLearnerPackage(packageId)?.stripePriceEnv?.[billingInterval];
}
