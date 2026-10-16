export type LegalPageContent = {
  title: string;
  intro: string;
  updated: string;
  highlights?: string[];
  sections: Array<{ heading: string; body: string[] }>;
};

export const legalPages: Record<string, LegalPageContent> = {
  privacy: {
    title: "Privacy Policy",
    intro: "This Privacy Policy explains how LDA / L Driving Academy collects, uses, shares, stores, and protects personal information across the website, learner services, instructor onboarding, bookings, payments, support, analytics, and platform features.",
    updated: "Last reviewed 30 July 2026 against current UK GDPR, Data Protection Act 2018, PECR, Data (Use and Access) Act 2025, ICO guidance, GOV.UK guidance, consumer guidance, accessibility guidance, and platform-sector requirements available at the review date.",
    highlights: [
      "Explains what information LDA collects from learners, instructors, guests, and signed-in users.",
      "Covers account data, bookings, payments, support, marketing choices, location, analytics, and safety records.",
      "Sets out privacy rights, retention, sharing, security, and how to contact LDA."
    ],
    sections: [
      {
        heading: "1. Who we are",
        body: [
          "LDA / L Driving Academy is a UK learner driver platform designed to connect learners with verified driving instructors. For data protection purposes, LDA is the controller for account, booking, verification, support, marketing, safety, fraud-prevention, and platform administration data unless a specific service notice states otherwise.",
          "Contact for privacy matters: info@ldrivingacademy.co.uk. Users may contact us about privacy, account data, marketing choices, deletion requests, or any concern about how their information is handled."
        ]
      },
      {
        heading: "2. Personal information we collect",
        body: [
          "For learners, we may collect name, email address, optional phone number, date of birth confirmation, provisional licence confirmation, pickup postcode or preferred lesson area, booking details, lesson history, payment references, support messages, referral or promotion code use, reviews of instructors, and communication preferences.",
          "For instructors, we may collect name, contact details, ADI status and badge number, profile information, photograph, vehicle details, transmission type, areas covered, availability, booking records, earnings and payout references, verification evidence, and support or dispute communications.",
          "For all users, we may collect technical information such as IP address, device and browser information, security logs, cookie choices, precise or approximate location where enabled and needed for pickup accuracy, nearby instructor matching or live tracking, and usage information needed to keep the service secure, reliable, and responsive."
        ]
      },
      {
        heading: "3. How we use personal information",
        body: [
          "We use personal information to create and secure accounts, verify instructor eligibility, show approved instructors in search, calculate location and distance, manage availability, take bookings, process payments, send booking confirmations and service updates, handle cancellations and refunds, provide support, prevent fraud, investigate disputes, improve the platform, and comply with legal obligations.",
          "We may use booking, cancellation, support, payment, and account activity to detect suspected off-platform solicitation, payment avoidance, duplicate accounts, fraud, misuse, policy breaches, or platform leakage that could harm learners, instructors, or LDA.",
          "Live location features are used only where necessary for booking, nearby instructor matching, pickup accuracy, or accepted lessons near lesson time. Where a user enables device location, LDA may process precise GPS coordinates for those purposes. Browser, device, operating-system and network settings may still affect location accuracy and availability, so users should check the pickup address before checkout.",
          "Where LDA uses matching, AI, risk flags, or automated routing tools, those tools are designed to support booking, safety, fraud prevention, and service guidance. They should not be used as the only basis for a significant legal, eligibility, suspension, or financial decision without appropriate human review.",
          "We do not sell personal information. We do not collect special category information unless a user chooses to share accessibility or support needs for Smart Match or lesson support. Where this happens, we use that information only to support a suitable learning experience and apply additional care to access, retention, and sharing."
        ]
      },
      {
        heading: "4. Lawful bases",
        body: [
          "We rely on different lawful bases under UK data protection law depending on the purpose. These may include contract where we provide account, booking, payment and support services; legal obligation where we keep tax, payment, safety or regulatory records; legitimate interests where we protect the platform, prevent fraud, improve services and manage disputes; and consent where required for optional marketing, non-essential cookies, or optional features.",
          "Where consent is used, users can withdraw it at any time. Withdrawing consent does not affect processing that took place before consent was withdrawn or processing that relies on another lawful basis."
        ]
      },
      {
        heading: "5. Payments and verification",
        body: [
          "Payments are processed securely by Stripe. LDA does not store raw card numbers, CVC codes, or full payment card details. We may store payment status, transaction identifiers, refund references, dispute records, subscription status, booking references, and confirmation records.",
          "Instructor verification documents may be reviewed by LDA administrators or authorised verification providers. Instructors cannot appear publicly in search until approved under the platform process."
        ]
      },
      {
        heading: "6. Sharing personal information",
        body: [
          "We may share limited personal information with service providers who help us operate the platform, including hosting, authentication, database, storage, payment processing, email and SMS delivery, mapping, postcode lookup, analytics where consented, support, security, verification, and professional advisers.",
          "Providers may include Supabase, Stripe, Vercel, Google Maps or Places, Postcodes.io, Resend or another email provider, an SMS provider, DVLA/DVSA verification routes where configured, and other suppliers added as the platform develops. Suppliers that process personal information must operate under appropriate contractual and security safeguards.",
          "We may disclose information where required by law, to enforce our terms, to protect users and instructors, to respond to lawful requests, or in connection with a business transfer."
        ]
      },
      {
        heading: "7. International transfers",
        body: [
          "Some service providers may process information outside the UK. Where this happens, LDA uses appropriate safeguards such as adequacy regulations, the UK International Data Transfer Agreement, the UK Addendum to EU standard contractual clauses, or another lawful transfer mechanism."
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
          "LDA aims to respond to valid data rights requests without undue delay and within one month where UK data protection law requires it, unless an extension, exemption, identity check, legal hold, fraud-prevention need, payment record, safety record, or dispute record applies.",
          "To make a request, contact info@ldrivingacademy.co.uk from the email address linked to the account. We may need to verify identity before responding. Users can also contact the ICO at ico.org.uk if they are unhappy with how their data is handled, and LDA will review privacy complaints before directing users to the ICO where appropriate."
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
    title: "Terms and Conditions",
    intro: "These Terms and Conditions set out the rules for using LDA / L Driving Academy, including learner accounts, instructor onboarding, bookings, payments, reviews, support, and platform access.",
    updated: "Draft updated 16 October 2026. Awaiting legal review before commercial launch.",
    highlights: [
      "Sets out learner, instructor, booking, payment, support, review, and account rules.",
      "Explains LDA's role as a platform and the independent responsibilities of instructors.",
      "Covers refunds, subscriptions, live location, anti-circumvention, marketing claims, and safety enforcement."
    ],
    sections: [
      {
        heading: "1. About LDA",
        body: [
          "LDA operates as a UK learner driver platform connecting learners with verified independent driving instructors. The platform helps users search, compare, book, pay, communicate, track lesson status, and manage lesson records.",
          "Driving instructors remain independent providers responsible for delivering lessons professionally, safely, and in accordance with applicable laws, regulatory requirements, insurance obligations, and DVSA or Northern Ireland DVA requirements as applicable.",
          "LDA provides the platform services described in these terms. Instructors are responsible for the teaching and supervision they provide. This allocation of responsibilities does not remove LDA's responsibility for its own services, representations, checks or failures, or determine liability for an incident without considering the facts and applicable law.",
          "LDA does not guarantee that a user will find an instructor, pass a test, receive an exact arrival time, obtain a particular insurance quote, or receive uninterrupted access to the website."
        ]
      },
      {
        heading: "2. Regulatory position and instructor standards",
        body: [
          "LDA is not DVSA, DVLA, the practical driving test examiner, or a licensing authority. LDA does not issue driving licences, approve test passes, guarantee test outcomes, or replace official DVSA/DVLA checks.",
          "Instructors who use LDA must hold the required current instructor registration with DVSA in Great Britain or DVA in Northern Ireland for the lessons they offer and must keep their badge, driving licence, insurance, vehicle, availability, and contact information accurate.",
          "Accepting these terms, entering a licence number or uploading a document is not confirmation that verification has passed. A driving entitlement check is separate from an identity check, instructor registration check and insurance review. Users must provide the information and permissions required for the applicable checks; any verification status relates only to the checks actually completed and their recorded dates.",
          "LDA may ask for evidence, pause search visibility, suspend bookings, remove verified status, or refer a matter for support/admin review where eligibility, vehicle roadworthiness, insurance, learner safety, complaints, cancellation patterns, or documentation are unclear.",
          "Learners should use official GOV.UK/DVSA services for official theory or practical test booking where required. LDA may provide planning guidance or links, but it does not replace official test booking rules or official DVSA/DVLA information."
        ]
      },
      {
        heading: "3. Accounts and eligibility",
        body: [
          "Users must provide accurate information and keep account details secure. A user must not create duplicate accounts to bypass safety, verification, booking, payment, cancellation, promotional, or account restrictions.",
          "Learners must be legally eligible before booking paid driving lessons and must confirm they hold a valid UK provisional licence where required. Instructors must provide accurate ADI information and supporting evidence before appearing in search.",
          "LDA may suspend or close accounts where information is inaccurate, misleading, fraudulent, unsafe, unlawful, or in breach of these terms."
        ]
      },
      {
        heading: "4. Learner responsibilities",
        body: [
          "Learners must provide accurate pickup details, attend lessons on time, comply with lawful instructor directions, behave respectfully, and avoid any conduct that could make a lesson unsafe.",
          "Learners must not book a lesson if they are not legally entitled to drive, are medically unfit to drive, are under the influence of alcohol or drugs, or otherwise cannot safely take the lesson.",
          "Guests and account holders must provide their own accurate licence and identity details and promptly report changes to their licence, entitlement or restrictions. Changed details require renewed verification before further bookings where verification is required. A previously completed check does not establish that changed details are verified. Existing bookings affected by a change must be referred to LDA support before the lesson.",
          "Learners must cooperate with reasonable identity and eligibility checks at the lesson. Platform verification does not override an insurer's requirements or an instructor's duty to refuse unsafe or unlawful driving."
        ]
      },
      {
        heading: "5. Instructor responsibilities",
        body: [
          "Instructors must keep their profile, vehicle, insurance, licence, ADI status, availability, pricing, and areas covered accurate and up to date.",
          "Instructors must deliver lessons with reasonable skill and care, comply with road traffic and driving instruction requirements, maintain appropriate insurance, protect learner information, and report safety, cancellation, or dispute issues promptly.",
          "Insurance must cover the instructor, the vehicle used and paid driving tuition with the learner driving under supervision, subject to the policy's conditions. Instructors must provide the certificate, relevant schedule and endorsements requested for review, and promptly report cancellation, expiry, restrictions or changes to their policy, vehicle or registration. They must not accept or deliver a lesson without the required cover and entitlement. An uploaded certificate alone does not prove current cover for a particular lesson.",
          "Instructors cannot appear publicly in search or accept paid platform bookings until LDA has approved their instructor application.",
          "Instructors must manage LDA-introduced learners through LDA for booking, payment, cancellation, rescheduling, progress notes, support, and dispute handling unless LDA gives written permission otherwise."
        ]
      },
      {
        heading: "6. Bookings, cancellations and refunds",
        body: [
          "Before payment, learners are shown the instructor or matching status, lesson time or booking window, pickup area, lesson price, payment method, and cancellation position. Any unavoidable platform, booking, service, or payment charge must be included in the upfront price or clearly disclosed before the learner commits to booking, with no hidden mandatory fee added later at checkout.",
          "Cancellations, refunds, no-shows, rescheduling and disputes are handled under the Cancellation and Refund Policy. Refund availability may depend on timing, instructor travel, whether a replacement booking can reasonably be made, payment processor rules, and any manual support decision.",
          "Scheduled lesson packages that reserve instructor diary time in advance must clearly show the non-refundable or limited-refund position before payment. Nothing in this policy removes statutory consumer rights, cooling-off rights where they apply, or any remedy required by law where a service is not provided with reasonable care and skill."
        ]
      },
      {
        heading: "7. Live location and tracking",
        body: [
          "By creating or using an LDA account, users agree that location features may be used where they are necessary to provide booking, pickup, instructor matching, live tracking, operational safety, support, and dispute-resolution features.",
          "Learners can choose whether account-level location is enabled while their account is idle. When a learner has an active booked lesson or opens live lesson tracking, LDA may request or activate live device location for that booking so the pickup point, instructor route, lesson status, and safety/support tools can work correctly.",
          "Instructors can choose whether account-level location is enabled while they are not working. When an instructor logs on, starts work, accepts an on-demand request, travels to a learner, or is otherwise registered as available for LDA work, live location is required until they log off or end the working session. If location permission is not available, LDA may prevent the instructor from going live, appearing in the booking pool, or receiving work.",
          "LDA may show current or last known working-session location to authorised administrators for operational safety, incident support, emergency escalation, booking support, fraud prevention, and dispute handling. LDA will use live location for those purposes and aims to keep the location data proportionate to the service need.",
          "Browser, device, operating-system and network settings may still affect whether live location can be collected and how accurate it is. Users remain responsible for checking pickup details and allowing required device permissions when using live tracking or working-session features."
        ]
      },
      {
        heading: "8. Payments",
        body: [
          "Payments are intended to be processed by Stripe or another approved payment provider. LDA may apply a platform commission, service charge, instructor payout rule, refund rule, or promotional discount where clearly disclosed before payment.",
          "Where LDA offers paid recurring learner or instructor subscriptions, the price, billing period, renewal position, main benefits, cancellation route, and any material limits are shown clearly before checkout and in the user's account or support route. Users who sign up online have an online way to cancel or manage the paid subscription, subject to Stripe processing and any lawful terms shown before purchase.",
          "Annual plans, free or discounted trials, automatic renewal reminders, renewal cooling-off periods, and subscription-specific refund deductions will be operated in line with the Consumer Contracts Regulations, the Digital Markets, Competition and Consumers Act subscription-contract regime, and any commencement regulations or official guidance in force at the time.",
          "Users must not attempt chargebacks, disputes, refund abuse, or payment misuse without first using the support process where appropriate. LDA may investigate payment issues and provide relevant evidence to payment providers.",
          "Learners and instructors must not use cash, bank transfer, private payment links, private booking forms, or other off-platform payment routes for lessons introduced, arranged, rescheduled, or managed through LDA."
        ]
      },
      {
        heading: "9. Anti-circumvention and LDA-introduced learners",
        body: [
          "A learner is treated as LDA-introduced when the learner finds, contacts, books, pays, reviews, receives progress notes from, or is otherwise matched with an instructor through LDA.",
          "Instructors must not ask, pressure, incentivise, or encourage an LDA-introduced learner to move bookings, repeat lessons, payments, cancellations, progress records, or dispute handling outside LDA to avoid platform fees, commission, policies, records, or safeguards.",
          "Learners should report requests to pay outside LDA or move an LDA booking into a private arrangement. LDA protections, including payment records, refund review, replacement support, live tracking, progress records, and dispute assistance, may not apply to off-platform arrangements.",
          "LDA may review suspected circumvention using support reports, booking patterns, cancellation patterns, repeat first-lesson-only behaviour, payment evidence, complaints, and other proportionate platform signals.",
          "Where LDA reasonably believes anti-circumvention rules have been breached, LDA may warn the user, reduce instructor visibility, pause bookings, withhold platform privileges, require remedial training, suspend or close an account, remove verified status, or take other lawful action."
        ]
      },
      {
        heading: "10. Reviews, advertising and content",
        body: [
          "Learners may be able to leave ratings and written reviews for instructors after completed lessons. Reviews must be honest, relevant, lawful, respectful, and based on a genuine experience.",
          "Users and instructors must not submit, commission, incentivise, or manipulate fake or misleading reviews, including undisclosed staff, family, competitor, duplicate, AI-generated, or paid-for reviews, or reviews requested in exchange for a particular rating.",
          "LDA may moderate, hide, or remove content that is abusive, discriminatory, misleading, defamatory, unlawful, spam, unsafe, solicits off-platform payment or booking, appears fake or manipulated, or is unrelated to the service. Review moderation should not be used to suppress genuine negative feedback or distort overall ratings.",
          "Marketing claims, comparison wording, instructor profile claims, speed/availability claims, price claims, and safety or verification claims must be accurate, capable of being substantiated, and not likely to mislead users."
        ]
      },
      {
        heading: "11. Insurance, first-car and third-party guidance",
        body: [
          "Insurance quote support, first-car guidance, vehicle shortlisting, seller prompts, and related AI outputs are general information and preparation tools only unless LDA clearly states that a regulated partner is providing a regulated service.",
          "LDA does not provide regulated financial advice, insurance advice, insurance broking, insurance distribution, credit broking, vehicle finance advice, or a guarantee of the cheapest or most suitable policy unless the relevant service is delivered through an appropriately authorised firm or approved arrangement.",
          "Before any live insurance quote, referral, commission, broker relationship, policy recommendation, vehicle finance lead, or financial promotion goes live, LDA will confirm the FCA regulatory position, disclose the provider and commercial relationship, and make clear who is responsible for the regulated service.",
          "Users must check insurer, broker, dealer, finance, vehicle-history, MOT, tax, and seller information directly before buying a car, arranging insurance, or relying on third-party data."
        ]
      },
      {
        heading: "12. Acceptable use",
        body: [
          "Users must not misuse the website, interfere with security, scrape the platform, reverse engineer systems, upload malicious material, impersonate others, harass users, bypass verification, or use the service for unlawful purposes.",
          "LDA may take reasonable action to protect users, instructors, payments, data, and the platform, including restricting features, pausing payments, suspending accounts, or contacting relevant authorities where necessary."
        ]
      },
      {
        heading: "13. Availability and changes",
        body: [
          "LDA aims to provide a reliable service but does not guarantee uninterrupted access. Features may be updated, paused, withdrawn, or changed as the platform develops.",
          "These terms may be updated from time to time. Material changes will be communicated where appropriate, and users will be told before LDA uses personal data or booking rules in a materially new way."
        ]
      },
      {
        heading: "14. Liability and governing law",
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
    updated: "Last reviewed 30 July 2026 against WCAG 2.2 AA principles, Equality Act reasonable-adjustment expectations, and key learner, instructor, payment, support, and policy journeys.",
    highlights: [
      "Targets WCAG 2.2 AA where reasonably achievable for the service.",
      "Covers public pages, account flows, bookings, payments, maps, support, and dashboards.",
      "Gives users a clear route to report access issues or request another format."
    ],
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
          "The website supports clear headings, meaningful links, consistent navigation, visible focus states, readable contrast, responsive layouts, form labels, helpful error messages, and alternatives for non-text content.",
          "Booking, payment, sign-up, verification, Smart Match, support, and dashboard journeys are reviewed with keyboard-only navigation and common assistive technologies as the product develops."
        ]
      },
      {
        heading: "3. Accessibility and learner support",
        body: [
          "LDA Smart Match may allow learners to tell us about preferences or support needs so they can be matched with suitable instructors. Learners should only share information they are comfortable sharing, and LDA should use it respectfully and only for the intended support purpose.",
          "Where possible, the platform avoids unnecessary barriers, rushed decisions, confusing language, hidden costs, inaccessible forms, or interfaces that rely only on colour, sound, or pointer precision."
        ]
      },
      {
        heading: "4. Ongoing accessibility review",
        body: [
          "LDA reviews accessibility across public pages, learner flows, instructor flows, admin dashboards, maps, live tracking, payment handoffs, documents, notifications, and policy pages as the service develops.",
          "Maps and live tracking may not be fully accessible on their own, so LDA provides essential pickup, instructor, booking, and support information in text where reasonably possible.",
          "Third-party tools, including payment, map, email, analytics, or embedded services, are selected and configured with accessibility in mind, with accessible alternatives provided where reasonably possible."
        ]
      },
      {
        heading: "5. Feedback and contact",
        body: [
          "If you find an accessibility issue or need information in another format, email info@ldrivingacademy.co.uk with the page URL, device, browser, assistive technology if relevant, and a short description of the problem.",
          "We aim to review accessibility feedback promptly and prioritise issues that block account access, booking, payment, safety information, or support."
        ]
      }
    ]
  },
  cancellation: {
    title: "Cancellation and refund policy",
    intro: "This policy explains how LDA handles cancellations, rescheduling, refunds, disputes, no-shows, and paid subscription cancellation support.",
    updated: "Last reviewed 30 July 2026 against UK consumer, payment, booking, refund, and subscription guidance available at the review date.",
    highlights: [
      "Explains the cancellation window, refund review route, no-show handling, and dispute process.",
      "Keeps statutory consumer rights and Stripe processing limits clear.",
      "Covers lesson bookings, scheduled packages, and paid account subscriptions."
    ],
    sections: [
      {
        heading: "Before booking",
        body: [
          "The learner must see lesson price, instructor, time, pickup postcode, cancellation window, and payment method before checkout.",
          "The payment button must make clear that the learner is placing a paid order.",
          "LDA cancellation support, refund review, payment records, replacement-instructor support, live tracking, and progress history only apply to lessons booked and paid through LDA."
        ]
      },
      {
        heading: "Cancellation window",
        body: [
          "LDA uses a 24-hour default cancellation window unless a different rule is clearly shown before booking. Cancellations made more than 24 hours before the lesson can be eligible for a full refund, subject to payment processor timing and any clearly disclosed unavoidable charges.",
          "Cancellations inside 24 hours may be eligible for a partial refund or manual review, depending on instructor availability, travel, and whether the instructor could reasonably replace the lesson slot.",
          "Advance scheduled lessons that book out instructor diary time beyond the next-day booking window may be non-refundable once paid where that term has been clearly displayed and accepted before checkout, unless LDA support approves an exception, the instructor cancels or cannot deliver, or applicable consumer rights require a different outcome.",
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
      },
      {
        heading: "Paid subscriptions",
        body: [
          "Learner Plus, Learner Pro, Instructor Plus, Instructor Pro, or similar paid account tiers may renew through Stripe where the checkout page and account journey clearly show the price, billing interval, renewal position, and cancellation route before payment.",
          "Users can manage or cancel a paid subscription online from the relevant LDA account journey or by contacting support if the account route is unavailable. Cancellation normally stops future renewal charges; refund availability for a period already started depends on the terms shown at checkout, Stripe processing, whether benefits have been supplied, and any statutory consumer rights that apply.",
          "Annual plans, free or discounted trials, automatic renewal reminders, renewal cooling-off periods, and subscription refund deductions will be operated in line with the UK subscription-contract rules under the Digital Markets, Competition and Consumers Act as those rules are brought into force."
        ]
      }
    ]
  },
  cookies: {
    title: "Cookie Policy",
    intro: "This Cookie Policy explains how LDA / L Driving Academy uses cookies, browser storage, and similar technologies to keep the website secure, remember choices, operate accounts and bookings, and run optional analytics or advertising functions where consent is required.",
    updated: "Last reviewed 30 July 2026 against PECR, UK GDPR, ICO cookies guidance, consent expectations, and the current LDA browser-storage inventory.",
    highlights: [
      "Essential cookies keep the website, accounts, bookings, security, payments, and cookie choices working.",
      "Analytics and targeted advertising are optional and stay off until the user accepts them.",
      "Users can reopen Cookie Settings in the footer to change or withdraw optional consent."
    ],
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
        heading: "3. Cookie choices and withdrawing consent",
        body: [
          "The first visit presents Cookie Settings, Reject All, and Accept All controls. Optional categories are off unless the user actively accepts them. Essential technologies remain active because the requested website and account services depend on them.",
          "A permanent Cookie Settings control is available in the website footer. It reopens the same controls so a user can change or withdraw optional consent at any time. Withdrawing analytics consent removes LDA's browser analytics identifiers and prevents new optional analytics events from being accepted.",
          "Cookie choices are normally remembered for 180 days. LDA may ask again sooner if its purposes, providers, or technologies materially change."
        ]
      },
      {
        heading: "4. Analytics and performance cookies",
        body: [
          "Analytics cookies help us understand how people use the website, which pages work well, where users experience problems, and how we can improve speed and reliability.",
          "LDA's current website analytics are first-party. When analytics consent is enabled, LDA records page views, selected button or link interactions, engagement duration, page paths, referral information, viewport size, and browser information. Raw IP addresses are not stored in the analytics tables; a one-way IP hash may be used to count public-site visitors.",
          "The browser analytics visitor identifier remains until consent is withdrawn or browser storage is cleared. The analytics session expires after 30 minutes of inactivity, and page-view deduplication information lasts for the current browser session."
        ]
      },
      {
        heading: "5. Targeted advertising",
        body: [
          "The targeted advertising category is intended for campaign measurement, referral understanding, tailored LDA offers, and controlling repeated promotions. It remains optional and is disabled when a user selects Reject All or leaves the category unselected.",
          "At the date of this policy update, LDA does not load a third-party advertising network tag on the public website. Selecting this category records the user's current permission, but does not itself load an unnamed advertising provider. LDA will update this policy, name the provider, explain its duration and purpose, and request fresh consent before activating a materially different third-party advertising service."
        ]
      },
      {
        heading: "6. Third-party services",
        body: [
          "Supabase provides account authentication and database services. Supabase authentication cookies are used when a person signs in and are necessary to maintain and refresh the requested account session. Their duration follows the active account session and security configuration.",
          "Stripe provides secure payment checkout. Stripe may set security, fraud-prevention, and checkout technologies when a user opens a Stripe payment flow. These are used to provide the requested payment service and are governed by Stripe's published privacy and cookie information.",
          "Vercel hosts and delivers the website. LDA does not currently use a third-party analytics or advertising tag supplied by Vercel. Server-side hosting and security logs are handled separately under LDA's Privacy Policy."
        ]
      },
      {
        heading: "7. Cookie and storage table",
        body: [
          "lda_cookie_consent and lda-cookie-consent: LDA first-party essential consent records. They store whether analytics and targeted advertising were accepted. The consent cookie lasts 180 days; the matching browser record remains until changed or cleared.",
          "lda-cookie-consent-id: LDA first-party essential anonymous identifier used to maintain a consent audit trail. It remains until browser storage is cleared and is not designed to contain a name or email address.",
          "lda-analytics-visitor: LDA first-party optional analytics identifier. It remains until analytics consent is withdrawn or browser storage is cleared. lda-analytics-session expires after 30 minutes of inactivity, and lda-analytics-pageviews lasts for the browser session.",
          "Supabase authentication cookies: Supabase strictly necessary account-session records. They are created for signed-in users and last for the active session or the configured secure refresh period.",
          "LDA security, booking, payment-handoff, account-recovery, remembered-device, language, notification, calendar, lesson-progress, and support storage: first-party technologies used only when the corresponding feature is requested. Session records end with the browser session; persistent user preferences remain until changed, removed through the relevant control, account data is deleted where applicable, or browser storage is cleared.",
          "Stripe checkout technologies: Stripe payment and fraud-prevention records activated when a user requests checkout. Stripe determines the individual names and durations under its current service documentation."
        ]
      },
      {
        heading: "8. Managing cookies",
        body: [
          "Use Cookie Settings in the footer to accept, reject, or change optional categories. Browser settings can also block, delete, or limit cookies and browser storage.",
          "Rejecting or withdrawing optional consent does not prevent use of the public website or core account services. Blocking essential technologies in browser settings may affect sign-in, booking, payment, security, saved preferences, or support features.",
          "Questions about LDA's use of cookies and similar technologies can be sent to info@ldrivingacademy.co.uk."
        ]
      }
    ]
  },
  "data-requests": {
    title: "Account deletion and data requests",
    intro: "This page explains how users can request account deletion, access, correction, restriction, portability, objection, and other data rights.",
    updated: "Last reviewed 30 July 2026. LDA handles data requests in line with UK data protection rights and proportionate identity checks.",
    sections: [
      {
        heading: "How to request",
        body: [
          "Users can contact support with the email address on their account and describe the request they want to make.",
          "LDA verifies identity before acting on sensitive requests."
        ]
      },
      {
        heading: "Account deletion",
        body: [
          "Deleting an account may not immediately delete records that LDA must retain for bookings, payments, legal obligations, safety, tax, fraud prevention, or dispute handling.",
          "The account centre includes a self-serve deletion request workflow with final confirmation. When confirmed, LDA removes or anonymises personal profile data, learner or instructor profile details, active location data, notifications, and removable document data while retaining only minimal non-identifying records needed for legal, payment, dispute, regulatory, tax, or fraud-prevention obligations."
        ]
      },
      {
        heading: "Response timing",
        body: [
          "LDA aims to respond to valid data rights requests without undue delay and within the time required by UK data protection law, subject to permitted extensions, identity checks, legal obligations, and exemptions."
        ]
      }
    ]
  },
  contact: {
    title: "Contact and support",
    intro: "Support routes for learner bookings, instructor onboarding, verification, payments, refunds, disputes, and data requests.",
    updated: "Last reviewed 30 July 2026.",
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
          "Instructors should include their account email, ADI number where relevant, and any verification or payout reference."
        ]
      },
      {
        heading: "Legal, regulatory and safety concerns",
        body: [
          "Use info@ldrivingacademy.co.uk for concerns about instructor eligibility, unsafe lessons, misleading advertising, fake reviews, data protection, accessibility, payments, refunds, insurance guidance, first-car guidance, or suspected account compromise.",
          "LDA escalates legal, regulatory, FCA, DVSA, ICO, safeguarding, or consumer-law uncertainty for professional review before relying on a risky judgement call."
        ]
      }
    ]
  }
};
