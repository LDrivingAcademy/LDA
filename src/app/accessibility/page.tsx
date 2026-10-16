import { LegalPage } from "@/components/legal-page";
import { legalPages } from "@/lib/legal-content";

export default function AccessibilityPage() {
  return <LegalPage content={legalPages.accessibility} />;
}
