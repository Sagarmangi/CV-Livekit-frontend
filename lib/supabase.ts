import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database";
import { supabaseEnv } from "@/lib/env";

/**
 * Service-role Supabase client for use in Server Components and Server Actions.
 *
 * Cached per process rather than per request — the client is stateless and
 * holds no per-user session, since the service-role key is not a user identity.
 */
let cached: SupabaseClient<Database> | null = null;

export function db(): SupabaseClient<Database> {
  if (!cached) {
    const { url, serviceRoleKey } = supabaseEnv();
    cached = createClient<Database>(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}

/**
 * Unwraps a Supabase result, throwing on error.
 *
 * Supabase returns errors in-band rather than rejecting, which is easy to
 * forget at every call site — funnelling reads through this makes a failed
 * query surface as a real error boundary instead of a silently empty table.
 */
export async function expect<T>(
  query: PromiseLike<{ data: T | null; error: { message: string } | null }>,
  context: string,
): Promise<T> {
  const { data, error } = await query;
  if (error) throw new Error(`${context}: ${error.message}`);
  if (data === null) throw new Error(`${context}: no data returned`);
  return data;
}
