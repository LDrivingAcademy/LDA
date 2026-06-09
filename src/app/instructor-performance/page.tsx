import { redirect } from "next/navigation";
import { PageTopBar } from "@/components/page-top-bar";
import { InstructorPerformanceWorkspace } from "@/components/instructor-performance-workspace";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export default async function InstructorPerformancePage() {
  const supabase = await createClient();

  if (hasSupabaseConfig() && supabase) {
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/auth/login?role=instructor");
    }

    const [{ data: roles }, { data: profile }] = await Promise.all([
      supabase.from("account_roles").select("role").eq("user_id", user.id),
      supabase.from("profiles").select("full_name,email").eq("id", user.id).maybeSingle()
    ]);
    const isInstructor = roles?.some((accountRole) => accountRole.role === "instructor") ?? false;

    if (!isInstructor) {
      redirect("/dashboard");
    }

    return (
      <>
        <PageTopBar backHref="/dashboard" backLabel="Back to dashboard" />
        <InstructorPerformanceWorkspace instructorName={profile?.full_name || user.email || "LDA instructor"} />
      </>
    );
  }

  return (
    <>
      <PageTopBar backHref="/dashboard" backLabel="Back to dashboard" />
      <InstructorPerformanceWorkspace instructorName="LDA instructor" />
    </>
  );
}
