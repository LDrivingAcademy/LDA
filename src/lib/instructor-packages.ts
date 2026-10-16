export type InstructorPackageId = "instructor" | "instructor-plus" | "instructor-pro";
export type BillingInterval = "monthly" | "yearly";

export type InstructorPackage = {
  id: InstructorPackageId;
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
  breakdown: Array<{
    heading: string;
    body: string;
  }>;
};

export const currentInstructorPackageId: InstructorPackageId = "instructor";

export const instructorPackages: InstructorPackage[] = [
  {
    id: "instructor",
    slug: "instructor",
    rank: 1,
    name: "Instructor",
    price: "Free",
    monthlyPrice: "Free",
    yearlyPrice: "Free",
    monthlyPricePence: 0,
    yearlyPricePence: 0,
    label: "Core access",
    summary:
      "The essential LDA instructor account for onboarding, availability, bookings, and payout visibility.",
    features: [
      "Submit ADI verification",
      "Publish an approved instructor profile",
      "Manage availability and booking requests",
      "Track confirmed bookings and payout status",
      "Build protected LDA learner history and reviews",
      "Core safety, compliance, account, and support tools",
    ],
    breakdown: [
      {
        heading: "Verified platform profile",
        body: "Upload instructor evidence, set your profile details, and wait for LDA review before appearing in learner search.",
      },
      {
        heading: "Booking basics",
        body: "Manage availability, accept or decline bookings, keep upcoming lessons visible in one instructor dashboard, and keep LDA-introduced learners inside the protected booking flow.",
      },
      {
        heading: "Payout readiness",
        body: "Prepared for secure payout status and earnings tracking once instructor payments are fully enabled.",
      },
      {
        heading: "Client growth record",
        body: "Completed LDA lessons can support learner history, progress notes, reviews, repeat bookings, support records, and future ranking signals.",
      },
    ],
  },
  {
    id: "instructor-plus",
    slug: "instructor-plus",
    rank: 2,
    name: "Instructor Plus",
    price: "From \u00a34.99/month",
    monthlyPrice: "\u00a34.99 per month",
    yearlyPrice: "\u00a359.88 per year",
    monthlyPricePence: 499,
    yearlyPricePence: 5988,
    label: "Growth tools",
    highlighted: true,
    summary:
      "Enhanced profile, availability, and growth tools for approved active instructors.",
    stripePriceEnv: {
      monthly: "STRIPE_INSTRUCTOR_PLUS_MONTHLY_PRICE_ID",
      yearly: "STRIPE_INSTRUCTOR_PLUS_YEARLY_PRICE_ID",
    },
    features: [
      "Enhanced profile sections",
      "Teaching-strength and accessibility-support badges",
      "Availability templates and quiet-hour controls",
      "Basic growth and conversion signals",
      "Clearer support context for booking, cancellation, and payout questions",
    ],
    breakdown: [
      {
        heading: "Enhanced profile",
        body: "Show more useful approved profile details, teaching strengths, support styles, and specialist services where the instructor has supplied them.",
      },
      {
        heading: "SmartMatch strengths",
        body: "Badges can highlight relevant instructor strengths, but matching must still prioritise safety, suitability, availability, distance, and learner needs.",
      },
      {
        heading: "Availability control",
        body: "Use better availability templates and quiet-hour tools so learner requests fit realistic teaching hours.",
      },
      {
        heading: "Growth signals",
        body: "See practical profile and booking signals without any promise of guaranteed bookings or paid queue priority.",
      },
      {
        heading: "Support context",
        body: "Booking, cancellation, dispute, and payout questions can carry clearer package and account context for LDA support.",
      },
    ],
  },
  {
    id: "instructor-pro",
    slug: "instructor-pro",
    rank: 3,
    name: "Instructor Pro",
    price: "From \u00a39.99/month",
    monthlyPrice: "\u00a39.99 per month",
    yearlyPrice: "\u00a3119.88 per year",
    monthlyPricePence: 999,
    yearlyPricePence: 11988,
    label: "Studio support",
    summary:
      "Advanced operations tools for high-volume instructors and specialist lesson services.",
    stripePriceEnv: {
      monthly: "STRIPE_INSTRUCTOR_PRO_MONTHLY_PRICE_ID",
      yearly: "STRIPE_INSTRUCTOR_PRO_YEARLY_PRICE_ID",
    },
    features: [
      "Advanced profile and booking insights",
      "Multi-area route and demand planning",
      "Specialist service presentation",
      "Exportable records and reporting support",
      "Compliance and maintenance reminder tools",
      "High-volume learner organisation tools",
    ],
    breakdown: [
      {
        heading: "Performance insight",
        body: "Review profile, booking, review, and availability signals to improve the way the instructor account is managed.",
      },
      {
        heading: "Specialist services",
        body: "Built for instructors who offer Pass Plus, motorway lessons, night driving, refresher lessons, accessibility support, or advanced confidence coaching.",
      },
      {
        heading: "Growth planning",
        body: "Plan multi-area coverage with LDA booking-pattern signals. This does not guarantee bookings or override learner suitability.",
      },
      {
        heading: "Operational reminders",
        body: "Use clearer compliance, maintenance, learner-record, and scheduling reminders for higher-volume teaching.",
      },
      {
        heading: "Records and reporting",
        body: "Prepare exportable records and reporting support for larger instructor operations without affecting essential free booking tools.",
      },
    ],
  },
];

export function getInstructorPackage(packageId: string) {
  return instructorPackages.find(
    (instructorPackage) => instructorPackage.id === packageId || instructorPackage.slug === packageId,
  );
}

export function getCurrentInstructorPackage(packageId: InstructorPackageId = currentInstructorPackageId) {
  return getInstructorPackage(packageId) ?? instructorPackages[0];
}

export function getInstructorPackageActionLabel(packageId: InstructorPackageId, currentPackageId: InstructorPackageId = currentInstructorPackageId) {
  const currentPackage = getCurrentInstructorPackage(currentPackageId);
  const targetPackage = getInstructorPackage(packageId);

  if (!targetPackage || targetPackage.id === currentPackage.id) {
    return "Current plan";
  }

  if (targetPackage.rank > currentPackage.rank) {
    return `Upgrade to ${targetPackage.name}`;
  }

  return `Select ${targetPackage.name}`;
}

export function getInstructorPackagePriceEnv(
  packageId: InstructorPackageId,
  billingInterval: BillingInterval,
) {
  return getInstructorPackage(packageId)?.stripePriceEnv?.[billingInterval];
}
