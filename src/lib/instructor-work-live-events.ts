import type { LiveGpsPoint } from "@/lib/live-gps-utils";

export const instructorWorkStatusEvent = "lda:instructor-work-status";
export const instructorWorkLocationEvent = "lda:instructor-work-location";

export function publishInstructorWorkStatus(isWorking: boolean) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(instructorWorkStatusEvent, { detail: { isWorking } }));
}

export function publishInstructorWorkLocation(point: LiveGpsPoint) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(instructorWorkLocationEvent, { detail: { point } }));
}
