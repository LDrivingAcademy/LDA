import { LegalPage } from "@/components/legal-page";
import { legalPages } from "@/lib/legal-content";

export default function PrivacyPage() {
  return <LegalPage content={legalPages.privacy} />;
}
