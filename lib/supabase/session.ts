/**
 * True when the cookie names include a Supabase auth session (`sb-<ref>-auth-token`, or its
 * chunks `…-auth-token.0`, `.1`). A visitor without one is signed out, so a `getUser()`
 * network call can only return "no session" — callers skip it.
 * The PKCE `…-auth-token-code-verifier` cookie is not a session and does not match.
 */
export function hasSessionCookie(names: Iterable<string>): boolean {
  for (const name of names) {
    if (/^sb-.+-auth-token(\.\d+)?$/.test(name)) return true;
  }
  return false;
}
