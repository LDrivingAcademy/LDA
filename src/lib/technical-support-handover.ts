type SupportActor = {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

export function currentLondonDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function supportActorDisplayName(user: SupportActor) {
  const metadata = user.user_metadata ?? {};
  const nameCandidates = [
    metadata.full_name,
    metadata.name,
    metadata.display_name
  ];
  const name = nameCandidates.find((value) => typeof value === "string" && value.trim().length > 1);
  if (typeof name === "string") return name.trim().slice(0, 120);
  return String(user.email ?? "LDA technical support").trim().slice(0, 120);
}
