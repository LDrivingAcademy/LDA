export type SmartMatchInput = {
  postcode?: string;
  budgetPence?: number;
  transmission?: "automatic" | "manual" | "either";
  availability?: "asap" | "weekdays" | "evenings" | "weekends" | "flexible";
  confidence?: "nervous" | "some" | "confident";
  learningSupport?: string[];
  goals?: string[];
  notes?: string;
};

export type SmartMatchInstructor = {
  id: string;
  name: string;
  badge: "ADI" | "PDI";
  pricePence: number;
  transmission: "automatic" | "manual";
  distanceMiles: number;
  rating: number;
  reviewCount: number;
  car: string;
  nextSlot: string;
  strengths: string[];
  qualifications: string[];
  availabilityTags: string[];
  accessibilityTags: string[];
  teachingStyle: string;
};

export const smartMatchInstructors: SmartMatchInstructor[] = [
  {
    id: "amelia-khan",
    name: "Amelia Khan",
    badge: "ADI",
    pricePence: 4200,
    transmission: "automatic",
    distanceMiles: 1.8,
    rating: 4.9,
    reviewCount: 186,
    car: "Toyota Yaris Hybrid",
    nextSlot: "Today 16:30",
    strengths: ["nervous learners", "city traffic", "test route confidence", "calm first lessons"],
    qualifications: ["ADI", "night-driving coaching", "mock-test specialist"],
    availabilityTags: ["asap", "weekdays", "evenings"],
    accessibilityTags: ["anxiety-aware", "step-by-step", "extra processing time"],
    teachingStyle: "Calm, low-pressure lessons with small goals and clear feedback after each drive."
  },
  {
    id: "marcus-reed",
    name: "Marcus Reed",
    badge: "ADI",
    pricePence: 3900,
    transmission: "manual",
    distanceMiles: 2.6,
    rating: 4.8,
    reviewCount: 142,
    car: "Ford Fiesta",
    nextSlot: "Thu 10:00",
    strengths: ["manual control", "hill starts", "roundabouts", "motorway confidence"],
    qualifications: ["ADI", "advanced-driving coaching", "night-driving coaching"],
    availabilityTags: ["weekdays", "weekends"],
    accessibilityTags: ["structured plans", "written recap", "confidence rebuilding"],
    teachingStyle: "Structured coaching for learners who want a clear route from basics to independent driving."
  },
  {
    id: "priya-shah",
    name: "Priya Shah",
    badge: "PDI",
    pricePence: 3600,
    transmission: "manual",
    distanceMiles: 4.1,
    rating: 4.7,
    reviewCount: 91,
    car: "VW Polo",
    nextSlot: "Fri 13:00",
    strengths: ["first-time learners", "parking", "hazard awareness", "weekly progress notes"],
    qualifications: ["PDI", "progress-tracker focused"],
    availabilityTags: ["weekdays", "flexible"],
    accessibilityTags: ["visual prompts", "checklists", "repeatable routines"],
    teachingStyle: "Methodical lesson plans with progress checklists and revision links after each session."
  },
  {
    id: "daniel-owen",
    name: "Daniel Owen",
    badge: "ADI",
    pricePence: 4600,
    transmission: "automatic",
    distanceMiles: 3.2,
    rating: 4.95,
    reviewCount: 211,
    car: "Hyundai Kona Automatic",
    nextSlot: "Sat 09:00",
    strengths: ["autistic learners", "ADHD-friendly pacing", "dual carriageways", "night lessons"],
    qualifications: ["ADI", "neurodiversity-aware coaching", "advanced-driving coaching", "night-driving coaching"],
    availabilityTags: ["weekends", "evenings", "flexible"],
    accessibilityTags: ["quiet explanations", "sensory-aware", "predictable lesson structure", "extra processing time"],
    teachingStyle: "Adaptive sessions with pre-lesson plans, quiet coaching, and less cognitive overload."
  }
];

function scoreText(values: string[], wanted: string[]) {
  return values.reduce((score, value) => {
    const normalised = value.toLowerCase();
    return score + wanted.filter((item) => normalised.includes(item.toLowerCase())).length;
  }, 0);
}

export function runSmartMatch(input: SmartMatchInput) {
  const support = input.learningSupport ?? [];
  const goals = input.goals ?? [];
  const notes = input.notes?.toLowerCase() ?? "";

  const ranked = smartMatchInstructors
    .map((instructor) => {
      let score = 50;
      const reasons: string[] = [];

      if (input.transmission && input.transmission !== "either") {
        if (instructor.transmission === input.transmission) {
          score += 18;
          reasons.push(`Matches ${input.transmission} lessons`);
        } else {
          score -= 20;
        }
      }

      if (input.budgetPence) {
        if (instructor.pricePence <= input.budgetPence) {
          score += 12;
          reasons.push("Inside your price range");
        } else {
          score -= Math.min(18, Math.round((instructor.pricePence - input.budgetPence) / 100));
        }
      }

      if (input.availability && instructor.availabilityTags.includes(input.availability)) {
        score += 12;
        reasons.push(`Has ${input.availability} availability`);
      }

      if (input.confidence === "nervous") {
        const calmScore = scoreText([...instructor.strengths, ...instructor.accessibilityTags], ["nervous", "anxiety", "calm", "step-by-step", "quiet"]);
        score += calmScore * 8;
        if (calmScore) reasons.push("Strong fit for nervous or anxious learners");
      }

      const supportScore = scoreText(instructor.accessibilityTags, support);
      if (supportScore) {
        score += supportScore * 10;
        reasons.push("Matches your learning support preferences");
      }

      const goalScore = scoreText([...instructor.strengths, ...instructor.qualifications], goals);
      if (goalScore) {
        score += goalScore * 9;
        reasons.push("Matches your driving goals");
      }

      if (notes) {
        const noteScore = scoreText([...instructor.strengths, ...instructor.qualifications, ...instructor.accessibilityTags], notes.split(/\W+/).filter(Boolean));
        score += Math.min(noteScore * 2, 14);
        if (noteScore) reasons.push("Understands the needs described in your notes");
      }

      score += Math.max(0, 12 - instructor.distanceMiles * 2);
      score += instructor.rating * 4;
      score += Math.min(instructor.reviewCount / 40, 6);

      if (instructor.badge === "ADI") {
        score += 8;
        reasons.push("Fully approved ADI");
      }

      return {
        ...instructor,
        matchScore: Math.max(0, Math.min(99, Math.round(score))),
        reasons: reasons.length ? reasons.slice(0, 4) : ["Balanced match for your location, price, rating, and availability"]
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore);

  const top = ranked[0];
  const plan = [
    input.confidence === "nervous" ? "Start with a calm confidence session and agree hand signals or pause words before moving off." : "Begin with a short assessment drive so the instructor can set the right pace.",
    support.length ? "Share your support preferences before the lesson so the instructor can adapt explanations and reduce cognitive load." : "Use LDA progress tracker notes after the lesson so you know exactly what to revise.",
    goals.includes("night") || top.qualifications.some((qualification) => qualification.includes("night"))
      ? "Add a night-driving slot once basic control is settled, especially for winter lesson times."
      : "Book the next visible slot and keep the same pickup area for consistency."
  ];

  return {
    summary: `${top.name} is the strongest SmartMatch based on your budget, transmission, support needs, reviews, and availability.`,
    plan,
    matches: ranked
  };
}
