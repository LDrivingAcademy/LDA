export type LegalPageContent = {
  title: string;
  intro: string;
  updated: string;
  sections: Array<{ heading: string; body: string[] }>;
};

export const legalPages: Record<string, LegalPageContent> = {
  privacy: {
    title: "Privacy policy",
    intro: "How LDA expects to collect, use, share, retain, and protect personal data for learners, instructors, admins, support, payments, safety, and legal obligations.",
    updated: "Draft placeholder - solicitor and data protection review required before launch.",
    sections: [
      {
        heading: "Data we collect",
        body: [
          "Learners: account details, contact details, booking details, pickup postcode, eligibility confirmations, payment references, support messages, reviews, and safety-related records.",
          "Instructors: account details, ADI/PDI status and number, profile details, car and areas covered, availability, payout references, verification documents, and booking records.",
          "We should not collect unnecessary special category data. Location tracking should only be used for accepted bookings near lesson time and with clear consent."
        ]
      },
      {
        heading: "Why we use data",
        body: [
          "To create accounts, verify instructors, show approved instructors in search, take bookings, process payments, send service messages, manage support, prevent misuse, handle disputes, and comply with legal obligations.",
          "Marketing should be opt-in where required. Operational booking emails are separate from marketing."
        ]
      },
      {
        heading: "Sharing and processors",
        body: [
          "Planned processors include Supabase for auth/database/storage, Stripe for payments, Google Maps/Postcodes.io for location and distance features, and Resend or SendGrid for email.",
          "Stripe should handle card data directly. LDA should store payment references and status, not raw card details."
        ]
      },
      {
        heading: "Retention and rights",
        body: [
          "Account, booking, payment, verification, support, and dispute records need clear retention periods before launch.",
          "Users need a route to request access, correction, deletion, restriction, portability, objection, and account deletion. Some records may need retaining for legal, fraud prevention, tax, safety, or dispute reasons."
        ]
      }
    ]
  },
  terms: {
    title: "Terms of service",
    intro: "Marketplace terms for learners, instructors, bookings, payments, acceptable use, account rules, and platform limits.",
    updated: "Draft placeholder - solicitor review required before launch.",
    sections: [
      {
        heading: "Marketplace role",
        body: [
          "LDA is intended to connect learner drivers with independent verified driving instructors. Final wording must explain whether LDA acts as agent, marketplace, payment facilitator, or direct supplier for each part of the service.",
          "Instructor profiles, prices, availability, and areas covered must be accurate and kept up to date."
        ]
      },
      {
        heading: "Learner responsibilities",
        body: [
          "Learners must be at least 17 before booking paid lessons and must confirm they hold a valid UK provisional licence where required.",
          "Learners must provide accurate pickup details and attend lessons on time."
        ]
      },
      {
        heading: "Instructor responsibilities",
        body: [
          "Instructors must provide accurate ADI/PDI details, maintain insurance and licence evidence, deliver lessons professionally, and comply with applicable UK driving instruction rules.",
          "Instructors cannot appear in public search until admin approval is granted."
        ]
      },
      {
        heading: "Payments and fees",
        body: [
          "Learners must see the full lesson price before payment. Platform commission and instructor payout rules must be finalised before launch.",
          "Stripe Connect should handle payment processing, refunds, disputes, and payout references."
        ]
      }
    ]
  },
  cancellation: {
    title: "Cancellation and refund policy",
    intro: "How learners, instructors, and admins should handle cancellations, rescheduling, refunds, disputes, and no-shows.",
    updated: "Draft placeholder - solicitor review required before launch.",
    sections: [
      {
        heading: "Before booking",
        body: [
          "The learner must see lesson price, instructor, time, pickup postcode, cancellation window, and payment method before checkout.",
          "The payment button must make clear that the learner is placing a paid order."
        ]
      },
      {
        heading: "Cancellation window",
        body: [
          "Current MVP setting uses a 24-hour default cancellation window. Cancellations made more than 24 hours before the lesson can be eligible for a full refund, subject to payment processor timing.",
          "Cancellations inside 24 hours may be eligible for a partial refund or manual review, depending on instructor availability, travel, and whether the instructor could reasonably replace the lesson slot.",
          "Very late cancellations, including cancellations close to instructor en-route time, may be non-refundable unless LDA support approves an exception.",
          "The final solicitor-reviewed policy must explain what happens when instructors cancel, are late, or cannot deliver a lesson."
        ]
      },
      {
        heading: "Refunds and disputes",
        body: [
          "Admins need manual controls for refund decisions and Stripe dispute references.",
          "Refund timing depends on Stripe and payment method processing times."
        ]
      }
    ]
  },
  cookies: {
    title: "Cookie notice",
    intro: "How LDA expects to use essential cookies and optional analytics/marketing cookies.",
    updated: "Draft placeholder - cookie audit required before launch.",
    sections: [
      {
        heading: "Essential cookies",
        body: [
          "Authentication/session cookies are required for secure login, dashboard access, booking flows, and fraud prevention.",
          "These should be kept to the minimum necessary for service delivery."
        ]
      },
      {
        heading: "Optional cookies",
        body: [
          "Analytics, marketing, heatmap, or advertising cookies should not be set until consent is collected where required.",
          "Google Maps may set third-party cookies or process user data depending on implementation; final cookie notice must reflect actual production setup."
        ]
      }
    ]
  },
  "data-requests": {
    title: "Account deletion and data requests",
    intro: "A placeholder flow for users to request account deletion, access, correction, restriction, portability, objection, and other data rights.",
    updated: "Draft placeholder - data protection review required before launch.",
    sections: [
      {
        heading: "How to request",
        body: [
          "Users can contact support with the email address on their account and describe the request they want to make.",
          "LDA should verify identity before acting on sensitive requests."
        ]
      },
      {
        heading: "Account deletion",
        body: [
          "Deleting an account may not immediately delete records that LDA must retain for bookings, payments, legal obligations, safety, tax, fraud prevention, or dispute handling.",
          "The production app should include a self-serve deletion request button in account settings."
        ]
      },
      {
        heading: "Response timing",
        body: [
          "UK GDPR rights requests generally need a structured response process. Final operational timing and exceptions should be reviewed before launch."
        ]
      }
    ]
  },
  contact: {
    title: "Contact and support",
    intro: "Support routes for learner bookings, instructor onboarding, verification, payments, refunds, disputes, and data requests.",
    updated: "Operational placeholder.",
    sections: [
      {
        heading: "Support email",
        body: [
          "Use info@ldrivingacademy.co.uk for launch preparation, support, and data request handling.",
          "Before launch, configure Resend or SendGrid and verify the sending domain so booking and support emails are trusted."
        ]
      },
      {
        heading: "What to include",
        body: [
          "Learners should include booking reference, instructor name, lesson date/time, pickup postcode, and a clear description of the issue.",
          "Instructors should include their account email, ADI/PDI number where relevant, and any verification or payout reference."
        ]
      }
    ]
  }
};
