import { redirect } from "next/navigation";
import { AdminSessionAutoSignOut } from "@/components/admin-session-auto-sign-out";
import { PageTopBar } from "@/components/page-top-bar";
import { InstructorFinanceWorkspace } from "@/components/instructor-finance-workspace";
import { isSignedInAdmin } from "@/lib/account-package-state";
import { getInstructorApprovalState, redirectUnlessApprovedInstructor } from "@/lib/instructor-approval";
import { getPageBackLink, type PageSourceSearchParams } from "@/lib/page-back-link";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

type InstructorFinancePageProps = {
  searchParams?: PageSourceSearchParams;
};

export default async function InstructorFinancePage({ searchParams }: InstructorFinancePageProps) {
  const { backHref, backLabel, fromAdmin } = await getPageBackLink(searchParams, {
    allowAdminSource: await isSignedInAdmin()
  });
  const supabase = await createClient();

  if (hasSupabaseConfig() && supabase) {
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/auth/login?role=instructor");
    }

    redirectUnlessApprovedInstructor(await getInstructorApprovalState(supabase, user.id));
  }

  return (
    <>
      {fromAdmin ? <AdminSessionAutoSignOut /> : null}
      <PageTopBar
        backHref={fromAdmin ? "/admin" : backHref === "/" ? "/dashboard" : backHref}
        backLabel={fromAdmin ? "Back to admin" : backLabel === "Back to homepage" ? "Back to dashboard" : backLabel}
        brandHref={fromAdmin ? "/admin" : "/"}
        brandLabel={fromAdmin ? "LDA admin dashboard" : "L Driving Academy home"}
      />
      <InstructorFinanceWorkspace />
    </>
  );
}
