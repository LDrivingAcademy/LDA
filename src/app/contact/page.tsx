import { LegalPage } from "@/components/legal-page";
import { legalPages } from "@/lib/legal-content";

export default function ContactPage() {
  return <LegalPage content={legalPages.contact} />;
}
