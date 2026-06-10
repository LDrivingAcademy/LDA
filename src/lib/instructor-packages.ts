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
    label: "Core access",
    summary:
      "The essential LDA instructor account for onboarding, availability, bookings, and payout visibility.",
    features: [
      "Submit ADI/PDI verification",
      "Publish an approved instructor profile",
      "Manage availability and booking requests",
      "Track confirmed bookings and payout status",
      "Build protected LDA learner history, reviews, and repeat-booking signals",
      "Core LDA AI for vehicle, lesson, and safety guidance",
    ],
    breakdown: [
      {
        heading: "Verified marketplace profile",
        body: "Upload instructor evidence, set your profile details, and wait for admin approval before appearing in learner search.",
      },
      {
        heading: "Booking basics",
        body: "Manage availability, accept or decline bookings, keep upcoming lessons visible in one instructor dashboard, and keep LDA-introduced learners inside the protected booking flow.",
      },
      {
        heading: "Payout readiness",
        body: "Prepared for Stripe Connect payout status and earnings tracking once instructor payments are fully enabled.",
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
    price: "From Â£12.99/month",
    monthlyPrice: "Â£12.99 per month",
    yearlyPrice: "Â£129 per year",
    label: "Growth tools",
    highlighted: true,
    summary:
      "Higher visibility, stronger SmartMatch profile signals, and better booking support for active instructors.",
    stripePriceEnv: {
      monthly: "STRIPE_INSTRUCTOR_PLUS_MONTHLY_PRICE_ID",
      yearly: "STRIPE_INSTRUCTOR_PLUS_YEARLY_PRICE_ID",
    },
    features: [
      "Priority placement in relevant local searches",
      "Enhanced availability and quiet-hours controls",
      "SmartMatch teaching-strength badges",
      "Priority instructor support for booking issues",
      "Stronger repeat-learner and conversion signals",
      "Plus LDA AI for learner-plan summaries, support needs, and message condensation",
    ],
    breakdown: [
      {
        heading: "Better local visibility",
        body: "Designed to help approved instructors stand out in relevant postcode, transmission, price, and availability searches.",
      },
      {
        heading: "SmartMatch strengths",
        body: "Prepared for badges such as Pass Plus, night driving, motorway confidence, accessibility support, and learner anxiety support.",
      },
      {
        heading: "Adaptive AI workflow",
        body: "Instructor Plus is designed to help summarise learner needs, prepare lesson plans, condense long messages, and connect recurring learner questions back into SmartMatch.",
      },
      {
        heading: "Booking support",
        body: "Instructor Plus can prioritise support for scheduling, cancellation, dispute, and payout questions once live operations begin.",
      },
      {
        heading: "Retention tools",
        body: "Designed to help instructors convert first bookings into repeat learners through progress records, reminders, reviews, and platform-managed lesson history.",
      },
    ],
  },
  {
    id: "instructor-pro",
    slug: "instructor-pro",
    rank: 3,
    name: "Instructor Pro",
    price: "From Â£24.99/month",
    monthlyPrice: "Â£24.99 per month",
    yearlyPrice: "Â£249 per year",
    label: "Studio support",
    summary:
      "Advanced instructor growth tools for high-volume instructors and specialist lesson services.",
    stripePriceEnv: {
      monthly: "STRIPE_INSTRUCTOR_PRO_MONTHLY_PRICE_ID",
      yearly: "STRIPE_INSTRUCTOR_PRO_YEARLY_PRICE_ID",
    },
    features: [
      "Advanced profile insights and conversion signals",
      "Multi-area route and demand planning",
      "Premium matching for Pass Plus and specialist lessons",
      "Early access to instructor growth tools",
      "Demand, retention, and leakage-risk insights",
      "Pro LDA AI for compliance reminders, demand insight, and connector-ready operations checks",
    ],
    breakdown: [
      {
        heading: "Performance insight",
        body: "Prepared for search visibility, booking conversion, review quality, and lesson demand signals to help instructors improve their profile.",
      },
      {
        heading: "Specialist services",
        body: "Built for instructors who offer Pass Plus, motorway lessons, night driving, refresher lessons, accessibility support, or advanced confidence coaching.",
      },
      {
        heading: "Growth planning",
        body: "Designed to support multi-area coverage, demand heatmaps, repeat learner planning, and future team-style instructor operations.",
      },
      {
        heading: "Pro AI operations",
        body: "Instructor Pro is prepared for proactive MOT, tax, insurance, service, learner-message, demand, and availability insights once account-level reminders and partner checks are connected.",
      },
      {
        heading: "Clientele operations",
        body: "Prepared for repeat-learner management, ranking health, off-platform leakage warnings, and high-volume instructor support workflows.",
      },
    ],
  },
];

export function getInstructorPackage(packageId: string) {
  return instructorPackages.find(
    (instructorPackage) => instructorPackage.id === packageId || instructorPackage.slug === packageId,
  );
}

export function getCurrentInstructorPackage() {
  return getInstructorPackage(currentInstructorPackageId) ?? instructorPackages[0];
}

export function getInstructorPackageActionLabel(packageId: InstructorPackageId) {
  const currentPackage = getCurrentInstructorPackage();
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
