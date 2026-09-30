/**
 * Server-only environment access.
 *
 * Every value here is a secret or an admin-scoped credential, so nothing in
 * this file may ever be imported from a Client Component. Reads are lazy and
 * grouped by integration: the dashboard should still render the agents list
 * when, say, Twilio isn't configured yet — only the numbers page should fail.
 */

import "server-only";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. ` +
        `Copy dashboard/.env.example to dashboard/.env.local and fill it in.`,
    );
  }
  return value;
}

export function supabaseEnv() {
  return {
    url: required("SUPABASE_URL"),
    // The service-role key bypasses RLS. This dashboard is an internal admin
    // tool that only ever talks to Supabase from Server Components and Server
    // Actions, so that's intended — but it is exactly why none of this can be
    // exposed with a NEXT_PUBLIC_ prefix.
    serviceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  };
}

export function authEnv() {
  return {
    url: required("SUPABASE_URL"),
    // The anon key is the intentionally-public one -- Auth (password
    // sign-in) is designed to be called with it. It's still read
    // server-only here because every auth call in this app happens from a
    // Server Action, Route Handler, or proxy -- there's no browser-side
    // Supabase client, so there's no reason to also expose it as
    // NEXT_PUBLIC_.
    anonKey: required("SUPABASE_ANON_KEY"),
  };
}

export function twilioEnv() {
  return {
    accountSid: required("TWILIO_ACCOUNT_SID"),
    authToken: required("TWILIO_AUTH_TOKEN"),
    /**
     * SID of the one shared Elastic SIP Trunk (starts with `TK`). Per the
     * Project Plan v2 scope addition, this trunk is created once by hand and
     * stays static; the dashboard only attaches and detaches numbers on it.
     */
    trunkSid: required("TWILIO_SIP_TRUNK_SID"),
  };
}

export function livekitEnv() {
  return {
    url: required("LIVEKIT_URL"),
    apiKey: required("LIVEKIT_API_KEY"),
    apiSecret: required("LIVEKIT_API_SECRET"),
  };
}

/**
 * The voice-pipeline provider keys the agent worker uses -- mirrored here
 * (not required) purely so the dashboard's integrations status page can run
 * live health checks against them. Every field is optional: an agent that
 * never uses DeepSeek/Gemini Live shouldn't force those keys to exist, and
 * "not configured" is itself a status this page needs to be able to show.
 */
export function voiceProviderEnv() {
  return {
    deepgramApiKey: process.env.DEEPGRAM_API_KEY || null,
    groqApiKey: process.env.GROQ_API_KEY || null,
    deepseekApiKey: process.env.DEEPSEEK_API_KEY || null,
    deepseekBaseUrl: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
    geminiApiKey: process.env.GEMINI_API_KEY || null,
    slackWebhookUrl: process.env.SLACK_WEBHOOK_URL || null,
  };
}

/**
 * Which integrations are usable right now. The UI uses this to explain what an
 * admin still needs to configure instead of throwing an unhandled error.
 */
export function integrationStatus() {
  const check = (fn: () => unknown) => {
    try {
      fn();
      return true;
    } catch {
      return false;
    }
  };
  return {
    supabase: check(supabaseEnv),
    twilio: check(twilioEnv),
    livekit: check(livekitEnv),
  };
}
