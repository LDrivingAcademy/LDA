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

export const currentLearnerPackageId: LearnerPackageId = "learner-plus";

export const learnerPackages: LearnerPackage[] = [
  {
    id: "learner",
    slug: "learner",
    rank: 1,
    name: "Learner",
    price: "Free",
    monthlyPrice: "Free",
    yearlyPrice: "Free",
    label: "Core access",
    summary: "The essential LDA account for booking lessons and managing your learner record.",
    features: [
      "Search approved local instructors",
      "Book and pay securely through LDA",
      "Booking history and cancellation tools",
      "Instructor ratings and written reviews"
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
    price: "From £7.99/month",
    monthlyPrice: "£7.99 per month",
    yearlyPrice: "£79 per year",
    label: "Current plan",
    highlighted: true,
    summary: "More guidance, stronger SmartMatch weighting, and priority learner support.",
    stripePriceEnv: {
      monthly: "STRIPE_LEARNER_PLUS_MONTHLY_PRICE_ID",
      yearly: "STRIPE_LEARNER_PLUS_YEARLY_PRICE_ID"
    },
    features: [
      "Premium LDA SmartMatch weighting",
      "Priority learner support for booking issues",
      "Deeper progress tracker recommendations",
      "Early access to lesson bundles and launch offers"
    ],
    breakdown: [
      {
        heading: "Smarter matching",
        body: "SmartMatch can prioritise support preferences, instructor strengths, availability, rating quality, and lesson goals when suggesting instructors."
      },
      {
        heading: "Better revision support",
        body: "Learner Plus is prepared for richer after-lesson revision, lesson-plan reminders, and targeted videos based on instructor feedback."
      },
      {
        heading: "Priority help",
        body: "Booking issues, payment questions, and lesson changes can be triaged ahead of standard learner support once the paid tier is enabled."
      }
    ]
  },
  {
    id: "learner-pro",
    slug: "learner-pro",
    rank: 3,
    name: "Learner Pro",
    price: "From £14.99/month",
    monthlyPrice: "£14.99 per month",
    yearlyPrice: "£149 per year",
    label: "Full support",
    stripePriceEnv: {
      monthly: "STRIPE_LEARNER_PRO_MONTHLY_PRICE_ID",
      yearly: "STRIPE_LEARNER_PRO_YEARLY_PRICE_ID"
    },
    summary: "Full learner journey support from theory prep through first-car and insurance guidance.",
    features: [
      "Advanced theory and hazard practice plans",
      "Practical test readiness checklist",
      "First-car and insurance quote support",
      "Personalised revision and confidence coaching"
    ],
    breakdown: [
      {
        heading: "Theory and hazard preparation",
        body: "Prepared for deeper mock theory tests, hazard awareness exercises, and revision recommendations before official test booking."
      },
      {
        heading: "Practical test readiness",
        body: "Includes structured readiness checks, instructor sign-off context, route-confidence planning, and final test preparation prompts."
      },
      {
        heading: "After passing",
        body: "Designed to unlock first-car guidance, insurance quote support, Pass Plus pathways, motorway confidence, and post-test road confidence."
      }
    ]
  }
];

export function getLearnerPackage(packageId: string) {
  return learnerPackages.find((learnerPackage) => learnerPackage.id === packageId || learnerPackage.slug === packageId);
}

export function getCurrentLearnerPackage() {
  return getLearnerPackage(currentLearnerPackageId) ?? learnerPackages[1];
}

export function getPackageActionLabel(packageId: LearnerPackageId) {
  const currentPackage = getCurrentLearnerPackage();
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
