export type SmartMatchInput = {
  postcode?: string;
  budgetPence?: number;
  transmission?: "automatic" | "manual";
  availability?: "book-now" | "today" | "later" | "asap" | "weekdays" | "evenings" | "weekends" | "flexible";
  bookingPath?: "on-demand" | "book-lesson" | "schedule-lesson";
  confidence?: "nervous" | "some" | "confident";
  lessonStage?: "new" | "test-soon" | "refresher" | "post-pass" | "returning";
  accessibilityNeeds?: string[];
  communicationPreferences?: string[];
  environmentPreferences?: string[];
  learningSupport?: string[];
  learningPreferences?: string[];
  lessonPreferences?: string[];
  lessonSupport?: string[];
  goals?: string[];
  disclosureConsent?: boolean;
  privateNote?: string;
  notes?: string;
};

export type SmartMatchInstructor = {
  id: string;
  name: string;
  badge: "ADI";
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
  learningPreferenceTags: string[];
  accessibilityCapabilityTags: string[];
  postPassTags: string[];
  lessonAdaptations: string[];
  teachingStyle: string;
  verifiedBadges: string[];
  onDemandAvailable: boolean;
  todaySlots: string[];
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
    strengths: ["confidence building", "city traffic", "test route confidence", "calm first lessons"],
    qualifications: ["ADI", "night-driving coaching", "mock-test specialist"],
    availabilityTags: ["book-now", "today", "asap", "weekdays", "evenings"],
    learningPreferenceTags: ["calm coaching", "step-by-step", "extra thinking time", "confidence building", "one instruction at a time"],
    accessibilityCapabilityTags: ["calm support", "extra processing time", "one instruction at a time", "confidence support", "clear verbal instructions"],
    postPassTags: ["night driving", "pass plus", "urban confidence"],
    lessonAdaptations: ["pre-lesson written plan", "calm pause points", "short reflective debrief"],
    teachingStyle: "Calm, low-pressure lessons with small goals and clear feedback after each drive.",
    verifiedBadges: ["DVSA-approved ADI", "Verified LDA instructor", "Mock-test specialist"],
    onDemandAvailable: true,
    todaySlots: ["16:30", "18:00"]
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
    learningPreferenceTags: ["structured plans", "written recap", "confidence rebuilding", "clear lesson targets"],
    accessibilityCapabilityTags: ["written recap", "structured plan", "clear lesson targets", "manual confidence support"],
    postPassTags: ["motorway driving", "pass plus", "rural roads", "advanced driving"],
    lessonAdaptations: ["route-by-route plan", "written recap", "goal ladder for manual control"],
    teachingStyle: "Structured coaching for learners who want a clear route from basics to independent driving.",
    verifiedBadges: ["DVSA-approved ADI", "Verified LDA instructor", "Advanced coaching"],
    onDemandAvailable: false,
    todaySlots: []
  },
  {
    id: "priya-shah",
    name: "Priya Shah",
    badge: "ADI",
    pricePence: 3600,
    transmission: "manual",
    distanceMiles: 4.1,
    rating: 4.7,
    reviewCount: 91,
    car: "VW Polo",
    nextSlot: "Fri 13:00",
    strengths: ["first-time learners", "parking", "hazard awareness", "weekly progress notes"],
    qualifications: ["ADI", "progress-tracker focused"],
    availabilityTags: ["today", "weekdays", "flexible"],
    learningPreferenceTags: ["visual examples", "checklists", "repeatable routines", "memory support", "practice notes"],
    accessibilityCapabilityTags: ["visual examples", "memory support", "checklists", "repeatable routines", "practice notes", "written or visual directions"],
    postPassTags: ["refresher lessons", "parking reset", "hazard awareness"],
    lessonAdaptations: ["visual cue cards", "written or visual directions", "editable progress checklist", "revision links after lesson"],
    teachingStyle: "Methodical lesson plans with progress checklists and revision links after each session.",
    verifiedBadges: ["DVSA-approved ADI", "Verified LDA instructor", "Progress tracker"],
    onDemandAvailable: false,
    todaySlots: ["14:00"]
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
    strengths: ["quiet coaching", "flexible pacing", "dual carriageways", "night lessons"],
    qualifications: ["ADI", "inclusive-learning coaching", "advanced-driving coaching", "night-driving coaching"],
    availabilityTags: ["book-now", "today", "weekends", "evenings", "flexible"],
    learningPreferenceTags: ["quiet explanations", "low distraction", "predictable lesson structure", "extra thinking time", "flexible pace", "one instruction at a time"],
    accessibilityCapabilityTags: ["low distraction", "quiet explanations", "predictable lesson structure", "flexible pacing", "sensory-aware route start", "one instruction at a time"],
    postPassTags: ["night driving", "motorway driving", "pass plus", "dual carriageways", "advanced driving"],
    lessonAdaptations: ["low sensory route start", "predictable lesson structure", "one-instruction-at-a-time coaching"],
    teachingStyle: "Adaptive sessions with pre-lesson plans, quiet coaching, and less cognitive overload.",
    verifiedBadges: ["DVSA-approved ADI", "Verified LDA instructor", "Inclusive teaching"],
    onDemandAvailable: true,
    todaySlots: ["12:30", "17:30"]
  },
  {
    id: "sarah-mitchell",
    name: "Sarah Mitchell",
    badge: "ADI",
    pricePence: 4400,
    transmission: "automatic",
    distanceMiles: 5.5,
    rating: 4.9,
    reviewCount: 168,
    car: "Nissan Leaf Automatic",
    nextSlot: "Mon 18:00",
    strengths: ["hearing-aware coaching", "mobility considerations", "refresher lessons", "post-pass confidence"],
    qualifications: ["ADI", "Pass Plus registered", "refresher specialist", "advanced-driving coaching"],
    availabilityTags: ["evenings", "weekends", "flexible"],
    learningPreferenceTags: ["visual examples", "written recap", "accessible pickup planning", "patient coaching", "confidence rebuilding"],
    accessibilityCapabilityTags: ["accessible pickup planning", "hearing-aware communication", "sign language support", "written or visual directions", "written recap", "mobility considerations", "patient coaching"],
    postPassTags: ["pass plus", "refresher lessons", "motorway driving", "city parking", "confidence rebuilding"],
    lessonAdaptations: ["agree communication method before moving", "sign language support where arranged", "written or visual directions", "accessible pickup planning", "written safety recap"],
    teachingStyle: "Patient coaching for learners returning to driving, post-pass development, and accessibility-led planning.",
    verifiedBadges: ["DVSA-approved ADI", "Verified LDA instructor", "Pass Plus registered"],
    onDemandAvailable: false,
    todaySlots: []
  }
];

function scoreText(values: string[], wanted: string[]) {
  return values.reduce((score, value) => {
    const normalised = value.toLowerCase();
    return score + wanted.filter((item) => normalised.includes(item.toLowerCase())).length;
  }, 0);
}

export function runSmartMatch(input: SmartMatchInput) {
  const preferences = [
    ...(input.accessibilityNeeds ?? []),
    ...(input.learningPreferences ?? []),
    ...(input.lessonPreferences ?? []),
    ...(input.learningSupport ?? []),
    ...(input.lessonSupport ?? []),
    ...(input.communicationPreferences ?? []),
    ...(input.environmentPreferences ?? [])
  ];
  const goals = input.goals ?? [];
  const notes = (input.privateNote ?? input.notes)?.toLowerCase() ?? "";
  const availability = input.availability === "book-now" ? "book-now" : input.availability === "today" ? "today" : input.availability;

  const ranked = smartMatchInstructors
    .map((instructor) => {
      let score = 50;
      const reasons: string[] = [];

      if (input.transmission) {
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

      if (availability && instructor.availabilityTags.includes(availability)) {
        score += 12;
        reasons.push(availability === "book-now" ? "Available for on-demand booking" : availability === "today" ? "Has lesson slots today" : "Fits your preferred timing");
      }

      if (availability === "book-now" && !instructor.onDemandAvailable) {
        score -= 18;
      }

      if (input.confidence === "nervous") {
        const calmScore = scoreText([...instructor.strengths, ...instructor.learningPreferenceTags, ...instructor.accessibilityCapabilityTags, ...instructor.lessonAdaptations], ["confidence", "calm", "step-by-step", "quiet", "pause", "low-pressure"]);
        score += calmScore * 8;
        if (calmScore) reasons.push("Strong fit for confidence-building lessons");
      }

      const preferenceScore = scoreText([...instructor.learningPreferenceTags, ...instructor.accessibilityCapabilityTags, ...instructor.lessonAdaptations, ...instructor.teachingStyle.split(/\W+/)], preferences);
      if (preferenceScore) {
        score += preferenceScore * 10;
        reasons.push("Matches the accessibility and learning preferences you selected");
      }

      const goalScore = scoreText([...instructor.strengths, ...instructor.qualifications, ...instructor.postPassTags], goals);
      if (goalScore) {
        score += goalScore * 9;
        reasons.push("Matches your driving goals");
      }

      if (input.lessonStage === "post-pass" || goals.some((goal) => ["pass plus", "motorway", "night", "advanced"].some((term) => goal.includes(term)))) {
        const postPassScore = scoreText([...instructor.postPassTags, ...instructor.qualifications], ["pass plus", "motorway", "night", "advanced", "dual carriageways"]);
        score += postPassScore * 8;
        if (postPassScore) reasons.push("Strong post-pass or advanced driving fit");
      }

      if (input.lessonStage === "refresher" || input.lessonStage === "returning") {
        const refresherScore = scoreText([...instructor.strengths, ...instructor.postPassTags, ...instructor.learningPreferenceTags], ["refresher", "confidence rebuilding", "returning", "parking reset"]);
        score += refresherScore * 9;
        if (refresherScore) reasons.push("Good fit for refresher or returning-driver confidence");
      }

      if (notes) {
        const noteScore = scoreText([...instructor.strengths, ...instructor.qualifications, ...instructor.learningPreferenceTags, ...instructor.accessibilityCapabilityTags, ...instructor.postPassTags, ...instructor.lessonAdaptations], notes.split(/\W+/).filter(Boolean));
        score += Math.min(noteScore * 2, 14);
        if (noteScore) reasons.push("Fits the private note you added");
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

  const topMatches = ranked.slice(0, 4);
  const top = topMatches[0] ?? ranked[0] ?? smartMatchInstructors[0];
  const learnerPlan = [
    input.disclosureConsent
      ? "Only the instructor you book can see the private note and selected accessibility preferences."
      : "Keep the private note inside this Smart Match session until you choose to share it at booking.",
    preferences.length
      ? `Prioritise instructors who offer ${preferences.slice(0, 3).join(", ")}.`
      : "Ask whether the learner prefers calm, structured, visual, written, quiet, or flexible coaching before checkout.",
    `Suggested adaptation: ${top.lessonAdaptations[0]}.`
  ];
  const plan = [
    input.confidence === "nervous" ? "Start with a calm confidence session and agree a pause signal before moving off." : "Begin with a short assessment drive so the instructor can set the right pace.",
    preferences.length ? "Use the selected learning preferences to shape the first lesson plan." : "Use LDA progress tracker notes after the lesson so you know exactly what to revise.",
    goals.includes("night") || goals.includes("night driving") || top.qualifications.some((qualification) => qualification.includes("night"))
      ? "Add a night-driving slot once basic control is settled, especially for winter lesson times."
      : "Book the next visible slot and keep the same pickup area for consistency."
  ];

  return {
    summary: `${top.name} is the strongest SmartMatch based on accessibility fit, transmission, price, verified profile, reviews, and availability.`,
    learnerPlan,
    accessibilityPlan: learnerPlan,
    ldaExclusive: [
      "Private learner preference handoff after booking",
      "Instructor capability matching beyond price and postcode",
      "Post-pass pathways for Pass Plus, night, motorway, refresher, and confidence rebuilding",
      "Progress tracker recommendations after each completed lesson"
    ],
    plan,
    matches: topMatches
  };
}
