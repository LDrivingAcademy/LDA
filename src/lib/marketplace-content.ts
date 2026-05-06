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
  "Create learner account",
  "Confirm age 17+ and provisional licence",
  "Search local approved instructors",
  "Compare price, distance, rating, car, and availability",
  "Choose lesson time and pickup postcode",
  "Review full price before Stripe checkout"
];

export const instructorSteps = [
  "Create instructor account",
  "Enter ADI/PDI status and badge number",
  "Upload ID, licence, insurance, and supporting evidence",
  "Set lesson price, car, transmission, and covered areas",
  "Publish availability",
  "Wait for admin approval before appearing in search"
];

export const complianceLinks = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/cancellation-policy", label: "Cancellation" },
  { href: "/cookies", label: "Cookies" },
  { href: "/data-requests", label: "Data requests" },
  { href: "/contact", label: "Support" }
];
