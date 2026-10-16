import { redirect } from "next/navigation";
import { getHeaderAccountSummary } from "@/lib/current-account";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true
  }
};

export default async function AccountSupportRouter() {
  const account = await getHeaderAccountSummary();

  if (!account) {
    redirect("/support/guest?from=role-router");
  }

  if (account.role === "instructor") {
    redirect("/support/instructor/dashboard?from=dashboard");
  }

  if (account.role === "learner") {
    redirect("/support/learner?from=dashboard");
  }

  if (account.role === "admin" || account.role === "support") {
    redirect(account.dashboardHref);
  }

  redirect("/support/guest?from=role-router");
}
