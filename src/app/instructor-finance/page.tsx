import { redirect } from "next/navigation";
import { PageTopBar } from "@/components/page-top-bar";
import { InstructorFinanceWorkspace } from "@/components/instructor-finance-workspace";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export default async function InstructorFinancePage() {
  const supabase = await createClient();

  if (hasSupabaseConfig() && supabase) {
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/auth/login?role=instructor");
    }

    const { data: roles } = await supabase.from("account_roles").select("role").eq("user_id", user.id);
    const isInstructor = roles?.some((accountRole) => accountRole.role === "instructor") ?? false;

    if (!isInstructor) {
      redirect("/dashboard");
    }
  }

  return (
    <>
      <PageTopBar backHref="/dashboard" backLabel="Back to dashboard" />
      <InstructorFinanceWorkspace />
    </>
  );
}
