"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowLeft, ArrowRight, BookOpenCheck, CheckCircle2, Clock3, ExternalLink, Flag, MousePointerClick, RotateCcw, type LucideIcon } from "lucide-react";
import type { LearnerPackageId } from "@/lib/learner-packages";
import { consumePracticeAllowance, getPracticeAllowanceSnapshot } from "@/lib/client-practice-allowances";
import { learnerPackageEntitlements, type LearnerAllowanceKey } from "@/lib/subscription-tier-entitlements";

type ViewKey = "prepare" | "topic-quiz" | "mock" | "hazard" | "book";
const LdaHazardVideoTest = dynamic(() => import("@/components/lda-hazard-video-test").then(module => module.LdaHazardVideoTest));
const LegacyHazardPractice = dynamic(() => import("@/components/legacy-hazard-practice").then(module => module.LegacyHazardPractice), { ssr: false });
type MockQuestionVisual =
  | "priority-crossroads"
  | "roundabout-priority"
  | "no-entry-sign"
  | "dual-carriageway-gap"
  | "motorway-red-x"
  | "amber-roadworks"
  | "box-junction"
  | "zebra-crossing"
  | "school-patrol"
  | "keep-left-sign"
  | "speed-limit-sign"
  | "no-overtaking-sign"
  | "give-way-sign"
  | "stop-sign"
  | "toucan-crossing"
  | "level-crossing-barrier"
  | "no-motor-vehicles"
  | "slippery-road-sign"
  | "height-restriction"
  | "bus-lane-times"
  | "priority-narrow-road"
  | "cycle-route-sign"
  | "cattle-warning"
  | "traffic-light-amber"
  | "mini-roundabout-sign";
type MockQuestion = { topic: string; question: string; answers: string[]; correctIndex: number; explanation: string; visual?: MockQuestionVisual; sourceKey?: string };
type OfficialReadingSource = {
  label: string;
  url: string;
};
type KnowledgeSection = {
  title: string;
  points: string[];
  officialLabel: string;
  officialSources: OfficialReadingSource[];
  quizTopics: string[];
};

type PracticeAllowanceSnapshot = ReturnType<typeof getPracticeAllowanceSnapshot>;
type PracticeAllowanceSnapshots = Record<LearnerAllowanceKey, PracticeAllowanceSnapshot>;

const MOCK_TEST_SECONDS = 57 * 60;
const MOCK_PASS_MARK = 43;
const MOCK_TEST_SIZE = 50;
const MOCK_TEST_DIAGRAM_COUNT = 12;
const TOPIC_PRACTICE_SIZE = 10;
const TOPIC_PRACTICE_MIN_SIZE = 5;
const TOPIC_PRACTICE_SECONDS = 5 * 60;
const MOCK_HISTORY_KEY = "lda-theory-mock-recent-question-bank";
const TOPIC_HISTORY_KEY_PREFIX = "lda-theory-topic-quiz-history";
const allowanceKeys: LearnerAllowanceKey[] = [
  "topicQuizzesPerDay",
  "fullTheoryMocksPerDay",
  "individualHazardClipsPerDay",
  "fullHazardMocksPerWeek",
];

function getAllowanceSnapshots(packageId: LearnerPackageId): PracticeAllowanceSnapshots {
  return allowanceKeys.reduce((snapshots, allowanceKey) => {
    snapshots[allowanceKey] = getPracticeAllowanceSnapshot(packageId, allowanceKey);
    return snapshots;
  }, {} as PracticeAllowanceSnapshots);
}

const visualMockQuestions: MockQuestion[] = [
  {
    topic: "Priority",
    question: "Look at the diagram. Which vehicle has priority?",
    answers: ["Vehicle A", "Vehicle B", "Both vehicles at the same time", "Whichever vehicle is travelling faster"],
    correctIndex: 1,
    explanation: "Vehicle A is turning right across the path of oncoming traffic. Vehicle B has priority if it is safe to proceed.",
    visual: "priority-crossroads"
  },
  {
    topic: "Roundabouts",
    question: "Look at the diagram. Which vehicle has priority at this mini-roundabout?",
    answers: ["Vehicle A entering from the left", "Vehicle B approaching from the right", "The larger vehicle", "The vehicle nearest the kerb"],
    correctIndex: 1,
    explanation: "At roundabouts, give way to traffic approaching from your right unless signs, signals, or road markings show otherwise.",
    visual: "roundabout-priority"
  },
  {
    topic: "Road signs",
    question: "What does the sign shown in the diagram mean?",
    answers: ["No entry for vehicles", "No waiting", "No overtaking", "National speed limit applies"],
    correctIndex: 0,
    explanation: "A red circular sign with a horizontal white bar means no entry for vehicular traffic.",
    visual: "no-entry-sign"
  },
  {
    topic: "Dual carriageways",
    question: "You are turning right across this dual carriageway. What should you do if the central reservation is large enough?",
    answers: ["Wait in the central gap and complete the turn when the second carriageway is clear", "Stop across both carriageways", "Turn without stopping", "Use hazard lights to claim priority"],
    correctIndex: 0,
    explanation: "If the central reservation can safely hold your vehicle, treat each carriageway as a separate crossing and wait in the centre until the far side is clear.",
    visual: "dual-carriageway-gap"
  },
  {
    topic: "Motorways",
    question: "What must you do when a red X is shown over a motorway lane?",
    answers: ["Leave that lane as soon as it is safe", "Use the lane if traffic is light", "Only avoid the lane at night", "Stop immediately under the signal"],
    correctIndex: 0,
    explanation: "A red X means the lane is closed. Move out of the lane safely and do not use it.",
    visual: "motorway-red-x"
  },
  {
    topic: "Roadworks",
    question: "You see amber flashing roadwork beacons ahead. What should you do?",
    answers: ["Slow down and be ready for workers, cones, or a change in lane layout", "Speed up before the road narrows", "Ignore them if the road is dry", "Use main beam headlights"],
    correctIndex: 0,
    explanation: "Amber beacons warn of danger or obstruction. Slow down, scan ahead, and follow any temporary signs or signals.",
    visual: "amber-roadworks"
  },
  {
    topic: "Box junctions",
    question: "When may you enter the yellow box junction shown?",
    answers: ["Only when your exit road is clear, except when waiting to turn right", "Whenever the traffic light is green", "To stop vehicles entering from the side road", "If you are following a bus"],
    correctIndex: 0,
    explanation: "Do not enter a box junction unless your exit is clear, except when waiting to turn right and blocked only by oncoming traffic or other right-turning vehicles.",
    visual: "box-junction"
  },
  {
    topic: "Crossings",
    question: "You are approaching the crossing shown and someone is waiting. What should you do?",
    answers: ["Prepare to slow down and stop", "Sound the horn so they stay back", "Flash headlights to make them cross", "Drive on if you are in a hurry"],
    correctIndex: 0,
    explanation: "Approach zebra crossings ready to stop. Never wave people across or pressure them.",
    visual: "zebra-crossing"
  },
  {
    topic: "School crossings",
    question: "A school crossing patrol is displaying the sign shown. What must you do?",
    answers: ["Stop", "Continue if no children are visible", "Drive around the patrol", "Sound the horn and keep moving"],
    correctIndex: 0,
    explanation: "You must stop when a school crossing patrol shows the stop sign.",
    visual: "school-patrol"
  },
  {
    topic: "Road signs",
    question: "What does this blue circular sign tell you to do?",
    answers: ["Keep left of the obstruction", "Turn left at the next road", "Left lane closed ahead", "No left turn"],
    correctIndex: 0,
    explanation: "Blue circular signs usually give positive instructions. This sign tells traffic to keep left.",
    visual: "keep-left-sign"
  },
  {
    topic: "Speed limits",
    question: "What does the sign shown in the diagram mean?",
    answers: ["Maximum speed 30 mph", "Minimum speed 30 mph", "No vehicles over 30 tonnes", "Advisory speed only"],
    correctIndex: 0,
    explanation: "A red-ringed circular sign with a number shows the maximum speed limit in miles per hour.",
    visual: "speed-limit-sign"
  },
  {
    topic: "Road signs",
    question: "What does the sign shown in the diagram mean?",
    answers: ["No overtaking", "No motor vehicles", "Two-way traffic", "Priority over oncoming traffic"],
    correctIndex: 0,
    explanation: "The red-ringed sign showing two cars side by side means no overtaking.",
    visual: "no-overtaking-sign"
  },
  {
    topic: "Priority",
    question: "You are approaching the sign shown. What must you be prepared to do?",
    answers: ["Give way to traffic on the major road", "Stop only if pedestrians are waiting", "Accelerate before the junction", "Ignore it if the road is quiet"],
    correctIndex: 0,
    explanation: "The give way sign warns you to slow down and give priority where required.",
    visual: "give-way-sign"
  },
  {
    topic: "Priority",
    question: "What must you do at the sign shown?",
    answers: ["Stop at the line and give way before proceeding", "Slow down only if traffic is visible", "Keep moving if you are turning left", "Stop only at night"],
    correctIndex: 0,
    explanation: "A stop sign means you must stop at the stop line, check carefully, and only proceed when safe.",
    visual: "stop-sign"
  },
  {
    topic: "Crossings",
    question: "The diagram shows a toucan crossing. Who may use this crossing?",
    answers: ["Pedestrians and cyclists", "Only pedestrians", "Only horse riders", "Only buses and taxis"],
    correctIndex: 0,
    explanation: "Toucan crossings are shared by pedestrians and cyclists, so approach ready for both.",
    visual: "toucan-crossing"
  },
  {
    topic: "Level crossings",
    question: "The barrier and lights in the diagram are active. What should you do?",
    answers: ["Stop before the barrier or stop line", "Drive around the barrier if the train is not visible", "Sound your horn and continue", "Follow the vehicle in front closely"],
    correctIndex: 0,
    explanation: "At a level crossing, stop when the warning lights or barriers are operating and wait until it is safe and permitted to cross.",
    visual: "level-crossing-barrier"
  },
  {
    topic: "Road signs",
    question: "What does this red-ringed sign mean?",
    answers: ["No motor vehicles", "Cars only", "Motorway begins", "Vehicles must use both lanes"],
    correctIndex: 0,
    explanation: "A red-ringed sign showing a motorcycle above a car means no motor vehicles.",
    visual: "no-motor-vehicles"
  },
  {
    topic: "Weather",
    question: "What hazard does the warning sign shown describe?",
    answers: ["Slippery road", "Uneven road", "Loose chippings", "Hump bridge"],
    correctIndex: 0,
    explanation: "The skidding-car warning sign tells you the road may be slippery, often because of water, ice, mud, or leaves.",
    visual: "slippery-road-sign"
  },
  {
    topic: "Road signs",
    question: "What should you check before passing under the bridge shown?",
    answers: ["Your vehicle height and any load height", "Your fuel level only", "Whether the horn works", "The nearest car park"],
    correctIndex: 0,
    explanation: "Height restriction signs protect bridges and vehicles. Know the height of your vehicle, trailer, or roof load.",
    visual: "height-restriction"
  },
  {
    topic: "Bus lanes",
    question: "The bus lane sign shows restricted times. What should you do before using the lane?",
    answers: ["Check the times and permitted vehicles on the sign", "Use it whenever there is traffic", "Use it only if no bus is visible", "Use it to overtake on the left"],
    correctIndex: 0,
    explanation: "Bus lane signs tell you when restrictions apply and which vehicles are allowed.",
    visual: "bus-lane-times"
  },
  {
    topic: "Priority",
    question: "At the narrow section shown, which traffic normally has priority?",
    answers: ["Traffic facing the larger white arrow", "Traffic facing the smaller red arrow", "The fastest vehicle", "The vehicle that flashes headlights first"],
    correctIndex: 0,
    explanation: "Priority signs at narrow sections show which direction has priority. Never force through if it is not safe.",
    visual: "priority-narrow-road"
  },
  {
    topic: "Cyclists",
    question: "What does the blue circular sign shown mean?",
    answers: ["Route for pedal cycles only", "No cycling", "Cyclists must dismount", "Cycle parking ahead"],
    correctIndex: 0,
    explanation: "A blue circular sign with a cycle symbol gives a positive instruction for cyclists to use that route.",
    visual: "cycle-route-sign"
  },
  {
    topic: "Animals",
    question: "You see this warning sign on a rural road. What should you expect?",
    answers: ["Farm animals may be in or near the road", "A zoo entrance only", "No livestock nearby", "A mandatory cattle crossing speed"],
    correctIndex: 0,
    explanation: "Animal warning signs mean you should reduce speed and be ready to stop if animals or a handler are ahead.",
    visual: "cattle-warning"
  },
  {
    topic: "Traffic lights",
    question: "The amber light is showing after green. What should you do?",
    answers: ["Stop at the stop line unless you are too close to stop safely", "Speed up to clear the junction", "Stop only if pedestrians are crossing", "Treat it as a green light"],
    correctIndex: 0,
    explanation: "Amber after green means stop at the stop line unless stopping would be unsafe.",
    visual: "traffic-light-amber"
  },
  {
    topic: "Roundabouts",
    question: "What does the mini-roundabout sign tell you to do?",
    answers: ["Give way to traffic from the right and travel around the centre marking", "Drive straight over the centre at speed", "Treat it as a one-way street only", "Always stop before entering"],
    correctIndex: 0,
    explanation: "At a mini-roundabout, give way to the right unless signs or markings say otherwise and avoid driving over the centre marking where possible.",
    visual: "mini-roundabout-sign"
  }
];

const baseMockQuestionBank: MockQuestion[] = [
  ...visualMockQuestions,
  { topic: "Weather", question: "You are driving in heavy rain. What should you do with your following distance?", answers: ["Keep the same gap", "Double it", "At least double it", "Only increase it on motorways"], correctIndex: 2, explanation: "Wet roads increase stopping distance, so leave at least double the normal gap." },
  { topic: "Crossings", question: "A pedestrian is waiting at a zebra crossing. What should you do?", answers: ["Sound your horn", "Prepare to stop", "Flash your headlights", "Wave them across"], correctIndex: 1, explanation: "Approach crossings at a speed that lets you stop safely." },
  { topic: "Traffic lights", question: "What does a red traffic light mean?", answers: ["Stop before the stop line", "Stop only if traffic is crossing", "Continue if clear", "Prepare to go"], correctIndex: 0, explanation: "Red means stop and wait behind the stop line." },
  { topic: "Visibility", question: "When should you use dipped headlights in daytime?", answers: ["Only in built-up areas", "When visibility is seriously reduced", "Only in fog", "Never in daylight"], correctIndex: 1, explanation: "Dipped headlights help others see you when visibility is poor." },
  { topic: "Observation", question: "What is the main reason for checking mirrors before changing speed?", answers: ["To see what is behind and around you", "To check your hair", "To avoid signalling", "To look at passengers"], correctIndex: 0, explanation: "Mirror checks help you understand how your actions affect surrounding road users." },
  { topic: "Road signs", question: "You see a triangular warning sign. What does the shape usually tell you?", answers: ["An order", "A warning", "A parking restriction", "A motorway direction"], correctIndex: 1, explanation: "Triangular signs warn you about hazards ahead." },
  { topic: "Vehicle control", question: "Why should you avoid coasting downhill in neutral?", answers: ["It saves too much fuel", "It reduces vehicle control", "It makes the horn louder", "It improves braking distance"], correctIndex: 1, explanation: "Keeping the vehicle in gear helps maintain control, especially downhill." },
  { topic: "Emergency vehicles", question: "What should you do when emergency vehicles approach with blue lights?", answers: ["Brake sharply immediately", "Find a safe place to let them pass", "Stop on a bend", "Mount the pavement"], correctIndex: 1, explanation: "Stay calm, check around you, and let emergency vehicles pass safely." },
  { topic: "Vulnerable users", question: "What should you do before opening a car door on the road side?", answers: ["Open it quickly", "Check mirrors and blind spots", "Only check the front", "Signal with your horn"], correctIndex: 1, explanation: "Check for cyclists, motorcyclists, and other traffic before opening a door." },
  { topic: "Fitness to drive", question: "What is the safest response if you feel tired while driving?", answers: ["Open a window and continue", "Stop in a safe place and rest", "Drive faster to arrive sooner", "Turn music up"], correctIndex: 1, explanation: "Tiredness seriously affects reaction time. Stop safely and rest." },
  { topic: "Speed limits", question: "What should you do if street lights are present but no speed limit signs are shown?", answers: ["Assume it is always 40 mph", "Treat it as a 30 mph area unless signs show otherwise", "Drive at the national speed limit", "Match the speed of traffic"], correctIndex: 1, explanation: "Street lights usually indicate a 30 mph limit unless signs show a different limit." },
  { topic: "Motorways", question: "What is the hard shoulder normally used for?", answers: ["Overtaking slow traffic", "Stopping in an emergency", "Parking to make calls", "Joining faster traffic"], correctIndex: 1, explanation: "The hard shoulder is for emergencies, breakdowns, and instructions from police or traffic officers." },
  { topic: "Motorways", question: "When joining a motorway from a slip road, what should you do?", answers: ["Force traffic to slow down", "Match a safe gap and join without causing others to alter speed", "Stop at the end of the slip road", "Use the hard shoulder to build speed"], correctIndex: 1, explanation: "Use the slip road to build a suitable speed and join only when there is a safe gap." },
  { topic: "Signs", question: "What does a circular sign with a red border usually mean?", answers: ["A warning", "An order or restriction", "A tourist route", "A parking bay"], correctIndex: 1, explanation: "Circular signs give orders. Red borders usually show restrictions." },
  { topic: "Road markings", question: "What does a double white line with the line nearest you solid usually mean?", answers: ["You may cross to overtake any vehicle", "You must not cross or straddle it unless an exception applies", "It marks a bus lane", "It only applies at night"], correctIndex: 1, explanation: "A solid white line nearest you means you must not cross or straddle it except in limited situations." },
  { topic: "Roundabouts", question: "Which signal should you normally give when leaving a roundabout?", answers: ["Left signal", "Right signal", "Hazard lights", "No signal is ever needed"], correctIndex: 0, explanation: "Signal left after passing the exit before the one you want, unless road layout makes it unsafe or confusing." },
  { topic: "Box junctions", question: "When may you enter a yellow box junction?", answers: ["Whenever the lights are green", "Only if your exit is clear, except when waiting to turn right", "To block side roads", "If you are following a bus"], correctIndex: 1, explanation: "Do not enter unless your exit road is clear, except when waiting to turn right and blocked only by oncoming traffic." },
  { topic: "Stopping distance", question: "What happens to thinking distance as your speed increases?", answers: ["It stays the same", "It increases", "It decreases", "It only changes in rain"], correctIndex: 1, explanation: "The faster you travel, the further you move before reacting." },
  { topic: "Vehicle checks", question: "Why should tyre tread depth be checked regularly?", answers: ["To improve radio reception", "To keep grip and water clearance", "To reduce seatbelt wear", "To make steering heavier"], correctIndex: 1, explanation: "Good tread helps tyres grip the road and clear water, especially in wet conditions." },
  { topic: "Vehicle checks", question: "What should you do if a warning light stays on after starting the engine?", answers: ["Ignore it until the next service", "Check the handbook and get help if needed", "Drive faster to charge the battery", "Cover it so it is not distracting"], correctIndex: 1, explanation: "Persistent warning lights can indicate a fault. Check the handbook and seek advice." },
  { topic: "Eco driving", question: "Which action can reduce fuel use and emissions?", answers: ["Harsh acceleration", "Planning ahead and avoiding unnecessary braking", "Keeping the engine revving while stopped", "Carrying unnecessary weight"], correctIndex: 1, explanation: "Smooth, planned driving reduces fuel use and wear." },
  { topic: "Cyclists", question: "When overtaking a cyclist, what should you leave?", answers: ["As little gap as possible", "A safe gap and enough room for wobble or obstacles", "Only half a lane", "No gap if traffic is waiting"], correctIndex: 1, explanation: "Cyclists need space, especially near drains, potholes, wind, and parked vehicles." },
  { topic: "Pedestrians", question: "Who should you be especially aware of near parked cars?", answers: ["Only bus drivers", "Children who may step out without seeing you", "Only motorcyclists", "Only pedestrians facing traffic"], correctIndex: 1, explanation: "Children can be hidden by parked vehicles and may not judge speed well." },
  { topic: "Bus lanes", question: "When may you use a bus lane?", answers: ["Whenever traffic is heavy", "Only during the times shown, or when signs permit", "Only if turning right", "Whenever no bus is visible"], correctIndex: 1, explanation: "Bus lane signs show when restrictions apply and which vehicles may use the lane." },
  { topic: "Mobile phones", question: "What should you do if you need to use a hand-held phone while driving?", answers: ["Use it briefly at traffic lights", "Stop safely and legally first", "Hold it below the steering wheel", "Use it only on quiet roads"], correctIndex: 1, explanation: "Do not use a hand-held phone while driving. Stop safely and legally before using it." },
  { topic: "Alcohol and drugs", question: "What is the safest rule about alcohol before driving?", answers: ["Only drive if you feel alert", "Do not drink alcohol if you are going to drive", "Coffee cancels its effect", "Drive slowly if you have had one drink"], correctIndex: 1, explanation: "Alcohol affects judgement and reaction time. The safest option is not to drink before driving." },
  { topic: "Towing", question: "What should you check before towing a trailer?", answers: ["That the trailer is secure and within legal limits", "Only that it looks tidy", "That it is heavier than the car", "That hazard lights stay on"], correctIndex: 0, explanation: "The load, coupling, lights, tyres, and legal weight limits must be safe before towing." },
  { topic: "Level crossings", question: "What should you do if warning lights flash at a level crossing?", answers: ["Drive through quickly", "Stop before the barrier or stop line", "Sound your horn and continue", "Follow the vehicle in front"], correctIndex: 1, explanation: "Flashing red lights mean stop and wait until it is safe and permitted to cross." },
  { topic: "Parking", question: "Where should you avoid parking?", answers: ["Where it blocks visibility at a junction", "In a marked bay", "On a private driveway with permission", "In a legal car park"], correctIndex: 0, explanation: "Parking near junctions can block visibility and create danger." },
  { topic: "Night driving", question: "What should you do if dazzled by oncoming headlights?", answers: ["Look towards the left edge of your lane and slow if needed", "Look directly at the lights", "Flash main beam repeatedly", "Close one eye and accelerate"], correctIndex: 0, explanation: "Avoid staring at the headlights, use the road edge as a guide, and slow if visibility is reduced." },
  { topic: "Fog", question: "When should rear fog lights be used?", answers: ["Whenever it rains", "When visibility is seriously reduced", "At night in clear weather", "Only on motorways"], correctIndex: 1, explanation: "Fog lights are for seriously reduced visibility and should be switched off when visibility improves." },
  { topic: "Skidding", question: "What is the first thing to do if your car starts to skid?", answers: ["Brake hard", "Ease off the accelerator and steer gently in the direction you want to go", "Accelerate sharply", "Apply the handbrake"], correctIndex: 1, explanation: "Harsh braking or steering can worsen a skid. Ease off and steer smoothly." },
  { topic: "Breakdowns", question: "Where should passengers wait after a motorway breakdown if safe to leave the vehicle?", answers: ["Inside the car", "Behind the barrier away from traffic", "In front of the car", "On the hard shoulder"], correctIndex: 1, explanation: "Leave the vehicle by the left doors if possible and wait behind the barrier, away from traffic." },
  { topic: "Documents", question: "What must a learner driver have before driving on public roads?", answers: ["A full licence", "A valid provisional licence and suitable supervision unless on a lesson with an instructor", "Only an appointment card", "Only insurance in a parent name"], correctIndex: 1, explanation: "Learners need a valid provisional licence, correct insurance, and legal supervision unless learning with an approved instructor." },
  { topic: "Eyesight", question: "Why must your eyesight meet the legal standard for driving?", answers: ["To read road signs and spot hazards early", "Only to read number plates at night", "To avoid wearing glasses", "Only for motorway driving"], correctIndex: 0, explanation: "Good eyesight is essential for reading signs, judging distance, and spotting hazards." },
  { topic: "Attitude", question: "What is the best response if another driver behaves aggressively?", answers: ["Compete with them", "Stay calm and avoid confrontation", "Flash headlights continuously", "Block their route"], correctIndex: 1, explanation: "Calm, defensive driving reduces risk and avoids escalating the situation." },
  { topic: "Signals", question: "Why should you signal in good time?", answers: ["To give other road users time to react", "To claim priority", "To make others stop", "Because it replaces mirror checks"], correctIndex: 0, explanation: "Signals help others understand your intentions, but they do not give priority." },
  { topic: "Priority", question: "At an unmarked crossroads, what should you do?", answers: ["Assume you have priority", "Slow down, look carefully, and be prepared to give way", "Sound your horn and continue", "Only look right"], correctIndex: 1, explanation: "Unmarked junctions need extra caution because priority may not be obvious." },
  { topic: "Country roads", question: "What should you expect on a narrow country road?", answers: ["No pedestrians", "Slow vehicles, animals, mud, and hidden bends", "Only one-way traffic", "Perfect road surfaces"], correctIndex: 1, explanation: "Country roads can contain sudden hazards and limited visibility." },
  { topic: "Animals", question: "What should you do when passing horses on the road?", answers: ["Rev the engine", "Pass wide and slow", "Sound the horn", "Drive close so they see you"], correctIndex: 1, explanation: "Horses can be startled. Pass slowly and leave plenty of room." },
  { topic: "Children", question: "What should you do near a school at opening or closing time?", answers: ["Expect children to behave like adults", "Drive slowly and be ready to stop", "Overtake waiting traffic quickly", "Ignore patrol signs"], correctIndex: 1, explanation: "Children may step into the road suddenly, so reduce speed and scan carefully." },
  { topic: "Roadworks", question: "What should you do when approaching roadworks?", answers: ["Keep the same speed", "Follow temporary signs and leave extra space", "Overtake all slow vehicles", "Use the closed lane until the last second"], correctIndex: 1, explanation: "Roadworks can have narrow lanes, workers, cones, and temporary speed limits." },
  { topic: "Seatbelts", question: "Who is responsible for making sure a 13-year-old passenger wears a seatbelt?", answers: ["The child only", "The driver", "The vehicle owner", "No one if it is a short journey"], correctIndex: 1, explanation: "Drivers are responsible for children under 14 using suitable restraints or seatbelts." },
  { topic: "Loads", question: "Why must luggage be secured?", answers: ["To stop it moving during braking or a collision", "To improve fuel economy only", "To make the car look tidy", "To stop the radio cutting out"], correctIndex: 0, explanation: "Loose items can become dangerous if you brake sharply or crash." },
  { topic: "Sat nav", question: "What should you do if a sat nav gives an unsafe instruction?", answers: ["Follow it because it is automatic", "Use road signs and your judgement instead", "Stop in the lane to check", "Reverse until it recalculates"], correctIndex: 1, explanation: "You are responsible for driving safely and legally, regardless of sat nav instructions." },
  { topic: "Overtaking", question: "When should you avoid overtaking?", answers: ["Approaching a bend, brow of a hill, or junction", "On a long clear straight", "When the road is dry and clear", "When the vehicle ahead is very slow but visibility is good"], correctIndex: 0, explanation: "Never overtake where you cannot see enough road ahead or where other traffic may emerge." },
  { topic: "Emergency stops", question: "After an emergency stop, what should you do before moving off again?", answers: ["Move immediately", "Check all around, including mirrors and blind spots", "Only check the speedometer", "Signal left every time"], correctIndex: 1, explanation: "Traffic and pedestrians may have moved around you, so check all around before moving." },
  { topic: "Shared spaces", question: "What should you do in areas with pedestrians and vehicles sharing space?", answers: ["Drive as if it is a normal road", "Drive slowly and be ready for unpredictable movement", "Use the horn continuously", "Assume pedestrians will move away"], correctIndex: 1, explanation: "Shared spaces need low speed, eye contact, and patience." },
  { topic: "Insurance", question: "Why must your vehicle be insured before you drive it?", answers: ["It is a legal requirement and protects against claims", "Only to reduce fuel costs", "Only for motorway driving", "Only when carrying passengers"], correctIndex: 0, explanation: "Motor insurance is a legal requirement and protects people if damage or injury occurs." },
  { topic: "Accidents", question: "If you are involved in a collision, when should you stop?", answers: ["Only if your car is damaged", "Always stop if anyone is injured, damage is caused, or an animal listed in law is involved", "Only if police are present", "Only if the other driver asks"], correctIndex: 1, explanation: "You must stop after collisions involving injury, damage, or certain animals, and exchange details where required." },
  { topic: "Emergency vehicles", question: "An ambulance is behind you with blue lights, but there is nowhere safe to pull in. What should you do?", answers: ["Stop immediately in the lane", "Keep moving until there is a safe place to let it pass", "Mount the pavement", "Drive through a red light"], correctIndex: 1, explanation: "Stay calm and keep moving legally until you can safely create space." },
  { topic: "Cyclists", question: "What should you do when approaching a cyclist near a mini-roundabout?", answers: ["Overtake before the roundabout", "Give them time and space", "Sound the horn", "Drive close so they know you are there"], correctIndex: 1, explanation: "Cyclists may need extra space to balance and position safely at roundabouts." },
  { topic: "Reversing", question: "What should you check before reversing?", answers: ["Only the interior mirror", "All around, including blind spots and vulnerable road users", "Only the camera screen", "The fuel gauge"], correctIndex: 1, explanation: "Reverse slowly only after checking all around, because pedestrians and cyclists can be hard to see." },
  { topic: "Wet roads", question: "What should you do if your vehicle begins to aquaplane?", answers: ["Brake sharply", "Ease off the accelerator and keep steering steady", "Accelerate through it", "Apply the handbrake"], correctIndex: 1, explanation: "Aquaplaning reduces tyre contact with the road. Ease off and avoid harsh steering or braking." },
  { topic: "Motorways", question: "What does a red X above a motorway lane mean?", answers: ["Use the lane with care", "Do not use that lane", "Overtake only", "The lane is for emergency vehicles only if convenient"], correctIndex: 1, explanation: "A red X closes the lane. Driving in it is dangerous and can be enforced." },
  { topic: "Traffic lights", question: "What should you do when traffic lights change to amber as you approach?", answers: ["Speed up to get through", "Stop unless it would be unsafe to do so", "Always continue", "Stop only if pedestrians are waiting"], correctIndex: 1, explanation: "Amber means stop at the stop line unless you are so close that stopping would be unsafe." },
  { topic: "Visibility", question: "Why should you keep the windscreen clean?", answers: ["To reduce glare and maintain a clear view", "Only to make the car look tidy", "To improve tyre grip", "To reduce fuel duty"], correctIndex: 0, explanation: "A dirty windscreen can worsen glare and hide hazards." },
  { topic: "Hazard lights", question: "When should hazard warning lights normally be used?", answers: ["To thank another driver", "To warn others of a temporary obstruction or danger", "To park where restrictions apply", "Whenever visibility is good"], correctIndex: 1, explanation: "Hazard lights warn other road users of danger, but they do not make unsafe parking legal." },
  { topic: "Observation", question: "A vehicle starts to pull out from a side road ahead. What should you do?", answers: ["Maintain speed to show priority", "Ease off and be ready to slow or stop", "Flash headlights to force it back", "Move closer to the centre line"], correctIndex: 1, explanation: "Anticipate the developing hazard and prepare to adjust speed safely." },
  { topic: "Country roads", question: "How should you approach a blind bend?", answers: ["Accelerate before the bend", "Slow down and keep well to the left", "Use the horn continuously", "Move to the centre of the road"], correctIndex: 1, explanation: "Reduce speed so you can stop safely if a hazard appears around the bend." },
  { topic: "Parked vehicles", question: "What is a clue that a parked car may move off?", answers: ["The wheels are missing", "A driver is inside, an indicator is flashing, or the wheels are turning", "The car is clean", "The road is quiet"], correctIndex: 1, explanation: "Look for signs that a parked vehicle may become a moving hazard." },
  { topic: "Pedestrians", question: "What should you do near a pedestrian refuge?", answers: ["Expect people may cross in two stages and be ready to stop", "Drive closer to the refuge", "Only look for traffic lights", "Ignore pedestrians already on the island"], correctIndex: 0, explanation: "Pedestrian refuges can hide people waiting or stepping into your lane." },
  { topic: "Motorcyclists", question: "Why should you avoid harsh braking behind a motorcyclist?", answers: ["Motorcyclists never brake", "They are vulnerable and may be affected by road surface or sudden movement", "It saves fuel only", "It lets you overtake sooner"], correctIndex: 1, explanation: "Leave space and brake smoothly because motorcyclists are exposed and can be affected by surface changes." },
  { topic: "Vehicle checks", question: "What should you do if your brakes feel spongy?", answers: ["Continue until the next MOT", "Stop safely and get the brakes checked", "Pump the accelerator", "Drive faster to dry them"], correctIndex: 1, explanation: "Spongy brakes can indicate a serious fault and should be checked before continuing." },
  { topic: "Ice", question: "What is the safest response when driving on ice?", answers: ["Use gentle controls, lower speed, and increase the gap", "Brake hard to test grip", "Follow closer for shelter", "Use high revs"], correctIndex: 0, explanation: "Ice greatly reduces grip, so use gentle steering, braking, and acceleration." },
  { topic: "Crossings", question: "What should you do at a toucan crossing?", answers: ["Watch for pedestrians and cyclists crossing", "Only look for horses", "Stop only if a car is waiting", "Sound the horn before passing"], correctIndex: 0, explanation: "Toucan crossings are used by pedestrians and cyclists." },
  { topic: "Large vehicles", question: "Why should you stay well back when following a large vehicle?", answers: ["To improve your view ahead and give yourself more time to react", "To hide from its mirrors", "To reduce the speed limit", "To make overtaking compulsory"], correctIndex: 0, explanation: "Large vehicles can block your view, so staying back improves observation and planning." },
  { topic: "Pedestrians", question: "Why should you avoid waving pedestrians across the road?", answers: ["It uses too much time", "Other road users may not have seen them", "It is always illegal to stop", "Pedestrians cannot understand signals"], correctIndex: 1, explanation: "Let pedestrians make their own decision because other traffic may not stop." },
  { topic: "Weather", question: "What should you do if low sun dazzles you?", answers: ["Slow down, use the sun visor if safe, and keep the windscreen clean", "Close your eyes briefly", "Use main beam", "Drive faster to leave the glare"], correctIndex: 0, explanation: "Glare can hide hazards. Reduce speed and improve visibility safely." },
  { topic: "Horn", question: "When may you sound the horn?", answers: ["To warn others of your presence", "To show annoyance", "Outside a hospital at night for no reason", "To make pedestrians cross faster"], correctIndex: 0, explanation: "The horn is a warning device, not a way to express frustration." },
  { topic: "Turning right", question: "What should you do before turning right?", answers: ["Check mirrors, signal, position correctly, and judge the gap", "Turn from the left edge", "Signal after turning", "Ignore oncoming traffic if you are first"], correctIndex: 0, explanation: "Plan the manoeuvre with observation, signal, position, speed, and looking." },
  { topic: "Parked vehicles", question: "Why should you leave extra room when passing parked cars?", answers: ["Doors may open or pedestrians may emerge", "It makes your car quieter", "It shortens your journey", "Parked cars always reverse"], correctIndex: 0, explanation: "A door or pedestrian can appear suddenly from a parked vehicle." },
  { topic: "Attitude", question: "What should you do if a learner driver stalls in front of you?", answers: ["Sound the horn repeatedly", "Be patient and keep a safe distance", "Overtake immediately at any cost", "Move close to hurry them"], correctIndex: 1, explanation: "Patience and space help keep everyone calm and safe." },
  { topic: "Braking", question: "What does ABS help you do during heavy braking?", answers: ["Maintain steering control", "Stop instantly in all conditions", "Avoid checking mirrors", "Increase engine power"], correctIndex: 0, explanation: "ABS helps prevent wheel lock so you can steer while braking hard." },
  { topic: "Loads", question: "How should pets travel in a vehicle?", answers: ["Loose on the driver's lap", "Properly secured so they cannot distract or injure anyone", "Standing in the footwell", "With the window fully open"], correctIndex: 1, explanation: "Pets should be restrained so they cannot distract the driver or be thrown forward." },
  { topic: "Speed limits", question: "What should you do when road conditions are poor but the speed limit is higher?", answers: ["Drive at the limit because it is allowed", "Choose a safe speed for the conditions", "Follow the closest vehicle", "Use hazard lights while driving normally"], correctIndex: 1, explanation: "The limit is a maximum, not a target. Reduce speed for weather, traffic, visibility, and road layout." },
  { topic: "Speed limits", question: "What does the national speed limit sign mean on a single carriageway for a car?", answers: ["50 mph unless signs say otherwise", "60 mph unless signs say otherwise", "70 mph in all conditions", "30 mph if there are street lights"], correctIndex: 1, explanation: "For cars, the national speed limit on a single carriageway is normally 60 mph, unless signs show another limit." },
  { topic: "Speed limits", question: "What does the national speed limit sign mean on a dual carriageway for a car?", answers: ["50 mph", "60 mph", "70 mph unless signs show otherwise", "No speed limit"], correctIndex: 2, explanation: "For cars, the national speed limit on a dual carriageway is normally 70 mph, unless signs show another limit." },
  { topic: "Motorways", question: "When should you use the left-hand lane on a motorway?", answers: ["Only when traffic is light", "For normal driving, unless overtaking or directed otherwise", "Only for slow vehicles", "Only after midnight"], correctIndex: 1, explanation: "Keep left unless overtaking or following signs and lane directions." },
  { topic: "Motorways", question: "What should you do after overtaking on a motorway?", answers: ["Stay in the outside lane", "Move back left when it is safe", "Brake to let the other vehicle pass", "Use hazard lights"], correctIndex: 1, explanation: "Return to the left when you can do so safely and without cutting in." },
  { topic: "Smart motorways", question: "A variable speed limit is shown on an overhead gantry. What should you do?", answers: ["Ignore it if the road looks clear", "Obey the displayed limit", "Drive at 70 mph only", "Stop on the hard shoulder"], correctIndex: 1, explanation: "Variable limits are enforceable and are used to manage traffic and incidents." },
  { topic: "Smart motorways", question: "What should you do if your vehicle breaks down in a live motorway lane?", answers: ["Stay in the vehicle if it is safest and call for help", "Walk down the motorway", "Put a warning triangle behind the car", "Try to repair it in the lane"], correctIndex: 0, explanation: "If you cannot reach a safe place, keep seatbelts on, use hazard lights, and call emergency help when safe." },
  { topic: "Breakdowns", question: "Where should you place a warning triangle after breaking down on a normal road?", answers: ["At least 45 metres behind if it is safe", "On a motorway lane", "Directly in front of the car", "On the roof"], correctIndex: 0, explanation: "Use a warning triangle only where safe and never on a motorway." },
  { topic: "Breakdowns", question: "What should you do if smoke starts coming from under the bonnet?", answers: ["Open the bonnet immediately", "Stop safely, switch off, and keep clear", "Pour water into the fuel tank", "Keep driving to cool the engine"], correctIndex: 1, explanation: "Stop safely, switch off the engine, move people away, and get assistance." },
  { topic: "Vehicle checks", question: "Why should engine oil be checked regularly?", answers: ["To prevent engine damage", "To make tyres last longer", "To improve brake lights", "To change the speed limit"], correctIndex: 0, explanation: "Low or dirty oil can cause serious engine damage." },
  { topic: "Vehicle checks", question: "What should washer fluid help you do?", answers: ["Clean the windscreen while driving", "Cool the brakes", "Increase tyre pressure", "Reduce insurance costs"], correctIndex: 0, explanation: "Washer fluid helps keep the windscreen clear, especially in spray, mud, and salt." },
  { topic: "Vehicle checks", question: "Why should head restraints be adjusted correctly?", answers: ["To reduce neck injury risk", "To improve fuel economy", "To stop windows misting", "To make steering lighter"], correctIndex: 0, explanation: "A correctly positioned head restraint can reduce whiplash injury in a collision." },
  { topic: "Tyres", question: "What can happen if tyres are under-inflated?", answers: ["They can overheat and affect handling", "They improve steering response", "They shorten thinking distance", "They make mirrors clearer"], correctIndex: 0, explanation: "Incorrect pressure can increase wear, heat, fuel use, and stopping distance." },
  { topic: "Tyres", question: "Why should you check tyres for cuts and bulges?", answers: ["They may indicate tyre damage or failure risk", "They improve acceleration", "They show the car has been washed", "They reduce the need for insurance"], correctIndex: 0, explanation: "Damage to a tyre wall or tread can make the tyre unsafe." },
  { topic: "Braking", question: "How should you brake on a slippery road?", answers: ["Harshly and late", "Early and gently", "Only with the handbrake", "Only while turning sharply"], correctIndex: 1, explanation: "Gentle braking helps reduce the risk of skidding on low-grip surfaces." },
  { topic: "Braking", question: "What should you do if your vehicle pulls to one side when braking?", answers: ["Have the brakes checked", "Ignore it if the road is straight", "Brake harder next time", "Drive faster to balance it"], correctIndex: 0, explanation: "Pulling to one side can indicate a braking or tyre fault." },
  { topic: "Steering", question: "What is the safest way to steer through a bend?", answers: ["Brake hard in the middle of the bend", "Slow before the bend and steer smoothly", "Accelerate before you can see the exit", "Coast in neutral"], correctIndex: 1, explanation: "Reduce speed before the bend and keep steering smooth to maintain control." },
  { topic: "Mirrors", question: "When should you check mirrors before signalling?", answers: ["Before changing direction or speed", "Only after completing a turn", "Only on motorways", "Only when following a lorry"], correctIndex: 0, explanation: "Check mirrors first so you know how your signal and movement may affect others." },
  { topic: "Mirrors", question: "What is a blind spot?", answers: ["An area not visible in your mirrors", "A dirty windscreen", "A road without street lights", "A sign hidden by trees"], correctIndex: 0, explanation: "Blind spots must be checked with a direct look before changing position." },
  { topic: "Signals", question: "When should you cancel a signal?", answers: ["When it no longer helps or after completing the manoeuvre", "Only when you park", "Before turning", "Never"], correctIndex: 0, explanation: "A misleading signal can confuse others, so cancel it when the message is no longer needed." },
  { topic: "Signals", question: "What should you do if your indicator fails?", answers: ["Make the manoeuvre without checking", "Avoid unnecessary manoeuvres and get it fixed", "Use the horn instead", "Drive with hazard lights on"], correctIndex: 1, explanation: "Faulty indicators can mislead others. Get them repaired and only drive if safe and legal." },
  { topic: "Junctions", question: "Why should you creep forward slowly at a closed junction?", answers: ["To improve your view without surprising others", "To make others stop suddenly", "To avoid using mirrors", "To increase engine speed"], correctIndex: 0, explanation: "Move slowly until you can see and be seen, while being ready to stop." },
  { topic: "Junctions", question: "What should you do if your view at a junction is blocked by parked vehicles?", answers: ["Edge forward carefully and keep checking", "Pull out quickly", "Sound the horn and go", "Reverse into traffic"], correctIndex: 0, explanation: "Treat it as a developing hazard and improve your view gradually." },
  { topic: "Roundabouts", question: "Which lane should you normally use when turning right at a roundabout?", answers: ["The right-hand lane unless signs or markings show otherwise", "The left lane every time", "Any lane without signalling", "The hard shoulder"], correctIndex: 0, explanation: "Use signs, road markings, and the normal right-lane position unless directed differently." },
  { topic: "Roundabouts", question: "What should you do if a long vehicle is straddling lanes at a roundabout?", answers: ["Keep back and allow room", "Drive up the inside", "Sound the horn", "Overtake on the roundabout"], correctIndex: 0, explanation: "Large vehicles may need extra room to turn, so stay back and avoid blind spots." },
  { topic: "Mini-roundabouts", question: "How should you treat a mini-roundabout?", answers: ["As a roundabout and give way to traffic from the right", "As a normal bend", "As a place to park", "As a one-way street only for buses"], correctIndex: 0, explanation: "Approach slowly, give way correctly, and avoid driving over the central markings unless unavoidable." },
  { topic: "Pedestrians", question: "What should you do when turning into a side road where pedestrians are crossing?", answers: ["Give way to pedestrians already crossing", "Turn quickly before they finish", "Sound the horn", "Flash headlights to make them stop"], correctIndex: 0, explanation: "People crossing the side road are vulnerable and should be allowed to continue safely." },
  { topic: "Pedestrians", question: "Who is most at risk when crossing near parked vehicles?", answers: ["Children and older pedestrians", "Only taxi drivers", "Only cyclists", "Only passengers in buses"], correctIndex: 0, explanation: "Some pedestrians may be hidden and may not judge speed or distance accurately." },
  { topic: "Crossings", question: "What should you do when a school crossing patrol steps into the road?", answers: ["Stop when signalled", "Drive around them", "Flash headlights and continue", "Stop only if children are already crossing"], correctIndex: 0, explanation: "You must stop when directed by a school crossing patrol." },
  { topic: "Crossings", question: "What should you do at a puffin crossing with pedestrians still crossing?", answers: ["Wait until the crossing is clear", "Move off when the light turns amber", "Sound the horn", "Drive behind them"], correctIndex: 0, explanation: "Wait until people have cleared your path before moving on." },
  { topic: "Crossings", question: "At a pelican crossing, what does a flashing amber light mean?", answers: ["Give way to pedestrians on the crossing", "Stop permanently", "Accelerate if clear", "Only buses may move"], correctIndex: 0, explanation: "You may go on flashing amber only if the crossing is clear." },
  { topic: "Cyclists", question: "Why should you look for cyclists before turning left?", answers: ["They may be coming up on your nearside", "They always stop first", "They are never allowed near junctions", "They must use the pavement"], correctIndex: 0, explanation: "Cyclists can be hard to see and may be alongside you near junctions." },
  { topic: "Cyclists", question: "How should you pass cyclists in slow-moving traffic?", answers: ["Leave enough room and avoid squeezing past", "Drive close to keep traffic flowing", "Use the horn first", "Pass on either side without checking"], correctIndex: 0, explanation: "Give cyclists room in case they wobble, avoid drains, or need to change position." },
  { topic: "Motorcyclists", question: "Why are motorcyclists harder to judge at junctions?", answers: ["Their speed and distance can be difficult to assess", "They always have priority", "They cannot use headlights", "They never turn right"], correctIndex: 0, explanation: "Motorcycles are smaller and can be missed or misjudged, so look carefully." },
  { topic: "Motorcyclists", question: "What should you do before changing lanes in traffic?", answers: ["Check mirrors, signal if needed, and check blind spots", "Move first and signal later", "Only check the centre mirror", "Follow the vehicle ahead"], correctIndex: 0, explanation: "Motorcyclists can filter through traffic and may be in your blind spot." },
  { topic: "Buses", question: "What should you do when a bus is signalling to pull out from a bus stop?", answers: ["Let it move out if safe", "Accelerate past every time", "Block the lane", "Sound the horn"], correctIndex: 0, explanation: "Give priority to buses when safe, especially in built-up areas." },
  { topic: "Buses", question: "Why should you be careful when passing a stopped bus?", answers: ["Pedestrians may step out from in front of it", "Buses always reverse", "The road is always closed", "There will be no passengers nearby"], correctIndex: 0, explanation: "The bus can hide pedestrians and other hazards." },
  { topic: "Large vehicles", question: "Why should you avoid sitting alongside a lorry at a junction?", answers: ["The driver may not see you and may need room to turn", "Lorries cannot turn", "It improves your view", "It reduces fuel use"], correctIndex: 0, explanation: "Large vehicles have blind spots and may swing out before turning." },
  { topic: "Large vehicles", question: "What can happen when a large vehicle passes you in wet weather?", answers: ["Spray may reduce your visibility", "Your fuel tank fills up", "Your brakes stop working instantly", "The speed limit changes"], correctIndex: 0, explanation: "Expect spray and keep enough space so you can see and react." },
  { topic: "Trams", question: "Why must you take extra care near tram tracks?", answers: ["Wheels can get caught and trams cannot steer around you", "Trams always stop instantly", "Cars have priority on tracks", "Tracks make your lights brighter"], correctIndex: 0, explanation: "Trams are heavy, follow fixed tracks, and need clear space." },
  { topic: "Level crossings", question: "What should you do if your vehicle breaks down on a level crossing?", answers: ["Get everyone clear and use the crossing phone if available", "Stay inside and wait", "Try to push the vehicle alone", "Close the barriers yourself"], correctIndex: 0, explanation: "Get people away from the crossing and contact the signal operator or emergency services quickly." },
  { topic: "Tunnels", question: "What should you do before entering a tunnel?", answers: ["Remove sunglasses if needed and switch on dipped headlights if required", "Close all windows and accelerate", "Use main beam at all times", "Stop at the entrance"], correctIndex: 0, explanation: "Prepare for lower light levels and follow signs for lighting and lane control." },
  { topic: "Tunnels", question: "What should you do if traffic stops in a tunnel?", answers: ["Keep a safe gap and follow signs or announcements", "Leave the vehicle immediately every time", "Use the horn continuously", "Reverse out"], correctIndex: 0, explanation: "Keep space, switch off if stopped for a while, and follow tunnel safety instructions." },
  { topic: "Roadworks", question: "What do temporary speed limits at roadworks protect?", answers: ["Workers and road users", "Only parked vehicles", "Only cameras", "Only pedestrians on pavements"], correctIndex: 0, explanation: "Roadworks often have narrow lanes, workers, plant, and changing layouts." },
  { topic: "Roadworks", question: "What should you do when lanes merge at roadworks?", answers: ["Follow signs and merge in turn where appropriate", "Block both lanes", "Accelerate to stop others merging", "Ignore cones"], correctIndex: 0, explanation: "Use the signed layout and merge calmly to keep traffic safe and steady." },
  { topic: "Road markings", question: "What does a lane marked with a white arrow usually tell you?", answers: ["The direction traffic in that lane should go", "The speed limit has ended", "Parking is free", "The road is closed"], correctIndex: 0, explanation: "Lane arrows guide positioning before junctions and roundabouts." },
  { topic: "Road markings", question: "What do zig-zag lines near a pedestrian crossing mean?", answers: ["You must not park or overtake the lead vehicle", "Parking is allowed for five minutes", "Only taxis may stop", "The road is one way"], correctIndex: 0, explanation: "Zig-zag markings keep visibility clear and protect people using the crossing." },
  { topic: "Road signs", question: "What does a blue circular sign usually give?", answers: ["A positive instruction", "A warning only", "A tourist attraction", "A parking charge"], correctIndex: 0, explanation: "Blue circular signs usually tell you something you must do, such as keep left." },
  { topic: "Road signs", question: "What does a rectangular sign usually provide?", answers: ["Information or directions", "Only a prohibition", "Only a hazard warning", "Only a speed limit"], correctIndex: 0, explanation: "Rectangular signs commonly give directions, information, or lane instructions." },
  { topic: "One-way streets", question: "What should you check before turning in a one-way street?", answers: ["The correct lane and any signs or road markings", "Only the left mirror", "The radio volume", "Only parked cars behind you"], correctIndex: 0, explanation: "One-way streets can have lane rules, bus lanes, cycle lanes, and unusual junction layouts." },
  { topic: "Bus lanes", question: "What should you do before crossing a bus lane to turn left?", answers: ["Check the signs and look for buses, taxis, and cyclists", "Cut across without checking", "Stop in the bus lane", "Use hazard lights"], correctIndex: 0, explanation: "Only use or cross a bus lane where permitted and safe." },
  { topic: "Parking", question: "Why should you avoid parking opposite another parked vehicle on a narrow road?", answers: ["It can block traffic and emergency access", "It improves visibility", "It makes the road wider", "It is always required"], correctIndex: 0, explanation: "Poor parking can obstruct the road and force unsafe passing." },
  { topic: "Parking", question: "When parking downhill, how should you help secure the vehicle?", answers: ["Use the parking brake and turn wheels towards the kerb where appropriate", "Leave it in neutral with no brake", "Keep the engine running", "Leave the door open"], correctIndex: 0, explanation: "Secure the vehicle so it cannot roll if the brake fails." },
  { topic: "Parking", question: "What should you do before opening a door after parking?", answers: ["Check for cyclists, pedestrians, and traffic", "Open it quickly", "Only look ahead", "Sound the horn"], correctIndex: 0, explanation: "Dooring can seriously injure cyclists and motorcyclists." },
  { topic: "Reversing", question: "What should you do if you cannot see clearly while reversing?", answers: ["Ask someone to guide you if safe", "Reverse faster", "Use only the horn", "Keep going until you hit the kerb"], correctIndex: 0, explanation: "Do not reverse unless you can do it safely and with proper observation." },
  { topic: "Turning", question: "What should you do if you realise you are in the wrong lane too late?", answers: ["Continue safely and reroute", "Swerve across lanes", "Stop suddenly", "Reverse to the correct lane"], correctIndex: 0, explanation: "A missed turn is safer than a rushed or unsafe lane change." },
  { topic: "Overtaking", question: "Why should you avoid overtaking near a junction?", answers: ["Vehicles may emerge or turn across your path", "It is always the fastest route", "Your mirrors stop working", "You must use the horn"], correctIndex: 0, explanation: "Junctions create crossing and turning traffic, making overtaking risky." },
  { topic: "Overtaking", question: "What should you do if a vehicle starts overtaking you?", answers: ["Maintain a steady speed and do not accelerate", "Speed up to stop them", "Move right", "Brake sharply without reason"], correctIndex: 0, explanation: "Do not make the overtake harder or more dangerous." },
  { topic: "Weather", question: "What should you do after driving through deep water?", answers: ["Test the brakes gently when safe", "Stop in the water", "Drive with the handbrake on", "Turn off all lights"], correctIndex: 0, explanation: "Water can reduce brake effectiveness, so test them carefully when clear." },
  { topic: "Weather", question: "What should you do in strong side winds?", answers: ["Keep both hands on the wheel and leave extra room", "Drive close to cyclists", "Overtake high-sided vehicles quickly", "Use main beam"], correctIndex: 0, explanation: "Strong winds can affect your vehicle and vulnerable road users." },
  { topic: "Weather", question: "When is the road most likely to be slippery after a dry spell?", answers: ["When rain first starts", "Only after snow", "Only at midday", "Only on motorways"], correctIndex: 0, explanation: "Rain can mix with oil and dirt on the road, making it slippery at first." },
  { topic: "Fog", question: "What should you do when following another vehicle in fog?", answers: ["Leave extra space and use dipped headlights", "Follow its tail lights closely", "Use main beam", "Turn lights off"], correctIndex: 0, explanation: "Fog reduces visibility and makes it harder to judge speed and distance." },
  { topic: "Night driving", question: "When should you dip your headlights at night?", answers: ["When meeting or following other road users", "Only in towns", "Only when parked", "Never on country roads"], correctIndex: 0, explanation: "Dipping headlights prevents dazzling others." },
  { topic: "Night driving", question: "What should you do if you are dazzled by a vehicle behind you?", answers: ["Adjust the mirror if possible and slow safely if needed", "Brake sharply", "Switch off your lights", "Drive faster"], correctIndex: 0, explanation: "Reduce glare and keep control without reacting suddenly." },
  { topic: "Emergency vehicles", question: "What should you avoid doing for an emergency vehicle?", answers: ["Breaking the law or creating a new danger", "Checking mirrors", "Looking for a safe gap", "Staying calm"], correctIndex: 0, explanation: "Do not run red lights, mount kerbs unsafely, or endanger others." },
  { topic: "Accidents", question: "What should you do first if you arrive at a serious collision?", answers: ["Make the scene safe and call emergency services", "Move injured people immediately", "Give everyone water", "Leave without stopping"], correctIndex: 0, explanation: "Protect yourself and others first, then call for appropriate help." },
  { topic: "First aid", question: "What should you do with an unconscious casualty who is breathing?", answers: ["Place them in the recovery position if safe", "Give them a drink", "Remove their helmet unless essential", "Make them stand up"], correctIndex: 0, explanation: "The recovery position helps keep the airway clear, unless injuries make movement unsafe." },
  { topic: "First aid", question: "Why should you not remove a motorcyclist's helmet unless essential?", answers: ["It could worsen injury", "It is always illegal", "It damages the helmet", "It stops traffic moving"], correctIndex: 0, explanation: "Only remove a helmet if necessary to maintain breathing or by trained help." },
  { topic: "Alcohol and drugs", question: "What can happen if you drive while taking some prescription medicines?", answers: ["Your driving may be impaired", "You are always safer", "Speed limits no longer apply", "Insurance is automatically cheaper"], correctIndex: 0, explanation: "Some medicines affect concentration, judgement, or reaction time. Check advice before driving." },
  { topic: "Alcohol and drugs", question: "Why might you still be over the drink-drive limit the morning after drinking?", answers: ["Alcohol takes time to leave the body", "Sleep removes all alcohol", "Coffee removes all alcohol", "Food cancels alcohol"], correctIndex: 0, explanation: "Only time removes alcohol from the body." },
  { topic: "Fitness to drive", question: "What should you do if you become angry while driving?", answers: ["Calm down and avoid reacting to others", "Drive closer to the vehicle ahead", "Use the horn repeatedly", "Race away"], correctIndex: 0, explanation: "Emotional driving increases risk. Stay calm and create space." },
  { topic: "Fitness to drive", question: "Why should you plan rest breaks on a long journey?", answers: ["To reduce tiredness and maintain concentration", "To make the journey legally longer", "To avoid checking tyres", "To use more fuel"], correctIndex: 0, explanation: "Regular breaks help prevent fatigue and poor concentration." },
  { topic: "Eco driving", question: "Which habit supports eco-safe driving?", answers: ["Anticipating traffic flow", "Late harsh braking", "Carrying unnecessary roof loads", "Revving while stationary"], correctIndex: 0, explanation: "Anticipation reduces wasted acceleration and braking." },
  { topic: "Eco driving", question: "Why should you remove an unused roof rack?", answers: ["It can increase drag and fuel use", "It improves braking only", "It makes the car exempt from tax", "It increases tyre tread"], correctIndex: 0, explanation: "Extra drag increases fuel consumption and emissions." },
  { topic: "Electric vehicles", question: "What should EV drivers consider before a long trip?", answers: ["Range, charging stops, and charger availability", "Only the colour of the cable", "That charging is instant everywhere", "That weather never affects range"], correctIndex: 0, explanation: "Planning charging and range helps avoid delays and unsafe stops." },
  { topic: "Electric vehicles", question: "Why should you take care around quiet electric vehicles as a pedestrian area driver?", answers: ["People may not hear the vehicle approaching", "They cannot stop", "They are not allowed near pedestrians", "They have no mirrors"], correctIndex: 0, explanation: "Low-speed EVs can be quieter, so vulnerable road users may not notice them." },
  { topic: "Insurance", question: "What could happen if you drive without valid insurance?", answers: ["You can face penalties and be personally liable", "Nothing if the journey is short", "Only the passenger is responsible", "It is allowed for learners"], correctIndex: 0, explanation: "Valid insurance is required before driving on public roads." },
  { topic: "Documents", question: "When must you update your driving licence details?", answers: ["When your name or address changes", "Only when buying fuel", "Only after an MOT", "Never for learners"], correctIndex: 0, explanation: "Your licence record should be kept up to date." },
  { topic: "Documents", question: "What does an MOT certificate show?", answers: ["The vehicle met minimum roadworthiness standards when tested", "The vehicle will stay fault-free for a year", "The driver is insured", "The vehicle can ignore speed limits"], correctIndex: 0, explanation: "An MOT is a roadworthiness check at the time of test, not a guarantee of future condition." },
  { topic: "Towing", question: "How can towing affect your driving?", answers: ["It can increase stopping distance and reduce acceleration", "It makes braking instant", "It removes blind spots", "It makes speed limits higher"], correctIndex: 0, explanation: "Towing changes handling, acceleration, braking, and reversing." },
  { topic: "Towing", question: "Why must a trailer load be balanced and secure?", answers: ["To reduce snaking and loss of control", "To make the horn louder", "To avoid checking mirrors", "To increase speed"], correctIndex: 0, explanation: "Poor loading can make a trailer unstable." },
  { topic: "Rural roads", question: "What should you do when approaching a horse rider on a country road?", answers: ["Slow down, leave room, and pass quietly", "Rev the engine", "Sound the horn", "Drive close behind"], correctIndex: 0, explanation: "Horses can be startled, so pass wide and slow." },
  { topic: "Rural roads", question: "Why should you expect mud on rural roads?", answers: ["Farm vehicles may leave mud near fields", "Only motorcycles create mud", "Mud means the road is closed", "Mud improves grip"], correctIndex: 0, explanation: "Mud can reduce grip and may be found near farms, gateways, and bends." },
  { topic: "Shared use", question: "What should you do in a home zone or shared area?", answers: ["Drive slowly and expect pedestrians in the road", "Use it as a high-speed route", "Ignore children playing", "Park on crossings"], correctIndex: 0, explanation: "Shared spaces need low speed and careful observation." },
  { topic: "Vulnerable users", question: "Why should you give extra space to older pedestrians?", answers: ["They may need more time to cross", "They always see you first", "They are not allowed to cross", "They must run at crossings"], correctIndex: 0, explanation: "Some pedestrians may move slowly or need extra time." },
  { topic: "Vulnerable users", question: "Why should you be careful near mobility scooters?", answers: ["Users may be vulnerable and slower to manoeuvre", "They always have priority over traffic lights", "They can stop cars instantly", "They are never near roads"], correctIndex: 0, explanation: "Give mobility scooter users space and time." },
  { topic: "Attitude", question: "What should you do if someone tailgates you?", answers: ["Increase the gap ahead and avoid braking sharply", "Brake suddenly to warn them", "Speed up beyond the limit", "Wave them past anywhere"], correctIndex: 0, explanation: "Creating more space ahead gives you more time to slow gently." },
  { topic: "Attitude", question: "What is defensive driving?", answers: ["Planning ahead and allowing for others' mistakes", "Always driving slowly in every lane", "Taking priority by force", "Ignoring mirrors"], correctIndex: 0, explanation: "Defensive driving means anticipating risk and leaving safe margins." },
  { topic: "Sat nav", question: "When should you set a sat nav route?", answers: ["Before starting or while safely parked", "While turning at a junction", "Only on motorways", "While overtaking"], correctIndex: 0, explanation: "Set devices before driving or when safely stopped to avoid distraction." },
  { topic: "Distraction", question: "Why is using a phone hands-free still risky?", answers: ["It can distract your attention", "It improves reaction time", "It removes the need for mirrors", "It changes the speed limit"], correctIndex: 0, explanation: "Even hands-free conversations can take attention away from driving." },
  { topic: "Distraction", question: "What should you do if a child passenger needs attention?", answers: ["Stop somewhere safe before dealing with it", "Turn around while driving", "Drive faster to get home", "Ignore the road briefly"], correctIndex: 0, explanation: "Deal with distractions only when parked safely." },
  { topic: "Lights", question: "When should you use sidelights?", answers: ["When parked on some roads at night or as required by conditions", "Instead of headlights in thick fog", "To overtake", "Only on motorways"], correctIndex: 0, explanation: "Use the correct lights for visibility, parking, and legal requirements." },
  { topic: "Lights", question: "Why should you check brake lights regularly?", answers: ["They warn following traffic that you are slowing", "They make the engine quieter", "They improve steering", "They show insurance details"], correctIndex: 0, explanation: "Faulty brake lights can leave following drivers with less warning." },
  { topic: "Learner drivers", question: "How should a qualified driver behave when supervising a learner?", answers: ["Stay fit to drive and pay attention", "Use a phone throughout", "Sit in the back seat", "Ignore road signs"], correctIndex: 0, explanation: "A supervising driver must be able to guide the learner safely and legally." },
  { topic: "Documents", question: "What must you be able to produce if police ask for your driving documents?", answers: ["Your licence, insurance, and MOT where required", "Only a fuel receipt", "Only your booking confirmation", "A vehicle handbook"], correctIndex: 0, explanation: "Drivers must be able to provide the correct legal documents when required." },
  { topic: "Documents", question: "When should you check that a vehicle is taxed before using it on the road?", answers: ["Before driving it", "Only after a collision", "Only when selling it", "Only after the MOT expires"], correctIndex: 0, explanation: "Vehicle tax is part of keeping a vehicle legal for public roads." },
  { topic: "Documents", question: "What should you do if your driving licence photocard is out of date?", answers: ["Renew it before relying on it", "Keep using it indefinitely", "Cover the date with tape", "Only update your insurance"], correctIndex: 0, explanation: "Licence details and photo validity should be kept current." },
  { topic: "Documents", question: "What does a V5C registration certificate identify?", answers: ["The registered keeper of the vehicle", "The insured driver for every journey", "The pass mark for the theory test", "The vehicle's maximum fuel range"], correctIndex: 0, explanation: "The V5C records the registered keeper. It is not proof of ownership or insurance." },
  { topic: "Documents", question: "What should you do when buying a used vehicle?", answers: ["Check the documents match the vehicle details", "Assume all documents are correct", "Ignore the MOT history", "Drive before arranging insurance"], correctIndex: 0, explanation: "Check vehicle identity, MOT, tax, insurance, and ownership details before use." },
  { topic: "Documents", question: "What should a learner make sure is displayed during practice on public roads?", answers: ["Correct L plates or D plates where applicable", "A handwritten name sign", "A hazard triangle on the roof", "No markings at all"], correctIndex: 0, explanation: "Learner plates must be clearly displayed during learner driving practice." },
  { topic: "Insurance", question: "Why must you tell your insurer about major vehicle modifications?", answers: ["They can affect cover and risk", "It removes the need for an MOT", "It makes all speed limits lower", "It lets you drive without tax"], correctIndex: 0, explanation: "Insurers need accurate details to keep cover valid." },
  { topic: "Insurance", question: "What could happen if you drive for work without suitable insurance cover?", answers: ["Your insurance may be invalid", "Your licence becomes automatic", "Your MOT is cancelled", "Your fuel cost is refunded"], correctIndex: 0, explanation: "The insurance must cover the actual use of the vehicle." },
  { topic: "Insurance", question: "What should you check before letting someone else drive your vehicle?", answers: ["That they are licensed and insured to drive it", "That they know your radio presets", "That they own a mobile phone", "That they have washed the vehicle"], correctIndex: 0, explanation: "The driver must be legally allowed and insured for that vehicle." },
  { topic: "Insurance", question: "What is the purpose of third-party insurance?", answers: ["To cover injury or damage caused to others", "To guarantee your own car is repaired", "To replace an MOT", "To allow unlimited parking"], correctIndex: 0, explanation: "Third-party cover protects others from losses you cause, but may not repair your vehicle." },
  { topic: "Learner drivers", question: "What must a supervising driver do during learner practice?", answers: ["Stay alert and able to take responsibility", "Sleep while the learner drives", "Use headphones", "Sit anywhere in the vehicle"], correctIndex: 0, explanation: "A supervisor must be engaged and fit to supervise throughout the drive." },
  { topic: "Learner drivers", question: "What should a learner do before practising on a motorway?", answers: ["Use an approved driving instructor in a dual-control car", "Go alone at night", "Practise with any friend", "Use the hard shoulder as a lane"], correctIndex: 0, explanation: "Learners may only practise on motorways with an approved instructor in a suitable dual-control car." },
  { topic: "Learner drivers", question: "Why should learners avoid routes beyond their current ability?", answers: ["It can create unnecessary risk and overload", "It makes the test easier", "It removes the need for mirrors", "It improves insurance automatically"], correctIndex: 0, explanation: "Practice should match skill level and build up safely." },
  { topic: "Attitude", question: "What should you do if another driver makes a mistake?", answers: ["Stay calm and give them space", "Punish them by driving close", "Flash repeatedly in anger", "Block their path"], correctIndex: 0, explanation: "Calm, defensive action reduces the chance of the mistake becoming a collision." },
  { topic: "Attitude", question: "How should you respond if you are running late?", answers: ["Accept the delay and drive safely", "Take more risks to make up time", "Ignore speed limits", "Use the horn to move traffic"], correctIndex: 0, explanation: "Being late is never a reason to take risks or pressure others." },
  { topic: "Attitude", question: "What should you do if passengers encourage unsafe driving?", answers: ["Ignore the pressure and drive responsibly", "Show them how fast the car can go", "Let them steer briefly", "Race another vehicle"], correctIndex: 0, explanation: "The driver is responsible for safe decisions, regardless of passenger pressure." },
  { topic: "Attitude", question: "Why should you avoid competitive driving?", answers: ["It encourages risky decisions", "It improves reaction time", "It makes braking shorter", "It is required on dual carriageways"], correctIndex: 0, explanation: "Treat driving as shared road use, not a competition." },
  { topic: "Attitude", question: "What should you do if someone cuts in front of you?", answers: ["Ease off and restore a safe gap", "Accelerate to close the gap", "Use the horn continuously", "Follow them closely"], correctIndex: 0, explanation: "Restoring space is safer than reacting aggressively." },
  { topic: "Signals", question: "Why should you signal in good time?", answers: ["To give others time to understand your intention", "To claim priority", "To make others stop every time", "To avoid checking mirrors"], correctIndex: 0, explanation: "A timely signal helps others plan, but it does not give you priority." },
  { topic: "Shared use", question: "What should you expect in a shared space with no clear kerbs?", answers: ["Pedestrians and cyclists may move across your path", "Only cars are allowed", "The speed limit no longer applies", "There will be no children"], correctIndex: 0, explanation: "Shared areas rely on low speed, eye contact, and caution." },
  { topic: "Emergency vehicles", question: "What should you do if an ambulance approaches from behind on a narrow road?", answers: ["Look for a safe place to pull in without causing danger", "Stop immediately in the lane every time", "Mount the pavement at speed", "Go through a red light"], correctIndex: 0, explanation: "Help emergency vehicles when safe and legal, without creating another hazard." },
  { topic: "Emergency vehicles", question: "Why should you check before moving aside for an emergency vehicle?", answers: ["Other road users may also be reacting", "Emergency vehicles always take the pavement", "You must reverse at once", "Mirrors are not useful"], correctIndex: 0, explanation: "Check mirrors and surroundings so your movement is predictable and safe." },
  { topic: "Emergency vehicles", question: "What should you do if you hear a siren but cannot see the emergency vehicle?", answers: ["Stay alert, check mirrors, and avoid sudden moves", "Brake hard immediately", "Accelerate away", "Stop on a bend"], correctIndex: 0, explanation: "Identify where the vehicle is before deciding how to help safely." },
  { topic: "Bus lanes", question: "When may you use a bus lane?", answers: ["Only when signs say your vehicle is allowed or outside restricted times", "Whenever traffic is busy", "Only when following a cyclist", "Never under any circumstances"], correctIndex: 0, explanation: "Bus lane signs show who may use the lane and when restrictions apply." },
  { topic: "Bus lanes", question: "Why should you check bus lane times before entering?", answers: ["Some lanes operate only during certain periods", "Times are only decorative", "They show the speed limit for pavements", "They replace traffic lights"], correctIndex: 0, explanation: "A bus lane may be open to general traffic outside restricted hours." },
  { topic: "Bus lanes", question: "What should you watch for when leaving a bus lane section?", answers: ["Buses, taxis, cyclists, and merging traffic", "Only vehicles behind you", "Only pedestrians on the opposite pavement", "Nothing if the lane is empty"], correctIndex: 0, explanation: "Traffic may be joining, leaving, or travelling alongside the lane." },
  { topic: "Country roads", question: "Why should you reduce speed before a blind bend on a country road?", answers: ["There may be oncoming traffic, animals, or slow vehicles", "The road always widens", "Bends remove stopping distance", "It makes the horn louder"], correctIndex: 0, explanation: "Only drive at a speed that lets you stop safely within the distance you can see." },
  { topic: "Country roads", question: "What should you expect near farm entrances?", answers: ["Slow or wide agricultural vehicles", "Only parked cars", "No mud or debris", "Motorway lane markings"], correctIndex: 0, explanation: "Farm vehicles can enter slowly, leave mud, and need extra room." },
  { topic: "Country roads", question: "How should you pass walkers on a narrow country road?", answers: ["Slow down and give plenty of room", "Pass close to save time", "Use the horn continuously", "Drive on the verge at speed"], correctIndex: 0, explanation: "Walkers are vulnerable and may have limited escape space." },
  { topic: "Rural roads", question: "Why should you be cautious at night on rural roads?", answers: ["Animals and unlit hazards may appear suddenly", "There are no speed limits", "Main beam removes all risk", "You can ignore bends"], correctIndex: 0, explanation: "Visibility is limited and hazards may appear without warning." },
  { topic: "Rural roads", question: "What should you do when meeting oncoming traffic on a single-track road?", answers: ["Use passing places courteously and plan ahead", "Force the other driver to reverse every time", "Stop in the middle indefinitely", "Drive onto soft verges at speed"], correctIndex: 0, explanation: "Use passing places sensibly and avoid damaging verges or creating conflict." },
  { topic: "Accidents", question: "What information should you exchange after a collision where required?", answers: ["Names, addresses, vehicle details, and insurance information", "Only your first name", "Your social media account", "Nothing if damage is minor"], correctIndex: 0, explanation: "Relevant driver, vehicle, and insurance details may be required after a collision." },
  { topic: "Accidents", question: "When should you call emergency services after a collision?", answers: ["If anyone is injured, danger remains, or the road is blocked", "Only if your vehicle is clean", "Only after leaving the scene", "Never for road collisions"], correctIndex: 0, explanation: "Call for help promptly where there is injury, danger, or serious obstruction." },
  { topic: "Accidents", question: "What should you do if fuel is leaking after a collision?", answers: ["Keep people clear and call emergency help", "Smoke near the vehicle", "Start the engine to test it", "Use a match to inspect it"], correctIndex: 0, explanation: "Fuel leaks create fire risk. Keep clear and get professional help." },
  { topic: "First aid", question: "What should you do if a casualty is bleeding heavily?", answers: ["Apply firm pressure if safe and call for help", "Give them food", "Move them without checking", "Wash the vehicle first"], correctIndex: 0, explanation: "Control serious bleeding where safe and get emergency help." },
  { topic: "First aid", question: "Why should you keep an injured person warm?", answers: ["To reduce shock risk while waiting for help", "To make them walk sooner", "To avoid calling emergency services", "To hide injuries"], correctIndex: 0, explanation: "Keeping casualties warm and calm can help while trained help arrives." },
  { topic: "First aid", question: "What should you check first if a casualty is not responding?", answers: ["Airway and breathing", "Their phone battery", "Their tyre pressure", "Their tax status"], correctIndex: 0, explanation: "Basic first-aid priorities start with airway and breathing." },
  { topic: "Breakdowns", question: "What should you do if you break down on a motorway and can reach an emergency area?", answers: ["Stop in the area, use hazard lights, and exit left if safe", "Stop in the right-hand lane", "Stand behind the vehicle", "Place a warning triangle in the carriageway"], correctIndex: 0, explanation: "Use a safer place if available and keep away from live traffic." },
  { topic: "Breakdowns", question: "Why should you switch on hazard warning lights after a breakdown?", answers: ["To warn other traffic of an obstruction", "To show you are parking for free", "To make the engine restart", "To replace headlights at night"], correctIndex: 0, explanation: "Hazard lights warn others that your vehicle is stopped or creating a hazard." },
  { topic: "Breakdowns", question: "What should you do if you get a puncture while driving?", answers: ["Hold the steering firmly, slow gradually, and stop safely", "Brake harshly at once", "Accelerate to the next town", "Turn sharply onto the verge"], correctIndex: 0, explanation: "Keep control and avoid sudden braking or steering." },
  { topic: "Motorways", question: "When should you use the hard shoulder on a motorway?", answers: ["Only in an emergency or when directed", "To overtake slow traffic", "To check your phone", "As a normal left lane"], correctIndex: 0, explanation: "The hard shoulder is not a normal running lane unless signs specifically open it." },
  { topic: "Motorways", question: "What should you do before joining a motorway from a slip road?", answers: ["Match speed safely and find a suitable gap", "Stop at the end of the slip road unless empty", "Force traffic to brake", "Join without checking mirrors"], correctIndex: 0, explanation: "Use the slip road to build speed and merge safely without cutting in." },
  { topic: "Motorways", question: "Why should you keep a longer gap behind large vehicles on motorways?", answers: ["They block your view ahead", "They always drive faster", "They reduce the speed limit", "They remove wind resistance completely"], correctIndex: 0, explanation: "A longer gap improves forward view and reaction time." },
  { topic: "Smart motorways", question: "What does a red X above a motorway lane mean?", answers: ["You must not drive in that lane", "The lane is fastest", "Only learners may use it", "The speed limit is removed"], correctIndex: 0, explanation: "A red X closes the lane and must be obeyed." },
  { topic: "Smart motorways", question: "What should you do if signs direct you to leave the motorway?", answers: ["Follow the signs and leave at the indicated exit", "Ignore them if your route continues", "Stop under the gantry", "Reverse to the previous exit"], correctIndex: 0, explanation: "Mandatory lane and route signs manage incidents and road safety." },
  { topic: "Stopping distance", question: "What increases thinking distance?", answers: ["Tiredness, distraction, alcohol, or drugs", "New tyres only", "A clean number plate", "Using dipped headlights"], correctIndex: 0, explanation: "Anything that slows reaction time increases thinking distance." },
  { topic: "Stopping distance", question: "What increases braking distance?", answers: ["Wet roads, poor tyres, or heavy loads", "Clear mirrors", "A shorter journey", "Good concentration"], correctIndex: 0, explanation: "Grip, vehicle condition, and weight affect how far the vehicle travels while braking." },
  { topic: "Stopping distance", question: "Why should you leave more space behind a motorcycle in wet weather?", answers: ["They may need to brake or avoid slippery surfaces suddenly", "They cannot stop at all", "They always turn left", "They are wider than lorries"], correctIndex: 0, explanation: "Give vulnerable road users extra space, especially in poor conditions." },
  { topic: "Fog", question: "When should you use rear fog lights?", answers: ["When visibility is seriously reduced", "Whenever it rains lightly", "Only in daylight traffic jams", "To make following drivers speed up"], correctIndex: 0, explanation: "Rear fog lights are for very poor visibility and should not dazzle others unnecessarily." },
  { topic: "Fog", question: "When should you switch fog lights off?", answers: ["When visibility improves", "Only when the engine is off", "After every gear change", "Only on motorways"], correctIndex: 0, explanation: "Fog lights can dazzle others when visibility is no longer seriously reduced." },
  { topic: "Skidding", question: "What is the main cause of skidding?", answers: ["Driver actions that are too harsh for the conditions", "Correct tyre pressure", "Smooth steering", "Looking well ahead"], correctIndex: 0, explanation: "Harsh braking, steering, or acceleration can cause loss of grip." },
  { topic: "Skidding", question: "What should you do if the rear of the car skids?", answers: ["Steer gently into the skid and avoid harsh braking", "Brake as hard as possible", "Close your eyes briefly", "Accelerate sharply"], correctIndex: 0, explanation: "Smooth steering and avoiding harsh inputs help regain control." },
  { topic: "Vehicle control", question: "Why should you avoid coasting in neutral?", answers: ["It reduces control and engine braking", "It improves steering response", "It makes braking shorter", "It is required downhill"], correctIndex: 0, explanation: "Coasting can reduce control, especially downhill or when changing speed." },
  { topic: "Vehicle control", question: "What should you do before moving off from the side of the road?", answers: ["Check all around, signal if needed, and move when safe", "Signal only after moving", "Move first to claim space", "Only check the front window"], correctIndex: 0, explanation: "Effective observation before moving off protects traffic, cyclists, and pedestrians." },
  { topic: "Reversing", question: "Where should you avoid reversing from?", answers: ["A side road into a main road", "A driveway when guided safely", "A parking bay at low speed", "A quiet private area"], correctIndex: 0, explanation: "Reversing into a busier road is risky because visibility and control are limited." },
  { topic: "Towing", question: "What should you check before towing a trailer?", answers: ["That the trailer, lights, coupling, load, and mirrors are safe", "Only the radio volume", "Only the paint colour", "That the trailer has no number plate"], correctIndex: 0, explanation: "Towing needs legal, secure equipment and enough rearward visibility." },
  { topic: "Loads", question: "Why must roof loads be secured carefully?", answers: ["They can affect handling and may fall off", "They reduce braking distance", "They make the car exempt from speed limits", "They improve cornering"], correctIndex: 0, explanation: "Loose or heavy roof loads can create serious danger and affect control." },
  { topic: "Loads", question: "What should you do if a load blocks your rear view?", answers: ["Use suitable side mirrors and make sure the load is legal and secure", "Drive without checking behind", "Remove both mirrors", "Use the horn before every turn"], correctIndex: 0, explanation: "You must maintain safe visibility and secure the load properly." },
  { topic: "Vehicle checks", question: "Why should coolant levels be checked?", answers: ["To help prevent overheating", "To improve tyre tread", "To make lights brighter", "To reduce the need for mirrors"], correctIndex: 0, explanation: "Low coolant can cause overheating and engine damage." },
  { topic: "Vehicle checks", question: "Why should windscreen wipers be in good condition?", answers: ["To keep a clear view in rain and spray", "To cool the engine", "To inflate tyres", "To reduce speed limits"], correctIndex: 0, explanation: "Damaged wipers can leave smears and reduce visibility." },
  { topic: "Seatbelts", question: "Who is responsible for an adult passenger wearing a seatbelt?", answers: ["The adult passenger", "The driver in every case", "The vehicle manufacturer", "The nearest pedestrian"], correctIndex: 0, explanation: "Adults are responsible for wearing their own seatbelt, while drivers have responsibilities for children." },
  { topic: "Seatbelts", question: "Why must a child use the correct restraint?", answers: ["To match their size and reduce injury risk", "To see out of the window only", "To avoid using mirrors", "To make the car faster"], correctIndex: 0, explanation: "Child restraints protect children according to size, age, and legal requirements." },
  { topic: "Lights", question: "When should you use dipped headlights in daytime?", answers: ["When visibility is reduced by weather or spray", "Only when parked", "Only above 60 mph", "Never during the day"], correctIndex: 0, explanation: "Dipped headlights help others see you in poor daytime visibility." },
  { topic: "Observation", question: "Why should you scan well ahead while driving?", answers: ["To spot developing hazards early", "To avoid using mirrors", "To drive closer to others", "To ignore side roads"], correctIndex: 0, explanation: "Early scanning gives more time to plan and respond smoothly." },
  { topic: "Observation", question: "Where should you look before changing lane?", answers: ["Mirrors, signal area, and blind spot", "Only straight ahead", "Only the sat nav", "Only the passenger mirror"], correctIndex: 0, explanation: "Lane changes need mirror checks and a direct blind-spot check where needed." },
  { topic: "Distraction", question: "What should you do before eating or drinking while driving?", answers: ["Wait until you are safely parked", "Eat only on bends", "Hold the wheel with one knee", "Use hazard lights and continue"], correctIndex: 0, explanation: "Eating or drinking can distract and reduce control." },
  { topic: "Fitness to drive", question: "What should you do if you feel sleepy while driving?", answers: ["Stop safely and rest", "Open a window and keep going indefinitely", "Turn up music only", "Drive faster to arrive sooner"], correctIndex: 0, explanation: "Sleepiness seriously affects reaction and judgement. Stop safely and rest." },
  { topic: "Road signs", question: "What shape is usually used for warning signs?", answers: ["Triangle", "Circle only", "Rectangle only", "Octagon only"], correctIndex: 0, explanation: "Most warning signs are triangular with a red border." },
  { topic: "Road signs", question: "What does a red circular sign usually mean?", answers: ["An order or restriction", "Tourist information", "A recommended route only", "A fuel station ahead"], correctIndex: 0, explanation: "Red circular signs normally tell you what you must not do or the restriction that applies." },
  { topic: "Road signs", question: "What does a brown sign usually indicate?", answers: ["Tourist information", "A compulsory instruction", "A motorway speed limit", "A pedestrian crossing patrol"], correctIndex: 0, explanation: "Brown signs commonly give tourist directions or attractions." },
  { topic: "Road markings", question: "What do double white lines with a solid line nearest you mean?", answers: ["Do not cross or straddle it except in limited permitted cases", "Overtake freely", "Parking is always allowed", "The lane is for buses only"], correctIndex: 0, explanation: "Solid white line systems restrict crossing because visibility or risk is higher." },
  { topic: "Roadworks", question: "Why should you obey temporary traffic lights at roadworks?", answers: ["They control single-lane or changing traffic safely", "They are only suggestions", "They apply only to cyclists", "They mean the road is closed forever"], correctIndex: 0, explanation: "Temporary lights protect workers and manage traffic through restricted layouts." },
  { topic: "Loads", question: "What should you do before carrying a heavy load?", answers: ["Check it is within the vehicle limit and secured", "Place it loose on the back seat", "Ignore tyre pressures", "Block all mirrors"], correctIndex: 0, explanation: "Loads must stay within limits, be secured, and not affect visibility or control." },
  { topic: "Towing", question: "What should you allow for when towing in windy conditions?", answers: ["Extra instability and longer stopping distances", "Shorter stopping distances", "No change in handling", "Higher speed limits"], correctIndex: 0, explanation: "Wind can make trailers unstable, so reduce speed and leave more space." },
  { topic: "Vehicle control", question: "Why should you select the correct gear before a steep hill?", answers: ["To maintain control and avoid unnecessary gear changes", "To avoid using mirrors", "To make steering unnecessary", "To cancel speed limits"], correctIndex: 0, explanation: "The right gear helps control speed and power, especially on steep gradients." },
  { topic: "Reversing", question: "What should you do if pedestrians walk behind you while reversing?", answers: ["Stop and wait until it is safe", "Keep reversing slowly", "Sound the horn and continue", "Wave them around the vehicle"], correctIndex: 0, explanation: "Stop immediately if anyone enters the area behind your vehicle." },
  { topic: "Attitude", question: "What should you do if you feel pressured by traffic behind you?", answers: ["Keep to a safe legal speed and avoid rushing", "Speed up beyond the limit", "Brake sharply to warn them", "Drive through amber lights every time"], correctIndex: 0, explanation: "Do not let pressure from others make you take unsafe decisions." },
  { topic: "Learner drivers", question: "Why should other drivers give learners extra patience?", answers: ["They may need more time to deal with situations", "They must always be overtaken", "They are exempt from signals", "They cannot use roundabouts"], correctIndex: 0, explanation: "Learners can make mistakes, so patience and space help everyone stay safer." },
  { topic: "Country roads", question: "What should you do when approaching a sharp crest on a rural road?", answers: ["Slow so you can stop within the distance you can see", "Move to the centre of the road", "Sound the horn and accelerate", "Overtake before the crest"], correctIndex: 0, explanation: "You may not see oncoming traffic or hazards until late." },
  { topic: "Bus lanes", question: "What should you do if a bus lane sign is unclear to you?", answers: ["Stay out of the lane unless you are sure you may use it", "Use it until someone stops you", "Assume it is open to everyone", "Park in it to read the sign"], correctIndex: 0, explanation: "If you are unsure, avoid using the lane until you can confirm the restriction safely." },
  { topic: "Documents", question: "Why should your insurance details be kept easy to access after a collision?", answers: ["You may need to provide them to others or police", "They replace first aid", "They prove the road was clear", "They let you leave without stopping"], correctIndex: 0, explanation: "Insurance information is part of the required exchange after some incidents." },
  { topic: "Documents", question: "What should you do if your vehicle fails its MOT?", answers: ["Repair the defects before using it unless legally allowed to move it", "Ignore the failure for a year", "Drive normally because it was tested", "Remove the number plates"], correctIndex: 0, explanation: "A failed MOT can make the vehicle unsafe or illegal to use until repaired." }
];

const THEORY_BANK_TARGET_SIZE = 500;

const mockQuestionVariantFrames = [
  (question: string) => `${question}. Which answer keeps the situation safest?`,
  (question: string) => `${question}. What is the correct response?`,
  (question: string) => `During a normal journey, ${question.charAt(0).toLowerCase()}${question.slice(1)}. Which option should you choose?`,
  (question: string) => `${question}. What should a careful driver do?`,
  (question: string) => `On the road, ${question.charAt(0).toLowerCase()}${question.slice(1)}. Which answer best follows safe-driving guidance?`,
  (question: string) => `${question}. What is the safest option?`
];

function normaliseQuestionStem(question: string) {
  return question.trim().replace(/[?.!]\s*$/, "");
}

function createMockQuestionVariant(source: MockQuestion, variantIndex: number): MockQuestion {
  const frame = mockQuestionVariantFrames[variantIndex % mockQuestionVariantFrames.length];
  const stem = normaliseQuestionStem(source.question);

  return {
    ...source,
    sourceKey: getQuestionLearningPointId(source),
    question: frame(stem),
    explanation: source.explanation
  };
}

function buildMockQuestionBank(baseQuestions: MockQuestion[], targetSize: number): MockQuestion[] {
  const expandedQuestions = [...baseQuestions];
  const variantSources = baseQuestions.filter((question) => !question.visual);

  if (variantSources.length === 0) {
    return expandedQuestions.slice(0, targetSize);
  }

  let variantIndex = 0;
  while (expandedQuestions.length < targetSize) {
    const source = variantSources[variantIndex % variantSources.length];
    expandedQuestions.push(createMockQuestionVariant(source, variantIndex));
    variantIndex += 1;
  }

  return expandedQuestions.slice(0, targetSize);
}

const mockQuestionBank = buildMockQuestionBank(baseMockQuestionBank, THEORY_BANK_TARGET_SIZE);
const MOCK_BANK_SIZE = mockQuestionBank.length;

const theoryStandardPoints = [
  "Uses the current GOV.UK car theory-test structure: 50 multiple-choice questions, 57 minutes, and a 43/50 pass target.",
  "Covers the full 14-topic DVSA-style syllabus: alertness, attitude, safety and your vehicle, safety margins, hazard awareness, vulnerable road users, other types of vehicle, vehicle handling, motorway rules, rules of the road, road and traffic signs, documents, incidents, and vehicle loading.",
  "Includes selected original diagram questions for priority, signs, crossings, roadworks, dual carriageways, and motorway signals.",
  "Questions are original LDA practice wording, not official DVSA question text, so learners get realistic preparation without misleading them about the source."
];

const highwayCodeGeneralUrl = "https://www.gov.uk/guidance/the-highway-code/general-rules-techniques-and-advice-for-all-drivers-and-riders-103-to-158";
const highwayCodeDriversUrl = "https://www.gov.uk/guidance/the-highway-code/rules-for-drivers-and-motorcyclists-89-to-102";
const highwayCodeRoadUsersUrl = "https://www.gov.uk/guidance/the-highway-code/road-users-requiring-extra-care-204-to-225";
const highwayCodeRoadUseUrl = "https://www.gov.uk/guidance/the-highway-code/using-the-road-159-to-203";
const highwayCodeMotorwaysUrl = "https://www.gov.uk/guidance/the-highway-code/motorways-253-to-273";
const highwayCodeIncidentsUrl = "https://www.gov.uk/guidance/the-highway-code/breakdowns-and-incidents-274-to-287";
const highwayCodeWeatherUrl = "https://www.gov.uk/guidance/the-highway-code/driving-in-adverse-weather-conditions-226-to-237";
const highwayCodeAnnexVehicleUrl = "https://www.gov.uk/guidance/the-highway-code/annex-6-vehicle-maintenance-safety-and-security";
const highwayCodeAnnexDocsUrl = "https://www.gov.uk/guidance/the-highway-code/annex-3-motor-vehicle-documentation-and-learner-driver-requirements";
const highwayCodeSignalsUrl = "https://www.gov.uk/guidance/the-highway-code/signals-to-other-road-users";
const highwayCodeTrafficSignsUrl = "https://www.gov.uk/guidance/the-highway-code/traffic-signs";
const highwayCodeRoadMarkingsUrl = "https://www.gov.uk/guidance/the-highway-code/road-markings";
const highwayCodeTrafficLightsUrl = "https://www.gov.uk/guidance/the-highway-code/light-signals-controlling-traffic";
const trafficSignsUrl = "https://assets.publishing.service.gov.uk/media/656ef4271104cf0013fa74ef/know-your-traffic-signs-dft.pdf";

function officialSource(label: string, url: string): OfficialReadingSource {
  return { label, url };
}

// Display in the learner study order suggested by the first relevant official Highway Code rule/reference.
const knowledgeSections: KnowledgeSection[] = [
  {
    title: "Safety and your vehicle",
    points: ["Tyres, lights, brakes, and steering", "Seatbelts and child restraints", "Breakdowns and warning lights"],
    officialLabel: "GOV.UK Highway Code vehicle safety sections",
    officialSources: [
      officialSource("Vehicle condition", `${highwayCodeDriversUrl}#vehicle-condition-rule-89`),
      officialSource("Seat belts and child restraints", `${highwayCodeDriversUrl}#seat-belts-and-child-restraints-rules-99-to-102`),
      officialSource("Vehicle maintenance", `${highwayCodeAnnexVehicleUrl}#vehiclemain`),
      officialSource("Breakdowns", `${highwayCodeIncidentsUrl}#breakdowns-rule-276`)
    ],
    quizTopics: ["Vehicle checks", "Seatbelts", "Lights", "Breakdowns", "Vehicle control"]
  },
  {
    title: "Alertness",
    points: ["Observation and scanning", "Anticipation and concentration", "Avoiding distraction and tiredness"],
    officialLabel: "GOV.UK Highway Code alertness sections",
    officialSources: [
      officialSource("Fitness to drive, including tiredness", `${highwayCodeDriversUrl}#fitness-to-drive-rules-90-to-94`),
      officialSource("Concentration, distraction, and safe driving advice", `${highwayCodeGeneralUrl}#general-advice-rules-144-to-158`),
      officialSource("Mobile phones and in-vehicle technology", `${highwayCodeGeneralUrl}#mobile-phones-and-in-vehicle-technology`)
    ],
    quizTopics: ["Observation", "Distraction", "Fitness to drive", "Night driving", "Sat nav", "Lights"]
  },
  {
    title: "Vehicle loading",
    points: ["Load security", "Roof racks, trailers, and weight limits", "How loads affect braking and handling"],
    officialLabel: "GOV.UK Highway Code loading sections",
    officialSources: [
      officialSource("Vehicle towing and loading", `${highwayCodeDriversUrl}#vehicle-towing-and-loading-rule-98`),
      officialSource("Vehicle maintenance and security", `${highwayCodeAnnexVehicleUrl}#vehiclemain`),
      officialSource("Traffic officer stops for insecure loads", `${highwayCodeGeneralUrl}#other-stopping-procedures-rules-107-to-112`)
    ],
    quizTopics: ["Loads", "Towing", "Vehicle checks", "Eco driving"]
  },
  {
    title: "Road and traffic signs",
    points: ["Warning signs", "Orders, restrictions, and direction signs", "Road markings and temporary signs"],
    officialLabel: "GOV.UK and DfT traffic sign sections",
    officialSources: [
      officialSource("Traffic signs", highwayCodeTrafficSignsUrl),
      officialSource("Road markings", highwayCodeRoadMarkingsUrl),
      officialSource("Traffic light signals", highwayCodeTrafficLightsUrl),
      officialSource("DfT Know Your Traffic Signs PDF", trafficSignsUrl)
    ],
    quizTopics: ["Road signs", "Signs", "Road markings", "Traffic lights", "Speed limits", "Roadworks"]
  },
  {
    title: "Vehicle handling",
    points: ["Steering, braking, and gear control", "Skids and poor grip", "Reversing, towing, and manoeuvring"],
    officialLabel: "GOV.UK Highway Code vehicle handling sections",
    officialSources: [
      officialSource("Control of the vehicle", `${highwayCodeGeneralUrl}#control-of-the-vehicle-rules-117-to-126`),
      officialSource("Reversing", `${highwayCodeRoadUseUrl}#reversing-200-to-203`),
      officialSource("Vehicle towing and loading", `${highwayCodeDriversUrl}#vehicle-towing-and-loading-rule-98`)
    ],
    quizTopics: ["Vehicle control", "Skidding", "Reversing", "Turning", "Towing", "Weather"]
  },
  {
    title: "Safety margins",
    points: ["Stopping distances", "Following distance", "Weather, speed, and road-surface risk"],
    officialLabel: "GOV.UK Highway Code stopping and weather sections",
    officialSources: [
      officialSource("Control of the vehicle and stopping distances", `${highwayCodeGeneralUrl}#control-of-the-vehicle-rules-117-to-126`),
      officialSource("Wet weather", `${highwayCodeWeatherUrl}#wet-weather-rule-227`),
      officialSource("Icy and snowy weather", `${highwayCodeWeatherUrl}#icy-and-snowy-weather-rules-228-to-231`),
      officialSource("Fog", `${highwayCodeWeatherUrl}#fog-rules-234-to-236`)
    ],
    quizTopics: ["Stopping distance", "Weather", "Fog", "Skidding", "Speed limits"]
  },
  {
    title: "Attitude",
    points: ["Considerate driving", "Defensive decisions", "Avoiding aggressive or rushed behaviour"],
    officialLabel: "GOV.UK Highway Code attitude sections",
    officialSources: [
      officialSource("General advice for safe and responsible driving", `${highwayCodeGeneralUrl}#general-advice-rules-144-to-158`),
      officialSource("General rules before using the road", `${highwayCodeRoadUseUrl}#general-rules-rules-159-to-161`),
      officialSource("Extra care around vulnerable road users", `${highwayCodeRoadUsersUrl}#overview-rule-204`)
    ],
    quizTopics: ["Attitude", "Signals", "Shared use", "Learner drivers"]
  },
  {
    title: "Hazard awareness",
    points: ["Developing hazards", "Hidden pedestrians and cyclists", "Emergency vehicles and changing road conditions"],
    officialLabel: "GOV.UK Highway Code hazard sections",
    officialSources: [
      officialSource("General rules when using the road", `${highwayCodeRoadUseUrl}#general-rules-rules-159-to-161`),
      officialSource("Pedestrian crossings", `${highwayCodeRoadUseUrl}#pedestrian-crossings-rules-191-to-199`),
      officialSource("Road users requiring extra care", `${highwayCodeRoadUsersUrl}#overview-rule-204`),
      officialSource("Driving in adverse weather", `${highwayCodeWeatherUrl}#overview-rule-226`)
    ],
    quizTopics: ["Hazards", "Emergency vehicles", "Roadworks", "Crossings", "Pedestrians", "Children"]
  },
  {
    title: "Rules of the road",
    points: ["Junctions, roundabouts, and priority", "Speed limits and road positioning", "Overtaking, waiting, and parking rules"],
    officialLabel: "GOV.UK Highway Code road rule sections",
    officialSources: [
      officialSource("Road junctions", `${highwayCodeRoadUseUrl}#road-junctions-rules-170-to-183`),
      officialSource("Roundabouts", `${highwayCodeRoadUseUrl}#roundabouts-rules-184-to-190`),
      officialSource("Overtaking", `${highwayCodeRoadUseUrl}#overtaking-rules-162-to-169`),
      officialSource("Lines and lane markings", `${highwayCodeGeneralUrl}#lines-and-lane-markings-on-the-road-rules-127-to-132`)
    ],
    quizTopics: ["Priority", "Roundabouts", "Parking", "Overtaking", "Turning", "Box junctions", "Speed limits"]
  },
  {
    title: "Vulnerable road users",
    points: ["Pedestrians and children", "Cyclists and motorcyclists", "Horse riders and mobility scooter users"],
    officialLabel: "GOV.UK Highway Code vulnerable road user sections",
    officialSources: [
      officialSource("Pedestrians", `${highwayCodeRoadUsersUrl}#pedestrians-rules-205-to-210`),
      officialSource("Motorcyclists and cyclists", `${highwayCodeRoadUsersUrl}#motorcyclists-and-cyclists-rules-211-to-213`),
      officialSource("Other road users", `${highwayCodeRoadUsersUrl}#other-road-users-rules-214-to-218`)
    ],
    quizTopics: ["Vulnerable users", "Cyclists", "Pedestrians", "Children", "Animals", "Rural roads"]
  },
  {
    title: "Other types of vehicle",
    points: ["Buses, trams, and taxis", "Large vehicles and blind spots", "Emergency, slow, and agricultural vehicles"],
    officialLabel: "GOV.UK Highway Code other vehicle sections",
    officialSources: [
      officialSource("Other vehicles", `${highwayCodeRoadUsersUrl}#other-vehicles-rules-219-to-225`),
      officialSource("Other road users", `${highwayCodeRoadUsersUrl}#other-road-users-rules-214-to-218`),
      officialSource("Overtaking larger or slower vehicles", `${highwayCodeRoadUseUrl}#overtaking-rules-162-to-169`)
    ],
    quizTopics: ["Bus lanes", "Emergency vehicles", "Rural roads", "Country roads"]
  },
  {
    title: "Motorway rules",
    points: ["Joining and leaving motorways", "Lane discipline and signals", "Hard shoulder and smart motorway rules"],
    officialLabel: "GOV.UK Highway Code motorway sections",
    officialSources: [
      officialSource("Joining the motorway", `${highwayCodeMotorwaysUrl}#joining-the-motorway-rule-259`),
      officialSource("Motorway signals", `${highwayCodeMotorwaysUrl}#motorway-signals-rules-255-to-258`),
      officialSource("Lane discipline", `${highwayCodeMotorwaysUrl}#lane-discipline-rules-264-to-266`),
      officialSource("Hard shoulder and stopping", `${highwayCodeMotorwaysUrl}#hard-shoulder-rule-269`)
    ],
    quizTopics: ["Motorways", "Emergency vehicles", "Breakdowns"]
  },
  {
    title: "Incidents, accidents and emergencies",
    points: ["What to do at a collision", "First aid basics", "Reporting, stopping, and warning others"],
    officialLabel: "GOV.UK Highway Code incident sections",
    officialSources: [
      officialSource("Place of relative safety", `${highwayCodeIncidentsUrl}#place-of-relative-safety-rule-275`),
      officialSource("Breakdowns", `${highwayCodeIncidentsUrl}#breakdowns-rule-276`),
      officialSource("Incidents", `${highwayCodeIncidentsUrl}#incidents-rules-281-to-283`),
      officialSource("Obstructions", `${highwayCodeIncidentsUrl}#obstructions-rule-280`)
    ],
    quizTopics: ["Accidents", "First aid", "Breakdowns", "Emergency vehicles"]
  },
  {
    title: "Documents",
    points: ["Licence responsibilities", "Insurance and MOT", "Vehicle tax and legal records"],
    officialLabel: "GOV.UK Highway Code documentation sections",
    officialSources: [
      officialSource("Documents", `${highwayCodeAnnexDocsUrl}#documentation`),
      officialSource("Learner drivers", `${highwayCodeAnnexDocsUrl}#learner-drivers`),
      officialSource("Documentation after incidents", `${highwayCodeIncidentsUrl}#documentation-rules-286-to-287`)
    ],
    quizTopics: ["Documents", "Insurance", "Learner drivers"]
  }
];




const theoryViews: Array<{ key: ViewKey; label: string; Icon: LucideIcon }> = [
  { key: "prepare", label: "Get ready for theory", Icon: BookOpenCheck },
  { key: "mock", label: "Mock theory test", Icon: Clock3 },
  { key: "hazard", label: "Mock Hazard Perception", Icon: MousePointerClick },
  { key: "book", label: "Book official test", Icon: ExternalLink }
];

function formatTimer(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  return `${minutes}:${(seconds % 60).toString().padStart(2, "0")}`;
}


function shuffleQuestions<T>(items: T[]) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return shuffled;
}

function getQuestionId(question: MockQuestion) {
  return question.question;
}

function getQuestionLearningPointId(question: MockQuestion) {
  return question.sourceKey ?? `${question.topic}::${normaliseQuestionStem(question.question)}`;
}

function uniqueByQuestionId(questions: MockQuestion[]) {
  const seen = new Set<string>();
  return questions.filter((question) => {
    const id = getQuestionId(question);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function uniqueByLearningPoint(questions: MockQuestion[]) {
  const seen = new Set<string>();
  return questions.filter((question) => {
    const id = getQuestionLearningPointId(question);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function spreadQuestionsByTopic(questions: MockQuestion[]) {
  const grouped = new Map<string, MockQuestion[]>();

  shuffleQuestions(questions).forEach((question) => {
    const topicQuestions = grouped.get(question.topic) ?? [];
    topicQuestions.push(question);
    grouped.set(question.topic, topicQuestions);
  });

  const ordered: MockQuestion[] = [];

  while (grouped.size > 0 && ordered.length < questions.length) {
    const topics = shuffleQuestions(Array.from(grouped.keys()));
    topics.forEach((topic) => {
      const topicQuestions = grouped.get(topic);
      const question = topicQuestions?.shift();
      if (question) ordered.push(question);
      if (!topicQuestions?.length) grouped.delete(topic);
    });
  }

  return ordered;
}

function selectMockCandidates(questions: MockQuestion[], recentQuestions: Set<string>, count: number) {
  const freshQuestions = uniqueByLearningPoint(uniqueByQuestionId(questions.filter((question) => !recentQuestions.has(getQuestionId(question)))));
  const repeatQuestions = uniqueByLearningPoint(uniqueByQuestionId(questions.filter((question) => recentQuestions.has(getQuestionId(question)))));
  return spreadQuestionsByTopic(uniqueByLearningPoint([...freshQuestions, ...repeatQuestions])).slice(0, count);
}

function interleaveDiagramQuestions(textQuestions: MockQuestion[], diagramQuestions: MockQuestion[]) {
  if (diagramQuestions.length === 0) return textQuestions.slice(0, MOCK_TEST_SIZE);

  const diagramSlots = new Set(
    diagramQuestions.map((_question, index) =>
      Math.max(0, Math.min(MOCK_TEST_SIZE - 1, Math.round(((index + 1) * MOCK_TEST_SIZE) / (diagramQuestions.length + 1)) - 1))
    )
  );
  const sessionQuestions: MockQuestion[] = [];
  let textIndex = 0;
  let diagramIndex = 0;

  for (let index = 0; index < MOCK_TEST_SIZE; index += 1) {
    if (diagramSlots.has(index) && diagramIndex < diagramQuestions.length) {
      sessionQuestions.push(diagramQuestions[diagramIndex]);
      diagramIndex += 1;
      continue;
    }

    if (textIndex < textQuestions.length) {
      sessionQuestions.push(textQuestions[textIndex]);
      textIndex += 1;
      continue;
    }

    if (diagramIndex < diagramQuestions.length) {
      sessionQuestions.push(diagramQuestions[diagramIndex]);
      diagramIndex += 1;
    }
  }

  return sessionQuestions;
}

function readMockHistory() {
  if (typeof window === "undefined") return [];

  try {
    const parsed = JSON.parse(window.localStorage.getItem(MOCK_HISTORY_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function getMockHistoryCoverage() {
  const bankIds = new Set(mockQuestionBank.map(getQuestionId));
  return readMockHistory().filter((id) => bankIds.has(id)).length;
}

function storeMockHistory(selectedQuestions: MockQuestion[]) {
  if (typeof window === "undefined") return 0;

  try {
    const bankIds = new Set(mockQuestionBank.map(getQuestionId));
    const previous = readMockHistory().filter((id) => bankIds.has(id));
    const selected = selectedQuestions.map(getQuestionId);
    const deduped = Array.from(new Set([...previous, ...selected]));
    window.localStorage.setItem(MOCK_HISTORY_KEY, JSON.stringify(deduped));
    return deduped.length;
  } catch {
    // Local storage is a convenience only; the mock still randomizes without it.
    return 0;
  }
}

function buildMockSessionQuestions() {
  const recentQuestions = new Set(readMockHistory());
  const diagramBank = uniqueByQuestionId(mockQuestionBank.filter((question) => question.visual));
  const textBank = uniqueByQuestionId(mockQuestionBank.filter((question) => !question.visual));
  const diagramCount = Math.min(MOCK_TEST_DIAGRAM_COUNT, diagramBank.length, MOCK_TEST_SIZE);
  const diagramQuestions = selectMockCandidates(diagramBank, recentQuestions, diagramCount);
  const textQuestions = selectMockCandidates(textBank, recentQuestions, MOCK_TEST_SIZE - diagramQuestions.length);
  const selectedQuestions = interleaveDiagramQuestions(textQuestions, diagramQuestions);

  if (selectedQuestions.length === MOCK_TEST_SIZE) return selectedQuestions;

  const fallbackQuestions = selectMockCandidates(mockQuestionBank, recentQuestions, MOCK_TEST_SIZE);
  return fallbackQuestions.length === MOCK_TEST_SIZE ? fallbackQuestions : spreadQuestionsByTopic(uniqueByQuestionId(mockQuestionBank)).slice(0, MOCK_TEST_SIZE);
}

function getTopicHistoryKey(section: KnowledgeSection) {
  const topicSlug = section.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${TOPIC_HISTORY_KEY_PREFIX}:${topicSlug}`;
}

function readTopicPracticeHistory(section: KnowledgeSection) {
  if (typeof window === "undefined") return [];

  try {
    const parsed = JSON.parse(window.localStorage.getItem(getTopicHistoryKey(section)) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function storeTopicPracticeHistory(section: KnowledgeSection, selectedQuestions: MockQuestion[], topicBank: MockQuestion[], options?: { restartCycle?: boolean }) {
  if (typeof window === "undefined") return;

  try {
    const bankIds = new Set(topicBank.map(getQuestionLearningPointId));
    const previous = readTopicPracticeHistory(section).filter((id) => bankIds.has(id));
    const selected = selectedQuestions.map(getQuestionLearningPointId);
    const deduped = Array.from(new Set([...(options?.restartCycle ? [] : previous), ...selected]));
    window.localStorage.setItem(getTopicHistoryKey(section), JSON.stringify(deduped));
  } catch {
    // Topic history improves variety, but quizzes still work without local storage.
  }
}

function getTopicPracticeSize(topicBankSize: number) {
  if (topicBankSize <= TOPIC_PRACTICE_MIN_SIZE) return topicBankSize;
  return Math.min(TOPIC_PRACTICE_SIZE, Math.max(TOPIC_PRACTICE_MIN_SIZE, Math.floor(topicBankSize / 4)));
}

function buildTopicPracticeBank(section: KnowledgeSection) {
  const topicNames = section.quizTopics.map((topic) => topic.toLowerCase());
  const matchingQuestions = mockQuestionBank.filter((question) => {
    const questionTopic = question.topic.toLowerCase();
    return topicNames.some((topic) => questionTopic === topic || questionTopic.includes(topic) || topic.includes(questionTopic));
  });
  return spreadQuestionsByTopic(uniqueByLearningPoint(uniqueByQuestionId(matchingQuestions)));
}

function buildTopicPracticeQuestions(section: KnowledgeSection) {
  const topicBank = buildTopicPracticeBank(section);
  const quizSize = getTopicPracticeSize(topicBank.length);
  const usedLearningPoints = new Set(readTopicPracticeHistory(section));
  const freshQuestions = topicBank.filter((question) => !usedLearningPoints.has(getQuestionLearningPointId(question)));

  if (freshQuestions.length >= quizSize) {
    const selectedQuestions = spreadQuestionsByTopic(freshQuestions).slice(0, quizSize);
    storeTopicPracticeHistory(section, selectedQuestions, topicBank);
    return selectedQuestions;
  }

  const selectedFreshQuestions = spreadQuestionsByTopic(freshQuestions);
  const freshIds = new Set(selectedFreshQuestions.map(getQuestionLearningPointId));
  const resetQuestions = spreadQuestionsByTopic(topicBank.filter((question) => !freshIds.has(getQuestionLearningPointId(question))));
  const selectedQuestions = [...selectedFreshQuestions, ...resetQuestions].slice(0, quizSize);
  storeTopicPracticeHistory(section, selectedQuestions, topicBank, { restartCycle: true });
  return selectedQuestions;
}

function getPrimaryOfficialSource(section: KnowledgeSection) {
  return section.officialSources[0];
}

function getQuestionBankCompletionIndex(selectedQuestions: MockQuestion[]) {
  if (typeof window === "undefined") return null;

  const bankIds = new Set(mockQuestionBank.map(getQuestionId));
  const coveredIds = new Set(readMockHistory().filter((id) => bankIds.has(id)));
  if (coveredIds.size >= MOCK_BANK_SIZE) return 0;

  for (let index = 0; index < selectedQuestions.length; index += 1) {
    coveredIds.add(getQuestionId(selectedQuestions[index]));
    if (coveredIds.size >= MOCK_BANK_SIZE) return index;
  }

  return null;
}








function MockQuestionDiagram({ visual }: { visual?: MockQuestionVisual }) {
  if (!visual) return null;

  const titles: Record<MockQuestionVisual, string> = {
    "priority-crossroads": "Crossroads priority diagram",
    "roundabout-priority": "Mini-roundabout priority diagram",
    "no-entry-sign": "No entry road sign diagram",
    "dual-carriageway-gap": "Dual carriageway central reservation diagram",
    "motorway-red-x": "Motorway lane closed signal diagram",
    "amber-roadworks": "Amber roadworks beacon diagram",
    "box-junction": "Yellow box junction diagram",
    "zebra-crossing": "Zebra crossing diagram",
    "school-patrol": "School crossing patrol stop sign diagram",
    "keep-left-sign": "Keep left road sign diagram",
    "speed-limit-sign": "Speed limit road sign diagram",
    "no-overtaking-sign": "No overtaking road sign diagram",
    "give-way-sign": "Give way road sign diagram",
    "stop-sign": "Stop road sign diagram",
    "toucan-crossing": "Toucan crossing diagram",
    "level-crossing-barrier": "Level crossing barrier diagram",
    "no-motor-vehicles": "No motor vehicles road sign diagram",
    "slippery-road-sign": "Slippery road warning sign diagram",
    "height-restriction": "Height restriction road sign diagram",
    "bus-lane-times": "Bus lane time plate diagram",
    "priority-narrow-road": "Priority through narrow road sign diagram",
    "cycle-route-sign": "Cycle route road sign diagram",
    "cattle-warning": "Cattle warning road sign diagram",
    "traffic-light-amber": "Traffic light amber signal diagram",
    "mini-roundabout-sign": "Mini-roundabout road sign diagram"
  };

  return (
    <figure className="mt-6 overflow-hidden rounded border border-zinc-200 bg-white shadow-sm">
      <svg viewBox="0 0 640 380" role="img" aria-label={titles[visual]} className="block h-auto w-full bg-[#e9f2e4]">
        {visual === "priority-crossroads" ? (
          <>
            <rect x="250" y="0" width="140" height="380" fill="#686f76" />
            <rect x="0" y="135" width="640" height="110" fill="#686f76" />
            <rect x="315" y="10" width="8" height="55" fill="#f8d44c" />
            <rect x="315" y="90" width="8" height="55" fill="#f8d44c" />
            <rect x="315" y="250" width="8" height="55" fill="#f8d44c" />
            <rect x="315" y="330" width="8" height="45" fill="#f8d44c" />
            <path d="M320 310 C320 230 410 235 492 190" fill="none" stroke="#1d77c3" strokeWidth="12" strokeLinecap="round" />
            <path d="M490 190 l-24 -10 l10 25" fill="none" stroke="#1d77c3" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M320 70 L320 304" fill="none" stroke="#f2b705" strokeWidth="12" strokeLinecap="round" />
            <path d="M320 304 l-18 -25 l36 0" fill="none" stroke="#f2b705" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="280" y="258" width="58" height="82" rx="13" fill="#1677c8" stroke="#0f3e66" strokeWidth="4" />
            <text x="309" y="306" textAnchor="middle" fontSize="30" fontWeight="900" fill="white">A</text>
            <rect x="289" y="45" width="62" height="88" rx="13" fill="#e7b927" stroke="#795d00" strokeWidth="4" />
            <text x="320" y="98" textAnchor="middle" fontSize="30" fontWeight="900" fill="#111">B</text>
          </>
        ) : null}

        {visual === "roundabout-priority" ? (
          <>
            <rect x="0" y="145" width="640" height="90" fill="#626970" />
            <rect x="275" y="0" width="90" height="380" fill="#626970" />
            <circle cx="320" cy="190" r="102" fill="#626970" />
            <circle cx="320" cy="190" r="50" fill="#7da44a" />
            <circle cx="320" cy="190" r="112" fill="none" stroke="#f4f4f5" strokeWidth="8" strokeDasharray="18 16" />
            <path d="M105 190 C168 190 191 190 228 190" fill="none" stroke="#1d77c3" strokeWidth="12" strokeLinecap="round" />
            <path d="M228 190 l-24 -12 l0 24" fill="none" stroke="#1d77c3" strokeWidth="12" strokeLinecap="round" />
            <path d="M512 120 C445 117 399 140 375 175" fill="none" stroke="#d61f2c" strokeWidth="12" strokeLinecap="round" />
            <path d="M375 175 l9 -27 l20 20" fill="none" stroke="#d61f2c" strokeWidth="12" strokeLinecap="round" />
            <rect x="87" y="161" width="82" height="48" rx="12" fill="#1677c8" stroke="#0f3e66" strokeWidth="4" />
            <text x="128" y="194" textAnchor="middle" fontSize="25" fontWeight="900" fill="white">A</text>
            <rect x="468" y="92" width="84" height="48" rx="12" fill="#d61f2c" stroke="#7f1d1d" strokeWidth="4" />
            <text x="510" y="125" textAnchor="middle" fontSize="25" fontWeight="900" fill="white">B</text>
          </>
        ) : null}

        {visual === "no-entry-sign" ? (
          <>
            <rect x="0" y="0" width="640" height="380" fill="#e8f0e1" />
            <rect x="0" y="270" width="640" height="110" fill="#5f6872" />
            <rect x="309" y="272" width="22" height="76" rx="6" fill="#4b5563" />
            <circle cx="320" cy="164" r="111" fill="#dc2626" />
            <rect x="223" y="135" width="194" height="58" rx="7" fill="#ffffff" />
            <circle cx="320" cy="164" r="111" fill="none" stroke="#b91c1c" strokeWidth="4" />
          </>
        ) : null}

        {visual === "dual-carriageway-gap" ? (
          <>
            <rect x="0" y="0" width="640" height="380" fill="#dbe9cf" />
            <rect x="0" y="70" width="640" height="106" fill="#5f6872" />
            <rect x="0" y="218" width="640" height="106" fill="#5f6872" />
            <rect x="0" y="176" width="640" height="42" fill="#7da44a" />
            <rect x="300" y="176" width="92" height="42" fill="#dbeafe" stroke="#1d4ed8" strokeWidth="5" />
            <line x1="36" y1="123" x2="604" y2="123" stroke="#facc15" strokeWidth="7" strokeDasharray="38 26" />
            <line x1="36" y1="271" x2="604" y2="271" stroke="#facc15" strokeWidth="7" strokeDasharray="38 26" />
            <path d="M105 271 H346 V197 H516" fill="none" stroke="#1d77c3" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M516 197 l-26 -13 l9 29" fill="none" stroke="#1d77c3" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="92" y="244" width="88" height="54" rx="13" fill="#1677c8" stroke="#0f3e66" strokeWidth="4" />
            <rect x="430" y="92" width="94" height="50" rx="11" fill="#f59e0b" stroke="#92400e" strokeWidth="4" />
            <rect x="146" y="245" width="94" height="50" rx="11" fill="#f59e0b" stroke="#92400e" strokeWidth="4" />
          </>
        ) : null}

        {visual === "motorway-red-x" ? (
          <>
            <rect x="0" y="0" width="640" height="380" fill="#59616b" />
            <rect x="0" y="245" width="640" height="135" fill="#3f464f" />
            <line x1="214" y1="245" x2="214" y2="380" stroke="#f8fafc" strokeWidth="7" strokeDasharray="22 22" />
            <line x1="426" y1="245" x2="426" y2="380" stroke="#f8fafc" strokeWidth="7" strokeDasharray="22 22" />
            <rect x="94" y="44" width="452" height="126" rx="18" fill="#111827" stroke="#374151" strokeWidth="8" />
            <text x="162" y="126" textAnchor="middle" fontSize="68" fontWeight="900" fill="#ef4444">X</text>
            <path d="M318 77 v66 M292 111 h52" stroke="#22c55e" strokeWidth="20" strokeLinecap="round" />
            <path d="M494 77 v66 M468 111 h52" stroke="#22c55e" strokeWidth="20" strokeLinecap="round" />
            <rect x="70" y="288" width="96" height="54" rx="14" fill="#1677c8" />
            <rect x="288" y="292" width="96" height="54" rx="14" fill="#e5e7eb" />
            <rect x="488" y="292" width="96" height="54" rx="14" fill="#ef4444" />
          </>
        ) : null}

        {visual === "amber-roadworks" ? (
          <>
            <rect x="0" y="0" width="640" height="380" fill="#4b5563" />
            <rect x="0" y="145" width="640" height="90" fill="#5f6872" />
            <line x1="50" y1="190" x2="590" y2="190" stroke="#f8fafc" strokeWidth="7" strokeDasharray="28 24" />
            <rect x="86" y="62" width="112" height="72" rx="18" fill="#111827" />
            <circle cx="142" cy="98" r="24" fill="#f59e0b" />
            <circle cx="142" cy="98" r="38" fill="none" stroke="#fbbf24" strokeWidth="8" opacity="0.5" />
            {[270, 340, 410, 480].map((x) => (
              <g key={x}>
                <path d={`M${x} 258 l26 -84 l26 84 z`} fill="#f97316" />
                <rect x={x + 10} y="220" width="32" height="10" fill="white" />
              </g>
            ))}
            <rect x="76" y="235" width="118" height="54" rx="12" fill="#f59e0b" stroke="#92400e" strokeWidth="4" />
          </>
        ) : null}

        {visual === "box-junction" ? (
          <>
            <rect x="0" y="0" width="640" height="380" fill="#dfead6" />
            <rect x="0" y="124" width="640" height="132" fill="#606871" />
            <rect x="254" y="0" width="132" height="380" fill="#606871" />
            <rect x="254" y="124" width="132" height="132" fill="#4b5563" stroke="#facc15" strokeWidth="8" />
            {Array.from({ length: 8 }).map((_, index) => (
              <line key={`box-a-${index}`} x1={254 + index * 20} y1="124" x2={386} y2={256 - index * 20} stroke="#facc15" strokeWidth="5" />
            ))}
            {Array.from({ length: 8 }).map((_, index) => (
              <line key={`box-b-${index}`} x1={254 + index * 20} y1="256" x2={386} y2={124 + index * 20} stroke="#facc15" strokeWidth="5" />
            ))}
            <line x1="0" y1="190" x2="640" y2="190" stroke="#f8fafc" strokeWidth="5" strokeDasharray="26 24" opacity="0.75" />
            <line x1="320" y1="0" x2="320" y2="380" stroke="#f8fafc" strokeWidth="5" strokeDasharray="26 24" opacity="0.75" />
            <rect x="424" y="164" width="96" height="52" rx="13" fill="#e5e7eb" stroke="#cbd5e1" strokeWidth="3" />
            <rect x="118" y="164" width="96" height="52" rx="13" fill="#1677c8" stroke="#0f3e66" strokeWidth="3" />
          </>
        ) : null}

        {visual === "zebra-crossing" ? (
          <>
            <rect x="0" y="0" width="640" height="380" fill="#b5cd8f" />
            <rect x="0" y="60" width="640" height="260" fill="#5f6872" />
            <rect x="0" y="0" width="640" height="60" fill="#d7e7c6" />
            <rect x="0" y="320" width="640" height="60" fill="#d7e7c6" />
            <rect x="238" y="60" width="26" height="260" fill="#ffffff" />
            <rect x="286" y="60" width="26" height="260" fill="#ffffff" />
            <rect x="334" y="60" width="26" height="260" fill="#ffffff" />
            <rect x="382" y="60" width="26" height="260" fill="#ffffff" />
            {[82, 124, 258, 300].map((x) => (
              <g key={`zig-${x}`} stroke="#f8fafc" strokeWidth="5" fill="none" opacity="0.95">
                <path d={`M${x} 79 l22 18 l-22 18 l22 18 l-22 18`} />
                <path d={`M${x} 229 l22 18 l-22 18 l22 18 l-22 18`} />
              </g>
            ))}
            <rect x="120" y="248" width="86" height="48" rx="12" fill="#1677c8" stroke="#0f3e66" strokeWidth="4" />
            <g>
              <rect x="188" y="48" width="10" height="86" fill="#111827" />
              <circle cx="193" cy="42" r="18" fill="#facc15" stroke="#111827" strokeWidth="5" />
              <rect x="438" y="246" width="10" height="86" fill="#111827" />
              <circle cx="443" cy="240" r="18" fill="#facc15" stroke="#111827" strokeWidth="5" />
            </g>
            <circle cx="462" cy="286" r="16" fill="#111827" />
            <rect x="453" y="304" width="18" height="42" rx="9" fill="#111827" />
            <path d="M470 342 l22 22 M454 342 l-19 22" stroke="#111827" strokeWidth="8" strokeLinecap="round" />
          </>
        ) : null}

        {visual === "school-patrol" ? (
          <>
            <rect x="0" y="0" width="640" height="380" fill="#fef3c7" />
            <rect x="0" y="238" width="640" height="142" fill="#606871" />
            <rect x="300" y="122" width="14" height="172" rx="7" fill="#111827" />
            <circle cx="307" cy="100" r="58" fill="#facc15" stroke="#dc2626" strokeWidth="8" />
            <circle cx="307" cy="100" r="48" fill="none" stroke="#111827" strokeWidth="3" />
            <text x="307" y="90" textAnchor="middle" fontSize="22" fontWeight="900" fill="#111827">STOP</text>
            <text x="307" y="119" textAnchor="middle" fontSize="15" fontWeight="900" fill="#111827">CHILDREN</text>
            <rect x="80" y="272" width="96" height="52" rx="13" fill="#1677c8" stroke="#0f3e66" strokeWidth="4" />
            <circle cx="458" cy="214" r="18" fill="#111827" />
            <rect x="448" y="232" width="20" height="56" rx="10" fill="#111827" />
            <path d="M468 285 l24 26 M448 285 l-22 26" stroke="#111827" strokeWidth="8" strokeLinecap="round" />
          </>
        ) : null}

        {visual === "keep-left-sign" ? (
          <>
            <rect x="0" y="0" width="640" height="380" fill="#f8fafc" />
            <circle cx="320" cy="178" r="112" fill="#2563eb" />
            <path d="M382 96 L260 218" stroke="white" strokeWidth="34" strokeLinecap="round" />
            <path d="M260 218 L262 150 M260 218 L328 216" stroke="white" strokeWidth="34" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="276" y="276" width="88" height="24" rx="10" fill="#9ca3af" />
          </>
        ) : null}

        {visual === "speed-limit-sign" ? (
          <>
            <rect x="0" y="0" width="640" height="380" fill="#f8fafc" />
            <circle cx="320" cy="178" r="116" fill="white" stroke="#dc2626" strokeWidth="22" />
            <text x="320" y="207" textAnchor="middle" fontSize="96" fontWeight="900" fill="#111827">30</text>
            <rect x="286" y="290" width="68" height="28" rx="10" fill="#9ca3af" />
          </>
        ) : null}

        {visual === "no-overtaking-sign" ? (
          <>
            <rect x="0" y="0" width="640" height="380" fill="#f8fafc" />
            <circle cx="320" cy="178" r="118" fill="white" stroke="#dc2626" strokeWidth="22" />
            <path d="M230 181 h16 l18 -30 h50 l22 30 h16 v35 H230 Z" fill="#111827" />
            <path d="M292 156 h18 l13 25 h-47 Z" fill="white" opacity="0.75" />
            <circle cx="260" cy="219" r="15" fill="#111827" />
            <circle cx="322" cy="219" r="15" fill="#111827" />
            <path d="M334 181 h16 l18 -30 h50 l22 30 h16 v35 H334 Z" fill="#dc2626" />
            <path d="M396 156 h18 l13 25 h-47 Z" fill="white" opacity="0.75" />
            <circle cx="364" cy="219" r="15" fill="#111827" />
            <circle cx="426" cy="219" r="15" fill="#111827" />
          </>
        ) : null}

        {visual === "give-way-sign" ? (
          <>
            <rect x="0" y="0" width="640" height="380" fill="#f8fafc" />
            <polygon points="320,300 170,64 470,64" fill="#dc2626" />
            <polygon points="320,254 219,94 421,94" fill="#ffffff" />
            <text x="320" y="166" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontSize="38" fontWeight="900" fill="#111827">GIVE</text>
            <text x="320" y="211" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontSize="38" fontWeight="900" fill="#111827">WAY</text>
            <rect x="306" y="298" width="28" height="48" rx="8" fill="#6b7280" />
          </>
        ) : null}

        {visual === "stop-sign" ? (
          <>
            <rect x="0" y="0" width="640" height="380" fill="#f8fafc" />
            <path d="M275 70 H365 L430 135 V225 L365 290 H275 L210 225 V135 Z" fill="#dc2626" stroke="white" strokeWidth="10" />
            <text x="320" y="202" textAnchor="middle" fontSize="68" fontWeight="900" fill="white">STOP</text>
            <rect x="306" y="290" width="28" height="48" rx="10" fill="#6b7280" />
            <line x1="130" y1="340" x2="510" y2="340" stroke="#111827" strokeWidth="9" strokeLinecap="round" />
          </>
        ) : null}

        {visual === "toucan-crossing" ? (
          <>
            <rect x="0" y="0" width="640" height="380" fill="#a7c17a" />
            <rect x="130" y="0" width="380" height="380" fill="#606871" />
            {[95, 136, 177, 218, 259].map((y) => (
              <rect key={y} x="130" y={y} width="380" height="18" fill="white" />
            ))}
            <rect x="62" y="70" width="74" height="150" rx="16" fill="#111827" />
            <circle cx="99" cy="112" r="21" fill="#ef4444" />
            <circle cx="99" cy="178" r="21" fill="#22c55e" />
            <circle cx="540" cy="112" r="18" fill="#111827" />
            <rect x="530" y="130" width="20" height="56" rx="10" fill="#111827" />
            <circle cx="555" cy="246" r="15" fill="#111827" />
            <circle cx="592" cy="246" r="15" fill="#111827" />
            <path d="M555 246 L580 220 L592 246" fill="none" stroke="#111827" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
          </>
        ) : null}

        {visual === "level-crossing-barrier" ? (
          <>
            <rect x="0" y="0" width="640" height="380" fill="#dbeafe" />
            <rect x="0" y="230" width="640" height="150" fill="#606871" />
            <rect x="0" y="150" width="640" height="52" fill="#7f5539" />
            <line x1="0" y1="162" x2="640" y2="162" stroke="#111827" strokeWidth="8" />
            <line x1="0" y1="190" x2="640" y2="190" stroke="#111827" strokeWidth="8" />
            <rect x="108" y="118" width="358" height="22" rx="8" fill="white" stroke="#dc2626" strokeWidth="6" transform="rotate(18 108 118)" />
            <rect x="112" y="132" width="28" height="145" rx="8" fill="#111827" />
            <rect x="492" y="74" width="72" height="118" rx="14" fill="#111827" />
            <circle cx="528" cy="110" r="17" fill="#ef4444" />
            <circle cx="528" cy="156" r="17" fill="#ef4444" opacity="0.75" />
          </>
        ) : null}

        {visual === "no-motor-vehicles" ? (
          <>
            <rect x="0" y="0" width="640" height="380" fill="#f8fafc" />
            <circle cx="320" cy="178" r="118" fill="white" stroke="#dc2626" strokeWidth="22" />
            <path d="M245 208 h34 l22 -32 h38 l18 32 h38 v33 H245 Z" fill="#111827" />
            <path d="M301 181 h31 l12 27 h-62 Z" fill="white" opacity="0.75" />
            <circle cx="278" cy="244" r="14" fill="#111827" />
            <circle cx="362" cy="244" r="14" fill="#111827" />
            <circle cx="266" cy="151" r="23" fill="none" stroke="#111827" strokeWidth="11" />
            <circle cx="374" cy="151" r="23" fill="none" stroke="#111827" strokeWidth="11" />
            <path d="M266 151 h47 l28 -37 h32" fill="none" stroke="#111827" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M323 116 l20 35 h31" fill="none" stroke="#111827" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="316" cy="99" r="12" fill="#111827" />
            <path d="M316 112 l-20 26" stroke="#111827" strokeWidth="10" strokeLinecap="round" />
          </>
        ) : null}

        {visual === "slippery-road-sign" ? (
          <>
            <rect x="0" y="0" width="640" height="380" fill="#f8fafc" />
            <path d="M320 64 L464 306 H176 Z" fill="white" stroke="#dc2626" strokeWidth="16" strokeLinejoin="round" />
            <rect x="260" y="160" width="120" height="50" rx="14" fill="#111827" />
            <circle cx="282" cy="216" r="13" fill="#111827" />
            <circle cx="358" cy="216" r="13" fill="#111827" />
            <path d="M250 252 C290 224 325 284 370 250 C392 235 410 245 432 264" fill="none" stroke="#111827" strokeWidth="10" strokeLinecap="round" />
          </>
        ) : null}

        {visual === "height-restriction" ? (
          <>
            <rect x="0" y="0" width="640" height="380" fill="#e5e7eb" />
            <rect x="144" y="82" width="352" height="172" rx="18" fill="#9ca3af" />
            <rect x="206" y="144" width="228" height="118" rx="10" fill="#111827" />
            <circle cx="320" cy="178" r="74" fill="white" stroke="#dc2626" strokeWidth="14" />
            <text x="320" y="190" textAnchor="middle" fontSize="44" fontWeight="900" fill="#111827">7'0"</text>
            <rect x="238" y="284" width="164" height="52" rx="13" fill="#1677c8" />
          </>
        ) : null}

        {visual === "bus-lane-times" ? (
          <>
            <rect x="0" y="0" width="640" height="380" fill="#f8fafc" />
            <rect x="172" y="46" width="296" height="260" rx="14" fill="white" stroke="#111827" strokeWidth="8" />
            <rect x="198" y="72" width="244" height="80" rx="8" fill="#2563eb" />
            <path d="M236 103 h44 q18 0 18 18 v18 h-80 v-18 q0-18 18-18z" fill="white" />
            <circle cx="236" cy="144" r="7" fill="#2563eb" />
            <circle cx="280" cy="144" r="7" fill="#2563eb" />
            <text x="352" y="124" textAnchor="middle" fontSize="34" fontWeight="900" fill="white">BUS</text>
            <text x="320" y="190" textAnchor="middle" fontSize="29" fontWeight="900" fill="#111827">Mon - Fri</text>
            <text x="320" y="231" textAnchor="middle" fontSize="29" fontWeight="900" fill="#111827">7 - 10 am</text>
            <text x="320" y="270" textAnchor="middle" fontSize="25" fontWeight="900" fill="#111827">4 - 7 pm</text>
            <rect x="306" y="306" width="28" height="42" rx="10" fill="#6b7280" />
          </>
        ) : null}

        {visual === "priority-narrow-road" ? (
          <>
            <rect x="0" y="0" width="640" height="380" fill="#f8fafc" />
            <rect x="206" y="54" width="228" height="244" rx="18" fill="#2563eb" />
            <path d="M286 248 V118" stroke="white" strokeWidth="32" strokeLinecap="round" />
            <path d="M286 118 l-36 46 M286 118 l36 46" stroke="white" strokeWidth="32" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M360 118 V248" stroke="#dc2626" strokeWidth="24" strokeLinecap="round" />
            <path d="M360 248 l-28 -36 M360 248 l28 -36" stroke="#dc2626" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="306" y="298" width="28" height="48" rx="10" fill="#6b7280" />
          </>
        ) : null}

        {visual === "cycle-route-sign" ? (
          <>
            <rect x="0" y="0" width="640" height="380" fill="#f8fafc" />
            <circle cx="320" cy="178" r="112" fill="#2563eb" />
            <circle cx="272" cy="208" r="30" fill="none" stroke="white" strokeWidth="14" />
            <circle cx="382" cy="208" r="30" fill="none" stroke="white" strokeWidth="14" />
            <path d="M272 208 L318 150 L346 208 M318 150 L384 150" stroke="white" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <rect x="306" y="284" width="28" height="48" rx="10" fill="#6b7280" />
          </>
        ) : null}

        {visual === "cattle-warning" ? (
          <>
            <rect x="0" y="0" width="640" height="380" fill="#f8fafc" />
            <path d="M320 64 L464 306 H176 Z" fill="white" stroke="#dc2626" strokeWidth="16" strokeLinejoin="round" />
            <ellipse cx="320" cy="184" rx="72" ry="42" fill="#111827" />
            <circle cx="258" cy="176" r="28" fill="#111827" />
            <path d="M238 154 C218 126 204 130 224 162" fill="none" stroke="#111827" strokeWidth="10" strokeLinecap="round" />
            <path d="M278 154 C298 126 312 130 292 162" fill="none" stroke="#111827" strokeWidth="10" strokeLinecap="round" />
            {[280, 310, 350, 380].map((x) => (
              <line key={x} x1={x} y1="218" x2={x - 10} y2="264" stroke="#111827" strokeWidth="12" strokeLinecap="round" />
            ))}
          </>
        ) : null}

        {visual === "traffic-light-amber" ? (
          <>
            <rect x="0" y="0" width="640" height="380" fill="#e5e7eb" />
            <rect x="266" y="42" width="108" height="258" rx="24" fill="#111827" />
            <circle cx="320" cy="100" r="31" fill="#3f1d1d" />
            <circle cx="320" cy="171" r="31" fill="#f59e0b" />
            <circle cx="320" cy="242" r="31" fill="#12351f" />
            <rect x="304" y="300" width="32" height="50" rx="10" fill="#6b7280" />
            <line x1="118" y1="342" x2="522" y2="342" stroke="#111827" strokeWidth="8" strokeLinecap="round" />
          </>
        ) : null}

        {visual === "mini-roundabout-sign" ? (
          <>
            <rect x="0" y="0" width="640" height="380" fill="#f8fafc" />
            <circle cx="320" cy="178" r="112" fill="#2563eb" />
            <path d="M320 105 C382 111 410 178 374 226" fill="none" stroke="white" strokeWidth="24" strokeLinecap="round" />
            <path d="M374 226 l-4 -42 l37 20" stroke="white" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <path d="M384 222 C342 270 262 252 242 190" fill="none" stroke="white" strokeWidth="24" strokeLinecap="round" />
            <path d="M242 190 l36 21 l-2 -42" stroke="white" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <path d="M242 177 C247 118 292 96 336 106" fill="none" stroke="white" strokeWidth="24" strokeLinecap="round" />
            <path d="M336 106 l-34 25 l41 13" stroke="white" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <rect x="306" y="284" width="28" height="48" rx="10" fill="#6b7280" />
          </>
        ) : null}
      </svg>
    </figure>
  );
}


export function TheoryTestSuite({
  hazardVideoEnabled = false,
  currentLearnerPackageId = "learner",
}: {
  hazardVideoEnabled?: boolean;
  currentLearnerPackageId?: LearnerPackageId;
}) {
  const [activeView, setActiveView] = useState<ViewKey>("prepare");
  const [mockStarted, setMockStarted] = useState(false);
  const [currentMockIndex, setCurrentMockIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [timer, setTimer] = useState(MOCK_TEST_SECONDS);
  const [submitted, setSubmitted] = useState(false);
  const [reviewQuestionIndex, setReviewQuestionIndex] = useState<number | null>(null);
  const [sessionQuestions, setSessionQuestions] = useState<MockQuestion[]>(() => shuffleQuestions(mockQuestionBank).slice(0, MOCK_TEST_SIZE));
  const [flaggedQuestions, setFlaggedQuestions] = useState<Record<number, boolean>>({});
  const [revealedAnswers, setRevealedAnswers] = useState<Record<number, boolean>>({});
  const [bankCoverageCount, setBankCoverageCount] = useState(0);
  const [bankCycleNoticeIndex, setBankCycleNoticeIndex] = useState<number | null>(null);
  const [topicPracticeTitle, setTopicPracticeTitle] = useState<string | null>(null);
  const [booked, setBooked] = useState(false);
  const [allowanceMessage, setAllowanceMessage] = useState("");
  const [allowanceSnapshots, setAllowanceSnapshots] = useState<PracticeAllowanceSnapshots>(() => getAllowanceSnapshots(currentLearnerPackageId));
  const isQuizExperience = activeView === "mock" || activeView === "topic-quiz";

  useEffect(() => {
    setBankCoverageCount(getMockHistoryCoverage());
  }, []);

  useEffect(() => {
    setAllowanceSnapshots(getAllowanceSnapshots(currentLearnerPackageId));
  }, [currentLearnerPackageId]);

  function refreshAllowanceSnapshots() {
    setAllowanceSnapshots(getAllowanceSnapshots(currentLearnerPackageId));
  }

  function updateAllowanceSnapshot(allowanceKey: LearnerAllowanceKey, snapshot: PracticeAllowanceSnapshot) {
    setAllowanceSnapshots((current) => ({ ...current, [allowanceKey]: snapshot }));
  }

  useEffect(() => {
    if (!isQuizExperience || !mockStarted || submitted || timer <= 0) return;
    const interval = window.setInterval(() => setTimer((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(interval);
  }, [isQuizExperience, mockStarted, submitted, timer]);

  useEffect(() => {
    if (timer === 0) setSubmitted(true);
  }, [timer]);



  const score = useMemo(() => sessionQuestions.reduce((total, question, index) => total + (answers[index] === question.correctIndex ? 1 : 0), 0), [answers, sessionQuestions]);
  const currentMockQuestion = sessionQuestions[currentMockIndex] ?? sessionQuestions[0] ?? mockQuestionBank[0];
  const reviewQuestion = reviewQuestionIndex === null ? null : sessionQuestions[reviewQuestionIndex];
  const reviewAnswer = reviewQuestionIndex === null ? undefined : answers[reviewQuestionIndex];
  const answeredCount = Object.keys(answers).length;
  const flaggedCount = Object.values(flaggedQuestions).filter(Boolean).length;
  const mockQuestionCount = sessionQuestions.length || MOCK_TEST_SIZE;
  const mockProgress = Math.round(((currentMockIndex + 1) / mockQuestionCount) * 100);
  const hasCompletedQuestionBank = bankCoverageCount >= MOCK_BANK_SIZE;
  const showBankCycleNotice = bankCycleNoticeIndex !== null && currentMockIndex >= bankCycleNoticeIndex;
  const currentAnswer = answers[currentMockIndex];
  const isCurrentRevealed = Boolean(revealedAnswers[currentMockIndex]);
  const hasCurrentAnswer = currentAnswer !== undefined;
  const isFinalMockQuestion = currentMockIndex === mockQuestionCount - 1;
  const hasAnsweredEveryMockQuestion = answeredCount === mockQuestionCount;
  const isTopicPractice = topicPracticeTitle !== null;
  const currentQuizSeconds = isTopicPractice ? TOPIC_PRACTICE_SECONDS : MOCK_TEST_SECONDS;
  const mockTimeTaken = currentQuizSeconds - timer;
  const currentPassMark = isTopicPractice ? Math.ceil(mockQuestionCount * 0.75) : MOCK_PASS_MARK;
  const passedMock = score >= currentPassMark;
  const incorrectTopicQuestions = isTopicPractice
    ? sessionQuestions
        .map((question, index) => ({ question, answer: answers[index], index }))
        .filter((item) => item.answer !== item.question.correctIndex)
    : [];

  function beginMockSession(options?: { questions?: MockQuestion[]; topicTitle?: string }) {
    const nextSessionQuestions = options?.questions ?? buildMockSessionQuestions();
    const completionIndex = options?.topicTitle ? null : getQuestionBankCompletionIndex(nextSessionQuestions);
    const nextCoverageCount = options?.topicTitle ? bankCoverageCount : storeMockHistory(nextSessionQuestions);
    setSessionQuestions(nextSessionQuestions);
    setBankCoverageCount(nextCoverageCount);
    setBankCycleNoticeIndex(options?.topicTitle ? null : nextCoverageCount >= MOCK_BANK_SIZE ? completionIndex ?? 0 : null);
    setTopicPracticeTitle(options?.topicTitle ?? null);
    setMockStarted(true);
    setCurrentMockIndex(0);
    setAnswers({});
    setTimer(options?.topicTitle ? TOPIC_PRACTICE_SECONDS : MOCK_TEST_SECONDS);
    setSubmitted(false);
    setReviewQuestionIndex(null);
    setFlaggedQuestions({});
    setRevealedAnswers({});
  }

  function startMock() {
    const allowance = getPracticeAllowanceSnapshot(currentLearnerPackageId, "fullTheoryMocksPerDay");
    if (!allowance.allowed) {
      setAllowanceMessage(`You have used today's ${allowance.limit} mock theory test allowance for this plan. The allowance resets at 00:00 UK time.`);
      return;
    }
    updateAllowanceSnapshot("fullTheoryMocksPerDay", consumePracticeAllowance(currentLearnerPackageId, "fullTheoryMocksPerDay"));
    setAllowanceMessage("");
    beginMockSession();
  }

  function startTopicPractice(section: KnowledgeSection) {
    const allowance = getPracticeAllowanceSnapshot(currentLearnerPackageId, "topicQuizzesPerDay");
    if (!allowance.allowed) {
      setAllowanceMessage(`You have used today's ${allowance.limit} topic quiz allowance for this plan. The allowance resets at 00:00 UK time.`);
      return;
    }
    updateAllowanceSnapshot("topicQuizzesPerDay", consumePracticeAllowance(currentLearnerPackageId, "topicQuizzesPerDay"));
    setAllowanceMessage("");
    beginMockSession({ questions: buildTopicPracticeQuestions(section), topicTitle: section.title });
    setActiveView("topic-quiz");
  }

  function consumeTheoryAllowance(allowanceKey: "fullTheoryMocksPerDay" | "topicQuizzesPerDay") {
    const allowance = getPracticeAllowanceSnapshot(currentLearnerPackageId, allowanceKey);
    const label = allowanceKey === "fullTheoryMocksPerDay" ? "mock theory test" : "topic quiz";

    if (!allowance.allowed) {
      setAllowanceMessage(`You have used today's ${allowance.limit} ${label} allowance for this plan. The allowance resets at 00:00 UK time.`);
      return false;
    }

    updateAllowanceSnapshot(allowanceKey, consumePracticeAllowance(currentLearnerPackageId, allowanceKey));
    setAllowanceMessage("");
    return true;
  }

  function clearTopicPractice() {
    setTopicPracticeTitle(null);
    setMockStarted(false);
    setCurrentMockIndex(0);
    setAnswers({});
    setTimer(MOCK_TEST_SECONDS);
    setSubmitted(false);
    setReviewQuestionIndex(null);
    setFlaggedQuestions({});
    setRevealedAnswers({});
  }

  function returnToTheoryPreparation() {
    clearTopicPractice();
    setActiveView("prepare");
  }

  function changeTheoryView(key: ViewKey) {
    if (key === "topic-quiz") return;

    if (topicPracticeTitle) {
      clearTopicPractice();
    }

    setActiveView(key);
  }

  function resetMock() {
    if (topicPracticeTitle) {
      const section = knowledgeSections.find((item) => item.title === topicPracticeTitle);
      if (section) {
        if (!consumeTheoryAllowance("topicQuizzesPerDay")) return;
        beginMockSession({ questions: buildTopicPracticeQuestions(section), topicTitle: section.title });
        return;
      }
    }

    if (!consumeTheoryAllowance("fullTheoryMocksPerDay")) return;
    beginMockSession();
  }

  function submitMock() {
    setSubmitted(true);
    setReviewQuestionIndex(null);
    setCurrentMockIndex(mockQuestionCount - 1);
    const nextRevealedAnswers: Record<number, boolean> = {};
    sessionQuestions.forEach((_question, index) => {
      nextRevealedAnswers[index] = true;
    });
    setRevealedAnswers(nextRevealedAnswers);
  }

  function finishMockFromFinalQuestion() {
    if (!isFinalMockQuestion) return;
    submitMock();
  }

  function selectMockAnswer(answerIndex: number) {
    if (submitted) return;
    setAnswers((current) => ({ ...current, [currentMockIndex]: answerIndex }));
  }

  function goToMockQuestion(index: number) {
    setCurrentMockIndex(Math.min(mockQuestionCount - 1, Math.max(0, index)));
  }

  function openReviewQuestion(index: number) {
    setReviewQuestionIndex(Math.min(mockQuestionCount - 1, Math.max(0, index)));
  }

  function toggleMockFlag() {
    setFlaggedQuestions((current) => ({ ...current, [currentMockIndex]: !current[currentMockIndex] }));
  }

  function revealCurrentAnswer() {
    if (!hasCurrentAnswer) return;
    setRevealedAnswers((current) => ({ ...current, [currentMockIndex]: true }));
  }








  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid gap-3 md:grid-cols-4">
        {theoryViews.map(({ key, label, Icon }) => {
          const isActiveTheoryView = activeView === key || (activeView === "topic-quiz" && key === "prepare");

          return (
            <button key={key} type="button" onClick={() => changeTheoryView(key)} className={`rounded border p-4 text-left font-black transition ${isActiveTheoryView ? "border-brand bg-brand text-white" : "border-zinc-200 bg-white text-black hover:ring-2 hover:ring-brand"}`}>
              <Icon className="mb-3" />
              {label}
            </button>
          );
        })}
      </div>

      <div className="mt-4 rounded border border-zinc-200 bg-zinc-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-brand">Current theory allowance</p>
            <p className="mt-1 text-sm font-bold leading-6 text-zinc-600">
              Daily allowances reset at 00:00 UK time. Full hazard mock allowances reset every Monday at 00:00 UK time.
            </p>
          </div>
          <p className="rounded-full border border-zinc-300 bg-white px-3 py-2 text-xs font-black uppercase text-black">
            {currentLearnerPackageId.replace(/-/g, " ")}
          </p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded border border-zinc-200 bg-white p-3">
            <p className="text-xl font-black">{allowanceSnapshots.topicQuizzesPerDay.remaining}</p>
            <p className="mt-1 text-xs font-black uppercase tracking-[0.1em] text-zinc-500">Topic quizzes left today</p>
            <p className="mt-1 text-[11px] font-bold text-zinc-500">of {allowanceSnapshots.topicQuizzesPerDay.limit}</p>
          </div>
          <div className="rounded border border-zinc-200 bg-white p-3">
            <p className="text-xl font-black">{allowanceSnapshots.fullTheoryMocksPerDay.remaining}</p>
            <p className="mt-1 text-xs font-black uppercase tracking-[0.1em] text-zinc-500">Mock theory tests left today</p>
            <p className="mt-1 text-[11px] font-bold text-zinc-500">of {allowanceSnapshots.fullTheoryMocksPerDay.limit}</p>
          </div>
          <div className="rounded border border-zinc-200 bg-white p-3">
            <p className="text-xl font-black">{allowanceSnapshots.individualHazardClipsPerDay.remaining}</p>
            <p className="mt-1 text-xs font-black uppercase tracking-[0.1em] text-zinc-500">Hazard clips left today</p>
            <p className="mt-1 text-[11px] font-bold text-zinc-500">of {allowanceSnapshots.individualHazardClipsPerDay.limit}</p>
          </div>
          <div className="rounded border border-zinc-200 bg-white p-3">
            <p className="text-xl font-black">{allowanceSnapshots.fullHazardMocksPerWeek.remaining}</p>
            <p className="mt-1 text-xs font-black uppercase tracking-[0.1em] text-zinc-500">Full hazard mocks left this week</p>
            <p className="mt-1 text-[11px] font-bold text-zinc-500">of {allowanceSnapshots.fullHazardMocksPerWeek.limit}</p>
          </div>
        </div>
      </div>
      {allowanceMessage ? (
        <div role="alert" className="mt-4 rounded border border-red-200 bg-red-50 p-4 text-sm font-black leading-6 text-red-950">
          {allowanceMessage}
        </div>
      ) : null}

      {activeView === "prepare" ? (
        <div className="mt-6">
          <div className="grid gap-4 md:grid-cols-2">
            {knowledgeSections.map((section) => (
              <article key={section.title} className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl font-black">{section.title}</h2>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={getPrimaryOfficialSource(section).url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-9 items-center justify-center gap-1 rounded-full border border-zinc-300 bg-white px-3 py-2 text-xs font-black text-black transition hover:ring-2 hover:ring-brand"
                    >
                      Start learning <ExternalLink size={14} />
                    </a>
                    <button type="button" onClick={() => startTopicPractice(section)} className="inline-flex min-h-9 items-center justify-center gap-1 rounded-full border border-brand bg-brand px-3 py-2 text-xs font-black text-white transition hover:ring-2 hover:ring-red-100">
                      Take quiz <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
                <div className="mt-4 grid gap-2">
                  {section.points.map((point) => (
                    <div key={point} className="flex items-start gap-2 text-sm font-bold leading-6 text-zinc-700">
                      <CheckCircle2 className="mt-0.5 shrink-0 text-brand" size={16} />
                      {point}
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-xs font-bold leading-5 text-zinc-500">Official source: {getPrimaryOfficialSource(section).label}</p>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {isQuizExperience ? (
        <div className="mt-6 rounded border border-zinc-200 bg-white shadow-sm">
          {activeView === "topic-quiz" && topicPracticeTitle ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50 p-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-brand">Topic quiz</p>
                <h2 className="mt-1 text-2xl font-black">{topicPracticeTitle}</h2>
                <p className="mt-1 text-sm font-bold leading-6 text-zinc-600">
                  Up to ten unique focused questions for this topic. This is separate from the 50-question mock theory test.
                </p>
              </div>
              <button type="button" onClick={returnToTheoryPreparation} className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-black text-black hover:ring-2 hover:ring-brand">
                <ArrowLeft className="mr-1 inline" size={16} /> Back to Get ready
              </button>
            </div>
          ) : null}
          {!mockStarted ? (
            <div className="grid gap-6 p-5 lg:grid-cols-[1fr_340px]">
              <div>
                <p className="inline-flex rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-brand">LDA mock test</p>
                <h2 className="mt-4 text-3xl font-black">Start a 50-question theory mock.</h2>
                <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-zinc-600">
                  This is original LDA practice content built to the DVSA/GOV.UK car theory-test format: 50 multiple-choice questions, 57 minutes, and one question at a time.
                </p>
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <div className="rounded border border-zinc-200 bg-zinc-50 p-4">
                    <p className="text-2xl font-black">{MOCK_TEST_SIZE}</p>
                    <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-zinc-500">Questions</p>
                  </div>
                  <div className="rounded border border-zinc-200 bg-zinc-50 p-4">
                    <p className="text-2xl font-black">57:00</p>
                    <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-zinc-500">Minutes</p>
                  </div>
                  <div className="rounded border border-zinc-200 bg-zinc-50 p-4">
                    <p className="text-2xl font-black">{MOCK_PASS_MARK}/{MOCK_TEST_SIZE}</p>
                    <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-zinc-500">Pass target</p>
                  </div>
                </div>
                <div className="mt-4 rounded border border-zinc-200 bg-zinc-50 p-4">
                  <h3 className="text-sm font-black uppercase tracking-[0.12em] text-zinc-500">DVSA-style coverage standard</h3>
                  <ul className="mt-3 grid gap-2 text-sm font-bold leading-6 text-zinc-700">
                    {theoryStandardPoints.map((point) => (
                      <li key={point} className="flex gap-2">
                        <CheckCircle2 className="mt-0.5 shrink-0 text-brand" size={16} />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <button type="button" onClick={startMock} className="lda-pill lda-pill-sm mt-6">
                  Start test <ArrowRight size={17} />
                </button>
              </div>
              <aside className="rounded border border-red-200 bg-red-50 p-5">
                <Clock3 className="text-brand" />
                <h3 className="mt-4 text-xl font-black">How this works</h3>
                <div className="mt-4 grid gap-3 text-sm font-bold leading-6 text-red-950">
                  <p>Answer each question within the timer, just like a real theory-test practice session.</p>
                  <p>Check an answer straight away, or continue and review your result at the end.</p>
                  <p>Flag anything you want to revisit before submitting the test.</p>
                </div>
              </aside>
            </div>
          ) : (
            <div className={`grid gap-5 p-5 ${isTopicPractice ? "" : "xl:grid-cols-[1fr_320px]"}`}>
              <article className="min-w-0">
                {submitted && reviewQuestion ? (
                  <div className="rounded border border-zinc-200 bg-white p-6">
                    <button type="button" onClick={() => setReviewQuestionIndex(null)} className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-black hover:ring-2 hover:ring-brand">
                      <ArrowLeft className="mr-1 inline" size={16} /> Back to result
                    </button>
                    <p className="mt-5 text-xs font-black uppercase tracking-[0.14em] text-brand">Question {(reviewQuestionIndex ?? 0) + 1} review</p>
                    <h2 className="mt-2 text-2xl font-black">{reviewQuestion.question}</h2>
                    <MockQuestionDiagram visual={reviewQuestion.visual} />
                    <div className="mt-6 grid gap-3">
                      {reviewQuestion.answers.map((answer, answerIndex) => {
                        const isCorrectAnswer = answerIndex === reviewQuestion.correctIndex;
                        const isLearnerAnswer = answerIndex === reviewAnswer;
                        const answerClass = isCorrectAnswer
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : isLearnerAnswer
                            ? "border-red-400 bg-red-50 text-red-950"
                            : "border-zinc-200 bg-zinc-50 text-zinc-700";

                        return (
                          <div key={answer} className={`rounded border px-4 py-4 text-base font-black ${answerClass}`}>
                            <span className="mr-3 inline-flex h-7 w-7 items-center justify-center rounded-full border border-current text-xs">{String.fromCharCode(65 + answerIndex)}</span>
                            {answer}
                            {isCorrectAnswer ? <span className="ml-2 text-xs uppercase">Correct answer</span> : null}
                            {isLearnerAnswer ? <span className="ml-2 text-xs uppercase">Your answer</span> : null}
                          </div>
                        );
                      })}
                    </div>
                    <div className={`mt-5 rounded border p-4 text-sm font-bold leading-6 ${reviewAnswer === reviewQuestion.correctIndex ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-950"}`}>
                      <p className="font-black">{reviewAnswer === reviewQuestion.correctIndex ? "You got this right." : "This one needs review."}</p>
                      <p className="mt-1">{reviewQuestion.explanation}</p>
                    </div>
                    <div className="mt-5 flex flex-wrap gap-3">
                      <button type="button" onClick={() => openReviewQuestion((reviewQuestionIndex ?? 0) - 1)} disabled={reviewQuestionIndex === 0} className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-black hover:ring-2 hover:ring-brand disabled:cursor-not-allowed disabled:opacity-50">
                        <ArrowLeft className="mr-1 inline" size={16} /> Previous review
                      </button>
                      <button type="button" onClick={() => openReviewQuestion((reviewQuestionIndex ?? 0) + 1)} disabled={reviewQuestionIndex === mockQuestionCount - 1} className="lda-pill lda-pill-sm disabled:cursor-not-allowed disabled:opacity-50">
                        Next review <ArrowRight size={16} />
                      </button>
                    </div>
                  </div>
                ) : submitted ? (
                  <div className={`rounded border p-6 ${passedMock ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-950"}`}>
                    <p className="text-sm font-black uppercase tracking-[0.14em]">{isTopicPractice ? "Topic quiz finished" : "Test finished"}</p>
                    <h2 className="mt-3 text-4xl font-black">{score}/{mockQuestionCount}</h2>
                    <p className="mt-3 text-base font-bold leading-7">
                      {isTopicPractice
                        ? passedMock
                          ? `${topicPracticeTitle} looks solid. Move on when you feel ready.`
                          : `Read the official ${topicPracticeTitle} material again, then retake this topic quiz.`
                        : passedMock
                          ? "Pass-standard practice result."
                          : "Keep revising before booking the official test."}
                    </p>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded border border-current/20 bg-white/70 p-4 text-black">
                        <p className="text-2xl font-black">{score}/{mockQuestionCount}</p>
                        <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-zinc-600">Final score</p>
                      </div>
                      <div className="rounded border border-current/20 bg-white/70 p-4 text-black">
                        <p className="text-2xl font-black">{answeredCount}/{mockQuestionCount}</p>
                        <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-zinc-600">Answered</p>
                      </div>
                      <div className="rounded border border-current/20 bg-white/70 p-4 text-black">
                        <p className="text-2xl font-black">{flaggedCount}</p>
                        <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-zinc-600">Flagged</p>
                      </div>
                      <div className="rounded border border-current/20 bg-white/70 p-4 text-black">
                        <p className="text-2xl font-black">{formatTimer(mockTimeTaken)}</p>
                        <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-zinc-600">Time taken</p>
                      </div>
                    </div>
                    {hasCompletedQuestionBank && !isTopicPractice ? (
                      <div className="mt-5 rounded border border-current/20 bg-white/70 p-4 text-sm font-bold leading-6 text-black">
                        <p className="font-black">Thank you for completing the full LDA mock question bank.</p>
                        <p className="mt-1">
                          Your next tests will reshuffle the bank and repeat questions without duplicates in the same mock, helping the questions and answers stick through practice.
                        </p>
                      </div>
                    ) : null}
                    <p className="mt-5 text-sm font-bold leading-6">
                      {isTopicPractice
                        ? `All ${mockQuestionCount} questions were focused on ${topicPracticeTitle}. Review the answers below before retrying or moving to the next topic.`
                        : `All ${mockQuestionCount} questions were included in this submitted mock. Review the answers below before resetting for a fresh shuffled test.`}
                    </p>
                    {isTopicPractice && incorrectTopicQuestions.length > 0 ? (
                      <div className="mt-5 rounded border border-current/20 bg-white/70 p-4 text-sm font-bold leading-6 text-black">
                        <p className="font-black">Review before moving on</p>
                        <p className="mt-1 text-zinc-700">
                          A topic quiz target is {currentPassMark}/{mockQuestionCount}. Re-read the official material if these points are still unclear.
                        </p>
                        <ul className="mt-3 grid gap-2">
                          {incorrectTopicQuestions.slice(0, 5).map(({ question, index }) => (
                            <li key={`${question.question}-${index}`} className="rounded border border-zinc-200 bg-white p-3">
                              <span className="text-xs font-black uppercase tracking-[0.12em] text-brand">Question {index + 1}</span>
                              <p className="mt-1">{question.explanation}</p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    <div className="mt-5 flex flex-wrap gap-3">
                      <button type="button" onClick={resetMock} className="rounded-full border border-current/30 bg-white/80 px-4 py-2 text-sm font-black text-black hover:ring-2 hover:ring-brand">
                        {isTopicPractice ? "Try another topic quiz" : "Try another test"} <RotateCcw className="ml-2 inline" size={16} />
                      </button>
                      {isTopicPractice ? (
                        <button type="button" onClick={returnToTheoryPreparation} className="lda-pill lda-pill-sm">
                          Back to Get ready <ArrowRight size={16} />
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-4">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-brand">
                          {isTopicPractice ? `${topicPracticeTitle} quiz` : "Mock theory test"} · Question {currentMockIndex + 1} of {mockQuestionCount}
                        </p>
                        <h2 className="mt-2 text-2xl font-black">{currentMockQuestion.question}</h2>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-xl font-black text-brand">{formatTimer(timer)}</div>
                        <div className="rounded border border-zinc-200 bg-white px-3 py-2 text-center">
                          <p className="text-sm font-black text-black">{answeredCount}/{mockQuestionCount}</p>
                          <p className="text-[10px] font-black uppercase tracking-[0.1em] text-zinc-500">Answered</p>
                        </div>
                        <div className="rounded border border-zinc-200 bg-white px-3 py-2 text-center">
                          <p className="text-sm font-black text-black">{flaggedCount}</p>
                          <p className="text-[10px] font-black uppercase tracking-[0.1em] text-zinc-500">Flagged</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 h-2 overflow-hidden rounded-full bg-zinc-200">
                      <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${mockProgress}%` }} />
                    </div>

                    {showBankCycleNotice ? (
                      <div className="mt-5 rounded border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold leading-6 text-emerald-900">
                        <p className="font-black">Question bank complete</p>
                        <p className="mt-1">
                          You have now completed every question in the LDA question bank. Future mocks will reshuffle the bank and repeat questions, with no duplicates inside the same test, so the answers build through repetition.
                        </p>
                      </div>
                    ) : null}

                    <MockQuestionDiagram visual={currentMockQuestion.visual} />

                    <div className="mt-6 grid gap-3">
                      {currentMockQuestion.answers.map((answer, answerIndex) => {
                        const isSelected = currentAnswer === answerIndex;
                        const isCorrect = currentMockQuestion.correctIndex === answerIndex;
                        const isWrong = isCurrentRevealed && isSelected && !isCorrect;
                        const answerClass = isCurrentRevealed && isCorrect
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : isWrong || isSelected
                            ? "border-brand bg-brand text-white"
                            : "border-zinc-300 bg-white text-black hover:border-brand hover:ring-2 hover:ring-red-100";

                        return (
                          <button
                            key={answer}
                            type="button"
                            onClick={() => selectMockAnswer(answerIndex)}
                            className={`rounded border px-4 py-4 text-left text-base font-black transition ${answerClass}`}
                          >
                            <span className="mr-3 inline-flex h-7 w-7 items-center justify-center rounded-full border border-current text-xs">{String.fromCharCode(65 + answerIndex)}</span>
                            {answer}
                          </button>
                        );
                      })}
                    </div>

                    {isCurrentRevealed ? (
                      <div className={`mt-5 rounded border p-4 text-sm font-bold leading-6 ${currentAnswer === currentMockQuestion.correctIndex ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-950"}`}>
                        <p className="font-black">{currentAnswer === currentMockQuestion.correctIndex ? "Correct." : "Not quite."}</p>
                        <p className="mt-1">{currentMockQuestion.explanation}</p>
                      </div>
                    ) : null}

                    <div className="mt-6 flex flex-wrap items-center gap-3">
                      <button type="button" onClick={() => goToMockQuestion(currentMockIndex - 1)} disabled={currentMockIndex === 0} className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-black hover:ring-2 hover:ring-brand disabled:cursor-not-allowed disabled:opacity-50">
                        <ArrowLeft className="mr-1 inline" size={16} /> Previous
                      </button>
                      <button type="button" onClick={revealCurrentAnswer} disabled={!hasCurrentAnswer} className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-black hover:ring-2 hover:ring-brand disabled:cursor-not-allowed disabled:opacity-50">
                        Check answer
                      </button>
                      <button type="button" onClick={toggleMockFlag} className={`rounded-full border px-4 py-2 text-sm font-black hover:ring-2 hover:ring-brand ${flaggedQuestions[currentMockIndex] ? "border-amber-300 bg-amber-50 text-amber-900" : "border-zinc-300 bg-white text-black"}`}>
                        <Flag className="mr-1 inline" size={16} /> {flaggedQuestions[currentMockIndex] ? "Flagged" : "Flag"}
                      </button>
                      {currentMockIndex < mockQuestionCount - 1 ? (
                        <button type="button" onClick={() => goToMockQuestion(currentMockIndex + 1)} className="lda-pill lda-pill-sm">
                          Next question <ArrowRight size={16} />
                        </button>
                      ) : (
                        <button type="button" onClick={finishMockFromFinalQuestion} className="lda-pill lda-pill-sm">
                          {isTopicPractice ? "Finish quiz" : "Finish test"} <ArrowRight size={16} />
                        </button>
                      )}
                    </div>
                  </>
                )}
              </article>

              {!isTopicPractice ? (
              <aside className="rounded border border-zinc-200 bg-zinc-50 p-4">
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="rounded border border-zinc-200 bg-white p-3">
                    <p className="text-xl font-black">{answeredCount}/{mockQuestionCount}</p>
                    <p className="mt-1 text-xs font-black uppercase text-zinc-500">Answered</p>
                  </div>
                  <div className="rounded border border-zinc-200 bg-white p-3">
                    <p className="text-xl font-black">{flaggedCount}</p>
                    <p className="mt-1 text-xs font-black uppercase text-zinc-500">Flagged</p>
                  </div>
                </div>

                {submitted ? (
                  <div className={`mt-4 rounded border p-4 ${passedMock ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-950"}`}>
                    <p className="text-xs font-black uppercase tracking-[0.14em]">Final score</p>
                    <p className="mt-2 text-4xl font-black">{score}/{mockQuestionCount}</p>
                    <p className="mt-2 text-sm font-bold leading-6">
                      {isTopicPractice
                        ? passedMock
                          ? "Topic practice passed."
                          : "Review this topic before moving on."
                        : passedMock
                          ? "Pass-standard practice result."
                          : "Keep revising before booking the official test."}
                    </p>
                  </div>
                ) : isFinalMockQuestion ? (
                  <div className="mt-4">
                    <button type="button" onClick={finishMockFromFinalQuestion} className="w-full rounded-full border border-zinc-300 bg-white px-4 py-3 text-sm font-black hover:ring-2 hover:ring-brand">
                      Submit and review
                    </button>
                    {!hasAnsweredEveryMockQuestion ? (
                      <p className="mt-2 text-xs font-bold leading-5 text-zinc-600">Unanswered questions will be marked wrong when you submit.</p>
                    ) : null}
                  </div>
                ) : null}

                <div className="mt-4 rounded border border-zinc-200 bg-white p-4 text-sm font-bold leading-6 text-zinc-600">
                  {isTopicPractice ? "Move through this topic quiz using Previous and Next. Your answers stay saved as you go." : "Move through the mock using Previous and Next. The test keeps your answers saved as you go."}
                </div>
                <button type="button" onClick={resetMock} className="mt-4 w-full rounded-full border border-zinc-300 bg-white px-4 py-3 text-sm font-black hover:ring-2 hover:ring-brand">
                  <RotateCcw className="mr-2 inline" size={16} /> Reset with new questions
                </button>
              </aside>
              ) : null}

              {submitted ? (
                <section className={isTopicPractice ? "" : "xl:col-span-2"}>
                  <h3 className="text-xl font-black">Answer review</h3>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {sessionQuestions.map((question, index) => {
                      const selected = answers[index];
                      const correct = selected === question.correctIndex;
                      return (
                        <button key={question.question} type="button" onClick={() => openReviewQuestion(index)} className={`rounded border p-4 text-left text-sm font-bold leading-6 hover:ring-2 hover:ring-brand ${correct ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-950"}`}>
                          <span className="block font-black">Question {index + 1}: {correct ? "Correct" : "Click to learn this one"}</span>
                          <span className="mt-1 block text-zinc-700">{question.question}</span>
                          {!correct ? <span className="mt-2 block text-xs font-black uppercase tracking-[0.12em]">Review your answer</span> : null}
                        </button>
                      );
                    })}
                  </div>
                </section>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      {activeView === "hazard" && hazardVideoEnabled ? <LdaHazardVideoTest currentLearnerPackageId={currentLearnerPackageId} onAllowanceConsumed={refreshAllowanceSnapshots} /> : null}
      {!hazardVideoEnabled ? <LegacyHazardPractice active={activeView === "hazard"} /> : null}

      {activeView === "book" ? (
        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]">
          <article className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-2xl font-black">Book your official theory test</h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-zinc-600">Use the official GOV.UK booking service when your mock results are consistently strong. You will need your UK driving licence number, email address, and payment card.</p>
            <div className="mt-5 grid gap-3 rounded border border-zinc-200 bg-zinc-50 p-4 text-sm font-bold text-zinc-700">
              <span>Official car theory test fee currently listed by GOV.UK: GBP 23.</span>
              <span>Multiple-choice guidance: 50 questions, 57 minutes, pass mark 43.</span>
              <span>Hazard perception pass mark: 44 out of 75.</span>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <a href="https://www.gov.uk/book-theory-test" target="_blank" rel="noreferrer" className="lda-pill lda-pill-sm">Open GOV.UK booking <ExternalLink size={17} /></a>
              <button type="button" onClick={() => setBooked(true)} className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-black hover:ring-2 hover:ring-brand">I have booked it</button>
            </div>
          </article>
          <aside className="rounded border border-red-200 bg-red-50 p-5 shadow-sm">
            <h2 className="text-2xl font-black">Before you book</h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-red-950">LDA recommends at least three mock scores above 46/50 and calm hazard perception practice before paying for the official slot.</p>
            {booked ? <p className="mt-5 rounded border border-emerald-200 bg-emerald-50 p-4 text-sm font-black leading-6 text-emerald-800">Thank you for booking your theory test through LDA. We wish you the very best of luck.</p> : null}
          </aside>
        </div>
      ) : null}
    </section>
  );
}
