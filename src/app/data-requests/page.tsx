import { LegalPage } from "@/components/legal-page";
import { legalPages } from "@/lib/legal-content";

export default function DataRequestsPage() {
  return <LegalPage content={legalPages["data-requests"]} />;
}
