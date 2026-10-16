import { redirect } from "next/navigation";
import { InstructorSupportContent } from "@/components/instructor-support-content";
import { getHeaderAccountSummary } from "@/lib/current-account";

export default async function InstructorSupportPage() {
  const account = await getHeaderAccountSummary();
  if (!account) {
    redirect("/support/guest?from=role-guard");
  }

  if (account?.role === "learner") {
    redirect("/support/learner?from=role-guard");
  }

  return <InstructorSupportContent entry="public" />;
}
