import { getAllowedChatRoutes, type AccountAccessRole, type SafeChatLink } from "@/lib/chat-permissions";

export type SupportAudience = "guest" | "learner" | "instructor";
export type SupportCategory =
  | "booking"
  | "payment"
  | "cancellation"
  | "arrival"
  | "account"
  | "verification"
  | "payout"
  | "safety"
  | "off_platform"
  | "technical"
  | "general";
export type SupportPriority = "standard" | "urgent" | "critical";

export type SupportClassification = {
  category: SupportCategory;
  categoryLabel: string;
  priority: SupportPriority;
  riskFlags: string[];
  requiredDetails: string[];
  actions: SafeChatLink[];
  fallbackAnswer: string;
  summary: string;
};

const patterns = {
  safety: /\b(unsafe|danger|dangerous|accident|crash\w*|injur\w*|threat\w*|harass\w*|stranded|emergency|smoke|brake|steering)\b/i,
  offPlatform: /\b(cash|bank transfer|wire transfer|pay direct|pay directly|private payment|outside lda|outside the app|off[- ]platform|whatsapp|private booking|avoid commission)\b/i,
  arrival: /\b(late|not arrived|no show|where is|tracking|track|eta|on the way|did not turn up)\b/i,
  cancellation: /\b(cancel|cancelled|cancellation|reschedule|change.*lesson)\b/i,
  payment: /\b(pay|payment|stripe|card|charged|charge|paid twice|duplicate|checkout|refund|money back|payout|earnings)\b/i,
  booking: /\b(book|booking|lesson|calendar|slot|availability|schedule)\b/i,
  verification: /\b(adi|pdi|verification|verify|document|licence|license|badge|approval|application)\b/i,
  account: /\b(account|login|log in|sign in|password|email|profile|phone|access)\b/i,
  technical: /\b(error|broken|not working|crash|blank|slow|loading|bug|screen|page)\b/i
};
const existingBookingIssuePattern =
  /\b(missing|not showing|not there|wrong|problem|issue|pending|confirmed|changed|cancelled|late|failed|didn'?t|doesn'?t|can'?t|cannot|error|reference|history)\b/i;

const routeIdsByCategory: Record<SupportCategory, string[]> = {
  booking: ["book_lesson_dashboard", "learner_calendar", "instructor_calendar", "planned_lessons"],
  payment: ["learner_payment_help", "learner_packages", "instructor_packages"],
  cancellation: ["booking_history", "learner_calendar", "instructor_calendar", "cancellation_policy"],
  arrival: ["track_lesson", "learner_calendar", "instructor_calendar"],
  account: ["account_centre", "login", "signup"],
  verification: ["instructor_verification", "account_centre"],
  payout: ["instructor_finance", "instructor_support"],
  safety: ["roadworthy", "learner_support", "instructor_support", "guest_support"],
  off_platform: ["learner_support", "instructor_support", "guest_support"],
  technical: ["feedback", "learner_support", "instructor_support", "guest_support"],
  general: ["learner_support", "instructor_support", "guest_support"]
};

const categoryLabels: Record<SupportCategory, string> = {
  booking: "Booking help",
  payment: "Payment help",
  cancellation: "Cancellation or rescheduling",
  arrival: "Instructor arrival",
  account: "Account access",
  verification: "Verification",
  payout: "Instructor payout",
  safety: "Safety concern",
  off_platform: "Off-platform payment request",
  technical: "Website problem",
  general: "General support"
};

function classifyCategory(message: string, role: AccountAccessRole): SupportCategory {
  if (patterns.offPlatform.test(message)) return "off_platform";
  if (patterns.safety.test(message)) return "safety";
  if (patterns.arrival.test(message)) return "arrival";
  if (patterns.payment.test(message)) return role === "instructor" ? "payout" : "payment";
  if (patterns.cancellation.test(message)) return "cancellation";
  if (patterns.verification.test(message)) return "verification";
  if (patterns.booking.test(message)) return "booking";
  if (patterns.account.test(message)) return "account";
  if (patterns.technical.test(message)) return "technical";
  return "general";
}

function priorityFor(category: SupportCategory, message: string): SupportPriority {
  if (category === "safety" && /\b(immediate|now|emergency|accident|crash\w*|injur\w*|threat\w*|stranded)\b/i.test(message)) {
    return "critical";
  }
  if (
    category === "safety" ||
    category === "off_platform" ||
    category === "arrival" ||
    /\b(urgent|today|now|paid twice|duplicate charge)\b/i.test(message)
  ) {
    return "urgent";
  }
  return "standard";
}

function detailsFor(category: SupportCategory, message: string, hasBookingReference: boolean, _hasContactEmail: boolean) {
  const details: string[] = [];
  if (category === "booking" && !hasBookingReference && existingBookingIssuePattern.test(message)) {
    details.push("booking reference, if one exists");
  }
  if (["payment", "cancellation", "arrival", "off_platform"].includes(category) && !hasBookingReference) {
    details.push("booking reference, if one exists");
  }
  if (category === "payment") details.push("amount, payment date, and what checkout showed");
  if (category === "arrival") details.push("lesson time and instructor name");
  if (category === "verification") details.push("document type and the status shown");
  if (category === "payout") details.push("payout date or Stripe reference, without card or bank details");
  if (category === "technical") details.push("page, action attempted, and exact error shown");
  if (category === "off_platform") details.push("instructor name and a screenshot or exact wording");
  return [...new Set(details)];
}

function fallbackFor(category: SupportCategory, requiredDetails: string[]) {
  const missing = requiredDetails.length
    ? `\n\nIf this still needs the LDA team, add:\n${requiredDetails.map((detail) => `- ${detail}`).join("\n")}`
    : "\n\nIf the platform route does not solve it, LDA can escalate this with the details already provided.";

  const answers: Record<SupportCategory, string> = {
    booking: "You can book a lesson from the booking area in your learner dashboard, or use the calendar if you are checking an existing lesson.",
    payment: "Check the booking confirmation and payment status. Never send full card details; LDA only needs the payment email, amount, date, and booking reference.",
    cancellation: "Review the booking and cancellation policy before changing the lesson. If the dashboard cannot complete the change, keep the booking reference ready so LDA can review it.",
    arrival: "Check live tracking and the lesson time. If the instructor is late or has not arrived, keep the booking reference ready so LDA can prioritise the case.",
    account: "Use the account centre or login recovery route shown below. If access still fails, LDA can escalate with the account-safe context from this chat.",
    verification: "Open instructor verification and check the document status. LDA only needs the document type and status shown, not document numbers in chat.",
    payout: "Open the instructor finance area and check the payout status. Do not include full bank or card details in support messages.",
    safety: "Stop the activity if it is unsafe. If anyone is in immediate danger, contact the emergency services first. When safe, LDA can escalate the context.",
    off_platform: "Do not pay or move the booking outside LDA. Platform protections only apply to bookings and payments completed through LDA.",
    technical: "Retry the action once and note the page and exact error. If it still fails, LDA can send the full context to technical support.",
    general: "Use the most relevant action below. If that does not resolve the issue, LDA can review the context and next steps."
  };

  return `${answers[category]}${missing}`;
}

export function supportRoleFromAudience(audience: SupportAudience): AccountAccessRole {
  if (audience === "guest") return "visitor";
  return audience;
}

export function classifySupportRequest(input: {
  message: string;
  role: AccountAccessRole;
  hasBookingReference: boolean;
  hasContactEmail: boolean;
}): SupportClassification {
  const category = classifyCategory(input.message, input.role);
  const priority = priorityFor(category, input.message);
  const riskFlags = [
    ...(category === "safety" ? ["safety"] : []),
    ...(category === "off_platform" ? ["off_platform_payment"] : []),
    ...(priority === "critical" ? ["immediate_risk"] : [])
  ];
  const requiredDetails = detailsFor(category, input.message, input.hasBookingReference, input.hasContactEmail);
  const allowedRoutes = getAllowedChatRoutes(input.role);
  const actions = routeIdsByCategory[category]
    .map((routeId) => allowedRoutes.find((route) => route.id === routeId))
    .filter((route): route is NonNullable<typeof route> => Boolean(route))
    .slice(0, 3)
    .map(({ label, href }) => ({ label, href }));
  const categoryLabel = categoryLabels[category];

  return {
    category,
    categoryLabel,
    priority,
    riskFlags,
    requiredDetails,
    actions,
    fallbackAnswer: fallbackFor(category, requiredDetails),
    summary: `${categoryLabel}: ${input.message.replace(/\s+/g, " ").trim().slice(0, 360)}`
  };
}

export function supportTicketReference(ticketNumber: number) {
  return `LDA-S-${String(ticketNumber).padStart(6, "0")}`;
}
