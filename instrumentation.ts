import { loadSecretsIntoEnv } from "@/lib/secrets";

/**
 * Runs once per server instance, before the first request is handled.
 *
 * This is where provider credentials stored in `platform_secrets` get copied
 * into `process.env` (see lib/secrets.ts). Doing it here rather than per-request
 * is what keeps every reader in `lib/env.ts` synchronous: by the time anything
 * renders, the environment already reflects whatever was saved on the
 * Integrations page.
 */
export async function register(): Promise<void> {
  // The Edge runtime gets its own invocation of this file, and it has no
  // Supabase client, no ability to mutate the Node process's environment, and
  // nothing in it reads these credentials -- only the proxy runs there.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  await loadSecretsIntoEnv();
}
