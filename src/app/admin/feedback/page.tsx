import { redirect } from "next/navigation";
import { requireAdminDashboardClient } from "@/lib/admin-dashboard";

export default async function LegacyAdminFeedbackPage() {
  await requireAdminDashboardClient();
  redirect("/technical-support/feedback");
}
