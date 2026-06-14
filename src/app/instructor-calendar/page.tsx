import { redirect } from "next/navigation";
import { PageTopBar } from "@/components/page-top-bar";
import { InstructorCalendarWorkspace } from "@/components/instructor-calendar-workspace";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export default async function InstructorCalendarPage() {
  const supabase = await createClient();

  if (!hasSupabaseConfig() || !supabase) {
    return (
      <div className="lda-instructor-calendar-page">
        <PageTopBar backHref="/dashboard" backLabel="Back to dashboard" />
        <InstructorCalendarWorkspace instructorName="LDA instructor" />
      </div>
    );
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?role=instructor");
  }

  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("full_name,email").eq("id", user.id).maybeSingle(),
    supabase.from("account_roles").select("role").eq("user_id", user.id)
  ]);
  const isInstructor = roles?.some((accountRole) => accountRole.role === "instructor") ?? false;

  if (!isInstructor) {
    redirect("/dashboard");
  }

  return (
    <div className="lda-instructor-calendar-page">
      <PageTopBar backHref="/dashboard" backLabel="Back to dashboard" />
      <InstructorCalendarWorkspace instructorName={profile?.full_name || user.email || "LDA instructor"} instructorEmail={profile?.email ?? user.email} />
    </div>
  );
}
