import type { InstructorPackageId } from "@/lib/instructor-packages";
import type { LearnerPackageId } from "@/lib/learner-packages";

const activeSubscriptionStatuses = new Set(["active", "trialing", "past_due", "admin_granted"]);
const inactiveSubscriptionStatuses = new Set(["canceled", "cancelled", "unpaid", "incomplete", "incomplete_expired", "paused"]);

function normaliseStatus(status?: string | null) {
  return status?.trim().toLowerCase() || "";
}

export function hasInactiveSubscriptionStatus(status?: string | null) {
  return inactiveSubscriptionStatuses.has(normaliseStatus(status));
}

function expiresInFuture(expiresAt?: string | null) {
  if (!expiresAt) return true;

  const expiresAtTime = new Date(expiresAt).getTime();
  return Number.isNaN(expiresAtTime) || expiresAtTime > Date.now();
}

export function isLearnerPackageId(value?: string | null): value is LearnerPackageId {
  return value === "learner" || value === "learner-plus" || value === "learner-pro";
}

export function isInstructorPackageId(value?: string | null): value is InstructorPackageId {
  return value === "instructor" || value === "instructor-plus" || value === "instructor-pro";
}

export function isPaidLearnerPackageId(value?: string | null): value is Exclude<LearnerPackageId, "learner"> {
  return value === "learner-plus" || value === "learner-pro";
}

export function isPaidInstructorPackageId(value?: string | null): value is Exclude<InstructorPackageId, "instructor"> {
  return value === "instructor-plus" || value === "instructor-pro";
}

export function hasActiveSubscriptionEntitlement({
  packageId,
  status,
  expiresAt
}: {
  packageId?: string | null;
  status?: string | null;
  expiresAt?: string | null;
}) {
  if (!isPaidLearnerPackageId(packageId) && !isPaidInstructorPackageId(packageId)) {
    return false;
  }

  if (!expiresInFuture(expiresAt)) {
    return false;
  }

  const normalisedStatus = normaliseStatus(status);
  if (!normalisedStatus) {
    return true;
  }

  if (inactiveSubscriptionStatuses.has(normalisedStatus)) {
    return false;
  }

  return activeSubscriptionStatuses.has(normalisedStatus) || normalisedStatus.startsWith("admin_");
}

export function getEntitledLearnerPackageId({
  packageId,
  status,
  expiresAt
}: {
  packageId?: string | null;
  status?: string | null;
  expiresAt?: string | null;
}): LearnerPackageId | null {
  if (packageId === "learner") {
    return "learner";
  }

  return isPaidLearnerPackageId(packageId) && hasActiveSubscriptionEntitlement({ packageId, status, expiresAt })
    ? packageId
    : null;
}

export function getEntitledInstructorPackageId({
  packageId,
  status,
  expiresAt
}: {
  packageId?: string | null;
  status?: string | null;
  expiresAt?: string | null;
}): InstructorPackageId | null {
  if (packageId === "instructor") {
    return "instructor";
  }

  return isPaidInstructorPackageId(packageId) && hasActiveSubscriptionEntitlement({ packageId, status, expiresAt })
    ? packageId
    : null;
}
