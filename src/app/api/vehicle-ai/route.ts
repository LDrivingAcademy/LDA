import { jsonNoStore, isRateLimited, rateLimitResponse, readJsonBody, safeText } from "@/lib/security";

export const dynamic = "force-dynamic";

type VehicleAiRequest = {
  role?: "learner" | "instructor" | "visitor";
  vehicleType?: "manual" | "automatic" | "electric" | "hybrid" | "unknown";
  situation?: string;
  question?: string;
};

const safetyPattern =
  /\b(brake|brakes|steering|tyre blowout|flat tyre|smoke|burning|overheat|overheating|engine light|warning light|red light|airbag|abs|crash|accident|fuel leak|oil leak|no control|unsafe|danger|dangerous)\b/i;
const transmissionPattern = /\b(clutch|gear|gears|bite point|stall|stalling|hill start|automatic|manual|paddle|transmission|neutral|park|drive)\b/i;
const checksPattern = /\b(show me|tell me|cockpit|mirrors|blind spot|oil|coolant|washer|lights|horn|demister|wipers|brake fluid|tyre pressure)\b/i;
const evPattern = /\b(electric|ev|hybrid|battery|charging|regen|regenerative|range|charge)\b/i;
const compliancePattern = /\b(mot|tax|insurance|service|servicing|adi|pdi|licence|license|expiry|compliance|maintenance|defect|record)\b/i;

function isMeaningful(value?: string) {
  return typeof value === "string" && value.trim().length > 2;
}

function extractOutputText(payload: unknown) {
  if (
    payload &&
    typeof payload === "object" &&
    "output_text" in payload &&
    typeof payload.output_text === "string"
  ) {
    return payload.output_text;
  }

  return "";
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function classify(question: string) {
  const topics = [];
  if (safetyPattern.test(question)) topics.push("Safety");
  if (transmissionPattern.test(question)) topics.push("Transmission");
  if (checksPattern.test(question)) topics.push("Vehicle checks");
  if (evPattern.test(question)) topics.push("EV or hybrid");
  if (compliancePattern.test(question)) topics.push("Compliance");
  return topics.length ? topics : ["Vehicle guidance"];
}

function fallbackAnswer(input: Required<VehicleAiRequest>, safetyCritical: boolean) {
  const question = `${input.situation} ${input.question}`;
  const roleLabel = input.role === "instructor" ? "instructor" : input.role === "learner" ? "learner" : "driver";
  const vehicleLabel = input.vehicleType === "unknown" ? "vehicle" : input.vehicleType;

  if (safetyCritical) {
    return {
      answer:
        "This sounds safety-related. Do not continue driving if the vehicle feels unsafe, has braking or steering issues, visible smoke, a serious warning light, a tyre problem, or a fluid leak. Stop somewhere safe if you are already moving, switch on hazard lights if needed, and contact your instructor, recovery provider, garage, or emergency services depending on the situation.",
      nextSteps: [
        "Treat red warning lights, brake faults, steering faults, smoke, overheating, and tyre failures as stop-driving issues.",
        "Take a photo of the warning or defect only when parked safely.",
        roleLabel === "instructor"
          ? "Record the defect in your LDA vehicle compliance log before accepting more lessons."
          : "Tell your instructor what happened before booking or continuing the next lesson."
      ]
    };
  }

  if (transmissionPattern.test(question)) {
    const manualAdvice =
      "For a manual car, think in this order: clutch fully down, choose the right gear, find the bite point gently, add light gas, check mirrors and surroundings, then release smoothly. If you stall, secure the car, restart calmly, and reset the same sequence.";
    const automaticAdvice =
      "For an automatic, focus on smooth brake control, correct selector use, creep control, safe observation, and avoiding left-foot braking unless your instructor has specifically trained you that way.";

    return {
      answer:
        input.vehicleType === "automatic" || input.vehicleType === "electric" || input.vehicleType === "hybrid"
          ? automaticAdvice
          : `${manualAdvice} If you are in an automatic or EV, the key habit changes from clutch control to brake, selector, speed, and observation control.`,
      nextSteps: [
        "Ask your instructor to isolate the skill for five minutes before using it in traffic.",
        "Practise the same routine out loud until the order feels automatic.",
        "If the car jumps, stalls repeatedly, or makes unusual noises, pause and ask for an instructor check."
      ]
    };
  }

  if (checksPattern.test(question)) {
    return {
      answer:
        "For UK learner driving, vehicle confidence comes from repeatable checks: seating and belt, mirrors, blind spots, lights, tyres, fluids, demisters, wipers, horn, and warning lights. For show-me/tell-me style questions, learn what the control does, when to use it, and how to check it without taking attention away from the road.",
      nextSteps: [
        "Use the cockpit drill before every lesson: doors, seat, belt, mirrors, controls.",
        "Ask your instructor to link each check to a real driving situation, not just a memorised answer.",
        "Keep a short list of controls you still hesitate on and review it before your next booking."
      ]
    };
  }

  if (evPattern.test(question)) {
    return {
      answer:
        "For EVs and hybrids, the big learning differences are smoother acceleration, regenerative braking, range planning, charging awareness, and understanding that the car may move or respond very quietly. Treat the silence as a reason to be more observant around pedestrians, cyclists, and car parks.",
      nextSteps: [
        "Ask how regenerative braking changes the feel of slowing down.",
        "Check the vehicle range and charging plan before longer lessons.",
        "Practise low-speed control in a quiet area because EV torque can feel immediate."
      ]
    };
  }

  if (compliancePattern.test(question)) {
    return {
      answer:
        roleLabel === "instructor"
          ? "For instructor use, vehicle compliance should stay visible before lessons: MOT, tax, insurance, servicing, tyres, lights, registration status, defects, and expiry reminders. LDA should be your operating record so a lesson is never accepted with a compliance gap."
          : "For learners, you do not need to manage the instructor vehicle compliance record, but you should feel confident the car is roadworthy. If you notice a defect, warning light, tyre issue, or anything unsafe, ask the instructor before driving.",
      nextSteps: [
        roleLabel === "instructor" ? "Update the vehicle compliance page after any service, MOT, insurance, or defect event." : "Raise any vehicle concern before the lesson starts.",
        "Never ignore a warning light just because the lesson is already booked.",
        "Keep photos or documents only where LDA asks for them and avoid sharing unnecessary personal data."
      ]
    };
  }

  return {
    answer:
      `For a ${roleLabel} using a ${vehicleLabel}, the safest way to learn a vehicle topic is to split it into three parts: what the control or system does, when it matters during a lesson, and what action to take if something feels wrong. I can help with manual or automatic control, EV and hybrid driving, warning lights, cockpit checks, show-me/tell-me questions, tyres, brakes, fluids, MOT, tax, insurance, and instructor compliance records.`,
    nextSteps: [
      "Ask one specific question at a time for a sharper answer.",
      "Include the car type, warning light colour, lesson situation, and whether the vehicle is moving or parked.",
      "If the issue could affect braking, steering, tyres, smoke, overheating, or visibility, stop and treat it as safety-critical."
    ]
  };
}

export async function POST(request: Request) {
  if (isRateLimited(request, "vehicle-ai", 30)) {
    return rateLimitResponse();
  }

  const input = await readJsonBody<VehicleAiRequest>(request);
  if (!input) {
    return jsonNoStore({ error: "Invalid vehicle AI request." }, { status: 400 });
  }

  if (!isMeaningful(input.question)) {
    return jsonNoStore({ error: "Ask a vehicle question first." }, { status: 400 });
  }

  const cleanInput: Required<VehicleAiRequest> = {
    role: input.role === "instructor" || input.role === "learner" || input.role === "visitor" ? input.role : "visitor",
    vehicleType:
      input.vehicleType === "manual" ||
      input.vehicleType === "automatic" ||
      input.vehicleType === "electric" ||
      input.vehicleType === "hybrid" ||
      input.vehicleType === "unknown"
        ? input.vehicleType
        : "unknown",
    situation: safeText(input.situation, "General vehicle question", 500),
    question: safeText(input.question, "", 2000)
  };

  const combinedQuestion = `${cleanInput.situation}\n${cleanInput.question}`;
  const safetyCritical = safetyPattern.test(combinedQuestion);
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_VEHICLE_AI_MODEL || process.env.OPENAI_SUPPORT_MODEL || "gpt-5.2";
  let answer = "";
  let nextSteps: string[] = [];
  let mode: "demo" | "live" = "demo";

  if (apiKey) {
    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          instructions:
            "You are LDA Vehicle AI, a UK learner-driver and instructor vehicle coach. Be practical, calm, safety-aware, and concise. Cover manual, automatic, electric, and hybrid vehicles, dashboard warnings, show-me/tell-me checks, cockpit drill, tyres, brakes, fluids, visibility, MOT/tax/insurance awareness, and instructor vehicle compliance. Do not claim to diagnose faults with certainty. Do not replace a qualified mechanic, instructor, emergency service, DVSA, DVLA, insurer, or legal adviser. If there is any possible brake, steering, tyre, smoke, overheating, red warning light, crash, fluid leak, or unsafe-control issue, tell the user not to continue driving and to stop safely or seek professional help. Return a short answer followed by 3 practical next steps.",
          input: [
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: `Role: ${cleanInput.role}\nVehicle type: ${cleanInput.vehicleType}\nSituation: ${cleanInput.situation}\nSafety critical detected: ${safetyCritical ? "yes" : "no"}\nQuestion: ${cleanInput.question}`
                }
              ]
            }
          ]
        })
      });

      if (response.ok) {
        answer = extractOutputText(await response.json());
        mode = "live";
      }
    } catch {
      answer = "";
    }
  }

  if (!answer) {
    const fallback = fallbackAnswer(cleanInput, safetyCritical);
    answer = fallback.answer;
    nextSteps = fallback.nextSteps;
  }

  return jsonNoStore({
    answer,
    nextSteps,
    mode,
    safetyCritical,
    topics: unique(classify(combinedQuestion))
  });
}
