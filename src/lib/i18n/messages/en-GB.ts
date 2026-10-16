export const enGbMessages = {
  "ai.greeting": "Hi, welcome to L Driving Academy. How can I help today?",
  "ai.homepage.helperTitle": "Where do you need to go?",
  "ai.homepage.helperIntro":
    "I can point you to the right LDA route. Ask something short, like how to book, find an instructor, use Smart Match, or get support.",
  "ai.homepage.supportCta": "Contact Support AI",
  "ai.homepage.routeQuestion": "Are you trying to book a lesson, find an instructor, use Smart Match, or get support?",
  "ai.support.ticketCreated":
    "I have escalated this to LDA support with the chat context attached. Your reference is {reference}. LDA will review it and update you by email.",
  "language.selector.label": "Choose page language",
  "language.selector.searchPlaceholder": "Search languages",
  "language.selector.noResults": "No languages found",
  "language.selector.customPlaceholder": "Example: Cockney English, ar-EG, es-419",
  "language.selector.savedHint": "The visible page text changes after selection. Your choice is saved for the next visit.",
  "language.selector.customHint":
    "Enter a language code too, for example ar-EG, es-419, cy, fr, or ur, so the page translator can apply it.",
  "i18n.qa.badge": "Language QA",
  "i18n.qa.clean": "No text overflow detected",
  "i18n.qa.overflow": "{count} possible overflow issue(s)"
} as const;

export type EnGbMessageKey = keyof typeof enGbMessages;
