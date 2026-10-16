type CookieLike = {
  name: string;
  value?: string;
};

export function isSupabaseAuthCookieName(name: string) {
  return name.startsWith("sb-") && name.includes("auth-token");
}

export function hasSupabaseAuthCookie(cookies: CookieLike[]) {
  return cookies.some((cookie) => isSupabaseAuthCookieName(cookie.name) && Boolean(cookie.value));
}
