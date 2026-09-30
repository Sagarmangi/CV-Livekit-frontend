import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { authEnv } from "@/lib/env";

/**
 * Runs before every request: refreshes the Supabase session cookie (so it
 * doesn't silently expire mid-visit) and does an optimistic redirect to
 * /login when there's no session at all.
 *
 * Deliberately does NOT check the `allowed_users` table -- Next's own proxy
 * docs warn against using it as "a full session management or authorization
 * solution" and against slow data fetching here. The real allowlist gate is
 * `requireAllowedUser()` in app/(protected)/layout.tsx; this is just the fast
 * "is there a session at all" check plus keeping the cookie fresh.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const { url, anonKey } = authEnv();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // Re-create the response after mutating request cookies so a token
        // refresh that happens mid-request is visible to both the rest of
        // this request's cookie reads and the outgoing response.
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // `getClaims()` rather than `getUser()`: this runs on every request the
  // matcher below lets through -- including the RSC fetch behind every single
  // client-side navigation -- and `getUser()` is a round trip to the auth
  // server each time (~400ms from here). `getClaims()` verifies the token's
  // signature locally against the project's public JWK, falling back to
  // `getUser()` by itself if the project isn't on asymmetric keys. Either way
  // the session cookie still gets refreshed, because both read the session
  // through the cookie adapter above.
  const { data } = await supabase.auth.getClaims();

  const isPublicPath = request.nextUrl.pathname.startsWith("/login");

  if (!data?.claims && !isPublicPath) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
