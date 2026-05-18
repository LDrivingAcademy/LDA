export type LegalPageContent = {
  title: string;
  intro: string;
  updated: string;
  sections: Array<{ heading: string; body: string[] }>;
};

export const legalPages: Record<string, LegalPageContent> = {
  privacy: {
    title: "Privacy Policy",
    intro: "This Privacy Policy explains how LDA / L Driving Academy collects, uses, shares, stores, and protects personal information when people use our website, learner services, instructor onboarding, booking tools, support channels, and marketplace features.",
    updated: "Effective from launch. This policy is maintained for UK GDPR, Data Protection Act 2018, PECR, consumer trust, payment security, and marketplace transparency.",
    sections: [
      {
        heading: "1. Who we are",
        body: [
          "LDA / L Driving Academy is a UK learner-driver marketplace designed to connect learners with verified driving instructors. For data protection purposes, LDA acts as the controller for account, booking, verification, support, marketing, and platform administration data unless a specific service notice states otherwise.",
          "Contact for privacy matters: info@ldrivingacademy.co.uk. Users may contact us about privacy, account data, marketing choices, deletion requests, or any concern about how their information is handled."
        ]
      },
      {
        heading: "2. Personal information we collect",
        body: [
          "For learners, we may collect name, email address, optional phone number, date of birth confirmation, provisional licence confirmation, pickup postcode or preferred lesson area, booking details, lesson history, payment references, support messages, referral or promotion code use, reviews of instructors, and communication preferences.",
          "For instructors, we may collect name, contact details, ADI/PDI status and badge number, profile information, photograph, vehicle details, transmission type, areas covered, availability, booking records, earnings and payout references, verification evidence, and support or dispute communications.",
          "For all users, we may collect technical information such as IP address, device and browser information, security logs, cookie choices, approximate location where needed for booking or live tracking, and usage information needed to keep the service secure, reliable, and responsive."
        ]
      },
      {
        heading: "3. How we use personal information",
        body: [
          "We use personal information to create and secure accounts, verify instructor eligibility, show approved instructors in search, calculate location and distance, manage availability, take bookings, process payments, send booking confirmations and service updates, handle cancellations and refunds, provide support, prevent fraud, investigate disputes, improve the platform, and comply with legal obligations.",
          "Live location features are used only where necessary for booking, nearby instructor matching, or accepted lessons near lesson time. Learners can manage location preferences in account settings where the feature allows.",
          "We do not sell personal information. We do not collect special category information unless a user chooses to share accessibility or support needs for Smart Match or lesson support. Where this happens, we use that information only to support a suitable learning experience and apply additional care to access, retention, and sharing."
        ]
      },
      {
        heading: "4. Lawful bases",
        body: [
          "We rely on different lawful bases under UK data protection law depending on the purpose. These may include contract where we provide account, booking, payment and support services; legal obligation where we keep tax, payment, safety or regulatory records; legitimate interests where we protect the platform, prevent fraud, improve services and manage disputes; and consent where required for optional marketing, non-essential cookies, or certain optional features.",
          "Where consent is used, users can withdraw it at any time. Withdrawing consent does not affect processing that took place before consent was withdrawn or processing that relies on another lawful basis."
        ]
      },
      {
        heading: "5. Payments and verification",
        body: [
          "Payments are processed securely by Stripe. LDA does not store raw card numbers, CVC codes, or full payment card details. We may store payment status, transaction identifiers, refund references, and dispute records.",
          "Instructor verification documents may be reviewed by LDA administrators or authorised verification providers. Instructors cannot appear publicly in search until approved under the platform process."
        ]
      },
      {
        heading: "6. Sharing personal information",
        body: [
          "We may share limited personal information with service providers who help us operate the platform, including hosting, authentication, database, storage, payment processing, email delivery, mapping, postcode lookup, analytics where consented, support, security, and professional advisers.",
          "Providers may include Supabase, Stripe, Vercel, Google Maps or Places, Postcodes.io, Resend or another email provider, and other suppliers added as the platform develops. Suppliers that process personal information are expected to operate under appropriate contractual and security safeguards.",
          "We may disclose information where required by law, to enforce our terms, to protect users and instructors, to respond to lawful requests, or in connection with a business transfer."
        ]
      },
      {
        heading: "7. International transfers",
        body: [
          "Some service providers may process information outside the UK. Where this happens, LDA should use appropriate safeguards such as adequacy regulations, the UK International Data Transfer Agreement, the UK Addendum to EU standard contractual clauses, or another lawful transfer mechanism."
        ]
      },
      {
        heading: "8. Retention",
        body: [
          "We keep personal information only for as long as reasonably necessary for the purpose collected, including account operation, booking history, tax and accounting, fraud prevention, safety, complaints, legal claims, disputes, and regulatory obligations.",
          "LDA keeps retention periods proportionate to the data and purpose. Account records are normally kept while an account is active; booking, payment, refund and dispute records may be kept for accounting and legal limitation periods; verification records are kept only for as long as necessary to evidence approval, safety and compliance."
        ]
      },
      {
        heading: "9. Your rights",
        body: [
          "Subject to legal conditions and exemptions, users may have rights to access their personal information, correct inaccurate information, request deletion, restrict processing, object to processing, request portability, withdraw consent, and complain to the UK Information Commissioner's Office.",
          "To make a request, contact info@ldrivingacademy.co.uk from the email address linked to the account. We may need to verify identity before responding. Users can also contact the ICO at ico.org.uk if they are unhappy with how their data is handled."
        ]
      },
      {
        heading: "10. Security",
        body: [
          "We use technical and organisational measures designed to protect personal information, including secure hosting, role-based access, authentication controls, encrypted transport, limited administrator access, audit trails where appropriate, and secure payment handling through Stripe.",
          "No online service can be guaranteed to be completely secure. Users should keep login details private and contact us promptly if they believe their account has been compromised."
        ]
      }
    ]
  },
  terms: {
    title: "Terms of Use",
    intro: "These Terms of Use set out the rules for using LDA / L Driving Academy, including learner accounts, instructor onboarding, bookings, payments, reviews, support, and platform access.",
    updated: "Effective from launch. These terms are written for LDA's learner-driver marketplace, booking, payment, instructor, and support services.",
    sections: [
      {
        heading: "1. About LDA",
        body: [
          "LDA operates as a UK learner-driver marketplace connecting learners with verified independent driving instructors. The platform helps users search, compare, book, pay, communicate, track lesson status, and manage lesson records.",
          "Driving instructors remain independent providers responsible for delivering lessons professionally, safely, and in accordance with applicable laws, regulatory requirements, insurance obligations, and DVSA standards."
        ]
      },
      {
        heading: "2. Accounts and eligibility",
        body: [
          "Users must provide accurate information and keep account details secure. A user must not create duplicate accounts to bypass safety, verification, booking, payment, cancellation, promotional, or account restrictions.",
          "Learners must be at least 17 years old before booking paid driving lessons and must confirm they hold a valid UK provisional licence where required. Instructors must provide accurate ADI/PDI information and supporting evidence before appearing in search.",
          "LDA may suspend or close accounts where information is inaccurate, misleading, fraudulent, unsafe, unlawful, or in breach of these terms."
        ]
      },
      {
        heading: "3. Learner responsibilities",
        body: [
          "Learners must provide accurate pickup details, attend lessons on time, comply with lawful instructor directions, behave respectfully, and avoid any conduct that could make a lesson unsafe.",
          "Learners must not book a lesson if they are not legally entitled to drive, are medically unfit to drive, are under the influence of alcohol or drugs, or otherwise cannot safely take the lesson."
        ]
      },
      {
        heading: "4. Instructor responsibilities",
        body: [
          "Instructors must keep their profile, vehicle, insurance, licence, ADI/PDI status, availability, pricing, and areas covered accurate and up to date.",
          "Instructors must deliver lessons with reasonable skill and care, comply with road traffic and driving instruction requirements, maintain appropriate insurance, protect learner information, and report safety, cancellation, or dispute issues promptly.",
          "Instructors cannot appear publicly in search or accept paid platform bookings until LDA has approved their instructor application."
        ]
      },
      {
        heading: "5. Bookings, cancellations and refunds",
        body: [
          "Before payment, learners should be shown the instructor, lesson time, pickup area, lesson price, payment method, and cancellation position. There should be no hidden booking fee at checkout.",
          "Cancellations, refunds, no-shows, rescheduling and disputes are handled under the Cancellation and Refund Policy. Refund availability may depend on timing, instructor travel, whether a replacement booking can reasonably be made, payment processor rules, and any manual support decision."
        ]
      },
      {
        heading: "6. Payments",
        body: [
          "Payments are intended to be processed by Stripe or another approved payment provider. LDA may apply a platform commission, service charge, instructor payout rule, refund rule, or promotional discount where clearly disclosed before payment.",
          "Users must not attempt chargebacks, disputes, refund abuse, or payment misuse without first using the support process where appropriate. LDA may investigate payment issues and provide relevant evidence to payment providers."
        ]
      },
      {
        heading: "7. Reviews and content",
        body: [
          "Learners may be able to leave ratings and written reviews for instructors after completed lessons. Reviews must be honest, relevant, lawful, and respectful.",
          "LDA may moderate, hide, or remove content that is abusive, discriminatory, misleading, defamatory, unlawful, spam, unsafe, or unrelated to the service."
        ]
      },
      {
        heading: "8. Acceptable use",
        body: [
          "Users must not misuse the website, interfere with security, scrape the platform, reverse engineer systems, upload malicious material, impersonate others, harass users, bypass verification, or use the service for unlawful purposes.",
          "LDA may take reasonable action to protect users, instructors, payments, data, and the platform, including restricting features, pausing payments, suspending accounts, or contacting relevant authorities where necessary."
        ]
      },
      {
        heading: "9. Availability and changes",
        body: [
          "LDA aims to provide a reliable service but does not guarantee uninterrupted access. Features may be updated, paused, withdrawn, or changed as the marketplace develops.",
          "These terms may be updated from time to time. Material changes should be communicated where appropriate."
        ]
      },
      {
        heading: "10. Liability and governing law",
        body: [
          "Nothing in these terms limits liability where it would be unlawful to do so, including liability for death or personal injury caused by negligence, fraud, or statutory rights that cannot be excluded.",
          "These terms are governed by the laws of England and Wales, with courts of England and Wales having jurisdiction unless consumer law gives a user the right to bring proceedings elsewhere in the UK."
        ]
      }
    ]
  },
  accessibility: {
    title: "Accessibility",
    intro: "LDA aims to make the website and booking experience accessible, inclusive, readable, keyboard-friendly, and usable for as many learners, instructors, and administrators as possible.",
    updated: "Effective from launch. LDA aims to meet recognised accessibility principles and keep key learner, instructor, payment, support, and policy journeys usable.",
    sections: [
      {
        heading: "1. Our commitment",
        body: [
          "We want LDA to be usable by people with different access needs, including people who use screen readers, keyboard navigation, magnification, voice control, captions, high contrast settings, or assistive technologies.",
          "We aim to follow recognised accessibility principles: content should be perceivable, operable, understandable, and robust. Our target standard is WCAG 2.2 AA where reasonably achievable for this service."
        ]
      },
      {
        heading: "2. What we are building for",
        body: [
          "The website should support clear headings, meaningful links, consistent navigation, visible focus states, readable contrast, responsive layouts, form labels, helpful error messages, and alternatives for non-text content.",
          "Booking, payment, sign-up, verification, Smart Match, support, and dashboard journeys are reviewed with keyboard-only navigation and common assistive technologies as the product develops."
        ]
      },
      {
        heading: "3. Accessibility and learner support",
        body: [
          "LDA Smart Match may allow learners to tell us about preferences or support needs so they can be matched with suitable instructors. Learners should only share information they are comfortable sharing, and LDA should use it respectfully and only for the intended support purpose.",
          "Where possible, the platform should avoid unnecessary barriers, rushed decisions, confusing language, hidden costs, inaccessible forms, or interfaces that rely only on colour, sound, or pointer precision."
        ]
      },
      {
        heading: "4. Ongoing accessibility review",
        body: [
          "LDA reviews accessibility across public pages, learner flows, instructor flows, admin dashboards, maps, live tracking, payment handoffs, documents, notifications, and policy pages as the service develops.",
          "Third-party tools, including payment, map, email, analytics, or embedded services, should be selected and configured with accessibility in mind, with accessible alternatives provided where reasonably possible."
        ]
      },
      {
        heading: "5. Feedback and contact",
        body: [
          "If you find an accessibility issue, email info@ldrivingacademy.co.uk with the page URL, device, browser, assistive technology if relevant, and a short description of the problem.",
          "We aim to review accessibility feedback promptly and prioritise issues that block account access, booking, payment, safety information, or support."
        ]
      }
    ]
  },
  cancellation: {
    title: "Cancellation and refund policy",
    intro: "How learners, instructors, and admins should handle cancellations, rescheduling, refunds, disputes, and no-shows.",
    updated: "Effective from launch. This policy explains how cancellation, rescheduling, refunds, no-shows, and disputes are handled.",
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
          "If an instructor cancels, is materially late, or cannot deliver a lesson, LDA will review the booking and may offer a refund, reschedule, replacement instructor, account credit, or another reasonable remedy depending on the circumstances."
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
    title: "Cookie Policy",
    intro: "This Cookie Policy explains how LDA / L Driving Academy uses cookies and similar technologies to operate the website, protect accounts, remember choices, improve services, and support optional analytics or marketing where consent is required.",
    updated: "Effective from launch. LDA uses necessary cookies for core service operation and asks for consent before using non-essential cookies where required.",
    sections: [
      {
        heading: "1. What cookies are",
        body: [
          "Cookies are small files or similar technologies placed on a device when a person visits a website. They can help a website work, keep a user signed in, remember preferences, measure usage, or support marketing.",
          "Under UK rules, strictly necessary cookies may be used without consent where they are required to provide a service requested by the user. Non-essential cookies generally require clear information and consent before they are used."
        ]
      },
      {
        heading: "2. Strictly necessary cookies",
        body: [
          "We use necessary cookies and similar storage to provide secure login, account sessions, fraud prevention, booking flows, payment handoff, cookie consent choices, security controls, and core website functionality.",
          "These cookies are needed for the service to work and cannot usually be switched off through the LDA cookie controls. Users may block them in their browser, but parts of the website may stop working."
        ]
      },
      {
        heading: "3. Preference cookies",
        body: [
          "Preference cookies may remember choices such as language, region, saved interface settings, or cookie preferences. Where required, we will ask for consent before using optional preference cookies.",
          "If a preference is essential to provide a user-requested function, it may be treated as necessary for that function."
        ]
      },
      {
        heading: "4. Analytics and performance cookies",
        body: [
          "Analytics cookies help us understand how people use the website, which pages work well, where users experience problems, and how we can improve speed and reliability.",
          "Analytics cookies are not essential to provide the service and should only be used where consent has been obtained, unless a lawful exemption clearly applies and has been documented."
        ]
      },
      {
        heading: "5. Marketing cookies",
        body: [
          "Marketing cookies may be used to measure campaigns, personalise offers, prevent repeated adverts, or understand referrals. LDA should not use marketing cookies unless the user has given consent where required.",
          "Users can withdraw optional cookie consent through the cookie settings tool when available."
        ]
      },
      {
        heading: "6. Third-party services",
        body: [
          "Some features may use third-party providers such as Stripe for payments, Google Maps or Places for location features, Supabase for authentication, Vercel for hosting, and email providers for communications. These providers may use cookies or similar technologies as part of their services.",
          "LDA aims to maintain a current cookie table naming each material cookie, provider, purpose, duration, and category as the production service develops."
        ]
      },
      {
        heading: "7. Managing cookies",
        body: [
          "Users can manage optional cookies through the LDA cookie controls where available and through browser settings. Browser settings can usually block, delete, or limit cookies.",
          "Changing cookie settings may affect sign-in, booking, payment, maps, preferences, or support features."
        ]
      }
    ]
  },
  "data-requests": {
    title: "Account deletion and data requests",
    intro: "This page explains how users can request account deletion, access, correction, restriction, portability, objection, and other data rights.",
    updated: "Effective from launch. LDA handles data requests in line with UK data protection rights and proportionate identity checks.",
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
          "LDA aims to respond to valid data rights requests within the time required by UK data protection law, subject to permitted extensions, identity checks, legal obligations, and exemptions."
        ]
      }
    ]
  },
  contact: {
    title: "Contact and support",
    intro: "Support routes for learner bookings, instructor onboarding, verification, payments, refunds, disputes, and data requests.",
    updated: "Effective from launch.",
    sections: [
      {
        heading: "Support email",
        body: [
          "Use info@ldrivingacademy.co.uk for launch preparation, support, and data request handling.",
          "LDA uses verified email sending where available so booking and support emails are more likely to be delivered reliably."
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
