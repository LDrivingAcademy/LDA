import { selectRuntimeEnvValue } from "@/lib/runtime-env";

export const supabaseUrl = selectRuntimeEnvValue("NEXT_PUBLIC_SUPABASE_URL", {
  test: process.env.NEXT_PUBLIC_TEST_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_TEST_URL,
  live: process.env.NEXT_PUBLIC_LIVE_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_LIVE_URL,
  neutral: process.env.NEXT_PUBLIC_SUPABASE_URL
}).value;

export const supabasePublishableKey =
  selectRuntimeEnvValue("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", {
    test: process.env.NEXT_PUBLIC_TEST_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_TEST_PUBLISHABLE_KEY,
    live: process.env.NEXT_PUBLIC_LIVE_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_LIVE_PUBLISHABLE_KEY,
    neutral: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  }).value ??
  selectRuntimeEnvValue("NEXT_PUBLIC_SUPABASE_ANON_KEY", {
    test: process.env.NEXT_PUBLIC_TEST_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_TEST_ANON_KEY,
    live: process.env.NEXT_PUBLIC_LIVE_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_LIVE_ANON_KEY,
    neutral: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  }).value;

export function hasSupabaseConfig() {
  return Boolean(supabaseUrl && supabasePublishableKey);
}
