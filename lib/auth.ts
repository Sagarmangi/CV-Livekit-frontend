import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { cache } from "react";

import { authEnv } from "@/lib/env";
import { db } from "@/lib/supabase";
import { createClient } from "@/lib/supabase/server";

export type SessionUser = {
  id: string;
  email: string;
};

/**
 * Null if there's no session, or the session's JWT has no email on it.
 *
 * Uses `getClaims()` rather than `getUser()`. Both are verified checks, but
 * `getUser()` always costs a round trip to the auth server to ask whether a
 * token is good -- about 400ms from here, on every render of every protected
 * page. `getClaims()` verifies the signature itself against the project's
 * public JWK (this project signs with ES256, and the key set is cached after
 * the first fetch), so the usual case is local and free. If a project is still
 * on legacy HS256 symmetric secrets, or WebCrypto isn't available, it falls
 * back to `getUser()` on its own -- so this is never weaker than what it
 * replaced, only faster when it can be.
 *
 * Wrapped in React `cache()` so a request that checks twice -- the layout and
 * a server action in the same pass -- verifies once.
 */
export const getSessionUser = cache(async function getSessionUser(): Promise<
  SessionUser | null
> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.email || !claims.sub) return null;
  return { id: claims.sub, email: claims.email };
});

/**
 * The allowlist gate: Supabase Auth will happily authenticate any email that
 * asks for a magic link, so this table is the actual access control. Checked
 * with the service-role client -- `allowed_users` intentionally has no
 * anon/authenticated grant (see the 0003 migration), so there's no other way
 * to read it from app code.
 */
export const isEmailAllowed = cache(async function isEmailAllowed(
  email: string,
): Promise<boolean> {
  const { data, error } = await db()
    .from("allowed_users")
    .select("email")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  if (error) throw new Error(`isEmailAllowed: ${error.message}`);
  return data !== null;
});

/**
 * Re-checks the signed-in admin's own password, for actions that shouldn't ride
 * on nothing but a session cookie -- currently rewriting provider credentials
 * from the Integrations page.
 *
 * Uses a standalone client rather than the cookie-bound one from
 * lib/supabase/server: this must not touch the caller's session. That's also
 * why it doesn't sign the throwaway client out afterwards -- supabase-js
 * `signOut()` defaults to global scope, which would revoke every session for
 * this user, including the one making the request. With `persistSession: false`
 * nothing is stored locally and the short-lived token simply expires.
 */
export async function verifyPassword(
  email: string,
  password: string,
): Promise<boolean> {
  if (!password) return false;
  const { url, anonKey } = authEnv();
  const client = createSupabaseClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  return !error;
}

/**
 * The one real authorization check in the app -- call this from
 * `app/(protected)/layout.tsx`, not from `proxy.ts`. Proxy only refreshes the
 * session cookie and does an optimistic "is there a session at all" redirect;
 * it deliberately doesn't touch the database (Next's own guidance is to keep
 * proxy/middleware fast and push real authorization into the route/layout).
 *
 * Signs the user out and redirects if they're authenticated but not
 * allow-listed, rather than just redirecting -- otherwise they'd land right
 * back here on their next request with the same still-valid session.
 */
export async function requireAllowedUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  if (!(await isEmailAllowed(user.email))) {
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login?error=not_allowed");
  }

  return user;
}
