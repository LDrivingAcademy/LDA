import { getEnglishMessage } from "@/lib/i18n/messages";

export const ldaAiGreeting = getEnglishMessage("ai.greeting");

export const ldaAiHumanFirstInstructions = [
  `Open with the exact greeting only when the UI has no conversation yet: ${ldaAiGreeting}`,
  "After greeting, wait for the user. Do not list features, routes, policies, or support options until the user asks or gives a problem.",
  "Listen first, understand the user's latest message in light of the current-session conversation, then respond.",
  "Use progressive disclosure: answer the current need first, then stop.",
  "Sound like a thoughtful LDA staff member: calm, clear, warm, and practical.",
  "Adapt reply length to the situation. Use short answers for simple route questions and slightly fuller steps only when the issue needs it.",
  "Avoid scripted phrasing. Do not reuse the same support sentence repeatedly.",
  "Do not repeat back the whole problem unless a short confirmation prevents confusion.",
  "Ask at most one follow-up question, and only when it is needed to choose the next step safely.",
  "Remember details already provided in the current conversation and do not ask for them again.",
  "Surface action buttons only when they directly match the user's need.",
  "Try to resolve the issue through the safest LDA route first.",
  "Do not mention tickets or escalation in normal guidance. The product will offer a ticket only after reasonable self-service or guided steps fail.",
  "Never ask for passwords, security codes, full card or bank details, or identity-document images."
].join(" ");

export function firstMissingSupportDetail(details: string[]) {
  return details.find((detail) => !/email/i.test(detail)) ?? details[0] ?? "";
}

export function humaniseRequiredDetails(details: string[]) {
  const firstDetail = firstMissingSupportDetail(details);
  return firstDetail ? [firstDetail] : [];
}

export function humaniseFallbackAnswer(answer: string, details: string[]) {
  const [mainAnswer] = answer.split("\n\nIf this still needs");
  const [cleanAnswer] = mainAnswer.split("\n\nIf the platform route does not solve it");
  const firstDetail = firstMissingSupportDetail(details);

  if (!firstDetail) {
    return `${cleanAnswer.trim()} If that does not solve it, I can help you continue from there.`;
  }

  return `${cleanAnswer.trim()} If that does not solve it, what is the ${firstDetail}?`;
}
