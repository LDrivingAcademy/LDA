import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isRateLimited, jsonNoStore, rateLimitResponse, safeText } from "@/lib/security";

export async function GET(request: Request) {
  if (isRateLimited(request, "progress-learner-lookup", 40)) {
    return rateLimitResponse();
  }

  const supabase = await createClient();
  const admin = createAdminClient();

  if (!supabase || !admin) {
    return jsonNoStore({ error: "Learner lookup is not configured." }, { status: 503 });
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonNoStore({ error: "Sign in as an instructor to look up learners." }, { status: 401 });
  }

  const { data: roles } = await supabase.from("account_roles").select("role").eq("user_id", user.id);
  const isInstructor = roles?.some((accountRole) => accountRole.role === "instructor") ?? false;

  if (!isInstructor) {
    return jsonNoStore({ error: "Only instructors can look up learner emails." }, { status: 403 });
  }

  const url = new URL(request.url);
  const name = safeText(url.searchParams.get("name") ?? "", "", 120);

  if (name.length < 2) {
    return jsonNoStore({ error: "Enter at least two characters of the learner name." }, { status: 400 });
  }

  const { data, error } = await admin
    .from("profiles")
    .select("id,full_name,email,account_roles!inner(role)")
    .ilike("full_name", `%${name}%`)
    .eq("account_roles.role", "learner")
    .limit(2);

  if (error) {
    return jsonNoStore({ error: error.message }, { status: 500 });
  }

  if (!data?.length) {
    return jsonNoStore({ error: "No learner found with that name." }, { status: 404 });
  }

  if (data.length > 1) {
    return jsonNoStore({ error: "More than one learner matches that name. Type the full learner name." }, { status: 409 });
  }

  const learner = data[0];

  return jsonNoStore({
    learnerId: learner.id,
    name: learner.full_name,
    email: learner.email
  });
}
