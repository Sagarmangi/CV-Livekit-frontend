import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { authEnv } from "@/lib/env";

/**
 * An auth-aware Supabase client for Server Components, Server Actions, and
 * Route Handlers -- anon-keyed, backed by the request's session cookies.
 *
 * This is deliberately separate from `lib/supabase.ts`'s `db()`, which is the
 * service-role client every data query in this app uses. This client only
 * ever touches `auth.*` (magic-link send/verify, sign-out) -- session
 * identity, not data access.
 *
 * Server Components can't write cookies (a Next.js restriction), so `setAll`
 * is wrapped in a try/catch there; when that happens, `proxy.ts` is what
 * actually persists a refreshed session back to the browser. Server Actions
 * and Route Handlers CAN set cookies, so this same client does the real
 * cookie-writing when called from those contexts (see app/login/actions.ts,
 * app/auth/callback/route.ts).
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = authEnv();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component render -- proxy.ts refreshes and
          // persists the session on the next request instead.
        }
      },
    },
  });
}
