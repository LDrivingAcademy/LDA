export const practicalReadinessChecklist = [
  "Eyesight readiness and licence check",
  "Cockpit drill and safety checks",
  "Show me / tell me vehicle safety questions",
  "Mirrors, blind spots, signalling, and observations",
  "Moving off and stopping safely",
  "Pulling up on the left and rejoining traffic",
  "Steering control and lane discipline",
  "Accelerator, brake, clutch, gears, and smooth control",
  "Hill starts and angled starts",
  "Junctions and emerging",
  "Crossroads and turning across traffic",
  "Roundabouts and mini-roundabouts",
  "Traffic lights, pedestrian crossings, and controlled junctions",
  "Meeting, crossing, and overtaking traffic",
  "Speed limits, following distance, and judgement",
  "Dual carriageways and higher-speed roads",
  "Country roads, bends, and narrow roads",
  "Road signs, road markings, one-way streets, and bus lanes",
  "Independent driving with sat nav or traffic signs",
  "Forward bay parking",
  "Reverse bay parking",
  "Parallel parking at the roadside",
  "Pull up on the right, reverse, and rejoin traffic",
  "Emergency stop response",
  "Hazard perception and defensive planning",
  "Eco-safe driving and smooth progress",
  "Mock-test standard with no serious or dangerous faults",
  "Practical-test briefing, nerves, and final readiness"
];

export function uniqueSignedPracticalSkills(records: Array<{ completed_skills: string[] | null }>) {
  const skillsByKey = new Map<string, string>();

  for (const record of records) {
    for (const skill of record.completed_skills ?? []) {
      const cleaned = skill.trim();
      if (cleaned) {
        skillsByKey.set(cleaned.toLowerCase(), cleaned);
      }
    }
  }

  return Array.from(skillsByKey.values());
}

export function practicalReadinessPercent(completedSkills: string[]) {
  const completedKeys = new Set(completedSkills.map((skill) => skill.trim().toLowerCase()).filter(Boolean));
  const completedRequiredCount = practicalReadinessChecklist.filter((skill) => completedKeys.has(skill.toLowerCase())).length;

  return practicalReadinessChecklist.length
    ? Math.round((completedRequiredCount / practicalReadinessChecklist.length) * 100)
    : 0;
}

export function hasCompletedPracticalReadiness(completedSkills: string[]) {
  const completedKeys = new Set(completedSkills.map((skill) => skill.trim().toLowerCase()).filter(Boolean));

  return practicalReadinessChecklist.every((skill) => completedKeys.has(skill.toLowerCase()));
}
