import { LegalPage } from "@/components/legal-page";
import { legalPages } from "@/lib/legal-content";

export default function CookiesPage() {
  return <LegalPage content={legalPages.cookies} />;
}
