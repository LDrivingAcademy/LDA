import type { LearnerAllowanceKey } from "@/lib/subscription-tier-entitlements";
import { learnerPackageEntitlements } from "@/lib/subscription-tier-entitlements";
import type { LearnerPackageId } from "@/lib/learner-packages";

type PracticeAllowanceState = {
  used: number;
  periodKey: string;
};

function getUkDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  return {
    year: Number(parts.find((part) => part.type === "year")?.value ?? date.getUTCFullYear()),
    month: Number(parts.find((part) => part.type === "month")?.value ?? date.getUTCMonth() + 1),
    day: Number(parts.find((part) => part.type === "day")?.value ?? date.getUTCDate()),
  };
}

function getDailyKey() {
  const { year, month, day } = getUkDateParts();
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getWeeklyKey() {
  const { year, month, day } = getUkDateParts();
  const ukNoon = new Date(Date.UTC(year, month - 1, day, 12));
  const dayOfWeek = ukNoon.getUTCDay() || 7;
  ukNoon.setUTCDate(ukNoon.getUTCDate() - dayOfWeek + 1);
  return `${ukNoon.getUTCFullYear()}-${String(ukNoon.getUTCMonth() + 1).padStart(2, "0")}-${String(ukNoon.getUTCDate()).padStart(2, "0")}`;
}

function getPeriodKey(packageId: LearnerPackageId, allowanceKey: LearnerAllowanceKey) {
  const cadence = learnerPackageEntitlements[packageId].reset[allowanceKey];
  return cadence === "weekly" ? `week-${getWeeklyKey()}` : `day-${getDailyKey()}`;
}

function getStorageKey(packageId: LearnerPackageId, allowanceKey: LearnerAllowanceKey) {
  return `lda-practice-allowance:${packageId}:${allowanceKey}`;
}

export function getPracticeAllowanceSnapshot(packageId: LearnerPackageId, allowanceKey: LearnerAllowanceKey) {
  const limit = learnerPackageEntitlements[packageId].allowances[allowanceKey];
  const periodKey = getPeriodKey(packageId, allowanceKey);

  if (typeof window === "undefined") {
    return { limit, used: 0, remaining: limit, allowed: true };
  }

  const stored = window.localStorage.getItem(getStorageKey(packageId, allowanceKey));
  let parsed: Partial<PracticeAllowanceState> | null = null;
  try {
    parsed = stored ? (JSON.parse(stored) as Partial<PracticeAllowanceState>) : null;
  } catch {
    parsed = null;
  }
  const used = parsed?.periodKey === periodKey && Number.isFinite(parsed.used) ? Math.max(0, Number(parsed.used)) : 0;
  return { limit, used, remaining: Math.max(0, limit - used), allowed: used < limit };
}

export function consumePracticeAllowance(packageId: LearnerPackageId, allowanceKey: LearnerAllowanceKey) {
  const snapshot = getPracticeAllowanceSnapshot(packageId, allowanceKey);
  if (!snapshot.allowed || typeof window === "undefined") return snapshot;

  const periodKey = getPeriodKey(packageId, allowanceKey);
  const used = snapshot.used + 1;
  window.localStorage.setItem(getStorageKey(packageId, allowanceKey), JSON.stringify({ periodKey, used }));
  return { ...snapshot, used, remaining: Math.max(0, snapshot.limit - used), allowed: used < snapshot.limit };
}
