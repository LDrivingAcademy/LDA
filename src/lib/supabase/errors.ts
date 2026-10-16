export function authServiceErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");

  if (/fetch failed|failed to fetch|network|ECONN|ENOTFOUND|ETIMEDOUT|certificate|TLS/i.test(message)) {
    return "LDA could not reach the secure login service. Check the Supabase URL and publishable key in Vercel, then redeploy.";
  }

  return message || "LDA could not complete login. Please try again.";
}
