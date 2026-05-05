export type UserRole = "learner" | "instructor" | "admin";
export type Transmission = "manual" | "automatic";
export type VerificationStatus = "draft" | "pending" | "approved" | "rejected";
export type BookingStatus = "pending" | "confirmed" | "completed" | "cancelled" | "refunded" | "disputed";

export type Instructor = {
  id: string;
  displayName: string;
  adiPdiStatus: "ADI" | "PDI";
  adiPdiNumber: string;
  verificationStatus: VerificationStatus;
  photoUrl: string;
  bio: string;
  hourlyRatePence: number;
  transmission: Transmission;
  car: string;
  areasCovered: string[];
  postcode: string;
  ratingAverage: number;
  reviewCount: number;
  nextAvailability: string[];
  autoAccept: boolean;
  stripeAccountId?: string;
};

export type Kpi = { label: string; value: string; detail: string };
