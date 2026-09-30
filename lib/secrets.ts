/**
 * Provider credentials, editable from the Integrations page.
 *
 * How it fits together: a row in `platform_secrets` overrides the matching
 * environment variable for this server process. `loadSecretsIntoEnv()` copies
 * those rows into `process.env` once at startup (see instrumentation.ts), which
 * is what lets every existing reader in `lib/env.ts` stay exactly as it is --
 * plain synchronous `process.env` access, no async plumbing pushed through
 * lib/twilio.ts, lib/livekit.ts and the proxy.
 *
 * Deliberately no `import "server-only"` here, unlike the rest of lib/: this
 * module is imported by instrumentation.ts, which Next compiles outside the
 * React Server Component layer that guard is defined against. It builds its own
 * Supabase client from process.env for the same reason -- so it doesn't pull
 * lib/env.ts or lib/supabase.ts (both server-only) into that file. Nothing here
 * returns a secret value to a caller; the page renders masked previews only.
 */

import { createClient } from "@supabase/supabase-js";

export type SecretKind = "secret" | "plain";

export type ManagedSecret = {
  /** The environment variable this overrides. */
  name: string;
  label: string;
  group: string;
  kind: SecretKind;
  hint: string;
  placeholder?: string;
};

/**
 * What the Integrations page is allowed to change.
 *
 * Supabase's own three variables are absent on purpose: they're the credentials
 * needed to read this table at all, so an override stored inside it could never
 * be loaded, and a bad value would lock the dashboard out of its own database
 * with no way back through the UI. They stay in .env.local.
 */
export const MANAGED_SECRETS: ManagedSecret[] = [
  {
    name: "TWILIO_ACCOUNT_SID",
    label: "Account SID",
    group: "Twilio",
    kind: "plain",
    hint: "Starts with AC. From the Twilio Console dashboard.",
    placeholder: "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  },
  {
    name: "TWILIO_AUTH_TOKEN",
    label: "Auth token",
    group: "Twilio",
    kind: "secret",
    hint: "Also on the Console dashboard. Used for every number and trunk call this dashboard makes.",
  },
  {
    name: "TWILIO_SIP_TRUNK_SID",
    label: "Shared SIP trunk SID",
    group: "Twilio",
    kind: "plain",
    hint: "Starts with TK. The one Elastic SIP Trunk every platform number is attached to.",
    placeholder: "TKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  },
  {
    name: "LIVEKIT_URL",
    label: "Server URL",
    group: "LiveKit",
    kind: "plain",
    hint: "The wss:// URL of the media server. Browser test calls connect straight to this, so it has to be reachable from the browser -- not localhost.",
    placeholder: "wss://livekit.example.com",
  },
  {
    name: "LIVEKIT_API_KEY",
    label: "API key",
    group: "LiveKit",
    kind: "plain",
    hint: "From the LiveKit server's own key configuration.",
  },
  {
    name: "LIVEKIT_API_SECRET",
    label: "API secret",
    group: "LiveKit",
    kind: "secret",
    hint: "Signs the access tokens issued for browser test calls.",
  },
  {
    name: "DEEPGRAM_API_KEY",
    label: "Deepgram",
    group: "Voice pipeline",
    kind: "secret",
    hint: "Speech-to-text and Aura text-to-speech, for every agent that isn't on Gemini Live.",
  },
  {
    name: "GROQ_API_KEY",
    label: "Groq",
    group: "Voice pipeline",
    kind: "secret",
    hint: "The default conversation engine (Llama 3.3 70B).",
  },
  {
    name: "DEEPSEEK_API_KEY",
    label: "DeepSeek",
    group: "Voice pipeline",
    kind: "secret",
    hint: "Only needed if an agent opts into the DeepSeek engine.",
  },
  {
    name: "DEEPSEEK_BASE_URL",
    label: "DeepSeek base URL",
    group: "Voice pipeline",
    kind: "plain",
    hint: "Leave blank for DeepSeek's own API. Set it to point at a compatible proxy instead.",
    placeholder: "https://api.deepseek.com",
  },
  {
    name: "GEMINI_API_KEY",
    label: "Gemini",
    group: "Voice pipeline",
    kind: "secret",
    hint: "Only needed if an agent opts into the Gemini Live realtime engine.",
  },
  {
    name: "SLACK_WEBHOOK_URL",
    label: "Slack webhook",
    group: "Notifications",
    kind: "secret",
    hint: "Incoming-webhook URL for call summaries and transfer-failure alerts. Blank disables Slack notifications.",
    placeholder: "https://hooks.slack.com/services/…",
  },
];

export const SECRET_GROUPS = [
  "Twilio",
  "LiveKit",
  "Voice pipeline",
  "Notifications",
] as const;

const MANAGED_NAMES = new Set(MANAGED_SECRETS.map((s) => s.name));

/** Which names currently come from the database rather than the environment.
 * Populated by `loadSecretsIntoEnv` and kept in step by `saveSecrets`, so the
 * page can tell an admin where a value is actually coming from. */
const fromDatabase = new Set<string>();

/**
 * What each managed variable held in the environment before any override was
 * applied -- i.e. what .env.local actually says.
 *
 * Captured because overriding is destructive to `process.env`: without this,
 * clearing an override later could only delete the variable, leaving the
 * dashboard reporting "unset" for a credential that is in fact sitting in the
 * env file, until the next restart.
 */
const environmentBaseline = new Map<string, string | undefined>();

function rememberBaseline(name: string): void {
  if (!environmentBaseline.has(name)) {
    environmentBaseline.set(name, process.env[name]);
  }
}

function serviceClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Copies every stored override into `process.env`. Called once per server
 * start, before any request is served.
 *
 * Never throws: a dashboard that can't reach Supabase at boot should still come
 * up and show its own broken-integration banner, not fail to start.
 */
export async function loadSecretsIntoEnv(): Promise<void> {
  const client = serviceClient();
  if (!client) return;

  const { data, error } = await client
    .from("platform_secrets")
    .select("name, value");

  if (error || !data) return;

  for (const row of data as { name: string; value: string }[]) {
    // Anything not in the managed list is ignored rather than trusted -- this
    // writes into process.env, so the table is not allowed to introduce
    // variables the code never intended to be overridable.
    if (!MANAGED_NAMES.has(row.name)) continue;
    rememberBaseline(row.name);
    process.env[row.name] = row.value;
    fromDatabase.add(row.name);
  }
}

export type SecretSource = "database" | "environment" | "unset";

export type SecretStatus = {
  name: string;
  source: SecretSource;
  /** Safe to render: full value for `plain`, last four characters otherwise. */
  preview: string | null;
};

/** Masks a value for display. Never returns enough of a secret to use it. */
function preview(value: string, kind: SecretKind): string {
  if (kind === "plain") return value;
  const tail = value.slice(-4);
  return value.length > 4 ? `••••••••${tail}` : "••••••••";
}

/** The current state of every managed credential, for rendering. */
export function secretStatuses(): SecretStatus[] {
  return MANAGED_SECRETS.map((secret) => {
    const value = process.env[secret.name];
    if (!value) return { name: secret.name, source: "unset" as const, preview: null };
    return {
      name: secret.name,
      source: fromDatabase.has(secret.name) ? ("database" as const) : ("environment" as const),
      preview: preview(value, secret.kind),
    };
  });
}

export type SecretChange =
  /** Write this value, overriding whatever the environment says. */
  | { name: string; action: "set"; value: string }
  /** Drop the override and fall back to the environment. */
  | { name: string; action: "clear" };

/**
 * Applies changes to the table and to this process at the same time, so a
 * saved key takes effect on the very next request instead of at the next
 * deploy.
 *
 * Worth being clear about the limits: only *this* process is updated in memory.
 * Other dashboard instances pick the change up when they next start, and the
 * Python agent worker reads its own environment entirely -- it needs a restart
 * to see a new key. The UI says so.
 */
export async function saveSecrets(
  changes: SecretChange[],
  updatedBy: string,
): Promise<{ error: string | null }> {
  const client = serviceClient();
  if (!client) return { error: "Supabase isn't configured, so there's nowhere to store this." };

  const sets = changes.filter(
    (c): c is Extract<SecretChange, { action: "set" }> => c.action === "set",
  );
  const clears = changes.filter((c) => c.action === "clear");

  if (sets.length > 0) {
    const { error } = await client.from("platform_secrets").upsert(
      sets.map((c) => ({
        name: c.name,
        value: c.value,
        updated_at: new Date().toISOString(),
        updated_by: updatedBy,
      })),
      { onConflict: "name" },
    );
    if (error) return { error: error.message };
  }

  if (clears.length > 0) {
    const { error } = await client
      .from("platform_secrets")
      .delete()
      .in(
        "name",
        clears.map((c) => c.name),
      );
    if (error) return { error: error.message };
  }

  // Only mirrored into this process once the write succeeded -- otherwise a
  // failed save would still appear to have taken effect until the next restart.
  for (const change of sets) {
    rememberBaseline(change.name);
    process.env[change.name] = change.value;
    fromDatabase.add(change.name);
  }
  for (const change of clears) {
    // Back to what the environment file said, not to nothing.
    const baseline = environmentBaseline.get(change.name);
    if (baseline === undefined) delete process.env[change.name];
    else process.env[change.name] = baseline;
    fromDatabase.delete(change.name);
  }

  return { error: null };
}
