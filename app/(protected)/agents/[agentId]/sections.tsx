"use client";

import { useRef, useState } from "react";
import {
  attachTool,
  deleteAgent,
  detachTool,
  updateAgentCore,
  updateAgentKnowledgeBase,
  updateAgentVoice,
} from "@/app/(protected)/agents/actions";
import { Dropdown } from "@/components/dropdown";
import { ActionButton, ActionForm } from "@/components/form";
import { RepeatableRows } from "@/components/repeatable-rows";
import { GEMINI_DEFAULT_VOICE, GEMINI_VOICES } from "@/lib/gemini-voices";
import { toolTypeMeta } from "@/lib/tool-display";
import {
  Button,
  Checkbox,
  Chevron,
  Field,
  FieldSet,
  Input,
  StaticValue,
  Textarea,
  TextLink,
  ToolTypeGlyph,
} from "@/components/ui";
import { VoicePicker } from "@/components/voice-picker";
import type { Agent, FirstMessageMode, LLMProvider, Tool } from "@/lib/types";
import {
  BUILTIN_TOOLS,
  CONVERSATION_SETTING_DEFAULTS,
  FIRST_MESSAGE_MODES,
  LLM_PROVIDERS,
} from "@/lib/types";

/* Short enough to read in full inside the closed <select>; the trade-offs live
 * in the tooltips below rather than being truncated mid-word. */
const LLM_PROVIDER_LABELS: Record<LLMProvider, string> = {
  gemini: "Gemini Flash — fastest (default)",
  deepseek: "DeepSeek — v4 Flash",
  groq: "Groq — Llama 3.3 70B",
  gemini_live: "Gemini Live — speech-to-speech",
};

/** Shown as each <option>'s hover tooltip (native `title` attribute). */
const LLM_PROVIDER_TOOLTIPS: Record<LLMProvider, string> = {
  gemini:
    "Gemini Flash as a text model inside the Deepgram pipeline, with reasoning turned off. Fastest measured time to first word (~0.5s), and it keeps every turn-taking setting below. Best default for call latency.",
  deepseek:
    "Cheaper per output token, but roughly 0.1-0.15s slower to first word than Gemini Flash against DeepSeek's own API. Point DEEPSEEK_BASE_URL at a faster host (DeepInfra, Together) to close most of that gap.",
  groq: "Llama 3.3 70B on Groq's LPU hardware. Kept as a fallback -- this account's Groq key is currently being rejected, so an agent set to it will fail when it takes a call.",
  gemini_live:
    "Google's realtime speech-to-speech model. Skips separate STT/TTS entirely, so it's the cheapest option -- but it can't use the pronunciation dictionary, and it decides turn-taking itself rather than through the settings below, which makes it fragile on a noisy phone line.",
};

const FIRST_MESSAGE_LABELS: Record<FirstMessageMode, string> = {
  agent_generates: "Agent greets, ad-libbed from the prompt (default)",
  agent_says_exact: "Agent says this exact line",
  user_starts: "Caller speaks first -- agent stays silent until then",
};

const FIRST_MESSAGE_TOOLTIPS: Record<FirstMessageMode, string> = {
  agent_generates:
    "The model writes its own greeting each call, following the system prompt's persona -- never word-for-word identical twice.",
  agent_says_exact:
    "Skips the model entirely for the opening line -- spoken exactly as typed below, every call, then the conversation continues normally from the prompt.",
  user_starts:
    "The agent says nothing when the call connects. It waits for the caller to speak first, then responds normally.",
};

/* -------------------------------------------------------------------------- */
/* Prompt, persona, status, qualification criteria                            */
/* -------------------------------------------------------------------------- */

export function CoreConfigForm({ agent }: { agent: Agent }) {
  const [firstMessageMode, setFirstMessageMode] = useState<FirstMessageMode>(
    agent.first_message_mode,
  );

  return (
    <ActionForm action={updateAgentCore} pendingLabel="Saving…">
      <input type="hidden" name="agent_id" value={agent.agent_id} />
      {/* Persona name/status now edit from the sticky header (see
          identity-form.tsx) -- carried here unchanged so this form's own
          full-row save doesn't overwrite whatever's set there. */}
      <input type="hidden" name="name" value={agent.name} />
      <input type="hidden" name="status" value={agent.status} />

      <FieldSet legend="Call opening">
        <Field
          label="Who speaks first"
          htmlFor="first-message-mode"
          badge="required"
          hint="Controls only the very first line of the call -- everything after follows the prompt normally regardless of this setting."
        >
          <Dropdown
            id="first-message-mode"
            name="first_message_mode"
            value={firstMessageMode}
            onValueChange={(next) => setFirstMessageMode(next as FirstMessageMode)}
            options={FIRST_MESSAGE_MODES.map((mode) => ({
              value: mode,
              label: FIRST_MESSAGE_LABELS[mode],
              description: FIRST_MESSAGE_TOOLTIPS[mode],
            }))}
          />
        </Field>
        {/* Stays mounted (just visually hidden) rather than unmounting when the
            mode changes -- so switching away and back doesn't lose whatever
            was typed here, and saving in another mode doesn't wipe it. */}
        <div hidden={firstMessageMode !== "agent_says_exact"}>
          <Field
            label="Exact opening line"
            htmlFor="first-message-text"
            badge="required"
            hint="Spoken word-for-word, every call -- not written by the model."
          >
            <Textarea
              id="first-message-text"
              name="first_message_text"
              rows={2}
              defaultValue={agent.first_message_text ?? ""}
              placeholder="Thanks for calling Kodexo Labs, this is Ava -- how can I help you today?"
            />
          </Field>
        </div>
      </FieldSet>

      <Field
        label="System prompt"
        htmlFor="agent-prompt"
        badge="Required to activate"
        hint="The agent's standing instructions: who it is, how it opens, how it handles the call. The worker sends this as the system message on every turn. Can be left blank while the agent is a draft, but Status can't be set to active without one."
      >
        <Textarea
          id="agent-prompt"
          name="prompt"
          rows={18}
          defaultValue={agent.prompt}
          placeholder="You are the receptionist for Kodexo Labs…"
        />
      </Field>

      <FieldSet
        legend="Qualification criteria"
        description="Optional overall — no rows means the agent qualifies freely from the
          prompt alone. But once a row is started, both Key and What to find
          out become required for that row. The key is how the answer is
          reported back in the call log, so it has to be identifier-safe."
      >
        <RepeatableRows
          addLabel="Add criterion"
          emptyHint="No criteria yet — the agent will qualify freely from the prompt alone."
          columns={[
            {
              name: "criterion_key",
              kind: "text",
              label: "Key",
              placeholder: "project_type",
              width: "sm:w-52",
            },
            {
              name: "criterion_question",
              kind: "text",
              label: "What to find out",
              placeholder: "What kind of project are they looking to build?",
            },
            { name: "criterion_required", kind: "bool", label: "Required" },
          ]}
          initial={agent.qualification_criteria.map((c) => ({
            criterion_key: c.key,
            criterion_question: c.question,
            criterion_required: String(c.required),
          }))}
        />
      </FieldSet>

      <FieldSet legend="When to end the call">
        <Field
          label="End-call conditions"
          htmlFor="end-call-instructions"
          badge="optional"
          hint='The built-in end_call tool always does the actual hang-up -- this only changes the conditions the model watches for before calling it. Leave blank to use the default: end once qualification is complete and there is nothing further to transfer or discuss. Example: "End the call once the caller has booked a demo slot, or after they decline twice."'
        >
          <Textarea
            id="end-call-instructions"
            name="end_call_instructions"
            rows={3}
            defaultValue={agent.end_call_instructions ?? ""}
            placeholder="End once qualification is complete and there's nothing further to discuss."
          />
        </Field>
        <Field
          label="End-call webhook URL"
          htmlFor="end-call-webhook-url"
          badge="optional"
          hint="Posts the full call record -- transcript, outcome, lead info -- to this URL right after the call ends. Fires for test calls too, not just real ones. There's no call recording yet, so the payload's recording_url is always null."
        >
          <Input
            id="end-call-webhook-url"
            name="end_call_webhook_url"
            defaultValue={agent.end_call_webhook_url ?? ""}
            placeholder="https://n8n.example.com/webhook/call-ended"
          />
        </Field>
        <Field
          label="Slack notifications"
          htmlFor="slack-notifications-enabled"
          badge="off by default"
          hint="Posts to Slack when a call captures lead details — a name, company or what they need — and when a transfer fails and someone owes the caller a callback. Nothing else: spam, wrong numbers and calls that dropped early stay in the call log without becoming a message. Needs SLACK_WEBHOOK_URL set on the worker as well; if that's missing, nothing arrives even with this on."
        >
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              id="slack-notifications-enabled"
              name="slack_notifications_enabled"
              defaultChecked={agent.slack_notifications_enabled}
            />
            Post this agent&apos;s leads to Slack
          </label>
        </Field>
      </FieldSet>
    </ActionForm>
  );
}

/* -------------------------------------------------------------------------- */
/* Voice & humanness                                                          */
/* -------------------------------------------------------------------------- */

/**
 * The FSD Section 4.3 tuning parameters, with the ranges the action enforces.
 *
 * `appliesTo` is the honest answer to "does moving this actually change a
 * call?", read off the worker rather than assumed:
 *
 *  - "all"      -- reaches every engine, though not always by the same route.
 *                  temperature and max_reply_sentences go into the
 *                  model/prompt. The two turn-taking values go into
 *                  AgentSession's TurnHandlingOptions on the STT/LLM/TTS
 *                  pipeline, but a realtime model owns turn-taking outright and
 *                  discards those options, so for Gemini Live the worker
 *                  translates them into Gemini's own activity-detection config
 *                  instead -- same intent, different mechanism and slightly
 *                  different units. `realtimeNote` spells out the difference on
 *                  the field itself; see entrypoint.py
 *                  `_gemini_activity_detection`.
 *  - "none"     -- stored, but nothing consumes it today. Deepgram Aura exposes
 *                  no stability or rate control and the worker has no
 *                  backchannel behaviour, so these are placeholders for a TTS
 *                  vendor that supports them.
 */
const TUNING_FIELDS = [
  {
    name: "temperature",
    label: "Temperature",
    step: "0.05",
    min: 0,
    max: 2,
    hint: "Lower is more predictable and on-script.",
    appliesTo: "all",
  },
  {
    name: "max_reply_sentences",
    label: "Max reply sentences",
    step: "1",
    min: 1,
    max: 10,
    hint: "Long answers feel like a bot reading. Two is usually right.",
    appliesTo: "all",
  },
  {
    name: "vad_threshold_ms",
    label: "Silence before replying (ms)",
    step: "10",
    min: 100,
    max: 3000,
    hint: "Too low and the agent talks over a caller who paused to think.",
    appliesTo: "all",
    realtimeNote:
      "On Gemini Live this becomes Gemini's own silence timer, with a 500ms floor — its detector is purely time-based, so anything shorter cuts callers off mid-pause.",
  },
  {
    name: "interruption_sensitivity",
    label: "Interruption sensitivity",
    step: "0.05",
    min: 0,
    max: 1,
    hint: "How readily barge-in stops the agent mid-sentence.",
    appliesTo: "all",
    realtimeNote:
      "On Gemini Live this sets how long speech has to persist before it counts as barge-in. Lower it if background noise is stopping the agent mid-sentence.",
  },
  {
    name: "tts_stability",
    label: "TTS stability",
    step: "0.05",
    min: 0,
    max: 1,
    hint: "Higher is steadier but flatter.",
    appliesTo: "none",
  },
  {
    name: "speech_rate",
    label: "Speech rate",
    step: "0.05",
    min: 0.5,
    max: 2,
    hint: "1.0 is the voice's natural pace.",
    appliesTo: "none",
  },
  {
    name: "backchannel_frequency",
    label: "Backchannel frequency",
    step: "0.05",
    min: 0,
    max: 1,
    hint: 'How often it drops in an "mm-hm" while listening.',
    appliesTo: "none",
  },
] as const;

/** Shown against a field that the current configuration doesn't route to, so a
 * value that will have no effect never looks like it's doing something. */
function InactiveNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[0.6875rem] leading-relaxed text-warning-text">{children}</p>
  );
}

export function VoiceConfigForm({ agent }: { agent: Agent }) {
  const tuningRef = useRef<HTMLDivElement>(null);
  // Gemini Live is a speech-to-speech model: the worker hands it audio directly
  // and builds no STT or TTS stage at all (see entrypoint.py
  // `_build_session_kwargs`). Everything downstream of "there is a TTS step"
  // therefore does nothing while it's selected -- tracked here so the form can
  // say so instead of showing Deepgram as though it were still in the path.
  const [llmProvider, setLlmProvider] = useState<LLMProvider>(agent.llm_provider);
  const realtime = llmProvider === "gemini_live";

  return (
    <ActionForm action={updateAgentVoice} pendingLabel="Saving…">
      <input type="hidden" name="agent_id" value={agent.agent_id} />

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Not editable: the worker always uses Deepgram for both --
            agent.stt_provider/tts_provider aren't read anywhere in the worker
            code, so an editable field here would silently do nothing. */}
        <Field
          label="Speech-to-text"
          badge={realtime ? "Not used" : "Fixed"}
          hint="Fixed for every agent that runs the STT/LLM/TTS pipeline. Gemini Live doesn't use a separate transcriber at all."
        >
          <StaticValue>
            {realtime ? "Handled by Gemini Live" : "Deepgram"}
          </StaticValue>
          <input type="hidden" name="stt_provider" value="deepgram" />
        </Field>
        <Field
          label="Text-to-speech"
          badge={realtime ? "Not used" : "Fixed"}
          hint="Fixed for every agent that runs the STT/LLM/TTS pipeline. Gemini Live generates its own audio."
        >
          <StaticValue>
            {realtime ? "Handled by Gemini Live" : "Deepgram (Aura)"}
          </StaticValue>
          <input type="hidden" name="tts_provider" value="deepgram" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Conversation engine"
          htmlFor="llm-provider"
          badge="required"
          hint="Groq is the fast default. DeepSeek is cheaper per-token but noticeably slower to respond. Gemini Live replaces the whole voice pipeline (no separate STT/TTS) -- cheapest option, but it drops the voice picker, the pronunciation dictionary, and the TTS tuning settings below. See VOICE_STACK_DECISION.md before switching a live agent."
        >
          <Dropdown
            id="llm-provider"
            name="llm_provider"
            value={llmProvider}
            onValueChange={(next) => setLlmProvider(next as LLMProvider)}
            options={LLM_PROVIDERS.map((provider) => ({
              value: provider,
              label: LLM_PROVIDER_LABELS[provider],
              description: LLM_PROVIDER_TOOLTIPS[provider],
            }))}
          />
        </Field>
        {/* One field, two catalogs. Each engine's picker stays mounted whichever
            is selected -- unmounting one would drop its field from the
            submission and wipe a voice that matters again the moment the engine
            is switched back. They write to separate columns for the same reason
            (see the 0018 migration). */}
        <Field
          label="Voice"
          htmlFor={realtime ? "gemini-voice" : "voice-id"}
          badge="optional"
          hint={
            realtime
              ? "Gemini Live speaks with one of its own prebuilt voices -- there's no separate TTS vendor to configure. Leave blank for the default (Puck)."
              : "Search by name, language, gender, or style. You can also paste a raw Deepgram model name directly. Leave blank to use the worker's default voice."
          }
        >
          <div hidden={realtime}>
            <VoicePicker id="voice-id" fieldName="voice_id" defaultValue={agent.voice_id ?? ""} />
          </div>
          <div hidden={!realtime}>
            <Dropdown
              id="gemini-voice"
              name="gemini_voice"
              defaultValue={agent.gemini_voice ?? ""}
              options={[
                { value: "", label: `Worker default (${GEMINI_DEFAULT_VOICE})` },
                ...GEMINI_VOICES.map((voice) => ({
                  value: voice.id,
                  label: voice.id,
                  description: voice.character,
                })),
              ]}
            />
          </div>
        </Field>
      </div>

      <FieldSet legend="Conversation tuning">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="max-w-2xl text-xs leading-relaxed text-muted">
            Leave a field blank to use the worker&apos;s default, shown as the
            placeholder. &ldquo;Reset to default&rdquo; clears these fields --
            click Save afterward to persist it.
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              const inputs = tuningRef.current?.querySelectorAll("input");
              inputs?.forEach((input) => {
                input.value = "";
              });
            }}
          >
            Reset to default
          </Button>
        </div>
        <div ref={tuningRef} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TUNING_FIELDS.map((field) => (
            <Field
              key={field.name}
              label={field.label}
              htmlFor={`tuning-${field.name}`}
              hint={field.hint}
              badge={field.appliesTo === "none" ? "No effect yet" : undefined}
            >
              <Input
                id={`tuning-${field.name}`}
                name={field.name}
                type="number"
                step={field.step}
                min={field.min}
                max={field.max}
                defaultValue={agent.conversation_settings[field.name] ?? ""}
                placeholder={String(CONVERSATION_SETTING_DEFAULTS[field.name])}
              />
              {field.appliesTo === "none" && (
                <InactiveNote>
                  Saved, but nothing reads it yet — Deepgram Aura has no such
                  control.
                </InactiveNote>
              )}
              {realtime && "realtimeNote" in field && (
                <p className="text-[0.6875rem] leading-relaxed text-muted">
                  {field.realtimeNote}
                </p>
              )}
            </Field>
          ))}
        </div>
      </FieldSet>

      <FieldSet
        legend="Pronunciation dictionary"
        description="Applied to TTS output and used to boost the same terms in STT, so
          “Kodexo” is both said and heard correctly."
      >
        {realtime && (
          <InactiveNote>
            Not applied while Gemini Live is selected — the substitution hooks
            into the Deepgram TTS step, which that engine replaces. Entries are
            kept for when you switch back.
          </InactiveNote>
        )}
        <RepeatableRows
          addLabel="Add term"
          emptyHint="No overrides — every term uses the voice's default pronunciation."
          columns={[
            {
              name: "term",
              kind: "text",
              label: "Written as",
              placeholder: "Kodexo Labs",
            },
            {
              name: "say_as",
              kind: "text",
              label: "Said as",
              placeholder: "Ko-DEX-oh Labs",
            },
          ]}
          initial={agent.pronunciation_dictionary.map((entry) => ({
            term: entry.term,
            say_as: entry.say_as,
          }))}
        />
      </FieldSet>
    </ActionForm>
  );
}

/* -------------------------------------------------------------------------- */
/* Knowledge base                                                             */
/* -------------------------------------------------------------------------- */

/**
 * One knowledge base per agent, exposed to the model as a single on-demand
 * tool (see agent-worker/src/worker/tools.py build_knowledge_tool) instead of
 * being concatenated into every turn's prompt -- knowledge_base_description
 * is what the model actually reads to decide whether to look it up, so its
 * content only costs tokens on the calls that actually need it.
 */
export function KnowledgeBaseForm({ agent }: { agent: Agent }) {
  return (
    <ActionForm action={updateAgentKnowledgeBase} pendingLabel="Saving…">
      <input type="hidden" name="agent_id" value={agent.agent_id} />
      <Field
        label="When to use it"
        htmlFor="kb-description"
        badge="required to activate"
        hint="Written for the model, not for a person -- a short summary of what this covers, so it knows when a caller's question is worth looking up here."
      >
        <Textarea
          id="kb-description"
          name="knowledge_base_description"
          rows={2}
          defaultValue={agent.knowledge_base_description}
          placeholder="Company info, pricing, and policies -- use this for anything off-script that isn't covered by the qualification flow."
        />
      </Field>
      <Field
        label="Knowledge base content"
        htmlFor="kb-content"
        badge="optional"
        hint="Paste everything the agent might need for off-topic questions. Only sent to the model on the calls where it actually decides to look it up."
      >
        <Textarea
          id="kb-content"
          name="knowledge_base_content"
          rows={16}
          defaultValue={agent.knowledge_base_content}
          placeholder="Paste FAQs, policies, pricing -- anything the agent should be able to answer from."
        />
      </Field>
    </ActionForm>
  );
}

/* -------------------------------------------------------------------------- */
/* Built-in tools                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Read-only: these 4 tools are code in `agent-worker/src/worker/tools.py`,
 * not a dashboard entry. Every agent gets all of them automatically, so
 * there's nothing to configure here -- just what each one does and the
 * arguments the model fills in when it decides to call one.
 */
export function BuiltinTools() {
  return (
    <div className="space-y-2">
      {BUILTIN_TOOLS.map((tool) => (
        <details
          key={tool.id}
          className="group rounded-md border border-line bg-canvas-alt p-3"
        >
          <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 text-sm font-medium text-strong marker:content-none">
            <Chevron />
            <span className="font-mono">{tool.name}</span>
            <span className="rounded-pill bg-surface px-2 py-0.5 text-[0.6875rem] font-medium whitespace-nowrap text-faint">
              Built in -- every agent
            </span>
          </summary>
          <p className="mt-2 pl-6 text-xs leading-relaxed text-muted">{tool.description}</p>
          {tool.parameters.length > 0 && (
            <dl className="mt-2.5 space-y-1 border-t border-divider pt-2.5 pl-6">
              {tool.parameters.map((param) => (
                <div key={param.name} className="flex flex-wrap gap-x-2 text-xs">
                  <dt className="font-mono text-body">{param.name}</dt>
                  <dd className="text-muted">
                    ({param.type}) {param.description}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </details>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Tools -- global library, this agent just picks which ones it uses         */
/* -------------------------------------------------------------------------- */


/** Every tool lives in the shared library at /tools now (see 0014_global_tools.sql)
 * -- this just lets an agent select which ones it uses, via the agent_tools
 * join table, instead of authoring a tool's own definition per agent. */
export function AgentToolsPanel({
  agentId,
  allTools,
  selectedToolIds,
}: {
  agentId: string;
  allTools: Tool[];
  selectedToolIds: Set<string>;
}) {
  return (
    <div className="space-y-2">
      {allTools.length === 0 && (
        <p className="text-sm text-muted">
          No tools in the library yet -- <TextLink href="/tools">create one</TextLink>{" "}
          first, then come back here to attach it.
        </p>
      )}
      {allTools.map((tool) => {
        const attached = selectedToolIds.has(tool.tool_id);
        const { icon, tone, badge } = toolTypeMeta(tool);
        return (
          <div
            key={tool.tool_id}
            className={
              attached
                ? "flex flex-wrap items-center gap-3 rounded-md border border-brand/40 bg-brand-tint/40 p-3"
                : "flex flex-wrap items-center gap-3 rounded-md border border-line bg-canvas-alt p-3"
            }
          >
            <ToolTypeGlyph icon={icon} tone={tone} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-mono text-sm font-medium text-strong">
                  {tool.name}
                </span>
                <span className="rounded-pill bg-surface px-2 py-0.5 text-[0.6875rem] font-medium whitespace-nowrap text-faint">
                  {badge}
                </span>
              </div>
              <p className="mt-0.5 truncate text-xs text-muted">
                {tool.description}
              </p>
            </div>
            <ActionButton
              action={attached ? detachTool : attachTool}
              label={attached ? "Detach" : "Attach"}
              variant={attached ? "danger" : "secondary"}
              size="sm"
              hidden={{ agent_id: agentId, tool_id: tool.tool_id }}
            />
          </div>
        );
      })}
      <TextLink href="/tools" className="inline-block pt-1 text-sm">
        Manage tool definitions in the library →
      </TextLink>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Danger zone                                                                */
/* -------------------------------------------------------------------------- */

export function DeleteAgentButton({
  agentId,
  agentName,
  hasNumber,
}: {
  agentId: string;
  agentName: string;
  hasNumber: boolean;
}) {
  return (
    <ActionButton
      action={deleteAgent}
      label="Delete agent"
      variant="danger"
      confirm={
        hasNumber
          ? `Delete "${agentName}"? Its phone number stays on the Twilio account but will route to nothing until you assign it to another agent.`
          : `Delete "${agentName}"? Its prompt and knowledge base go with it -- tools it used stay in the shared library. Call logs are kept.`
      }
      hidden={{ agent_id: agentId }}
    />
  );
}
