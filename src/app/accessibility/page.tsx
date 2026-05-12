import { LegalPage } from "@/components/legal-page";

const accessibilityContent = {
  title: "Accessibility",
  intro: "LDA aims to make the learner and instructor booking experience clear, keyboard-friendly, readable, and usable across modern devices.",
  updated: "Placeholder accessibility statement - needs final review before launch.",
  sections: [
    {
      heading: "Our aim",
      body: [
        "We want learners, instructors, and admins to be able to use LDA without unnecessary barriers.",
        "The product should use clear labels, readable contrast, consistent navigation, and predictable forms."
      ]
    },
    {
      heading: "Known work before launch",
      body: [
        "Complete a full accessibility audit across booking, payment, dashboard, support, and legal pages.",
        "Review keyboard navigation, focus states, alternative text, form errors, and screen-reader behaviour."
      ]
    },
    {
      heading: "Contact",
      body: [
        "If you have trouble using the website, contact info@ldrivingacademy.co.uk with the page, device, browser, and issue."
      ]
    }
  ]
};

export default function AccessibilityPage() {
  return <LegalPage content={accessibilityContent} />;
}
