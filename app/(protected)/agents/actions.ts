"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  bool,
  fail,
  guard,
  isIdentifier,
  num,
  ok,
  optionalStr,
  rows,
  str,
  type ActionState,
} from "@/lib/forms";
import { voiceProviderEnv } from "@/lib/env";
import { findGeminiVoice } from "@/lib/gemini-voices";
import { db } from "@/lib/supabase";
import type {
  AgentStatus,
  ConversationSettings,
  FirstMessageMode,
  LLMProvider,
  PronunciationEntry,
  QualificationCriterion,
} from "@/lib/types";
import { AGENT_STATUSES, FIRST_MESSAGE_MODES, LLM_PROVIDERS } from "@/lib/types";

/**
 * An agent can be switched to "active" with an LLM provider whose API key
 * was never set on the worker -- the dashboard save succeeds, then every
 * real call to it fails at the worker. Checked wherever status can become
 * "active" so that's caught here instead of on a live caller.
 */
function missingProviderKeyMessage(llmProvider: LLMProvider): string | null {
  const env = voiceProviderEnv();
  if (!env.deepgramApiKey) {
    return "DEEPGRAM_API_KEY isn't set -- every agent needs it for speech-to-text/text-to-speech.";
  }
  if (llmProvider === "groq" && !env.groqApiKey) {
    return "This agent's conversation engine is Groq, but GROQ_API_KEY isn't set -- set it, or switch engines on the Voice & humanness tab, before activating.";
  }
  if (llmProvider === "deepseek" && !env.deepseekApiKey) {
    return "This agent's conversation engine is DeepSeek, but DEEPSEEK_API_KEY isn't set -- set it, or switch engines on the Voice & humanness tab, before activating.";
  }
  // Both Gemini engines read the same key, so one check covers them -- but the
  // message names the engine the admin actually picked, since "Gemini Flash"
  // and "Gemini Live" are separate options in the picker.
  if ((llmProvider === "gemini" || llmProvider === "gemini_live") && !env.geminiApiKey) {
    const engine = llmProvider === "gemini" ? "Gemini Flash" : "Gemini Live";
    return `This agent's conversation engine is ${engine}, but GEMINI_API_KEY isn't set -- set it, or switch engines on the Voice & humanness tab, before activating.`;
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* Create / delete                                                            */
/* -------------------------------------------------------------------------- */

export async function createAgent(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return guard(async () => {
    const name = str(form, "name");
    if (!name) return fail("Give the agent a name.");

    const { data, error } = await db()
      .from("agents")
      .insert({
        name,
        prompt: str(form, "prompt"),
        // New agents start as drafts so an unfinished prompt can't take a live
        // call the moment a number gets attached.
        status: "draft",
      })
      .select("agent_id")
      .single();

    if (error) return fail(`Could not create agent: ${error.message}`);

    revalidatePath("/agents");
    redirect(`/agents/${(data as { agent_id: string }).agent_id}`);
  });
}

export async function deleteAgent(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return guard(async () => {
    const agentId = str(form, "agent_id");
    if (!agentId) return fail("Missing agent id.");

    // This agent's tool selections (agent_tools rows, not the shared tool
    // definitions themselves) cascade. call_logs deliberately do not --
    // they're set to null so call history survives deleting the agent that
    // handled it.
    const { error } = await db().from("agents").delete().eq("agent_id", agentId);
    if (error) return fail(`Could not delete agent: ${error.message}`);

    revalidatePath("/agents");
    redirect("/agents");
  });
}

/* -------------------------------------------------------------------------- */
/* Core config: prompt, persona, status, qualification                        */
/* -------------------------------------------------------------------------- */

export async function updateAgentCore(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return guard(async () => {
    const agentId = str(form, "agent_id");
    if (!agentId) return fail("Missing agent id.");

    const name = str(form, "name");
    if (!name) return fail("Name can't be empty.");

    const status = str(form, "status") as AgentStatus;
    if (!AGENT_STATUSES.includes(status)) return fail("Unknown status.");

    const prompt = str(form, "prompt");
    if (status === "active") {
      if (!prompt) {
        return fail("An active agent needs a prompt — it has nothing to say yet.");
      }
      const { data: current, error: fetchError } = await db()
        .from("agents")
        .select("llm_provider")
        .eq("agent_id", agentId)
        .maybeSingle();
      if (fetchError) return fail(fetchError.message);
      const providerError = missingProviderKeyMessage(
        (current?.llm_provider as LLMProvider) ?? "gemini",
      );
      if (providerError) return fail(providerError);
    }

    const firstMessageMode = str(form, "first_message_mode") as FirstMessageMode;
    if (!FIRST_MESSAGE_MODES.includes(firstMessageMode)) {
      return fail("Unknown first-message mode.");
    }
    const firstMessageText = optionalStr(form, "first_message_text");
    if (firstMessageMode === "agent_says_exact" && !firstMessageText) {
      return fail(
        'The "agent says this exact line" opening needs the line to actually say.',
      );
    }

    const criteria: QualificationCriterion[] = [];
    for (const row of rows(form, [
      "criterion_key",
      "criterion_question",
      "criterion_required",
    ] as const)) {
      // A row with neither field filled in is an empty template row.
      if (!row.criterion_key && !row.criterion_question) continue;
      if (!isIdentifier(row.criterion_key)) {
        return fail(
          `Qualification key "${row.criterion_key}" must be letters, digits and underscores, starting with a letter.`,
        );
      }
      if (!row.criterion_question) {
        return fail(`Qualification "${row.criterion_key}" needs a question.`);
      }
      criteria.push({
        key: row.criterion_key,
        question: row.criterion_question,
        // Checkbox groups collapse when unchecked, so the required flag rides
        // along as an explicit "true"/"false" hidden value per row.
        required: row.criterion_required === "true",
      });
    }

    const duplicate = criteria
      .map((c) => c.key)
      .find((key, i, all) => all.indexOf(key) !== i);
    if (duplicate) return fail(`Duplicate qualification key "${duplicate}".`);

    const endCallWebhookUrl = optionalStr(form, "end_call_webhook_url");
    if (endCallWebhookUrl && !/^https?:\/\//.test(endCallWebhookUrl)) {
      return fail("End-call webhook URL must start with http:// or https://.");
    }

    const { error } = await db()
      .from("agents")
      .update({
        name,
        status,
        prompt,
        first_message_mode: firstMessageMode,
        first_message_text: firstMessageText,
        qualification_criteria: criteria,
        end_call_instructions: optionalStr(form, "end_call_instructions"),
        end_call_webhook_url: endCallWebhookUrl,
        slack_notifications_enabled: bool(form, "slack_notifications_enabled"),
      })
      .eq("agent_id", agentId);

    if (error) return fail(`Could not save: ${error.message}`);

    revalidatePath(`/agents/${agentId}`);
    revalidatePath("/agents");
    return ok("Saved.");
  });
}

/**
 * Renaming or (de)activating an agent, split out of updateAgentCore so the
 * sticky header's quick editor doesn't have to resubmit the whole Prompt &
 * qualification form (prompt, qualification criteria, etc.) just to flip a
 * status -- it only ever touches these two columns.
 */
export async function updateAgentIdentity(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return guard(async () => {
    const agentId = str(form, "agent_id");
    if (!agentId) return fail("Missing agent id.");

    const name = str(form, "name");
    if (!name) return fail("Name can't be empty.");

    const status = str(form, "status") as AgentStatus;
    if (!AGENT_STATUSES.includes(status)) return fail("Unknown status.");

    if (status === "active") {
      const { data: current, error: fetchError } = await db()
        .from("agents")
        .select("prompt, llm_provider")
        .eq("agent_id", agentId)
        .maybeSingle();
      if (fetchError) return fail(fetchError.message);
      if (!current?.prompt) {
        return fail(
          "An active agent needs a prompt -- set one on the Prompt & qualification tab first.",
        );
      }
      const providerError = missingProviderKeyMessage(
        (current.llm_provider as LLMProvider) ?? "gemini",
      );
      if (providerError) return fail(providerError);
    }

    const { error } = await db()
      .from("agents")
      .update({ name, status })
      .eq("agent_id", agentId);
    if (error) return fail(`Could not save: ${error.message}`);

    revalidatePath(`/agents/${agentId}`);
    revalidatePath("/agents");
    return ok("Saved.");
  });
}

/* -------------------------------------------------------------------------- */
/* Voice & humanness (FSD Section 4)                                          */
/* -------------------------------------------------------------------------- */

const CONVERSATION_FIELDS = [
  "temperature",
  "max_reply_sentences",
  "tts_stability",
  "speech_rate",
  "vad_threshold_ms",
  "interruption_sensitivity",
  "backchannel_frequency",
] as const;

/** Accepted ranges for the Section 4.3 tuning parameters. */
const CONVERSATION_RANGES: Record<
  (typeof CONVERSATION_FIELDS)[number],
  [number, number]
> = {
  temperature: [0, 2],
  max_reply_sentences: [1, 10],
  tts_stability: [0, 1],
  speech_rate: [0.5, 2],
  vad_threshold_ms: [100, 3000],
  interruption_sensitivity: [0, 1],
  backchannel_frequency: [0, 1],
};

export async function updateAgentVoice(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return guard(async () => {
    const agentId = str(form, "agent_id");
    if (!agentId) return fail("Missing agent id.");

    const llmProvider = str(form, "llm_provider") as LLMProvider;
    if (!LLM_PROVIDERS.includes(llmProvider)) return fail("Unknown LLM provider.");

    // Switching engines on an already-active agent is the other way this
    // gap showed up: the prompt/status checks in updateAgentCore/
    // updateAgentIdentity never re-run here, so an active agent could be
    // pointed at a provider with no key set without either of them catching it.
    const { data: currentAgent, error: statusFetchError } = await db()
      .from("agents")
      .select("status")
      .eq("agent_id", agentId)
      .maybeSingle();
    if (statusFetchError) return fail(statusFetchError.message);
    if (currentAgent?.status === "active") {
      const providerError = missingProviderKeyMessage(llmProvider);
      if (providerError) return fail(providerError);
    }

    const settings: ConversationSettings = {};
    for (const field of CONVERSATION_FIELDS) {
      const value = num(form, field);
      if (value === null) continue; // Left blank: fall back to the worker default.
      const [min, max] = CONVERSATION_RANGES[field];
      if (value < min || value > max) {
        return fail(
          `${field.replace(/_/g, " ")} must be between ${min} and ${max}.`,
        );
      }
      settings[field] = value;
    }

    // Validated against the catalog rather than passed through: unlike a
    // Deepgram model name (where a raw string is legitimately useful for a
    // brand-new release), Gemini Live rejects anything outside its fixed set,
    // and it would only surface as a failed call.
    const geminiVoice = optionalStr(form, "gemini_voice");
    if (geminiVoice && !findGeminiVoice(geminiVoice)) {
      return fail(`"${geminiVoice}" isn't one of Gemini Live's prebuilt voices.`);
    }

    const dictionary: PronunciationEntry[] = [];
    for (const row of rows(form, ["term", "say_as"] as const)) {
      if (!row.term && !row.say_as) continue;
      if (!row.term || !row.say_as) {
        return fail("Each pronunciation entry needs both a term and a spoken form.");
      }
      dictionary.push({ term: row.term, say_as: row.say_as });
    }

    const { error } = await db()
      .from("agents")
      .update({
        stt_provider: str(form, "stt_provider") || "deepgram",
        tts_provider: str(form, "tts_provider") || "deepgram",
        llm_provider: llmProvider,
        // Both are always submitted, whichever engine is selected: the form
        // keeps the inactive engine's picker mounted so switching back doesn't
        // find its voice wiped (see sections.tsx VoiceConfigForm).
        voice_id: optionalStr(form, "voice_id"),
        gemini_voice: geminiVoice,
        pronunciation_dictionary: dictionary,
        conversation_settings: settings,
      })
      .eq("agent_id", agentId);

    if (error) return fail(`Could not save: ${error.message}`);

    revalidatePath(`/agents/${agentId}`);
    return ok("Saved.");
  });
}

/* -------------------------------------------------------------------------- */
/* Knowledge base -- one free-text field per agent, see 0013 migration        */
/* -------------------------------------------------------------------------- */

export async function updateAgentKnowledgeBase(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return guard(async () => {
    const agentId = str(form, "agent_id");
    if (!agentId) return fail("Missing agent id.");

    const { error } = await db()
      .from("agents")
      .update({
        knowledge_base_content: str(form, "knowledge_base_content"),
        knowledge_base_description: str(form, "knowledge_base_description"),
      })
      .eq("agent_id", agentId);

    if (error) return fail(`Could not save: ${error.message}`);

    revalidatePath(`/agents/${agentId}`);
    return ok("Saved.");
  });
}

/* -------------------------------------------------------------------------- */
/* Tools -- global library (see /(protected)/tools/actions.ts); this agent    */
/* only picks which of them it uses.                                         */
/* -------------------------------------------------------------------------- */

export async function attachTool(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return guard(async () => {
    const agentId = str(form, "agent_id");
    const toolId = str(form, "tool_id");
    if (!agentId || !toolId) return fail("Missing agent or tool id.");

    const { error } = await db().from("agent_tools").insert({ agent_id: agentId, tool_id: toolId });
    if (error) return fail(`Could not attach tool: ${error.message}`);

    revalidatePath(`/agents/${agentId}`);
    return ok("Tool attached.");
  });
}

export async function detachTool(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return guard(async () => {
    const agentId = str(form, "agent_id");
    const toolId = str(form, "tool_id");
    if (!agentId || !toolId) return fail("Missing agent or tool id.");

    const { error } = await db()
      .from("agent_tools")
      .delete()
      .eq("agent_id", agentId)
      .eq("tool_id", toolId);
    if (error) return fail(`Could not detach tool: ${error.message}`);

    revalidatePath(`/agents/${agentId}`);
    return ok("Tool detached.");
  });
}
