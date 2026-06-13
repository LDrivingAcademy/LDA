import { createClient } from "@/lib/supabase/server";
import type { InstructorPackageId } from "@/lib/instructor-packages";
import type { LearnerPackageId } from "@/lib/learner-packages";

export async function getSignedInInstructorPackageId(): Promise<InstructorPackageId> {
  const supabase = await createClient();

  if (!supabase) {
    return "instructor";
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return "instructor";
  }

  const { data } = await supabase
    .from("instructor_profiles")
    .select("instructor_package")
    .eq("user_id", user.id)
    .maybeSingle();

  const packageId = data?.instructor_package;

  return packageId === "instructor-plus" || packageId === "instructor-pro" ? packageId : "instructor";
}

export async function getSignedInLearnerPackageId(): Promise<LearnerPackageId> {
  const supabase = await createClient();

  if (!supabase) {
    return "learner";
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return "learner";
  }

  const { data } = await supabase
    .from("learner_profiles")
    .select("learner_package,learner_plus_active,learner_plus_expires_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const packageId = data?.learner_package;
  const hasLegacyLearnerPlus =
    Boolean(data?.learner_plus_active) &&
    (!data?.learner_plus_expires_at || new Date(data.learner_plus_expires_at).getTime() > Date.now());

  if (packageId === "learner-pro" || packageId === "learner-plus") {
    return packageId;
  }

  return hasLegacyLearnerPlus ? "learner-plus" : "learner";
}
