import { cookies } from "next/headers";
import { jsonNoStore } from "@/lib/security";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete("lda_demo_role");

  const supabase = await createClient();

  if (supabase) {
    await supabase.auth.signOut();
  }

  return jsonNoStore({ ok: true });
}
