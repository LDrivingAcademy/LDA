"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Bot,
  Brain,
  CalendarClock,
  CarFront,
  ChevronDown,
  MapPinned,
  Mic,
  MicOff,
  Minimize2,
  RotateCcw,
  Route,
  Send,
  Sparkles,
  Target,
  Wrench
} from "lucide-react";

type VehicleAiResponse = {
  answer: string;
  nextSteps: string[];
  mode: "demo" | "live";
  safetyCritical: boolean;
  topics: string[];
};

type VehicleRole = "learner" | "instructor" | "visitor";
type VehicleType = "manual" | "automatic" | "electric" | "hybrid" | "unknown";
type ConfidenceLevel = "new" | "building" | "confident";
type AssistantFocus = "vehicle" | "lesson-plan" | "schedule" | "smart-match";
type LessonGoal = "first-lesson" | "confidence" | "test-ready" | "manual-control" | "city-driving" | "instructor-ops";
type LessonWindow = "weekday-morning" | "weekday-midday" | "weekday-evening" | "weekend";

type BrowserSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onresult: ((event: {
    resultIndex?: number;
    results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }>;
  }) => void) | null;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  }
}

type AdaptiveProfile = {
  confidence: ConfidenceLevel;
  preferredRole: VehicleRole;
  preferredVehicle: VehicleType;
  preferredFocus: AssistantFocus;
  preferredGoal: LessonGoal;
  preferredArea: string;
  preferredWindow: LessonWindow;
  questionCount: number;
  spokenQuestionCount: number;
  planCount: number;
  recurringTopics: Record<string, number>;
  lastQuestions: string[];
};

const adaptiveProfileKey = "lda.vehicle-ai.profile.v2";

const defaultAdaptiveProfile: AdaptiveProfile = {
  confidence: "building",
  preferredRole: "learner",
  preferredVehicle: "manual",
  preferredFocus: "vehicle",
  preferredGoal: "confidence",
  preferredArea: "",
  preferredWindow: "weekday-midday",
  questionCount: 0,
  spokenQuestionCount: 0,
  planCount: 0,
  recurringTopics: {},
  lastQuestions: []
};

const quickPrompts = [
  "Build me a personalised lesson plan for this week.",
  "Suggest the best lesson time around my area.",
  "Use Smart Match to explain what instructor style suits me.",
  "How do I stop stalling in a manual car?"
];

const roleOptions: { label: string; value: VehicleRole }[] = [
  { label: "Learner", value: "learner" },
  { label: "Instructor", value: "instructor" },
  { label: "Visitor", value: "visitor" }
];

const vehicleOptions: { label: string; value: VehicleType }[] = [
  { label: "Manual", value: "manual" },
  { label: "Automatic", value: "automatic" },
  { label: "Electric", value: "electric" },
  { label: "Hybrid", value: "hybrid" },
  { label: "Not sure", value: "unknown" }
];

const focusOptions: { label: string; value: AssistantFocus; icon: typeof CarFront }[] = [
  { label: "Vehicle help", value: "vehicle", icon: CarFront },
  { label: "Lesson plan", value: "lesson-plan", icon: Target },
  { label: "Best lesson time", value: "schedule", icon: CalendarClock },
  { label: "Smart Match coach", value: "smart-match", icon: Route }
];

const goalOptions: { label: string; value: LessonGoal }[] = [
  { label: "First lesson", value: "first-lesson" },
  { label: "Build confidence", value: "confidence" },
  { label: "Test ready", value: "test-ready" },
  { label: "Manual control", value: "manual-control" },
  { label: "City driving", value: "city-driving" },
  { label: "Instructor operations", value: "instructor-ops" }
];

const windowOptions: { label: string; value: LessonWindow }[] = [
  { label: "Weekday morning", value: "weekday-morning" },
  { label: "Weekday midday", value: "weekday-midday" },
  { label: "Weekday evening", value: "weekday-evening" },
  { label: "Weekend", value: "weekend" }
];

const safetyPattern =
  /\b(brake|brakes|steering|tyre blowout|flat tyre|smoke|burning|overheat|overheating|engine light|warning light|red light|airbag|abs|crash|accident|fuel leak|oil leak|no control|unsafe|danger|dangerous)\b/i;
const transmissionPattern = /\b(clutch|gear|gears|bite point|stall|stalling|hill start|automatic|manual|paddle|transmission|neutral|park|drive)\b/i;
const checksPattern = /\b(show me|tell me|cockpit|mirrors|blind spot|oil|coolant|washer|lights|horn|demister|wipers|brake fluid|tyre pressure)\b/i;
const evPattern = /\b(electric|ev|hybrid|battery|charging|regen|regenerative|range|charge)\b/i;
const compliancePattern = /\b(mot|tax|insurance|service|servicing|adi|pdi|licence|license|expiry|compliance|maintenance|defect|record)\b/i;
const schedulePattern = /\b(schedule|time|slot|when|traffic|road condition|rush hour|morning|evening|weekend|availability|calendar|ideal lesson)\b/i;
const coachingPattern = /\b(plan|lesson plan|coach|coaching|practice|improve|confidence|nervous|test ready|test-ready|mock test|syllabus|goal|progress)\b/i;
const smartMatchPattern = /\b(smart match|smartmatch|match|instructor style|teaching style|support needs|preferences|best instructor|local instructor)\b/i;

function readAdaptiveProfile() {
  if (typeof window === "undefined") {
    return defaultAdaptiveProfile;
  }

  try {
    const saved = window.localStorage.getItem(adaptiveProfileKey) ?? window.localStorage.getItem("lda.vehicle-ai.profile.v1");
    if (!saved) {
      return defaultAdaptiveProfile;
    }

    const parsed = JSON.parse(saved) as Partial<AdaptiveProfile>;
    return {
      ...defaultAdaptiveProfile,
      ...parsed,
      recurringTopics: parsed.recurringTopics ?? {},
      lastQuestions: parsed.lastQuestions ?? []
    };
  } catch {
    return defaultAdaptiveProfile;
  }
}

function saveAdaptiveProfile(profile: AdaptiveProfile) {
  try {
    window.localStorage.setItem(adaptiveProfileKey, JSON.stringify(profile));
  } catch {
    // If local storage is unavailable, the assistant still works without memory.
  }
}

function classify(question: string) {
  const topics = [];
  if (safetyPattern.test(question)) topics.push("Safety");
  if (transmissionPattern.test(question)) topics.push("Transmission");
  if (checksPattern.test(question)) topics.push("Vehicle checks");
  if (evPattern.test(question)) topics.push("EV or hybrid");
  if (compliancePattern.test(question)) topics.push("Compliance");
  if (schedulePattern.test(question)) topics.push("Scheduling");
  if (coachingPattern.test(question)) topics.push("Coaching plan");
  if (smartMatchPattern.test(question)) topics.push("Smart Match");
  return topics.length ? [...new Set(topics)] : ["Vehicle guidance"];
}

function confidenceCopy(confidence: ConfidenceLevel) {
  if (confidence === "new") {
    return "I'll keep this step-by-step because your profile is set to new/confidence-building.";
  }

  if (confidence === "confident") {
    return "I'll keep this sharper and more operational because your profile is set to confident.";
  }

  return "I'll keep this practical and coached because your profile is still building confidence.";
}

function strongestMemory(profile: AdaptiveProfile) {
  const [topic] = Object.entries(profile.recurringTopics).sort((first, second) => second[1] - first[1])[0] ?? [];
  return topic;
}

function adaptiveIntro(profile: AdaptiveProfile, topics: string[]) {
  const strongestTopic = strongestMemory(profile);
  const memoryLine = strongestTopic
    ? `I can see you have asked most about ${strongestTopic.toLowerCase()}, so I'll connect this answer back to that pattern.`
    : "I'll start building your LDA AI profile from this question.";
  const topicLine = topics.length ? `Current focus: ${topics.join(", ")}.` : "";
  const areaLine = profile.preferredArea ? `Area profile: ${profile.preferredArea}.` : "";

  return `${confidenceCopy(profile.confidence)} ${memoryLine} ${topicLine} ${areaLine}`.trim();
}

function lessonGoalCopy(goal: LessonGoal) {
  const copy: Record<LessonGoal, string> = {
    "first-lesson": "getting comfortable with the car, instructor, mirrors, controls, and basic moving off",
    confidence: "building calm repeatable habits before adding harder road situations",
    "test-ready": "tightening faults, judgement, independent driving, and mock-test readiness",
    "manual-control": "clutch control, gear choice, hill starts, junction timing, and smooth recovery after stalls",
    "city-driving": "lane discipline, hazards, busier junctions, parked cars, pedestrians, cyclists, and speed control",
    "instructor-ops": "running availability, compliance, learner progress, payments, and booking admin professionally"
  };

  return copy[goal];
}

function lessonWindowCopy(window: LessonWindow) {
  const copy: Record<LessonWindow, string> = {
    "weekday-morning": "weekday mornings usually suit learners who want calmer energy before the day gets busy, but avoid school-run pinch points where possible",
    "weekday-midday": "weekday midday often gives the cleanest learning rhythm because traffic is usually more predictable than rush hour",
    "weekday-evening": "weekday evenings can be useful for real-world traffic practice, but they are better once core control feels steady",
    weekend: "weekends can work well for longer lessons and quieter residential practice, with busier shopping roads avoided at peak times"
  };

  return copy[window];
}

function buildPersonalPlan(role: VehicleRole, vehicleType: VehicleType, situation: string, question: string, profile: AdaptiveProfile, topics: string[]) {
  const intro = adaptiveIntro(profile, topics);
  const vehicleLabel = vehicleType === "unknown" ? "current vehicle" : `${vehicleType} vehicle`;
  const roleLine =
    role === "instructor"
      ? "For an instructor, I would turn this into a repeatable coaching and evidence workflow."
      : "For a learner, I would turn this into a clear practice route that builds confidence without rushing.";
  const recentQuestionLine = profile.lastQuestions[0] ? `I will also keep your last question in mind: "${profile.lastQuestions[0]}".` : "";

  return {
    answer:
      `${intro}\n\n${roleLine} Your current goal is ${lessonGoalCopy(profile.preferredGoal)} in a ${vehicleLabel}. ${recentQuestionLine}\n\nA strong LDA plan would be: warm-up and cockpit confidence, one focused skill, one real-road application, a short reflection, then one next-lesson target. If the question is about your area or traffic, I would choose the lesson time and road type around confidence first, then difficulty second.`,
    nextSteps: [
      "Start the next lesson with a two-minute confidence check: what feels easy, what feels uncertain, and what must not be rushed.",
      `Set the session focus to ${lessonGoalCopy(profile.preferredGoal)}.`,
      role === "instructor"
        ? "Record the learner's outcome, next focus, and any safety/compliance note in LDA before the next booking."
        : "Ask Smart Match or your instructor to prioritise an instructor style that fits this goal, not only distance or price."
    ]
  };
}

function buildScheduleAdvice(role: VehicleRole, profile: AdaptiveProfile, topics: string[]) {
  const intro = adaptiveIntro(profile, topics);
  const area = profile.preferredArea || "your chosen pickup area";
  const recommendation =
    profile.confidence === "new"
      ? "choose a quieter learning window first, then add busier traffic once your control improves"
      : profile.confidence === "confident"
        ? "use a mix of calmer slots and controlled busy-road practice so your skill transfers to real test conditions"
        : "aim for predictable traffic first, then gradually introduce more demanding roads";

  return {
    answer:
      `${intro}\n\nFor ${area}, LDA AI would start with your confidence level, lesson goal, instructor availability, and the kind of roads you need next. ${lessonWindowCopy(profile.preferredWindow)}. My recommendation is to ${recommendation}.\n\nThis is not live traffic routing yet, but it is designed to plug into live road-condition data later so LDA can suggest ideal slots from real availability, traffic patterns, and lesson goals.`,
    nextSteps: [
      `Preferred window: ${windowOptions.find((option) => option.value === profile.preferredWindow)?.label ?? "Weekday midday"}.`,
      role === "instructor"
        ? "Publish free slots in the calendar around calmer learner-friendly periods and reserve tougher traffic windows for confident pupils."
        : "When booking, choose an instructor slot that matches your confidence stage before choosing the cheapest or earliest slot.",
      "If the area is busy, start on quiet roads for the first 10 minutes, then move into the planned challenge route."
    ]
  };
}

function buildSmartMatchAdvice(role: VehicleRole, vehicleType: VehicleType, profile: AdaptiveProfile, topics: string[]) {
  const intro = adaptiveIntro(profile, topics);
  const vehicleLabel = vehicleType === "unknown" ? "your preferred car type" : `${vehicleType} lessons`;
  const style =
    profile.confidence === "new"
      ? "calm, patient, highly structured, and good at explaining before asking you to act"
      : profile.confidence === "confident"
        ? "direct, progress-focused, and comfortable challenging you with realistic test-standard routes"
        : "balanced: calm enough to protect confidence, but clear enough to keep progress moving";

  return {
    answer:
      `${intro}\n\nSmart Match should not only match by postcode. For you, it should weigh ${vehicleLabel}, instructor style, price, availability, support needs, lesson goal, and how you learn best. Based on your current profile, the strongest instructor fit is ${style}.\n\nThe more you ask LDA AI, the more the match profile can learn what matters: nervous junctions, manual control, test readiness, EV/hybrid questions, lesson timing, or instructor compliance needs.`,
    nextSteps: [
      "Use Smart Match with your confidence level, goal, vehicle type, and preferred lesson window already set.",
      "Prefer instructors whose profile matches your learning style, not just the closest available slot.",
      role === "instructor"
        ? "Use learner goals and recurring AI topics to prepare the lesson before the pupil gets in the car."
        : "After each lesson, ask the AI what to practise next so your match and plan keep improving."
    ]
  };
}

function buildVehicleResponse(
  role: VehicleRole,
  vehicleType: VehicleType,
  focus: AssistantFocus,
  situation: string,
  question: string,
  profile: AdaptiveProfile
): VehicleAiResponse {
  const combinedQuestion = `${situation} ${question}`;
  const roleLabel = role === "instructor" ? "instructor" : role === "learner" ? "learner" : "driver";
  const vehicleLabel = vehicleType === "unknown" ? "vehicle" : vehicleType;
  const safetyCritical = safetyPattern.test(combinedQuestion);
  const topics = classify(combinedQuestion);
  const intro = adaptiveIntro(profile, topics);
  const shouldPlan = focus === "lesson-plan" || coachingPattern.test(combinedQuestion);
  const shouldSchedule = focus === "schedule" || schedulePattern.test(combinedQuestion);
  const shouldSmartMatch = focus === "smart-match" || smartMatchPattern.test(combinedQuestion);

  if (safetyCritical) {
    return {
      answer:
        `${intro}\n\nThis sounds safety-related. Do not continue driving if the vehicle feels unsafe, has braking or steering issues, visible smoke, a serious warning light, a tyre problem, or a fluid leak. Stop somewhere safe if you are already moving, switch on hazard lights if needed, and contact your instructor, recovery provider, garage, or emergency services depending on the situation.`,
      nextSteps: [
        "Treat red warning lights, brake faults, steering faults, smoke, overheating, and tyre failures as stop-driving issues.",
        "Take a photo of the warning or defect only when parked safely.",
        roleLabel === "instructor"
          ? "Record the defect in your LDA vehicle compliance log before accepting more lessons."
          : "Tell your instructor what happened before booking or continuing the next lesson."
      ],
      mode: "demo",
      safetyCritical,
      topics
    };
  }

  if (shouldSchedule) {
    const scheduleAdvice = buildScheduleAdvice(role, profile, topics);
    return {
      ...scheduleAdvice,
      mode: "demo",
      safetyCritical,
      topics
    };
  }

  if (shouldSmartMatch) {
    const smartMatchAdvice = buildSmartMatchAdvice(role, vehicleType, profile, topics);
    return {
      ...smartMatchAdvice,
      mode: "demo",
      safetyCritical,
      topics
    };
  }

  if (shouldPlan) {
    const plan = buildPersonalPlan(role, vehicleType, situation, question, profile, topics);
    return {
      ...plan,
      mode: "demo",
      safetyCritical,
      topics
    };
  }

  if (transmissionPattern.test(combinedQuestion)) {
    const manualAdvice =
      "For a manual car, think in this order: clutch fully down, choose the right gear, find the bite point gently, add light gas, check mirrors and surroundings, then release smoothly. If you stall, secure the car, restart calmly, and reset the same sequence.";
    const automaticAdvice =
      "For an automatic, focus on smooth brake control, correct selector use, creep control, safe observation, and avoiding left-foot braking unless your instructor has specifically trained you that way.";

    return {
      answer:
        vehicleType === "automatic" || vehicleType === "electric" || vehicleType === "hybrid"
          ? `${intro}\n\n${automaticAdvice}`
          : `${intro}\n\n${manualAdvice} If you are in an automatic or EV, the key habit changes from clutch control to brake, selector, speed, and observation control.`,
      nextSteps: [
        "Ask your instructor to isolate the skill for five minutes before using it in traffic.",
        "Practise the same routine out loud until the order feels automatic.",
        "If the car jumps, stalls repeatedly, or makes unusual noises, pause and ask for an instructor check."
      ],
      mode: "demo",
      safetyCritical,
      topics
    };
  }

  if (checksPattern.test(combinedQuestion)) {
    return {
      answer:
        `${intro}\n\nFor UK learner driving, vehicle confidence comes from repeatable checks: seating and belt, mirrors, blind spots, lights, tyres, fluids, demisters, wipers, horn, and warning lights. For show-me/tell-me style questions, learn what the control does, when to use it, and how to check it without taking attention away from the road.`,
      nextSteps: [
        "Use the cockpit drill before every lesson: doors, seat, belt, mirrors, controls.",
        "Ask your instructor to link each check to a real driving situation, not just a memorised answer.",
        "Keep a short list of controls you still hesitate on and review it before your next booking."
      ],
      mode: "demo",
      safetyCritical,
      topics
    };
  }

  if (evPattern.test(combinedQuestion)) {
    return {
      answer:
        `${intro}\n\nFor EVs and hybrids, the big learning differences are smoother acceleration, regenerative braking, range planning, charging awareness, and understanding that the car may move or respond very quietly. Treat the silence as a reason to be more observant around pedestrians, cyclists, and car parks.`,
      nextSteps: [
        "Ask how regenerative braking changes the feel of slowing down.",
        "Check the vehicle range and charging plan before longer lessons.",
        "Practise low-speed control in a quiet area because EV torque can feel immediate."
      ],
      mode: "demo",
      safetyCritical,
      topics
    };
  }

  if (compliancePattern.test(combinedQuestion)) {
    return {
      answer:
        roleLabel === "instructor"
          ? `${intro}\n\nFor instructor use, vehicle compliance should stay visible before lessons: MOT, tax, insurance, servicing, tyres, lights, registration status, defects, and expiry reminders. LDA should be your operating record so a lesson is never accepted with a compliance gap.`
          : `${intro}\n\nFor learners, you do not need to manage the instructor vehicle compliance record, but you should feel confident the car is roadworthy. If you notice a defect, warning light, tyre issue, or anything unsafe, ask the instructor before driving.`,
      nextSteps: [
        roleLabel === "instructor" ? "Update the vehicle compliance page after any service, MOT, insurance, or defect event." : "Raise any vehicle concern before the lesson starts.",
        "Never ignore a warning light just because the lesson is already booked.",
        "Keep photos or documents only where LDA asks for them and avoid sharing unnecessary personal data."
      ],
      mode: "demo",
      safetyCritical,
      topics
    };
  }

  return {
    answer:
      `${intro}\n\nFor a ${roleLabel} using a ${vehicleLabel}, the safest way to learn a vehicle topic is to split it into three parts: what the control or system does, when it matters during a lesson, and what action to take if something feels wrong. I can also build lesson plans, suggest better lesson windows, and connect your profile to Smart Match so LDA becomes more personalised each time you use it.`,
    nextSteps: [
      "Ask one specific question at a time for a sharper answer.",
      "Include the car type, warning light colour, lesson situation, and whether the vehicle is moving or parked.",
      "If the issue could affect braking, steering, tyres, smoke, overheating, or visibility, stop and treat it as safety-critical."
    ],
    mode: "demo",
    safetyCritical,
    topics
  };
}

function updateAdaptiveProfile(
  profile: AdaptiveProfile,
  role: VehicleRole,
  vehicleType: VehicleType,
  focus: AssistantFocus,
  question: string,
  topics: string[],
  usedVoice: boolean
) {
  const recurringTopics = { ...profile.recurringTopics };
  topics.forEach((topic) => {
    recurringTopics[topic] = (recurringTopics[topic] ?? 0) + 1;
  });

  return {
    ...profile,
    preferredRole: role,
    preferredVehicle: vehicleType,
    preferredFocus: focus,
    questionCount: profile.questionCount + 1,
    spokenQuestionCount: usedVoice ? profile.spokenQuestionCount + 1 : profile.spokenQuestionCount,
    planCount: focus === "lesson-plan" || topics.includes("Coaching plan") ? profile.planCount + 1 : profile.planCount,
    recurringTopics,
    lastQuestions: [question.trim(), ...profile.lastQuestions].filter(Boolean).slice(0, 3)
  };
}

export function VehicleAiAssistant({ variant = "floating" }: { variant?: "floating" | "inline" }) {
  const [isOpen, setIsOpen] = useState(variant === "inline");
  const [role, setRole] = useState<VehicleRole>("learner");
  const [vehicleType, setVehicleType] = useState<VehicleType>("manual");
  const [focus, setFocus] = useState<AssistantFocus>("vehicle");
  const [situation, setSituation] = useState("");
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState<VehicleAiResponse | null>(null);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<AdaptiveProfile>(defaultAdaptiveProfile);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcriptStatus, setTranscriptStatus] = useState("");
  const [lastInputUsedVoice, setLastInputUsedVoice] = useState(false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);

  useEffect(() => {
    const savedProfile = readAdaptiveProfile();
    setProfile(savedProfile);
    setRole(savedProfile.preferredRole);
    setVehicleType(savedProfile.preferredVehicle);
    setFocus(savedProfile.preferredFocus);
    setSpeechSupported(Boolean(window.SpeechRecognition || window.webkitSpeechRecognition));
  }, []);

  useEffect(() => {
    saveAdaptiveProfile(profile);
  }, [profile]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResponse(null);

    if (question.trim().length < 3) {
      setError("Ask a vehicle, lesson, schedule, or Smart Match question first.");
      return;
    }

    const nextResponse = buildVehicleResponse(role, vehicleType, focus, situation, question, profile);
    const nextProfile = updateAdaptiveProfile(profile, role, vehicleType, focus, question, nextResponse.topics, lastInputUsedVoice);
    setResponse(nextResponse);
    setProfile(nextProfile);
    setLastInputUsedVoice(false);
  }

  function resetAdaptiveProfile() {
    recognitionRef.current?.abort();
    setProfile(defaultAdaptiveProfile);
    setRole(defaultAdaptiveProfile.preferredRole);
    setVehicleType(defaultAdaptiveProfile.preferredVehicle);
    setFocus(defaultAdaptiveProfile.preferredFocus);
    setResponse(null);
    setError("");
    setTranscriptStatus("");
    setIsListening(false);
  }

  function updateProfileField<Key extends keyof AdaptiveProfile>(key: Key, value: AdaptiveProfile[Key]) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  function startDictation() {
    setError("");

    if (!speechSupported) {
      setError("Voice dictation is not supported by this browser yet. You can still type your question.");
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setError("Voice dictation is not supported by this browser yet. You can still type your question.");
      return;
    }

    const recognition = new Recognition();
    recognition.lang = "en-GB";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onstart = () => {
      setIsListening(true);
      setTranscriptStatus("Listening...");
    };
    recognition.onend = () => {
      setIsListening(false);
      setTranscriptStatus((current) => (current === "Listening..." ? "Dictation stopped." : current));
    };
    recognition.onerror = (event) => {
      setIsListening(false);
      setTranscriptStatus("");
      setError(event.error === "not-allowed" ? "Microphone permission was not allowed." : "Dictation stopped. Try again or type your question.");
    };
    recognition.onresult = (event) => {
      let finalTranscript = "";
      let interimTranscript = "";
      const startIndex = event.resultIndex ?? 0;

      for (let index = startIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript.trim()) {
        setQuestion((current) => `${current}${current.trim() ? " " : ""}${finalTranscript.trim()}`.trim());
        setLastInputUsedVoice(true);
        setTranscriptStatus("Dictation added to your question.");
      } else if (interimTranscript.trim()) {
        setTranscriptStatus(`Hearing: ${interimTranscript.trim()}`);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  const panel = (
    <section className={`${variant === "floating" ? "max-h-[78vh] overflow-y-auto rounded border border-zinc-800 bg-zinc-950 shadow-2xl" : "rounded bg-black shadow-2xl"} p-4 text-white sm:p-5`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded bg-red-500/15 text-brand">
            <Bot size={23} />
          </div>
          <div>
            <div className="text-xs font-black uppercase text-red-200">LDA Adaptive AI</div>
            <h2 className="text-xl font-black leading-tight">Your driving co-pilot.</h2>
          </div>
        </div>
        {variant === "floating" ? (
          <button
            type="button"
            aria-label="Minimise LDA Adaptive AI"
            onClick={() => setIsOpen(false)}
            className="grid h-9 w-9 shrink-0 place-items-center rounded border border-zinc-800 text-zinc-300 hover:border-red-500 hover:text-white"
          >
            <Minimize2 size={18} />
          </button>
        ) : null}
      </div>

      <p className="mt-3 text-sm font-semibold leading-6 text-zinc-300">
        Ask by typing or microphone. LDA AI can help with vehicles, lesson plans, Smart Match, confidence, scheduling, safety, and instructor operations.
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {focusOptions.map((option) => {
          const Icon = option.icon;
          const selected = focus === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setFocus(option.value);
                updateProfileField("preferredFocus", option.value);
              }}
              className={`flex items-center gap-2 rounded border bg-white px-3 py-3 text-left text-sm font-black text-black transition ${
                selected ? "border-brand ring-2 ring-red-500/25" : "border-zinc-300 hover:border-brand"
              }`}
            >
              <Icon size={18} className="text-brand" />
              {option.label}
            </button>
          );
        })}
      </div>

      <div className="mt-4 rounded border border-zinc-800 bg-black p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase text-red-200">
              <Brain size={15} /> Adaptive profile
            </div>
            <p className="mt-2 text-xs font-semibold leading-5 text-zinc-400">
              {profile.questionCount
                ? `Learning from ${profile.questionCount} question${profile.questionCount === 1 ? "" : "s"}, ${profile.spokenQuestionCount} spoken input${profile.spokenQuestionCount === 1 ? "" : "s"}, and ${profile.planCount} plan request${profile.planCount === 1 ? "" : "s"}. Strongest focus: ${strongestMemory(profile) ?? "building profile"}.`
                : "No memory yet. Ask a question and LDA will begin tailoring this assistant to you."}
            </p>
          </div>
          <button
            type="button"
            onClick={resetAdaptiveProfile}
            className="grid h-8 w-8 shrink-0 place-items-center rounded border border-zinc-800 text-zinc-400 hover:border-red-500 hover:text-white"
            aria-label="Reset adaptive Vehicle AI profile"
          >
            <RotateCcw size={15} />
          </button>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-black uppercase text-zinc-500">
            Confidence
            <select value={profile.confidence} onChange={(event) => updateProfileField("confidence", event.target.value as ConfidenceLevel)} className="rounded border border-zinc-700 bg-white px-3 py-2 text-sm font-black text-black">
              <option value="new">New / nervous</option>
              <option value="building">Building confidence</option>
              <option value="confident">Confident</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-black uppercase text-zinc-500">
            Goal
            <select value={profile.preferredGoal} onChange={(event) => updateProfileField("preferredGoal", event.target.value as LessonGoal)} className="rounded border border-zinc-700 bg-white px-3 py-2 text-sm font-black text-black">
              {goalOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-black uppercase text-zinc-500">
            Area / pickup
            <input
              value={profile.preferredArea}
              onChange={(event) => updateProfileField("preferredArea", event.target.value)}
              placeholder="e.g. EN5, Harrow, Birmingham"
              className="rounded border border-zinc-700 bg-white px-3 py-2 text-sm font-black text-black placeholder:text-zinc-500"
            />
          </label>
          <label className="grid gap-1 text-xs font-black uppercase text-zinc-500">
            Lesson window
            <select value={profile.preferredWindow} onChange={(event) => updateProfileField("preferredWindow", event.target.value as LessonWindow)} className="rounded border border-zinc-700 bg-white px-3 py-2 text-sm font-black text-black">
              {windowOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {quickPrompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => setQuestion(prompt)}
            className="rounded border border-zinc-800 bg-black px-3 py-3 text-left text-sm font-bold text-zinc-200 hover:border-red-500 hover:text-white"
          >
            {prompt}
          </button>
        ))}
      </div>

      <form onSubmit={submitQuestion} className="mt-4 grid gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-black uppercase text-zinc-400">
            Account type
            <select value={role} onChange={(event) => setRole(event.target.value as VehicleRole)} className="rounded border border-zinc-700 bg-white px-3 py-3 text-sm font-black text-black">
              {roleOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-black uppercase text-zinc-400">
            Vehicle
            <select value={vehicleType} onChange={(event) => setVehicleType(event.target.value as VehicleType)} className="rounded border border-zinc-700 bg-white px-3 py-3 text-sm font-black text-black">
              {vehicleOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>

        <input
          value={situation}
          onChange={(event) => setSituation(event.target.value)}
          placeholder="Situation, e.g. parked, lesson, test prep, warning light, traffic, EN5"
          className="rounded border border-zinc-700 bg-white px-3 py-3 text-sm font-bold text-black placeholder:text-zinc-500"
        />
        <div className="relative">
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask about the vehicle, lesson plan, best lesson time, Smart Match, confidence, or instructor operations"
            rows={variant === "floating" ? 4 : 5}
            className="w-full rounded border border-zinc-700 bg-white px-3 py-3 pr-14 text-sm font-bold text-black placeholder:text-zinc-500"
          />
          <button
            type="button"
            onClick={startDictation}
            aria-label={isListening ? "Stop voice dictation" : "Start voice dictation"}
            className={`absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full border text-black transition ${
              isListening ? "border-red-500 bg-red-50 text-brand ring-2 ring-red-500/25" : "border-zinc-300 bg-white hover:border-brand"
            }`}
          >
            {isListening ? <MicOff size={19} /> : <Mic size={19} />}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-zinc-400">
          <MapPinned size={15} className="text-brand" />
          {transcriptStatus || (speechSupported ? "Microphone dictation available on supported browsers." : "Type your question. This browser has not exposed speech recognition.")}
        </div>

        <button type="submit" className="lda-pill lda-pill-sm justify-center">
          Ask LDA AI <Send size={16} />
        </button>
      </form>

      {error ? (
        <p className="mt-4 rounded border border-red-500/40 bg-red-500/10 p-3 text-sm font-bold text-red-100">{error}</p>
      ) : null}

      {response ? (
        <article className="mt-4 rounded bg-white p-4 text-black">
          <div className="flex flex-wrap items-center gap-2 text-xs font-black uppercase text-zinc-500">
            {response.safetyCritical ? <AlertTriangle size={16} className="text-brand" /> : <Sparkles size={16} className="text-brand" />}
            {response.mode === "live" ? "AI response" : "Adaptive guided response"}
            {response.topics.map((topic) => (
              <span key={topic} className="rounded-full bg-zinc-100 px-2 py-1 text-[11px] text-zinc-700">{topic}</span>
            ))}
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-6 text-zinc-800">{response.answer}</p>
          {response.nextSteps.length ? (
            <div className="mt-4 rounded bg-zinc-100 p-4">
              <div className="flex items-center gap-2 text-sm font-black text-black">
                <Wrench size={17} className="text-brand" /> Action plan
              </div>
              <ul className="mt-2 grid gap-2 text-sm font-semibold leading-6 text-zinc-700">
                {response.nextSteps.map((step) => (
                  <li key={step} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </article>
      ) : null}

      <p className="mt-3 text-xs font-semibold leading-5 text-zinc-500">
        LDA AI is guidance only. If the car may be unsafe, stop safely and contact your instructor, garage, recovery provider, or emergency services.
      </p>
    </section>
  );

  if (variant === "inline") {
    return panel;
  }

  return (
    <div className="fixed bottom-5 left-5 z-50 w-[min(calc(100vw-2.5rem),430px)]">
      {isOpen ? (
        panel
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex max-w-full items-center gap-3 rounded-full border border-red-500/40 bg-black px-4 py-3 text-left text-white shadow-2xl transition hover:border-red-500 hover:ring-2 hover:ring-red-500/30"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand text-white">
            <CarFront size={22} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-black">LDA Adaptive AI</span>
            <span className="block truncate text-xs font-bold text-zinc-400">Voice, plans, Smart Match, safety</span>
          </span>
          <ChevronDown className="-rotate-90 text-zinc-400" size={18} />
        </button>
      )}
    </div>
  );
}
