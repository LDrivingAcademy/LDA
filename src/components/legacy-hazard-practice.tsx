"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpenCheck, CheckCircle2, Clock3, ExternalLink, Flag, MousePointerClick, Play, RotateCcw, TrafficCone, type LucideIcon } from "lucide-react";

// Retained only until the reviewed video release replaces the old practice mode.
// Never import this answer-bearing legacy module from the new video player.
type HazardScene = "school-run" | "parked-van" | "junction-cyclist" | "motorway-merge" | "wet-roundabout" | "rural-bend" | "bus-stop" | "night-roadworks" | "zebra-crossing" | "emergency-vehicle";

type HazardWindow = { label: string; start: number; end: number; clue: string };

type HazardScenario = {
  id: string;
  title: string;
  setting: string;
  length: number;
  scene: HazardScene;
  hazards: HazardWindow[];
  briefing: string;
};

type WeakAreaRecommendation = {
  category: string;
  scenario: HazardScenario;
  score: number;
  max: number;
};

const HAZARD_PASS_MARK = 44;

const HAZARD_TOTAL_MARKS = 75;

const hazardScenarios: HazardScenario[] = [
  {
    id: "school-run-child",
    title: "School-run side road",
    setting: "Residential street with parked cars",
    length: 28,
    scene: "school-run",
    briefing: "Scan both pavements, the gaps between parked cars, and the busier side road ahead.",
    hazards: [{ label: "Child steps out between parked cars", start: 10.2, end: 15.2, clue: "A football rolls from behind the parked cars before the child appears." }]
  },
  {
    id: "parked-van-pedestrian",
    title: "High street delivery van",
    setting: "Urban high street",
    length: 26,
    scene: "parked-van",
    briefing: "Watch the nearside pavement, shop entrances, and the blind area around the delivery van.",
    hazards: [{ label: "Pedestrian emerges from behind delivery van", start: 8.8, end: 13.8, clue: "The van blocks your view before a pedestrian starts crossing." }]
  },
  {
    id: "junction-cyclist",
    title: "Left turn with cyclist",
    setting: "Busy junction",
    length: 27,
    scene: "junction-cyclist",
    briefing: "Check mirrors, blind spots, cycle lanes, and vehicles turning across your path.",
    hazards: [{ label: "Cyclist moves up the inside as you approach a left turn", start: 9.4, end: 14.4, clue: "A cyclist appears in the nearside lane and closes the gap." }]
  },
  {
    id: "motorway-merge-lorry",
    title: "Motorway merge",
    setting: "Dual carriageway slip road",
    length: 29,
    scene: "motorway-merge",
    briefing: "Judge joining traffic, lane changes, and vehicles that may move without enough space.",
    hazards: [{ label: "Lorry indicates and starts moving into your lane", start: 11.1, end: 16.1, clue: "The lorry indicator starts flashing before the vehicle drifts across." }]
  },
  {
    id: "wet-roundabout",
    title: "Wet roundabout approach",
    setting: "Rainy roundabout",
    length: 28,
    scene: "wet-roundabout",
    briefing: "Look for poor grip, late braking, blocked exits, and vehicles joining without enough space.",
    hazards: [{ label: "Car ahead brakes sharply on the wet approach", start: 10.7, end: 15.7, clue: "Brake lights appear suddenly as traffic bunches near the give-way line." }]
  },
  {
    id: "rural-bend-tractor",
    title: "Rural bend",
    setting: "Narrow country road",
    length: 30,
    scene: "rural-bend",
    briefing: "Read hedges, road width, oncoming gaps, mud, and slow vehicles around bends.",
    hazards: [{ label: "Slow tractor appears around a blind bend", start: 12.0, end: 17.0, clue: "The bend hides a slow vehicle until it enters your lane view." }]
  },
  {
    id: "bus-stop-passenger",
    title: "Bus stop pull-out",
    setting: "Town road with bus stop",
    length: 27,
    scene: "bus-stop",
    briefing: "Scan bus indicators, passengers, pedestrians crossing in front of the bus, and following traffic.",
    hazards: [{ label: "Bus indicates and moves away from the stop", start: 9.6, end: 14.6, clue: "The bus indicator flashes while passengers are still nearby." }]
  },
  {
    id: "night-roadworks",
    title: "Night roadworks",
    setting: "Dark road with temporary traffic control",
    length: 29,
    scene: "night-roadworks",
    briefing: "Watch temporary signs, cones, work vehicles, workers, and narrowing lanes.",
    hazards: [{ label: "Temporary works vehicle reverses near cones", start: 11.4, end: 16.4, clue: "Hazard lights flash before the works vehicle moves into the lane." }]
  },
  {
    id: "zebra-crossing-runner",
    title: "Zebra crossing",
    setting: "Shopping parade",
    length: 25,
    scene: "zebra-crossing",
    briefing: "Approach crossings ready to stop and watch people who may suddenly step out.",
    hazards: [{ label: "Pedestrian turns and steps onto the zebra crossing", start: 7.8, end: 12.8, clue: "The pedestrian changes body direction towards the crossing." }]
  },
  {
    id: "emergency-blue-lights",
    title: "Emergency vehicle behind",
    setting: "Urban main road",
    length: 28,
    scene: "emergency-vehicle",
    briefing: "Keep checking mirrors and find a safe place to let the emergency vehicle pass.",
    hazards: [{ label: "Emergency vehicle approaches from behind with blue lights", start: 10.5, end: 15.5, clue: "Blue lights appear in the mirror and traffic starts reacting." }]
  },
  {
    id: "high-street-car-door",
    title: "Parked car door",
    setting: "High street with parked vehicles",
    length: 27,
    scene: "parked-van",
    briefing: "Look through and beyond parked vehicles for occupants, doors opening, pedestrians, and cyclists.",
    hazards: [{ label: "A parked vehicle door opens into your lane", start: 9.2, end: 14.2, clue: "Movement appears beside the parked vehicle before the door opens into your path." }]
  },
  {
    id: "country-horse-rider",
    title: "Horse rider on bend",
    setting: "Rural lane",
    length: 30,
    scene: "rural-bend",
    briefing: "Use bends, hedges, road surface, and verge movement to anticipate slower vulnerable road users.",
    hazards: [{ label: "Horse rider appears around a narrow bend", start: 11.8, end: 16.8, clue: "The bend and hedges hide the rider until they enter the lane ahead." }]
  },
  {
    id: "shopping-crossing-child",
    title: "Shopping parade crossing",
    setting: "Urban pedestrian area",
    length: 26,
    scene: "zebra-crossing",
    briefing: "Approach crossings ready to slow or stop, especially where people are distracted or hidden by street furniture.",
    hazards: [{ label: "Pedestrian suddenly commits to the crossing", start: 8.5, end: 13.5, clue: "The pedestrian turns towards the crossing and steps into the road." }]
  },
  {
    id: "residential-two-hazards",
    title: "Residential double hazard",
    setting: "School route with parked cars",
    length: 31,
    scene: "school-run",
    briefing: "Keep scanning after the first developing hazard because some clips can contain two separate hazards.",
    hazards: [
      { label: "Ball rolls from between parked cars", start: 7.8, end: 12.0, clue: "A ball rolls out before a child may follow." },
      { label: "Child follows the ball into the road", start: 12.2, end: 17.2, clue: "The child appears after the first clue, creating a second developing hazard." }
    ]
  }
];

const hazardCoachingPoints = [
  "Scan ahead, mirrors, pavements, junctions, parked vehicles, crossings, and side roads.",
  "Click when the situation becomes a developing hazard that may make you change speed or direction.",
  "Avoid clicking continuously or in a pattern. In official scoring this can result in no score for the clip.",
  "One clip in the official test has two developing hazards, so keep scanning after your first click."
];

const hazardWeakAreaLabels: Record<HazardScene, string> = {
  "school-run": "Children, schools, and parked-car gaps",
  "parked-van": "Parked vehicles and hidden pedestrians",
  "junction-cyclist": "Cyclists and nearside blind spots",
  "motorway-merge": "Dual carriageway merging and lane changes",
  "wet-roundabout": "Wet-road braking and roundabout approach",
  "rural-bend": "Country-road bends and slow vulnerable road users",
  "bus-stop": "Buses, stops, and pedestrian movement",
  "night-roadworks": "Night driving and temporary roadworks",
  "zebra-crossing": "Pedestrian crossings and commitment cues",
  "emergency-vehicle": "Emergency vehicles and mirror checks"
};

function formatClipTime(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const wholeSeconds = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${wholeSeconds}`;
}

function getWindowScore(clickTime: number | undefined, hazard: HazardWindow) {
  if (clickTime === undefined) return 0;
  if (clickTime < hazard.start || clickTime > hazard.end) return 0;
  const windowSize = hazard.end - hazard.start;
  const score = 5 - Math.floor(((clickTime - hazard.start) / windowSize) * 5);
  return Math.max(1, Math.min(5, score));
}

function hasClickPattern(clicks: number[]) {
  if (clicks.length > 10) return true;
  let rapidBursts = 0;
  for (let index = 1; index < clicks.length; index += 1) {
    if (clicks[index] - clicks[index - 1] < 0.45) rapidBursts += 1;
  }
  return rapidBursts >= 4;
}

function getHazardScores(scenario: HazardScenario, clicks: number[]) {
  if (hasClickPattern(clicks)) {
    return {
      total: 0,
      max: scenario.hazards.length * 5,
      disqualified: true,
      matched: scenario.hazards.map((hazard) => ({ hazard, clickTime: undefined, score: 0 }))
    };
  }

  const matched = scenario.hazards.map((hazard) => {
    const clickTime = clicks.find((click) => click >= hazard.start && click <= hazard.end);
    return { hazard, clickTime, score: getWindowScore(clickTime, hazard) };
  });

  return {
    total: matched.reduce((sum, item) => sum + item.score, 0),
    max: scenario.hazards.length * 5,
    disqualified: false,
    matched
  };
}

function buildWeakAreaRecommendations(
  scoredClips: Array<{ scenario: HazardScenario; clicks: number[] }>
): WeakAreaRecommendation[] {
  const recommendations = scoredClips
    .map(({ scenario, clicks }) => {
      const result = getHazardScores(scenario, clicks);
      return {
        category: hazardWeakAreaLabels[scenario.scene],
        scenario,
        score: result.total,
        max: result.max
      };
    })
    .filter((recommendation) => recommendation.score < recommendation.max)
    .sort((left, right) => {
      const leftRate = left.max ? left.score / left.max : 0;
      const rightRate = right.max ? right.score / right.max : 0;
      return leftRate - rightRate;
    });

  const seen = new Set<string>();
  return recommendations.filter((recommendation) => {
    if (seen.has(recommendation.category)) return false;
    seen.add(recommendation.category);
    return true;
  }).slice(0, 4);
}

function motion(time: number, start: number, end: number, from: number, to: number) {
  const progress = Math.min(1, Math.max(0, (time - start) / (end - start)));
  return from + (to - from) * progress;
}

function vehicleClass(colour: string) {
  return `absolute rounded-t-xl ${colour} shadow-2xl before:absolute before:left-[16%] before:top-[22%] before:h-[28%] before:w-[68%] before:rounded before:bg-sky-100/80 after:absolute after:bottom-[-8px] after:left-[14%] after:h-4 after:w-4 after:rounded-full after:bg-zinc-950`;
}

function RealisticHazardPracticeScene({
  scenario,
  time,
  clicks,
  showAnswer,
  isWindowLive
}: {
  scenario: HazardScenario;
  time: number;
  clicks: number[];
  showAnswer: boolean;
  isWindowLive: boolean;
}) {
  const roadPulse = (time * 28) % 92;
  const isNight = scenario.scene === "night-roadworks";
  const isWet = scenario.scene === "wet-roundabout";
  const isRural = scenario.scene === "rural-bend";
  const isMotorway = scenario.scene === "motorway-merge" || scenario.scene === "emergency-vehicle";
  const pedestrianX = motion(time, 7.5, 15, 430, 610);
  const parkedPedestrianX = motion(time, 8, 14, 332, 484);
  const cyclistX = motion(time, 7, 15, 950, 650);
  const motorwayTruckX = motion(time, 8, 16, 190, 420);
  const leadCarY = motion(time, 7, 16, 278, 368);
  const tractorX = motion(time, 9, 17, 990, 610);
  const busX = motion(time, 7, 15, 118, 286);
  const worksX = motion(time, 9, 16, 910, 780);
  const crossingX = motion(time, 6, 13, 318, 604);
  const emergencyScale = motion(time, 8, 15, 0.72, 1.26);
  const lastClickTime = clicks[clicks.length - 1];
  const showClickPulse = lastClickTime !== undefined && Math.abs(time - lastClickTime) < 1.2;

  function car({
    x,
    y,
    scale = 1,
    colour = "#1d4ed8",
    facing = "away",
    lights = false,
    label
  }: {
    x: number;
    y: number;
    scale?: number;
    colour?: string;
    facing?: "away" | "towards" | "side";
    lights?: boolean;
    label?: string;
  }) {
    const width = facing === "side" ? 145 : 86;
    const height = facing === "side" ? 54 : 142;
    return (
      <g transform={`translate(${x} ${y}) scale(${scale})`} filter="url(#sceneShadow)">
        {facing === "side" ? (
          <>
            <path d={`M0 34 C18 8 46 0 92 4 L124 16 C139 20 145 31 142 45 L8 49 C1 47 -3 41 0 34Z`} fill={colour} />
            <path d="M42 8 H87 L106 22 H28 Z" fill="url(#glassGradient)" opacity="0.9" />
            <circle cx="29" cy="50" r="12" fill="#111827" />
            <circle cx="113" cy="50" r="12" fill="#111827" />
            <circle cx="29" cy="50" r="5" fill="#4b5563" />
            <circle cx="113" cy="50" r="5" fill="#4b5563" />
            {lights ? <circle cx="140" cy="32" r="6" fill="#fef3c7" /> : null}
          </>
        ) : (
          <>
            <path d={`M10 42 C14 14 28 0 43 0 C60 0 74 14 78 42 L86 116 C88 135 75 142 43 142 C11 142 -2 135 0 116 Z`} fill={colour} />
            <path d="M19 42 C24 20 32 12 43 12 C54 12 63 20 68 42 L61 59 H25 Z" fill="url(#glassGradient)" opacity="0.95" />
            <path d="M21 72 H65 L70 113 C62 121 25 121 16 113 Z" fill="rgba(255,255,255,0.16)" />
            <rect x="11" y="122" width="18" height="8" rx="3" fill={lights || facing === "away" ? "#ef4444" : "#fef3c7"} opacity={lights ? "1" : "0.75"} />
            <rect x="57" y="122" width="18" height="8" rx="3" fill={lights || facing === "away" ? "#ef4444" : "#fef3c7"} opacity={lights ? "1" : "0.75"} />
            {label ? <text x="43" y="88" textAnchor="middle" fontSize="34" fontWeight="900" fill="white">{label}</text> : null}
          </>
        )}
      </g>
    );
  }

  function person(x: number, y: number, scale = 1, colour = "#111827") {
    return (
      <g transform={`translate(${x} ${y}) scale(${scale})`} filter="url(#sceneShadow)">
        <circle cx="0" cy="-28" r="13" fill="#f3d2b8" />
        <path d="M-12 -12 C-8 -30 9 -30 14 -12 L18 40 H-16 Z" fill={colour} />
        <path d="M-12 38 L-24 82 M14 38 L29 82" stroke="#1f2937" strokeWidth="9" strokeLinecap="round" />
        <path d="M-12 4 L-42 24 M14 2 L39 22" stroke={colour} strokeWidth="8" strokeLinecap="round" />
      </g>
    );
  }

  function cone(x: number, y: number, scale = 1) {
    return (
      <g transform={`translate(${x} ${y}) scale(${scale})`}>
        <path d="M0 58 L25 0 L50 58 Z" fill="#ea580c" />
        <rect x="9" y="34" width="32" height="8" fill="#fff7ed" />
        <rect x="-8" y="58" width="66" height="9" rx="3" fill="#7c2d12" />
      </g>
    );
  }

  function tree(x: number, y: number, scale = 1) {
    return (
      <g transform={`translate(${x} ${y}) scale(${scale})`} filter="url(#sceneShadow)">
        <path d="M-7 92 C-4 62 -2 28 0 0 C5 30 8 62 9 92 Z" fill="#5b3b24" />
        <circle cx="-26" cy="8" r="30" fill="#214f2a" />
        <circle cx="7" cy="-6" r="38" fill="#2f6b35" />
        <circle cx="39" cy="16" r="30" fill="#255d2f" />
        <circle cx="-4" cy="30" r="36" fill="#36733a" />
      </g>
    );
  }

  function streetLight(x: number, y: number, scale = 1) {
    return (
      <g transform={`translate(${x} ${y}) scale(${scale})`} opacity="0.85">
        <path d="M0 180 V20 C0 8 9 0 21 0 H72" fill="none" stroke="#303841" strokeWidth="7" strokeLinecap="round" />
        <path d="M70 -2 C92 -2 103 10 108 22 L70 22 Z" fill="#303841" />
      </g>
    );
  }

  function bollards(startX: number, y: number, count: number, gap: number) {
    return Array.from({ length: count }).map((_, index) => (
      <g key={`${startX}-${y}-${index}`} transform={`translate(${startX + index * gap} ${y + index * 2})`} opacity="0.82">
        <rect x="0" y="0" width="9" height="46" rx="4" fill="#111827" />
        <circle cx="4.5" cy="0" r="5.5" fill="#1f2937" />
      </g>
    ));
  }

  function clickFlag(clickTime: number, index: number) {
    const x = Math.min(1215, Math.max(65, (clickTime / scenario.length) * 1150 + 65));
    return (
      <g key={`${clickTime}-${index}`} transform={`translate(${x} 642)`} filter="url(#sceneShadow)">
        <path d="M0 0 V58" stroke="#991b1b" strokeWidth="5" strokeLinecap="round" />
        <path d="M4 2 C29 -10 49 11 76 -1 V34 C49 46 29 24 4 36 Z" fill="#dc2626" />
      </g>
    );
  }

  return (
    <svg viewBox="0 0 1280 720" role="img" aria-label={`${scenario.title} hazard perception practice scene`} className="absolute inset-0 h-full w-full bg-black">
      <defs>
        <linearGradient id="skyGradient" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={isNight ? "#101827" : "#9fb8cc"} />
          <stop offset="58%" stopColor={isNight ? "#293241" : "#d3dde5"} />
          <stop offset="100%" stopColor={isNight ? "#111827" : "#eef2f4"} />
        </linearGradient>
        <linearGradient id="roadGradient" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={isWet ? "#646b72" : "#565d64"} />
          <stop offset="64%" stopColor={isWet ? "#41484f" : "#33383e"} />
          <stop offset="100%" stopColor="#1f2328" />
        </linearGradient>
        <linearGradient id="glassGradient" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#dbeafe" />
          <stop offset="55%" stopColor="#7890a5" />
          <stop offset="100%" stopColor="#111827" />
        </linearGradient>
        <radialGradient id="headlightGlow">
          <stop offset="0%" stopColor="#fde68a" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#fde68a" stopOpacity="0" />
        </radialGradient>
        <filter id="sceneShadow" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="8" stdDeviation="7" floodColor="#000000" floodOpacity="0.38" />
        </filter>
        <filter id="sceneGrain">
          <feTurbulence type="fractalNoise" baseFrequency="0.88" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncA type="table" tableValues="0 0.12" />
          </feComponentTransfer>
        </filter>
        <filter id="softBlur">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
      </defs>

      <rect width="1280" height="720" fill="url(#skyGradient)" />
      <ellipse cx="560" cy="106" rx="168" ry="58" fill="rgba(255,255,255,0.58)" filter="url(#softBlur)" />
      <ellipse cx="755" cy="130" rx="230" ry="62" fill="rgba(255,255,255,0.45)" filter="url(#softBlur)" />
      <rect x="0" y="228" width="1280" height="220" fill={isRural ? "#4b6f36" : "#8a9299"} />
      <rect x="0" y="282" width="1280" height="168" fill={isRural ? "#567f3d" : "#a9afb4"} opacity="0.9" />

      {isMotorway ? (
        <>
          <rect x="60" y="170" width="150" height="78" rx="10" fill="#2f3f2d" opacity="0.75" />
          <rect x="225" y="150" width="120" height="98" rx="8" fill="#475b47" opacity="0.68" />
          <rect x="870" y="165" width="180" height="85" rx="9" fill="#4b5563" opacity="0.62" />
          <rect x="1045" y="142" width="95" height="112" rx="8" fill="#64748b" opacity="0.58" />
        </>
      ) : (
        <>
          <rect x="40" y="150" width="140" height="96" rx="10" fill={isRural ? "#2f5a2d" : "#d6d3c8"} opacity="0.78" />
          <rect x="190" y="125" width="118" height="125" rx="8" fill={isRural ? "#395f33" : "#a8b1b8"} opacity="0.74" />
          <rect x="930" y="132" width="132" height="118" rx="8" fill={isRural ? "#365f31" : "#c4b9a2"} opacity="0.72" />
          <rect x="1080" y="155" width="120" height="93" rx="8" fill={isRural ? "#48723b" : "#8795a1"} opacity="0.72" />
        </>
      )}
      {[70, 140, 246, 1010, 1115, 1205].map((x, index) => tree(x, 156 + (index % 2) * 16, 0.7 + (index % 3) * 0.1))}
      {[35, 100, 175, 250].map((x, index) => tree(x, 236 + index * 9, 0.98 + index * 0.12))}
      {[975, 1058, 1145, 1230].map((x, index) => tree(x, 226 + index * 8, 1 + index * 0.11))}
      {streetLight(550, 152, 0.55)}
      {streetLight(850, 172, 0.48)}

      <path d="M466 250 L814 250 L1210 720 L70 720 Z" fill="url(#roadGradient)" />
      <path d="M510 250 L530 250 L414 720 L298 720 Z" fill="#f8fafc" opacity="0.38" />
      <path d="M750 250 L770 250 L982 720 L866 720 Z" fill="#f8fafc" opacity="0.38" />
      <path d="M238 250 L458 250 L82 610 L0 610 L0 424 Z" fill="#b8bfc6" opacity="0.82" />
      <path d="M828 250 L1048 250 L1280 410 L1280 610 L1204 610 Z" fill="#b8bfc6" opacity="0.82" />
      {bollards(42, 330, 8, 34)}
      {bollards(1110, 338, 7, 25)}
      <path d={`M636 ${250 + roadPulse} L644 ${250 + roadPulse} L688 ${344 + roadPulse} L590 ${344 + roadPulse} Z`} fill="#facc15" opacity="0.82" />
      <path d={`M636 ${390 + roadPulse} L648 ${390 + roadPulse} L714 ${536 + roadPulse} L568 ${536 + roadPulse} Z`} fill="#facc15" opacity="0.82" />
      <path d={`M635 ${590 + roadPulse} L650 ${590 + roadPulse} L690 720 L596 720 Z`} fill="#facc15" opacity="0.82" />

      <path d="M0 600 C190 562 338 558 483 576 C567 586 676 588 776 578 C952 562 1100 568 1280 606 L1280 720 L0 720 Z" fill="#0b0f14" opacity="0.72" />
      <path d="M80 680 C280 632 1010 632 1200 680" fill="none" stroke="#111827" strokeWidth="18" opacity="0.65" />

      {scenario.scene === "school-run" ? (
        <>
          {car({ x: 176, y: 320, scale: 0.9, colour: "#64748b", facing: "side" })}
          {car({ x: 905, y: 402, scale: 1.16, colour: "#991b1b", facing: "away" })}
          {person(pedestrianX, 348, 0.78, "#1f2937")}
          <circle cx={motion(time, 6, 10, 392, 448)} cy={408} r="13" fill="#f8fafc" filter="url(#sceneShadow)" />
        </>
      ) : null}

      {scenario.scene === "parked-van" ? (
        <>
          {car({ x: 150, y: 300, scale: 1.5, colour: "#e5e7eb", facing: "side" })}
          {person(parkedPedestrianX, 358, 0.82, "#111827")}
          {car({ x: 840, y: 395, scale: 1.18, colour: "#1d4ed8", facing: "away" })}
        </>
      ) : null}

      {scenario.scene === "junction-cyclist" ? (
        <>
          <path d="M890 260 L1075 260 L1175 500 L970 520 Z" fill="#2f3740" opacity="0.82" />
          {car({ x: 534, y: 390, scale: 1.25, colour: "#e5e7eb", facing: "away" })}
          <g transform={`translate(${cyclistX} 418) scale(0.95)`} filter="url(#sceneShadow)">
            <circle cx="0" cy="60" r="21" fill="none" stroke="#111827" strokeWidth="7" />
            <circle cx="72" cy="60" r="21" fill="none" stroke="#111827" strokeWidth="7" />
            <path d="M0 60 L34 22 L72 60 M34 22 L50 60 M34 22 L18 60" fill="none" stroke="#111827" strokeWidth="7" strokeLinecap="round" />
            <circle cx="41" cy="-8" r="13" fill="#f3d2b8" />
            <path d="M38 7 L29 40 L58 40 Z" fill="#84cc16" />
          </g>
        </>
      ) : null}

      {scenario.scene === "motorway-merge" ? (
        <>
          <path d="M110 360 L385 425 L570 720 L430 720 L250 462 L70 405 Z" fill="#3f464f" opacity="0.9" />
          {car({ x: motorwayTruckX, y: 312, scale: 1.25, colour: "#f3f4f6", facing: "side", lights: true })}
          {car({ x: 820, y: 410, scale: 1.2, colour: "#1d4ed8", facing: "away" })}
        </>
      ) : null}

      {scenario.scene === "wet-roundabout" ? (
        <>
          <ellipse cx="640" cy="342" rx="190" ry="88" fill="#4b5563" stroke="#9ca3af" strokeWidth="18" opacity="0.95" />
          <ellipse cx="640" cy="342" rx="90" ry="40" fill="#456b38" />
          <rect x="0" y="0" width="1280" height="720" fill="rgba(255,255,255,0.08)" />
          <g opacity="0.45">
            {Array.from({ length: 24 }).map((_, index) => (
              <line key={index} x1={index * 62} y1="0" x2={index * 62 - 120} y2="720" stroke="#dbeafe" strokeWidth="3" />
            ))}
          </g>
          {car({ x: 610, y: leadCarY, scale: 0.92 + (leadCarY - 278) / 500, colour: "#b91c1c", facing: "away", lights: time > 9 })}
        </>
      ) : null}

      {scenario.scene === "rural-bend" ? (
        <>
          <path d="M820 250 C1030 305 1092 430 1020 720 L890 720 C935 510 882 382 710 300 Z" fill="#2f3a25" opacity="0.88" />
          <path d="M0 245 C170 260 265 272 380 315 L340 720 L0 720 Z" fill="#315f2f" />
          {car({ x: tractorX, y: 340, scale: 1.05, colour: "#3f7d20", facing: "side", lights: true })}
        </>
      ) : null}

      {scenario.scene === "bus-stop" ? (
        <>
          <rect x="118" y="265" width="180" height="52" fill="#e2e8f0" opacity="0.75" />
          <rect x="100" y="235" width="78" height="18" fill="#1f2937" />
          {car({ x: busX, y: 310, scale: 1.85, colour: "#eab308", facing: "side", lights: true })}
          {person(970, 348, 0.72, "#111827")}
          {car({ x: 720, y: 405, scale: 1.12, colour: "#374151", facing: "away" })}
        </>
      ) : null}

      {scenario.scene === "night-roadworks" ? (
        <>
          <rect x="0" y="0" width="1280" height="720" fill="rgba(0,0,0,0.42)" />
          <ellipse cx="530" cy="540" rx="340" ry="165" fill="url(#headlightGlow)" opacity="0.42" />
          {[392, 470, 548, 626, 704].map((x, index) => cone(x, 438 + index * 18, 0.88 + index * 0.07))}
          {car({ x: worksX, y: 342, scale: 1.06, colour: "#ea580c", facing: "side", lights: true })}
        </>
      ) : null}

      {scenario.scene === "zebra-crossing" ? (
        <>
          {[342, 370, 398, 426, 454].map((y, index) => (
            <path key={y} d={`M430 ${y} L850 ${y + index * 10} L895 ${y + 18 + index * 10} L398 ${y + 18} Z`} fill="#f8fafc" opacity="0.88" />
          ))}
          {person(crossingX, 330, 0.82, "#1f2937")}
          {car({ x: 544, y: 470, scale: 1.16, colour: "#1d4ed8", facing: "away" })}
        </>
      ) : null}

      {scenario.scene === "emergency-vehicle" ? (
        <>
          <g transform={`translate(185 288) scale(${emergencyScale})`} filter="url(#sceneShadow)">
            <rect x="0" y="0" width="210" height="88" rx="18" fill="#f8fafc" />
            <rect x="24" y="16" width="66" height="34" rx="6" fill="url(#glassGradient)" />
            <rect x="114" y="16" width="60" height="34" rx="6" fill="url(#glassGradient)" />
            <circle cx="46" cy="90" r="15" fill="#111827" />
            <circle cx="164" cy="90" r="15" fill="#111827" />
            <circle cx="89" cy="-3" r="12" fill="#2563eb" />
            <circle cx="124" cy="-3" r="12" fill="#60a5fa" />
          </g>
          <ellipse cx="315" cy="305" rx={80 * emergencyScale} ry={38 * emergencyScale} fill="#2563eb" opacity="0.15" />
          {car({ x: 720, y: 420, scale: 1.16, colour: "#e5e7eb", facing: "away" })}
        </>
      ) : null}

      <rect width="1280" height="720" filter="url(#sceneGrain)" opacity="0.45" />
      <rect x="0" y="0" width="1280" height="720" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="12" />
      <path d="M0 0 H1280 V720 H0 Z M92 54 H1188 C1238 54 1272 92 1272 142 V574 C1272 610 1248 626 1214 622 C1024 600 830 590 640 590 C450 590 256 600 66 622 C32 626 8 610 8 574 V142 C8 92 42 54 92 54 Z" fill="rgba(0,0,0,0.34)" fillRule="evenodd" />
      <rect x="548" y="58" width="184" height="48" rx="18" fill="rgba(17,24,39,0.78)" stroke="rgba(255,255,255,0.2)" strokeWidth="3" />
      <rect x="576" y="70" width="128" height="24" rx="9" fill="rgba(226,232,240,0.16)" />
      <path d="M0 610 C168 566 364 548 640 548 C916 548 1112 566 1280 610 V720 H0 Z" fill="rgba(10,14,18,0.92)" />
      <path d="M96 684 C292 620 988 620 1184 684" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="18" strokeLinecap="round" />
      <path d="M102 86 C228 130 352 130 484 98" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="5" strokeLinecap="round" opacity="0.45" />
      <path d="M858 98 C1004 126 1112 120 1218 78" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="5" strokeLinecap="round" opacity="0.42" />
      <rect x="0" y="0" width="1280" height="720" fill="rgba(0,0,0,0)" stroke="rgba(0,0,0,0.42)" strokeWidth="28" />
      <rect x="0" y="0" width="1280" height="610" fill="rgba(0,0,0,0.08)" />

      <g>
        <rect x="0" y="0" width="1280" height="54" fill="rgba(0,0,0,0.7)" />
        <text x="28" y="35" fontSize="20" fontWeight="900" fill="white" letterSpacing="2">{scenario.title.toUpperCase()}</text>
        <text x="1188" y="35" textAnchor="end" fontSize="20" fontWeight="900" fill="white">{formatClipTime(time)} / {formatClipTime(scenario.length)}</text>
      </g>

      <g>
        <rect x="0" y="610" width="1280" height="110" fill="#f8fafc" />
        <rect x="0" y="610" width="1280" height="1" fill="#d4d4d8" />
        {clicks.map((clickTime, index) => clickFlag(clickTime, index))}
        {showClickPulse ? (
          <g transform="translate(1030 635)">
            <rect x="0" y="0" width="180" height="38" rx="19" fill="#dc2626" />
            <text x="90" y="25" textAnchor="middle" fontSize="17" fontWeight="900" fill="white">CLICK REGISTERED</text>
          </g>
        ) : null}
      </g>

      {showAnswer ? (
        <g>
          <rect x="28" y="72" width="780" height="74" rx="14" fill="rgba(0,0,0,0.72)" />
          <text x="56" y="104" fontSize="22" fontWeight="900" fill="white">Developing hazard</text>
          <text x="56" y="132" fontSize="20" fontWeight="700" fill="#e5e7eb">{scenario.hazards.map((hazard) => hazard.label).join(" + ")}</text>
        </g>
      ) : null}

    </svg>
  );
}

function HazardPracticeScene({
  scenario,
  time,
  clicks,
  showAnswer,
  isWindowLive
}: {
  scenario: HazardScenario;
  time: number;
  clicks: number[];
  showAnswer: boolean;
  isWindowLive: boolean;
}) {
  const pedestrianX = motion(time, 7.5, 15, 0, 16);
  const cyclistX = motion(time, 7, 15, 78, 47);
  const motorwayX = motion(time, 8, 16, 18, 36);
  const leadCarY = motion(time, 7, 16, 18, 36);
  const ruralVehicleX = motion(time, 9, 17, 79, 51);
  const busX = motion(time, 7, 15, 8, 24);
  const worksX = motion(time, 9, 16, 66, 54);
  const crossingX = motion(time, 6, 13, 12, 45);
  const blueLightScale = motion(time, 8, 15, 0.6, 1.25);

  return (
    <>
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#7f96aa_0%,#d9e1e8_32%,#6b7280_33%,#30343a_100%)]" />
      <div className="absolute inset-x-0 top-[31%] h-[18%] bg-zinc-500/80" />
      <div className="absolute bottom-0 left-[35%] h-[70%] w-[30%] origin-bottom skew-x-[-7deg] bg-zinc-800" />
      <div className="absolute bottom-0 left-[49.5%] h-[70%] w-1 bg-[repeating-linear-gradient(180deg,#f8fafc_0,#f8fafc_24px,transparent_24px,transparent_58px)] opacity-80" />
      <div className="absolute bottom-0 left-0 right-0 h-[14%] bg-black/45 blur-sm" />
      <div className="absolute left-[4%] top-[12%] h-[15%] w-[22%] rounded bg-black/35 shadow-xl">
        <div className="mx-auto mt-2 h-[38%] w-[70%] rounded bg-zinc-900" />
        {scenario.scene === "emergency-vehicle" ? (
          <div className="mx-auto mt-2 flex h-4 w-16 items-center justify-center gap-1">
            <span className="h-3 w-3 animate-pulse rounded-full bg-blue-500" />
            <span className="h-3 w-3 animate-pulse rounded-full bg-blue-300" />
          </div>
        ) : null}
      </div>
      <div className="absolute right-[6%] top-[16%] h-[20%] w-[22%] rounded bg-white/15 shadow-xl" />

      {scenario.scene === "school-run" ? (
        <>
          <div className="absolute left-[8%] top-[19%] h-[22%] w-[28%] rounded-sm bg-zinc-700 shadow-2xl" />
          <div className="absolute left-[11%] top-[24%] h-[8%] w-[20%] rounded bg-sky-100/75" />
          <div className={vehicleClass("bg-red-700")} style={{ bottom: "18%", left: "68%", height: "10%", width: "17%" }} />
          <div className="absolute top-[42%] h-[13%] w-[3.4%] rounded-full bg-zinc-950 shadow-xl" style={{ left: `${36 + pedestrianX}%` }} />
          <div className="absolute top-[38%] h-[5.5%] w-[3%] rounded-full bg-zinc-100 shadow" style={{ left: `${36 + pedestrianX}%` }} />
          <div className="absolute left-[35%] top-[48%] h-4 w-4 rounded-full bg-white shadow" style={{ transform: `translateX(${motion(time, 6, 10, -80, 20)}px)` }} />
        </>
      ) : null}

      {scenario.scene === "parked-van" ? (
        <>
          <div className="absolute left-[8%] top-[18%] h-[27%] w-[32%] rounded bg-zinc-100 shadow-2xl">
            <div className="ml-5 mt-4 h-[28%] w-[46%] rounded bg-sky-100" />
            <div className="absolute bottom-[-10px] left-8 h-5 w-5 rounded-full bg-zinc-950" />
            <div className="absolute bottom-[-10px] right-8 h-5 w-5 rounded-full bg-zinc-950" />
          </div>
          <div className="absolute top-[43%] h-[12%] w-[4%] rounded-full bg-zinc-900 shadow-xl" style={{ left: `${34 + motion(time, 8, 14, 0, 14)}%` }} />
          <div className="absolute top-[39%] h-[6%] w-[3%] rounded-full bg-zinc-100" style={{ left: `${35 + motion(time, 8, 14, 0, 14)}%` }} />
        </>
      ) : null}

      {scenario.scene === "junction-cyclist" ? (
        <>
          <div className="absolute left-[64%] top-[25%] h-[26%] w-[5%] bg-white/70" />
          <div className={vehicleClass("bg-zinc-200")} style={{ bottom: "20%", left: "36%", height: "12%", width: "18%" }} />
          <div className="absolute top-[52%] h-5 w-5 rounded-full border-4 border-zinc-900" style={{ left: `${cyclistX}%` }} />
          <div className="absolute top-[52%] h-5 w-5 rounded-full border-4 border-zinc-900" style={{ left: `${cyclistX + 4}%` }} />
          <div className="absolute top-[46%] h-[9%] w-[3%] rounded bg-lime-400 shadow-xl" style={{ left: `${cyclistX + 2}%` }} />
        </>
      ) : null}

      {scenario.scene === "motorway-merge" ? (
        <>
          <div className="absolute bottom-0 left-[18%] h-[64%] w-[12%] skew-x-[12deg] bg-zinc-700" />
          <div className="absolute top-[36%] h-[15%] w-[28%] rounded bg-zinc-100 shadow-2xl" style={{ left: `${motorwayX}%` }}>
            <div className="ml-5 mt-3 h-7 w-16 rounded bg-sky-100" />
            <span className="absolute right-3 top-4 h-3 w-3 animate-pulse rounded-full bg-amber-400" />
          </div>
          <div className={vehicleClass("bg-blue-700")} style={{ bottom: "18%", left: "63%", height: "11%", width: "17%" }} />
        </>
      ) : null}

      {scenario.scene === "wet-roundabout" ? (
        <>
          <div className="absolute left-[35%] top-[30%] h-[24%] w-[30%] rounded-full border-[18px] border-zinc-600 bg-green-800/70" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_70%,transparent_0,transparent_45%,rgba(255,255,255,0.16)_46%,transparent_48%)]" />
          <div className={vehicleClass("bg-red-700")} style={{ top: `${leadCarY}%`, left: "48%", height: "10%", width: "16%" }}>
            <span className="absolute bottom-1 left-3 h-2 w-3 animate-pulse rounded bg-red-300" />
            <span className="absolute bottom-1 right-3 h-2 w-3 animate-pulse rounded bg-red-300" />
          </div>
          <div className="absolute inset-0 bg-[repeating-linear-gradient(120deg,rgba(255,255,255,0.18)_0,rgba(255,255,255,0.18)_2px,transparent_2px,transparent_12px)]" />
        </>
      ) : null}

      {scenario.scene === "rural-bend" ? (
        <>
          <div className="absolute inset-x-0 top-[26%] h-[18%] bg-green-900" />
          <div className="absolute left-[62%] top-[32%] h-[23%] w-[11%] rounded bg-green-700 shadow-2xl" style={{ transform: `translateX(${ruralVehicleX - 65}%)` }}>
            <div className="absolute bottom-[-7px] left-2 h-5 w-5 rounded-full bg-zinc-950" />
            <div className="absolute bottom-[-7px] right-2 h-5 w-5 rounded-full bg-zinc-950" />
          </div>
          <div className="absolute left-[12%] top-[20%] h-[36%] w-[18%] rounded-full bg-green-950" />
        </>
      ) : null}

      {scenario.scene === "bus-stop" ? (
        <>
          <div className="absolute left-[6%] top-[23%] h-[25%] w-[33%] rounded bg-yellow-500 shadow-2xl" style={{ transform: `translateX(${busX - 8}%)` }}>
            <div className="ml-4 mt-4 grid w-[65%] grid-cols-3 gap-2">
              <span className="h-7 rounded bg-sky-100" />
              <span className="h-7 rounded bg-sky-100" />
              <span className="h-7 rounded bg-sky-100" />
            </div>
            <span className="absolute right-4 top-4 h-3 w-3 animate-pulse rounded-full bg-amber-100" />
          </div>
          <div className="absolute right-[16%] top-[37%] h-[9%] w-[4%] rounded-full bg-zinc-800" />
        </>
      ) : null}

      {scenario.scene === "night-roadworks" ? (
        <>
          <div className="absolute inset-0 bg-black/45" />
          <div className="absolute left-[22%] top-[38%] flex gap-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <span key={index} className="h-9 w-5 bg-orange-500 [clip-path:polygon(50%_0,100%_100%,0_100%)]" />
            ))}
          </div>
          <div className="absolute top-[34%] h-[18%] w-[17%] rounded bg-orange-600 shadow-2xl" style={{ left: `${worksX}%` }}>
            <span className="absolute left-4 top-3 h-3 w-3 animate-pulse rounded-full bg-amber-200" />
            <span className="absolute right-4 top-3 h-3 w-3 animate-pulse rounded-full bg-amber-200" />
          </div>
        </>
      ) : null}

      {scenario.scene === "zebra-crossing" ? (
        <>
          <div className="absolute left-[34%] top-[43%] flex w-[35%] flex-col gap-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <span key={index} className="h-2 bg-white/90" />
            ))}
          </div>
          <div className="absolute top-[35%] h-[13%] w-[3.5%] rounded-full bg-zinc-900 shadow-xl" style={{ left: `${crossingX}%` }} />
          <div className="absolute top-[31%] h-[6%] w-[3%] rounded-full bg-zinc-100" style={{ left: `${crossingX}%` }} />
        </>
      ) : null}

      {scenario.scene === "emergency-vehicle" ? (
        <>
          <div className="absolute left-[9%] top-[18%] h-[18%] w-[24%] rounded bg-zinc-900/70 shadow-2xl" style={{ transform: `scale(${blueLightScale})` }}>
            <div className="mx-auto mt-4 flex w-20 justify-center gap-2">
              <span className="h-4 w-4 animate-pulse rounded-full bg-blue-500" />
              <span className="h-4 w-4 animate-pulse rounded-full bg-blue-300" />
            </div>
          </div>
          <div className={vehicleClass("bg-zinc-200")} style={{ bottom: "18%", left: "55%", height: "10%", width: "16%" }} />
        </>
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between bg-black/70 px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-white">
        <span>{scenario.title}</span>
        <span>{formatClipTime(time)} / {formatClipTime(scenario.length)}</span>
      </div>
      {clicks.map((clickTime, index) => (
        <span key={`${clickTime}-${index}`} className="absolute bottom-16 h-7 w-0.5 bg-brand" style={{ left: `${Math.min(96, Math.max(4, (clickTime / scenario.length) * 100))}%` }} />
      ))}
      {showAnswer ? (
        <div className="absolute left-4 top-14 max-w-[78%] rounded bg-black/75 px-4 py-3 text-sm font-black text-white shadow-xl">
          {scenario.hazards.map((hazard) => hazard.label).join(" + ")}
        </div>
      ) : null}
      {isWindowLive ? <span className="absolute right-4 top-14 rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-900">Developing hazard window</span> : null}
    </>
  );
}

export function LegacyHazardPractice({ active }: { active: boolean }) {
  const activeView = active ? "hazard" : "prepare";
  const [selectedScenarioId, setSelectedScenarioId] = useState(hazardScenarios[0].id);

  const [hazardClipTime, setHazardClipTime] = useState(0);

  const [hazardClipPlaying, setHazardClipPlaying] = useState(false);

  const [hazardClicks, setHazardClicks] = useState<number[]>([]);

  const [hazardAnswerVisible, setHazardAnswerVisible] = useState(false);

  const [hazardTestStarted, setHazardTestStarted] = useState(false);

  const [hazardTestFinished, setHazardTestFinished] = useState(false);

  const [hazardTestIndex, setHazardTestIndex] = useState(0);

  const [hazardTestClicksByClip, setHazardTestClicksByClip] = useState<Record<string, number[]>>({});

  useEffect(() => {
    if (activeView !== "hazard" || !hazardClipPlaying) return;
    const interval = window.setInterval(() => {
      const scenario = hazardScenarios.find((clip) => clip.id === selectedScenarioId) ?? hazardScenarios[0];
      setHazardClipTime((value) => Math.min(scenario.length, Number((value + 0.25).toFixed(2))));
    }, 250);
    return () => window.clearInterval(interval);
  }, [activeView, hazardClipPlaying, selectedScenarioId]);

  useEffect(() => {
    const scenario = hazardScenarios.find((clip) => clip.id === selectedScenarioId) ?? hazardScenarios[0];
    if (hazardClipTime < scenario.length) return;

    setHazardClipPlaying(false);

    if (!hazardTestStarted || hazardTestClicksByClip[scenario.id]) return;

    setHazardTestClicksByClip((current) => ({ ...current, [scenario.id]: hazardClicks }));

    if (hazardTestIndex >= hazardScenarios.length - 1) {
      setHazardTestStarted(false);
      setHazardTestFinished(true);
      setHazardAnswerVisible(true);
      return;
    }

    const nextIndex = hazardTestIndex + 1;
    const nextScenario = hazardScenarios[nextIndex];
    window.setTimeout(() => {
      setHazardTestIndex(nextIndex);
      setSelectedScenarioId(nextScenario.id);
      setHazardClipTime(0);
      setHazardClicks([]);
      setHazardAnswerVisible(false);
      setHazardClipPlaying(true);
    }, 900);
  }, [hazardClicks, hazardClipTime, hazardTestClicksByClip, hazardTestIndex, hazardTestStarted, selectedScenarioId]);

  const selectedScenario = useMemo(() => hazardScenarios.find((clip) => clip.id === selectedScenarioId) ?? hazardScenarios[0], [selectedScenarioId]);

  const hazardResult = useMemo(() => getHazardScores(selectedScenario, hazardClicks), [hazardClicks, selectedScenario]);

  const hazardProgress = Math.round((hazardClipTime / selectedScenario.length) * 100);

  const isHazardClipComplete = hazardClipTime >= selectedScenario.length;

  const isHazardWindowLive = selectedScenario.hazards.some((hazard) => hazardClipTime >= hazard.start && hazardClipTime <= hazard.end);

  const completedHazardClips = Object.keys(hazardTestClicksByClip).length;

  const hazardTestTotal = useMemo(
    () =>
      hazardScenarios.reduce((total, scenario) => {
        const clicks = scenario.id === selectedScenario.id && hazardTestStarted ? hazardClicks : hazardTestClicksByClip[scenario.id] ?? [];
        return total + getHazardScores(scenario, clicks).total;
      }, 0),
    [hazardClicks, hazardTestClicksByClip, hazardTestStarted, selectedScenario.id]
  );

  const hazardTestPassed = hazardTestTotal >= HAZARD_PASS_MARK;

  const weakAreaRecommendations = useMemo(() => {
    const scoredClips = Object.entries(hazardTestClicksByClip)
      .map(([scenarioId, clicks]) => {
        const scenario = hazardScenarios.find((clip) => clip.id === scenarioId);
        return scenario ? { scenario, clicks } : null;
      })
      .filter((clip): clip is { scenario: HazardScenario; clicks: number[] } => Boolean(clip));

    if (!hazardTestStarted && hazardClicks.length > 0 && !hazardTestClicksByClip[selectedScenario.id]) {
      scoredClips.push({ scenario: selectedScenario, clicks: hazardClicks });
    }

    return buildWeakAreaRecommendations(scoredClips);
  }, [hazardClicks, hazardTestClicksByClip, hazardTestStarted, selectedScenario]);

  function resetHazardClip() {
    if (hazardTestStarted) return;
    setHazardClipTime(0);
    setHazardClipPlaying(false);
    setHazardClicks([]);
    setHazardAnswerVisible(false);
  }

  function selectHazardScenario(scenarioId: string) {
    if (hazardTestStarted) return;
    setSelectedScenarioId(scenarioId);
    setHazardClipTime(0);
    setHazardClipPlaying(false);
    setHazardClicks([]);
    setHazardAnswerVisible(false);
  }

  function selectNextHazardScenario() {
    if (hazardTestStarted) return;
    const currentIndex = hazardScenarios.findIndex((scenario) => scenario.id === selectedScenarioId);
    const nextScenario = hazardScenarios[(currentIndex + 1) % hazardScenarios.length];
    selectHazardScenario(nextScenario.id);
  }

  function recordHazardClick() {
    if (hazardTestFinished && !hazardTestStarted) return;
    if (!hazardClipPlaying) {
      if (hazardClipTime === 0) setHazardClipPlaying(true);
      return;
    }
    setHazardClicks((current) => [...current, hazardClipTime]);
  }

  function startHazardFullTest() {
    const firstScenario = hazardScenarios[0];
    setHazardTestStarted(true);
    setHazardTestFinished(false);
    setHazardTestIndex(0);
    setHazardTestClicksByClip({});
    setSelectedScenarioId(firstScenario.id);
    setHazardClipTime(0);
    setHazardClicks([]);
    setHazardAnswerVisible(false);
    setHazardClipPlaying(true);
  }

  function resetHazardFullTest() {
    const firstScenario = hazardScenarios[0];
    setHazardTestStarted(false);
    setHazardTestFinished(false);
    setHazardTestIndex(0);
    setHazardTestClicksByClip({});
    setSelectedScenarioId(firstScenario.id);
    setHazardClipTime(0);
    setHazardClipPlaying(false);
    setHazardClicks([]);
    setHazardAnswerVisible(false);
  }

  function reviewHazardClip(scenarioId: string) {
    if (!hazardTestFinished) return;
    const scenario = hazardScenarios.find((clip) => clip.id === scenarioId) ?? hazardScenarios[0];
    setSelectedScenarioId(scenario.id);
    setHazardTestIndex(hazardScenarios.findIndex((clip) => clip.id === scenario.id));
    setHazardClipTime(scenario.length);
    setHazardClicks(hazardTestClicksByClip[scenario.id] ?? []);
    setHazardClipPlaying(false);
    setHazardAnswerVisible(true);
  }

  return active ? (
        <div className="mt-6 grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="rounded border border-zinc-200 bg-white p-4 shadow-sm xl:row-span-2">
            <div className="flex items-center gap-2 text-sm font-black uppercase text-brand">
              <TrafficCone size={17} /> Mock Test Mode
            </div>
            <div className="mt-4 rounded border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-sm font-black text-black">14 clips · 15 hazards · 75 marks</p>
              <p className="mt-2 text-xs font-bold leading-5 text-zinc-600">
                Mock Hazard Awareness Test built to the official-style structure: everyday UK road clips, one double-hazard clip, and timed 5-to-1 scoring.
              </p>
              <button
                type="button"
                onClick={startHazardFullTest}
                disabled={hazardTestStarted}
                className="lda-pill lda-pill-sm mt-4 w-full justify-center disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Play className="fill-white" size={16} /> Start mock test
              </button>
              {hazardTestStarted || hazardTestFinished ? (
                <button
                  type="button"
                  onClick={resetHazardFullTest}
                  className="mt-3 w-full rounded-full border border-zinc-300 px-4 py-2 text-sm font-black hover:ring-2 hover:ring-brand"
                >
                  Reset hazard test
                </button>
              ) : null}
            </div>
            <div className="mt-5 flex items-center gap-2 text-sm font-black uppercase text-brand">
              <MousePointerClick size={17} /> Practice Mode
            </div>
            <p className="mt-2 text-xs font-bold leading-5 text-zinc-600">
              Clip Bank lets learners practise one clip at a time, review the answer, then move to the next hazard.
            </p>
            <div className="mt-4 text-xs font-black uppercase tracking-[0.16em] text-zinc-500">Clip bank</div>
            <div className="mt-4 grid max-h-[620px] gap-2 overflow-auto pr-1">
              {hazardScenarios.map((scenario, index) => (
                <button
                  key={scenario.id}
                  type="button"
                  onClick={() => (hazardTestFinished ? reviewHazardClip(scenario.id) : selectHazardScenario(scenario.id))}
                  disabled={hazardTestStarted}
                  className={`rounded border p-3 text-left transition ${
                    selectedScenarioId === scenario.id ? "border-brand bg-red-50 text-black shadow-sm" : "border-zinc-200 bg-white text-zinc-700 hover:ring-2 hover:ring-brand"
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  <span className="text-xs font-black uppercase text-brand">Clip {index + 1}</span>
                  <span className="mt-1 block font-black">{scenario.title}</span>
                  <span className="mt-1 block text-xs font-bold text-zinc-500">{scenario.setting}</span>
                  {hazardTestClicksByClip[scenario.id] ? (
                    <span className="mt-2 block text-xs font-black text-zinc-700">
                      {getHazardScores(scenario, hazardTestClicksByClip[scenario.id]).total}/{scenario.hazards.length * 5}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
            <div className="mt-5 rounded border border-zinc-200 bg-zinc-50 p-4">
              <div className="flex items-center gap-2 text-sm font-black uppercase text-brand">
                <Flag size={16} /> Weak Area Mode
              </div>
              <p className="mt-2 text-xs font-bold leading-5 text-zinc-600">
                After practice or a mock test, LDA recommends the hazard types the learner missed most often.
              </p>
              <div className="mt-3 grid gap-2">
                {weakAreaRecommendations.length ? (
                  weakAreaRecommendations.map((recommendation) => (
                    <button
                      key={`${recommendation.category}-${recommendation.scenario.id}`}
                      type="button"
                      onClick={() => selectHazardScenario(recommendation.scenario.id)}
                      disabled={hazardTestStarted}
                      className="rounded border border-zinc-200 bg-white p-3 text-left text-xs font-bold leading-5 text-zinc-700 hover:ring-2 hover:ring-brand disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span className="block font-black text-black">{recommendation.category}</span>
                      <span className="mt-1 block">{recommendation.scenario.title} · {recommendation.score}/{recommendation.max}</span>
                    </button>
                  ))
                ) : (
                  <p className="rounded border border-zinc-200 bg-white p-3 text-xs font-bold leading-5 text-zinc-600">
                    Complete a Practice Mode clip or Mock Hazard Awareness Test to unlock weak-area recommendations.
                  </p>
                )}
              </div>
            </div>
          </aside>

          <article className="overflow-hidden rounded border border-zinc-200 bg-white shadow-sm">
            <button
              type="button"
              onClick={recordHazardClick}
              className="group relative block aspect-video w-full overflow-hidden bg-zinc-950 text-left focus:outline-none focus:ring-4 focus:ring-red-200"
              aria-label="Hazard perception practice clip. Click when you see a developing hazard."
            >
              <RealisticHazardPracticeScene
                scenario={selectedScenario}
                time={hazardClipTime}
                clicks={hazardClicks}
                showAnswer={hazardAnswerVisible && !hazardTestStarted}
                isWindowLive={isHazardWindowLive}
              />
              {!hazardClipPlaying && hazardClipTime === 0 ? (
                <div className="absolute inset-0 grid place-items-center bg-black/30">
                  <span className="flex items-center gap-3 rounded-full bg-white px-6 py-4 text-base font-black text-black shadow-xl">
                    <Play className="fill-black" size={20} /> Start practice clip
                  </span>
                </div>
              ) : null}
              {hazardTestStarted && isHazardClipComplete ? (
                <div className="absolute inset-0 grid place-items-center bg-black/45">
                  <span className="rounded-full bg-white px-6 py-4 text-base font-black text-black shadow-xl">
                    Loading next clip...
                  </span>
                </div>
              ) : null}
              {!hazardTestStarted && isHazardClipComplete ? (
                <div className="absolute inset-x-4 bottom-4 rounded bg-black/75 px-4 py-3 text-sm font-black text-white shadow-xl">
                  Clip complete. Review your score, show the answer, or move to the next clip.
                </div>
              ) : null}
            </button>
            <div className="border-t border-zinc-200 bg-zinc-50 p-4">
              <div className="h-3 overflow-hidden rounded-full bg-zinc-200">
                <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${hazardProgress}%` }} />
              </div>
              {hazardTestStarted ? (
                <div className="mt-4 rounded border border-zinc-200 bg-white p-4 text-sm font-black text-zinc-700">
                  Clip {hazardTestIndex + 1} of {hazardScenarios.length}. Click the video when a road situation becomes a developing hazard. Answers are locked until the full test ends.
                </div>
              ) : (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button type="button" onClick={() => setHazardClipPlaying(true)} disabled={isHazardClipComplete || hazardTestFinished} className="lda-pill lda-pill-sm disabled:cursor-not-allowed disabled:opacity-50">
                    {hazardClipTime === 0 ? "Play clip" : "Resume clip"}
                  </button>
                  <button type="button" onClick={resetHazardClip} disabled={hazardTestFinished} className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-black hover:ring-2 hover:ring-brand disabled:cursor-not-allowed disabled:opacity-50"><RotateCcw className="mr-2 inline" size={16} /> Restart</button>
                  {isHazardClipComplete ? (
                    <>
                      <button type="button" onClick={() => setHazardAnswerVisible(true)} className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-black hover:ring-2 hover:ring-brand">Show answer</button>
                      <button type="button" onClick={selectNextHazardScenario} disabled={hazardTestFinished} className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-black hover:ring-2 hover:ring-brand disabled:cursor-not-allowed disabled:opacity-50">
                        Next clip <ArrowRight className="ml-1 inline" size={16} />
                      </button>
                    </>
                  ) : null}
                </div>
              )}
            </div>
          </article>

          <aside className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
            <TrafficCone className="text-brand" />
            <h2 className="mt-4 text-2xl font-black">Hazard awareness training</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-zinc-600">
              Work through Practice Mode, Mock Test Mode, or Weak Area Mode. Watch each first-person road scene like dashcam footage and click when an everyday situation becomes a developing hazard.
            </p>
            <div className="mt-5 rounded border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">
                {hazardTestFinished ? "Final score" : hazardTestStarted ? "Test progress" : "Clip score"}
              </p>
              <p className="mt-2 text-4xl font-black">
                {hazardTestFinished ? `${hazardTestTotal}/${HAZARD_TOTAL_MARKS}` : hazardTestStarted ? `${completedHazardClips}/${hazardScenarios.length}` : `${hazardResult.total}/${hazardResult.max}`}
              </p>
              <p className="mt-2 text-sm font-semibold leading-6 text-zinc-600">
                {hazardTestFinished
                  ? hazardTestPassed
                    ? `Practice pass. GOV.UK lists the car hazard-perception pass mark as ${HAZARD_PASS_MARK}/${HAZARD_TOTAL_MARKS}.`
                    : `Keep practising. GOV.UK lists the car hazard-perception pass mark as ${HAZARD_PASS_MARK}/${HAZARD_TOTAL_MARKS}.`
                  : hazardResult.disqualified
                    ? "Clicking continuously or in a pattern has voided this practice clip."
                    : hazardClicks.length
                      ? "Your first valid click in each scoring window is used. Wrong clicks do not reduce the score unless the pattern is abusive."
                      : "Start the clip, scan the whole road, and click when the hazard develops."}
              </p>
            </div>
            <div className="mt-4 rounded border border-zinc-200 bg-white p-4">
              <p className="text-sm font-black">{selectedScenario.title}</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-zinc-600">{selectedScenario.briefing}</p>
              <div className="mt-3 grid gap-2">
                {hazardResult.matched.map(({ hazard, clickTime, score }) => (
                  <div key={hazard.label} className="rounded border border-zinc-200 bg-zinc-50 p-3 text-sm font-bold leading-6 text-zinc-700">
                    <span className="block text-black">{hazard.label}</span>
                    <span className="block text-xs uppercase text-zinc-500">
                      {clickTime === undefined ? "No scoring click" : `Clicked ${clickTime.toFixed(1)}s`} - {score}/5
                    </span>
                    {hazardAnswerVisible ? <span className="mt-1 block text-xs text-zinc-500">{hazard.clue}</span> : null}
                  </div>
                ))}
              </div>
            </div>
            {hazardTestFinished ? (
              <div className="mt-4 rounded border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-sm font-black">Review your clips</p>
                <div className="mt-3 grid max-h-64 gap-2 overflow-auto pr-1">
                  {hazardScenarios.map((scenario, index) => {
                    const result = getHazardScores(scenario, hazardTestClicksByClip[scenario.id] ?? []);
                    return (
                      <button
                        key={scenario.id}
                        type="button"
                        onClick={() => reviewHazardClip(scenario.id)}
                        className="rounded border border-zinc-200 bg-white p-3 text-left text-sm font-bold hover:ring-2 hover:ring-brand"
                      >
                        <span className="block text-xs font-black uppercase text-brand">Clip {index + 1}</span>
                        <span className="block text-black">{scenario.title}</span>
                        <span className="block text-xs text-zinc-500">{result.total}/{scenario.hazards.length * 5}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <div className="mt-5 grid gap-2">
              {hazardCoachingPoints.map((point) => (
                <div key={point} className="flex items-start gap-2 text-sm font-bold leading-6 text-zinc-700">
                  <CheckCircle2 className="mt-0.5 shrink-0 text-brand" size={17} />
                  {point}
                </div>
              ))}
            </div>
          </aside>
        </div>
      ) : null;
}
