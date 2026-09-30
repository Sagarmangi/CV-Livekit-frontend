import "server-only";

import { authEnv, livekitEnv, supabaseEnv, twilioEnv, voiceProviderEnv } from "@/lib/env";
import { describeSipConfig } from "@/lib/livekit";
import { db } from "@/lib/supabase";
import { describeSharedTrunk } from "@/lib/twilio";

/**
 * One deliberately narrow status vocabulary for every integration on this
 * page, so "what's actually wrong" is always one of these, not a raw error
 * string the admin has to interpret themselves.
 */
export type HealthStatus =
  | "ok"
  | "not_configured"
  | "auth_error"
  | "quota_error"
  | "network_error"
  | "error";

export type HealthCheck = {
  name: string;
  /** Short phrase for what this integration is used for, shown under the name. */
  usedFor: string;
  status: HealthStatus;
  message: string;
};

const STATUS_ORDER: Record<HealthStatus, number> = {
  auth_error: 0,
  quota_error: 1,
  network_error: 2,
  error: 3,
  not_configured: 4,
  ok: 5,
};

/** True for anything worth surfacing in a top-of-page alert -- configured but broken. */
export function isActiveError(status: HealthStatus): boolean {
  return status === "auth_error" || status === "quota_error" || status === "network_error" || status === "error";
}

/**
 * Classifies an HTTP response into our status vocabulary. 401/403 -> misconfigured
 * key, 429 -> rate limit/quota, everything else 4xx/5xx -> generic error. This
 * mapping is the same across every REST-based provider we check.
 */
function classifyHttpStatus(httpStatus: number): HealthStatus {
  if (httpStatus === 401 || httpStatus === 403) return "auth_error";
  if (httpStatus === 429) return "quota_error";
  if (httpStatus >= 200 && httpStatus < 300) return "ok";
  return "error";
}

/** Classifies a thrown error (network failure, timeout, DNS, etc.) that never got an HTTP response. */
function classifyException(error: unknown): { status: HealthStatus; message: string } {
  if (error instanceof Error) {
    if (error.name === "AbortError" || /timeout/i.test(error.message)) {
      return { status: "network_error", message: "Request timed out." };
    }
    if (/fetch failed|ENOTFOUND|ECONNREFUSED|network/i.test(error.message)) {
      return { status: "network_error", message: `Couldn't reach the API: ${error.message}` };
    }
    return { status: "error", message: error.message };
  }
  return { status: "error", message: "Unknown error." };
}

async function pingRest(
  url: string,
  headers: Record<string, string>,
  timeoutMs = 8000,
): Promise<{ status: HealthStatus; message: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { headers, signal: controller.signal });
    const status = classifyHttpStatus(response.status);
    if (status === "ok") return { status, message: "Reachable, key accepted." };
    if (status === "auth_error") return { status, message: `Rejected the API key (HTTP ${response.status}).` };
    if (status === "quota_error") return { status, message: "Rate limit or quota exceeded (HTTP 429)." };
    return { status, message: `Unexpected response (HTTP ${response.status}).` };
  } catch (error) {
    return classifyException(error);
  } finally {
    clearTimeout(timeout);
  }
}

async function checkSupabase(): Promise<HealthCheck> {
  const base = { name: "Supabase", usedFor: "database for agents, numbers, call logs" };
  try {
    supabaseEnv();
  } catch {
    return { ...base, status: "not_configured", message: "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set." };
  }
  const { error } = await db().from("agents").select("agent_id").limit(1);
  if (!error) return { ...base, status: "ok", message: "Reachable, query succeeded." };
  if (/JWT|API key|permission denied/i.test(error.message)) {
    return { ...base, status: "auth_error", message: error.message };
  }
  return { ...base, status: "error", message: error.message };
}

async function checkAuth(): Promise<HealthCheck> {
  const base = { name: "Auth (login)", usedFor: "dashboard sign-in" };
  try {
    authEnv();
  } catch {
    return { ...base, status: "not_configured", message: "SUPABASE_ANON_KEY not set." };
  }
  return { ...base, status: "ok", message: "Configured." };
}

async function checkTwilio(): Promise<HealthCheck> {
  const base = { name: "Twilio", usedFor: "phone numbers + SIP trunk" };
  try {
    twilioEnv();
  } catch {
    return { ...base, status: "not_configured", message: "Account SID / auth token / trunk SID not set." };
  }
  try {
    const trunk = await describeSharedTrunk();
    return { ...base, status: "ok", message: `Trunk "${trunk.friendlyName}" reachable.` };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    if (/authenticate|401|20003/i.test(message)) return { ...base, status: "auth_error", message };
    if (/20429|429|too many requests/i.test(message)) return { ...base, status: "quota_error", message };
    return { ...base, status: "error", message };
  }
}

async function checkLiveKit(): Promise<HealthCheck> {
  const base = { name: "LiveKit", usedFor: "self-hosted media server + SIP" };
  try {
    livekitEnv();
  } catch {
    return { ...base, status: "not_configured", message: "LIVEKIT_URL / API key / secret not set." };
  }
  try {
    await describeSipConfig();
    return { ...base, status: "ok", message: "Reachable, SIP config read successfully." };
  } catch (error) {
    return { ...base, status: "network_error", message: error instanceof Error ? error.message : "Unreachable." };
  }
}

async function checkDeepgram(apiKey: string | null): Promise<HealthCheck> {
  const base = { name: "Deepgram", usedFor: "speech-to-text + Aura text-to-speech" };
  if (!apiKey) return { ...base, status: "not_configured", message: "DEEPGRAM_API_KEY not set." };
  const result = await pingRest("https://api.deepgram.com/v1/projects", { Authorization: `Token ${apiKey}` });
  return { ...base, ...result };
}

async function checkGroq(apiKey: string | null): Promise<HealthCheck> {
  const base = { name: "Groq", usedFor: "default conversation LLM (Llama 3.3 70B)" };
  if (!apiKey) return { ...base, status: "not_configured", message: "GROQ_API_KEY not set." };
  const result = await pingRest("https://api.groq.com/openai/v1/models", { Authorization: `Bearer ${apiKey}` });
  return { ...base, ...result };
}

async function checkDeepSeek(apiKey: string | null, baseUrl: string): Promise<HealthCheck> {
  const base = { name: "DeepSeek", usedFor: "opt-in cheaper/slower LLM, per-agent" };
  if (!apiKey) return { ...base, status: "not_configured", message: "DEEPSEEK_API_KEY not set (only needed if an agent opts in)." };
  const result = await pingRest(`${baseUrl}/models`, { Authorization: `Bearer ${apiKey}` });
  return { ...base, ...result };
}

async function checkGemini(apiKey: string | null): Promise<HealthCheck> {
  const base = { name: "Gemini Live", usedFor: "opt-in realtime speech-to-speech engine, per-agent" };
  if (!apiKey) return { ...base, status: "not_configured", message: "GEMINI_API_KEY not set (only needed if an agent opts in)." };
  const result = await pingRest(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
    {},
  );
  return { ...base, ...result };
}

async function checkSlack(webhookUrl: string | null): Promise<HealthCheck> {
  const base = { name: "Slack", usedFor: "call summary + transfer-failure notifications" };
  if (!webhookUrl) return { ...base, status: "not_configured", message: "SLACK_WEBHOOK_URL not set." };
  // Deliberately not a live test: posting to verify would put a real message in
  // the channel every time this page loads. Configured-but-broken here would
  // only surface the next time the worker actually tries to notify.
  return { ...base, status: "ok", message: "Configured (not live-tested -- would post a real message)." };
}

export async function checkAllIntegrations(): Promise<HealthCheck[]> {
  const voice = voiceProviderEnv();

  const results = await Promise.all([
    checkSupabase(),
    checkAuth(),
    checkTwilio(),
    checkLiveKit(),
    checkDeepgram(voice.deepgramApiKey),
    checkGroq(voice.groqApiKey),
    checkDeepSeek(voice.deepseekApiKey, voice.deepseekBaseUrl),
    checkGemini(voice.geminiApiKey),
    checkSlack(voice.slackWebhookUrl),
  ]);

  return results.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
}
