export type InstructorVerificationDisplay = {
  label: string;
  toneClass: string;
};

function titleCaseStatus(status: string) {
  return status
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function getInstructorVerificationDisplay(status?: string | null): InstructorVerificationDisplay {
  const normalised = String(status || "not_started").trim().toLowerCase().replace(/\s+/g, "_");

  if (normalised === "draft" || normalised === "not_started" || normalised === "not-started") {
    return {
      label: "Not started",
      toneClass: "border-zinc-200 bg-zinc-50 text-zinc-700"
    };
  }

  if (normalised === "pending") {
    return {
      label: "Pending",
      toneClass: "border-amber-200 bg-amber-50 text-amber-900"
    };
  }

  if (normalised === "in_progress" || normalised === "in-progress") {
    return {
      label: "In progress",
      toneClass: "border-sky-200 bg-sky-50 text-sky-800"
    };
  }

  if (normalised === "approved" || normalised === "completed") {
    return {
      label: "Completed",
      toneClass: "border-emerald-200 bg-emerald-50 text-emerald-800"
    };
  }

  if (normalised === "rejected") {
    return {
      label: "Needs attention",
      toneClass: "border-red-200 bg-red-50 text-brand"
    };
  }

  return {
    label: titleCaseStatus(normalised),
    toneClass: "border-zinc-200 bg-zinc-50 text-zinc-700"
  };
}
