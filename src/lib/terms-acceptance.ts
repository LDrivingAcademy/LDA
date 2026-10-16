import { createClient } from "@/lib/supabase/server";
import { hasAcceptedCurrentTerms } from "@/lib/terms-version";

type TermsReadClient = Pick<NonNullable<Awaited<ReturnType<typeof createClient>>>, "from">;

export async function getCurrentTermsStatus(supabase: TermsReadClient, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("terms_version_accepted")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.warn("[terms] profile terms status read failed", {
      userId,
      message: error.message
    });
  }

  return {
    accepted: !error && hasAcceptedCurrentTerms(data),
    error,
    profile: data
  };
}
