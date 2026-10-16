import clipData from "./hazard-clips.json";

export type HazardWindow = { label: string; start: number; end: number; clue: string; response: string };
export type HazardClip = {
  id: string; title: string; setting: string; duration: number; kind: string;
  onset: number; weather: string; reviewStatus: string; hazards: HazardWindow[];
};
export const hazardClips: HazardClip[] = clipData;

/** LDA practice heuristic, NOT the unpublished official anti-clicking algorithm.
 * No arbitrary total-click limit: a few considered follow-up clicks are allowed.
 */
export function clickPatternReason(clicks: readonly number[]): string | null {
  const sorted = [...clicks].filter(Number.isFinite).sort((a, b) => a - b);
  for (let start = 0; start + 8 <= sorted.length; start++) {
    const group = sorted.slice(start, start + 8);
    const gaps = group.slice(1).map((time, i) => time - group[i]);
    if (gaps.every((gap) => gap < 0.25)) return "Sustained rapid clicking";
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    if (mean >= 0.25 && mean <= 2 && gaps.every((gap) => Math.abs(gap - mean) < 0.06)) {
      return "Repeated regular clicking pattern";
    }
  }
  return null;
}

/** Half-open scoring windows [start,end); exact end is too late. */
export function scoreHazard(time: number, hazard: HazardWindow): number {
  if (!Number.isFinite(time) || time < hazard.start || time >= hazard.end || hazard.end <= hazard.start) return 0;
  return Math.max(1, 5 - Math.floor((time - hazard.start) / (hazard.end - hazard.start) * 5));
}

export function scoreClip(clip: HazardClip, input: readonly number[]) {
  const clicks = [...input].filter((t) => Number.isFinite(t) && t >= 0 && t < clip.duration).sort((a, b) => a - b);
  const reason = clickPatternReason(clicks);
  const hazards = clip.hazards.map((hazard) => {
    const time = clicks.find((t) => scoreHazard(t, hazard) > 0);
    return { hazard, time, score: reason || time === undefined ? 0 : scoreHazard(time, hazard) };
  });
  return { total: hazards.reduce((sum, h) => sum + h.score, 0), max: clip.hazards.length * 5, hazards, reason, clicks };
}

export function validateClipBank(clips: HazardClip[]): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const clip of clips) {
    if (ids.has(clip.id) || !/^[a-z0-9-]+$/.test(clip.id)) errors.push(`Invalid or duplicate id: ${clip.id}`);
    ids.add(clip.id);
    if (!Number.isFinite(clip.duration) || clip.duration <= 0) errors.push(`Invalid duration: ${clip.id}`);
    for (let i = 0; i < clip.hazards.length; i++) {
      const h = clip.hazards[i];
      if (!(h.start >= 0 && h.end > h.start && h.end < clip.duration)) errors.push(`Invalid window: ${clip.id}`);
      if (i && h.start <= clip.hazards[i - 1].end) errors.push(`Overlapping windows: ${clip.id}`);
      if (!h.clue || !h.response) errors.push(`Missing coaching: ${clip.id}`);
    }
  }
  return errors;
}
