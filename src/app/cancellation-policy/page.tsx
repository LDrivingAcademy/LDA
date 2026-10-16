import { LegalPage } from "@/components/legal-page";
import { legalPages } from "@/lib/legal-content";

export default function CancellationPolicyPage() {
  return <LegalPage content={legalPages.cancellation} />;
}
