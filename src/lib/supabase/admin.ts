import { createClient } from "@supabase/supabase-js";
import { getRuntimeEnvValue } from "@/lib/runtime-env";
import { supabaseUrl } from "./config";

export function createAdminClient() {
  const serviceRoleKey = getRuntimeEnvValue("SUPABASE_SERVICE_ROLE_KEY").value;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
