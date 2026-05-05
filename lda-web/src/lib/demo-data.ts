import type { Instructor, Kpi } from "./types";

export const instructors: Instructor[] = [
  {
    id: "ins_amelia",
    displayName: "Amelia Khan",
    adiPdiStatus: "ADI",
    adiPdiNumber: "ADI-284193",
    verificationStatus: "approved",
    photoUrl: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=600&q=80",
    bio: "Patient ADI instructor focused on nervous learners, test route confidence, and calm city driving.",
    hourlyRatePence: 4200,
    transmission: "automatic",
    car: "Toyota Yaris Hybrid, dual controls",
    areasCovered: ["Barnet", "Finchley", "Edgware", "Mill Hill"],
    postcode: "EN5",
    ratingAverage: 4.9,
    reviewCount: 86,
    nextAvailability: ["Tue 10:00", "Wed 14:30", "Fri 09:00"],
    autoAccept: true,
    stripeAccountId: "acct_demo_amelia"
  },
  {
    id: "ins_marcus",
    displayName: "Marcus Reed",
    adiPdiStatus: "ADI",
    adiPdiNumber: "ADI-738410",
    verificationStatus: "approved",
    photoUrl: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=600&q=80",
    bio: "Manual specialist with structured lesson plans, motorway confidence sessions, and mock tests.",
    hourlyRatePence: 3900,
    transmission: "manual",
    car: "Ford Fiesta, dual controls",
    areasCovered: ["Hendon", "Golders Green", "Brent Cross"],
    postcode: "NW4",
    ratingAverage: 4.8,
    reviewCount: 61,
    nextAvailability: ["Mon 16:00", "Thu 11:00", "Sat 08:30"],
    autoAccept: false,
    stripeAccountId: "acct_demo_marcus"
  }
];

export const kpis: Kpi[] = [
  { label: "Total users", value: "154", detail: "126 learners, 28 instructors" },
  { label: "Active instructors", value: "19", detail: "Approved and searchable" },
  { label: "Bookings", value: "312", detail: "Last 30 days" },
  { label: "Gross lesson value", value: "£12,840", detail: "Paid bookings" }
];
