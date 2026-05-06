export const demoInstructors = [
  {
    name: "Amelia Khan",
    type: "ADI",
    price: 4200,
    transmission: "automatic",
    areas: "Barnet, Finchley, Edgware",
    distance: "1.8 miles",
    rating: "4.9",
    next: "Today 16:30",
    car: "Toyota Yaris Hybrid",
    bio: "Patient instructor focused on nervous learners, test route confidence, and calm city driving."
  },
  {
    name: "Marcus Reed",
    type: "ADI",
    price: 3900,
    transmission: "manual",
    areas: "Hendon, Golders Green, Brent Cross",
    distance: "2.6 miles",
    rating: "4.8",
    next: "Thu 10:00",
    car: "Ford Fiesta",
    bio: "Manual specialist with structured lesson plans, motorway confidence sessions, and mock tests."
  },
  {
    name: "Priya Shah",
    type: "PDI",
    price: 3600,
    transmission: "manual",
    areas: "Harrow, Wembley, Kenton",
    distance: "4.1 miles",
    rating: "4.7",
    next: "Fri 13:00",
    car: "VW Polo",
    bio: "Structured lessons for first-time drivers, mock test prep, and weekly progress notes."
  }
];

export const learnerSteps = [
  "Sign in as learner",
  "Confirm age 17+ and provisional licence",
  "Set pickup postcode and preferences",
  "Compare local instructors by distance, price, rating, car, and availability",
  "Select instructor and lesson slot",
  "Review full price and pay through Stripe",
  "Receive email confirmation and in-app booking status",
  "Track instructor live when they are en route",
  "Leave an instructor review after completion"
];

export const instructorSteps = [
  "Choose instructor sign-in",
  "Enter ADI/PDI status and badge number",
  "Upload ID, licence, insurance, and supporting evidence",
  "Set lesson price, car, transmission, and covered areas",
  "Publish availability",
  "Wait for admin approval before appearing in search",
  "Accept or decline bookings",
  "Mark en route so learner can see live distance",
  "Track earnings and Stripe payout status"
];

export const learnerJourneyStages = [
  {
    title: "Where from?",
    detail: "Learner enters pickup postcode or town, then confirms age 17+ and provisional licence before booking."
  },
  {
    title: "Choose your ride",
    detail: "The app shows verified local instructors with transmission, distance, rating, price, car, and next available slots."
  },
  {
    title: "Book and pay",
    detail: "Learner chooses date/time, sees the full price upfront, applies promo/referral code if available, then checks out with Stripe."
  },
  {
    title: "Confirmed",
    detail: "Learner gets a booking email. Instructor gets an email and an in-app notification to accept or prepare."
  },
  {
    title: "Instructor en route",
    detail: "When the instructor starts travelling, the learner sees live location, ETA, and distance refreshed every second."
  },
  {
    title: "Completed",
    detail: "Booking moves to completed, payout status updates, and the learner can review the instructor only."
  }
];

export const instructorJourneyStages = [
  {
    title: "Sign in as instructor",
    detail: "A separate front-page option routes instructors away from the learner booking flow."
  },
  {
    title: "Get verified",
    detail: "Upload ADI/PDI, ID, licence, insurance, vehicle, and admin review evidence before going live."
  },
  {
    title: "Set supply",
    detail: "Set car, transmission, postcode areas, hourly rate, auto-accept, and available lesson slots."
  },
  {
    title: "Manage jobs",
    detail: "Accept or decline bookings, see learner pickup details, and receive in-app notifications."
  },
  {
    title: "Go en route",
    detail: "Instructor explicitly starts live sharing for the accepted lesson so the learner can track arrival."
  },
  {
    title: "Get paid",
    detail: "Stripe Connect records gross lesson value, platform commission, instructor net, and payout status."
  }
];

export const adminKpis = [
  { label: "Drivers on platform", value: "128", detail: "Active verified ADI/PDI instructors" },
  { label: "Learners on platform", value: "2,840", detail: "Registered learner accounts" },
  { label: "Revenue this month", value: "£18.4k", detail: "Platform commission from paid lessons" },
  { label: "Revenue YTD", value: "£146k", detail: "Calendar-year platform revenue" },
  { label: "Gross lesson value", value: "£1.46m", detail: "Total learner spend before commission" },
  { label: "Avg instructor rating", value: "4.8", detail: "Reviews are for instructors only" }
];

export const bookingPipeline = [
  "Preferences",
  "Instructor selected",
  "Slot booked",
  "Stripe paid",
  "Email sent",
  "Instructor notified",
  "En route",
  "Completed"
];

export const complianceLinks = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/cancellation-policy", label: "Cancellation" },
  { href: "/cookies", label: "Cookies" },
  { href: "/data-requests", label: "Data requests" },
  { href: "/contact", label: "Support" }
];