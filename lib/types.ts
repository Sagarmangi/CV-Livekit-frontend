/**
 * Row types for the Supabase schema in `supabase/migrations/0001_init_schema.sql`.
 *
 * Hand-written rather than generated so the JSONB columns get real shapes
 * instead of `Json`. If you change the migration, change this file too.
 */

export type AgentStatus = "active" | "paused" | "draft";

export const AGENT_STATUSES: AgentStatus[] = ["active", "paused", "draft"];

/**
 * Switchable anytime, no worker redeploy -- see VOICE_STACK_DECISION.md.
 *
 * "gemini", "deepseek" and "groq" are text LLMs inside the same Deepgram
 * STT+TTS pipeline, so all three keep the pronunciation dictionary and every
 * tuning knob below; they differ only in which model writes the words.
 *
 * "gemini_live" is a different shape: a realtime speech-to-speech model that
 * replaces the whole STT+LLM+TTS pipeline, not just the LLM leg -- it gives
 * up the pronunciation dictionary and most tuning knobs below, and decides
 * turn-taking server-side, in exchange for lower cost.
 */
export type LLMProvider = "gemini" | "deepseek" | "groq" | "gemini_live";

/** Ordered fastest-first -- this is the order the picker renders in. */
export const LLM_PROVIDERS: LLMProvider[] = [
  "gemini",
  "deepseek",
  "groq",
  "gemini_live",
];

/** How the agent opens a call -- see flow.py's on_enter for what each does. */
export type FirstMessageMode = "agent_generates" | "agent_says_exact" | "user_starts";

export const FIRST_MESSAGE_MODES: FirstMessageMode[] = [
  "agent_generates",
  "agent_says_exact",
  "user_starts",
];

export type CallOutcome =
  | "qualified"
  | "department_transfer"
  | "not_qualified"
  | "transfer_failed"
  | "dropped"
  // Written by a spam detector, not by the agent's own judgement. Separate from
  // "dropped" so these can be counted and reviewed -- see the 0020 migration.
  | "spam_bot"
  | "spam_sales";

export const CALL_OUTCOMES: CallOutcome[] = [
  "qualified",
  "department_transfer",
  "not_qualified",
  "transfer_failed",
  "dropped",
  "spam_bot",
  "spam_sales",
];

/** One entry in `agents.qualification_criteria`. */
export type QualificationCriterion = {
  /** Stable key the worker uses when reporting what it captured. */
  key: string;
  /** The question the agent should get answered. */
  question: string;
  required: boolean;
};

/** One entry in `agents.pronunciation_dictionary` (FSD 4.1 / FR-07). */
export type PronunciationEntry = {
  /** The written form, e.g. "Kodexo Labs". */
  term: string;
  /** How TTS should say it, e.g. "Ko-DEX-oh Labs". */
  say_as: string;
};

/**
 * `agents.conversation_settings` — the FSD Section 4.3 humanness parameters.
 * Every field is optional in the database; the worker applies its own defaults
 * for anything unset, and `CONVERSATION_SETTING_DEFAULTS` below mirrors those
 * so the dashboard can show an admin what "unset" actually resolves to.
 */
export type ConversationSettings = {
  temperature?: number;
  max_reply_sentences?: number;
  tts_stability?: number;
  speech_rate?: number;
  vad_threshold_ms?: number;
  interruption_sensitivity?: number;
  backchannel_frequency?: number;
};

export const CONVERSATION_SETTING_DEFAULTS: Required<ConversationSettings> = {
  temperature: 0.7,
  max_reply_sentences: 2,
  tts_stability: 0.6,
  speech_rate: 1,
  // 300ms, not 500: the worker now runs Deepgram Flux, which decides
  // end-of-turn from the speech itself, so this is a floor under that decision
  // rather than the whole of it. 500ms of dead air was being added to every
  // phone turn on top of PSTN transit, which no setting here can shorten.
  vad_threshold_ms: 300,
  interruption_sensitivity: 0.5,
  backchannel_frequency: 0.2,
};

/**
 * The one tool baked into the worker's Python code (`agent-worker/src/worker/tools.py`)
 * that every agent gets automatically, unconditionally -- because something
 * has to be able to hang up the call regardless of what's configured.
 * Transfer, lead-recording, and callback-recording used to be unconditional
 * builtins too; they're now regular attachable `Tool` rows (see `ToolType`)
 * so an agent that isn't doing lead qualification, say, doesn't get nudged
 * toward asking for a name/company it has no use for. Purely informational
 * display -- nothing here is per-agent configurable.
 */
export type BuiltinToolId = "end_call";

export type BuiltinToolInfo = {
  id: BuiltinToolId;
  name: string;
  description: string;
  parameters: { name: string; type: string; description: string }[];
};

/** Mirrors the `@function_tool` definition in `agent-worker/src/worker/tools.py` --
 * keep this in sync if that signature or description changes. */
export const BUILTIN_TOOLS: BuiltinToolInfo[] = [
  {
    id: "end_call",
    name: "end_call",
    description:
      "Ends the call after the agent's closing line finishes playing. Every call needs this eventually, or it never hangs up. The hang-up itself can't be customized, but the conditions that tell the model when to call it are editable per agent -- see \"When to end the call\" on the Prompt & qualification tab.",
    parameters: [
      {
        name: "outcome",
        type: "string (optional)",
        description: 'One of the call outcomes, e.g. "not_qualified" or "dropped".',
      },
    ],
  },
];

export type Agent = {
  agent_id: string;
  name: string;
  twilio_number: string | null;
  status: AgentStatus;
  prompt: string;
  first_message_mode: FirstMessageMode;
  /** Only used when first_message_mode is "agent_says_exact". */
  first_message_text: string | null;
  qualification_criteria: QualificationCriterion[];
  stt_provider: string;
  tts_provider: string;
  llm_provider: LLMProvider;
  /** Deepgram Aura model name. Only reaches a call when llm_provider is groq
   * or deepseek -- Gemini Live has no separate TTS step (see 0018). */
  voice_id: string | null;
  /** Gemini Live prebuilt voice name. Only used when llm_provider is
   * gemini_live; null means the plugin's own default. */
  gemini_voice: string | null;
  pronunciation_dictionary: PronunciationEntry[];
  conversation_settings: ConversationSettings;
  /** Null means "use the worker's default end-of-call guidance" -- see BuiltinTools' end_call entry. */
  end_call_instructions: string | null;
  /** Free-form reference text for off-topic questions -- exposed to the model
   * as a single on-demand tool rather than concatenated into every turn's
   * prompt, so it only costs tokens on the calls that actually need it. */
  knowledge_base_content: string;
  /** Model-facing summary of what knowledge_base_content covers -- this, not
   * the content itself, is what the model sees to decide whether to look it up. */
  knowledge_base_description: string;
  /** Posted the full call record (transcript, outcome, lead info) once the
   * call ends. Null means "don't send". No recording pipeline exists yet, so
   * the posted payload's recording_url is always null too -- see
   * agent-worker's notify.send_end_call_webhook. */
  end_call_webhook_url: string | null;
  /**
   * Whether this agent posts to Slack at all. Off by default, including for
   * agents created before the column existed — see migration 0026.
   *
   * When on, the agent posts a lead alert for calls where lead details were
   * captured, plus the urgent alert when a transfer fails. It never posts a
   * summary of every call; that behaviour was removed, because a channel that
   * carries every robocall and four-second hangup is one nobody reads.
   *
   * Requires SLACK_WEBHOOK_URL on the worker too. This switch can't enable
   * notifications a deployment has no webhook for, so "on" here plus silence
   * in Slack means the webhook is missing, not that the toggle failed.
   */
  slack_notifications_enabled: boolean;
  created_at: string;
  updated_at: string;
};

/**
 * "function" calls webhook_url with the model's arguments (the original,
 * still the only type that runs your own code via n8n). The other three are
 * native worker behavior that used to be unconditional builtins -- transfer,
 * lead capture, callback capture -- now admin-created rows like any other
 * tool, opt-in per agent. See agent-worker/src/worker/tools.py's
 * build_agent_tools for what each one actually does when called.
 */
export type ToolType =
  | "function"
  | "transfer_call"
  | "record_lead_info"
  | "record_callback_number"
  | "detect_bot_call"
  | "detect_sales_call"
  /**
   * Hangs up. The only type with a built-in fallback: an agent with no end_call
   * tool attached still gets the default one, because an agent that cannot hang
   * up doesn't end its calls — it holds the line until LiveKit's room timeout
   * expires while telephony bills every minute. Attaching a row *replaces* the
   * default rather than enabling it, and the description you write is appended
   * to the built-in mechanics rather than overwriting them.
   */
  | "end_call";

export const TOOL_TYPES: ToolType[] = [
  "function",
  "transfer_call",
  "record_lead_info",
  "record_callback_number",
  "detect_bot_call",
  "detect_sales_call",
  "end_call",
];

/**
 * The two spam detectors. Unlike every other type these are never offered to
 * the model as callable functions -- the worker checks them against the
 * caller's first reply itself and hangs up (see agent-worker/src/worker/spam.py).
 * A tool the model chooses to call can be talked out of hanging up; this can't.
 */
export const DETECTOR_TOOL_TYPES: ToolType[] = ["detect_bot_call", "detect_sales_call"];

export function isDetectorTool(toolType: ToolType): boolean {
  return DETECTOR_TOOL_TYPES.includes(toolType);
}

/** Which LLM judges the semantic pass for a detector. */
export type DetectorLLM = "gemini" | "deepseek";

export const DETECTOR_LLMS: DetectorLLM[] = ["gemini", "deepseek"];

/** Global now -- the same tool can be selected by more than one agent via
 * the `agent_tools` join table (see 0014_global_tools.sql), rather than
 * belonging to exactly one. */
export type Tool = {
  tool_id: string;
  name: string;
  description: string;
  tool_type: ToolType;
  /** JSON Schema for the tool's arguments -- only meaningful for "function". */
  parameter_schema: Record<string, unknown>;
  /** Only set for "function". */
  webhook_url: string | null;
  /** Only set for "transfer_call" -- one fixed E.164 destination per tool,
   * like Vapi's Transfer Call tool, rather than a shared departments directory. */
  destination_number: string | null;
  is_builtin: boolean;
  /** Off takes the tool out of every agent at once, without unpicking
   * `agent_tools`. Applies to all types, not just detectors. */
  is_enabled: boolean;
  /** Detector types only. Matched literally against the caller's first reply
   * first (free, instant), then used as examples for the LLM pass. */
  detector_statements: string[];
  /** Detector types only. Null means "use the agent's own llm_provider". */
  detector_llm: DetectorLLM | null;
  created_at: string;
  updated_at: string;
};

/** One row of the `agent_tools` join table -- which global tool an agent has selected. */
export type AgentToolLink = {
  agent_id: string;
  tool_id: string;
  created_at: string;
};

export type CallLog = {
  call_log_id: string;
  call_sid: string | null;
  room_id: string | null;
  agent_id: string | null;
  caller_number: string | null;
  transcript: string | null;
  recording_url: string | null;
  duration_seconds: number | null;
  outcome: CallOutcome | null;
  matched_department: string | null;
  /** Which spam detector ended the call and what triggered it. Null unless the
   * outcome is spam_bot/spam_sales. These calls are hung up on with no
   * explanation to the caller, so this is the only evidence a false positive
   * leaves -- surface it wherever the outcome is shown. */
  spam_detection: string | null;
  lead_name: string | null;
  lead_company: string | null;
  lead_need: string | null;
  /** True for a dashboard "Test agent" browser session -- no phone number or Twilio call involved. */
  is_test: boolean;
  /**
   * What the call cost, split by the thing that charges for it, frozen at the
   * rates in effect when it ended (see agent-worker/src/worker/pricing.py).
   * Null on every row written before cost tracking existed -- those calls have
   * no usage counters and can never be priced, which is why this is nullable
   * rather than 0.
   *
   * Three of the four are computed from metered usage. `cost_telephony_usd` is
   * not: Twilio bills the account directly and the worker holds no Twilio
   * credentials, so it is duration x a configured rate. Say "estimated"
   * wherever it's shown.
   */
  cost_stt_usd: number | null;
  cost_llm_usd: number | null;
  cost_tts_usd: number | null;
  cost_telephony_usd: number | null;
  cost_total_usd: number | null;
  cost_breakdown: CostBreakdown | null;

  /* --- Post-call analysis (agent-worker/src/worker/analysis.py) ------------
   *
   * `call_status` and `priority` sit alongside `outcome`, not instead of it.
   * They answer different questions: outcome is what the call was *for*,
   * call_status is whether it *worked*, priority is how much to care. A
   * robocall hung up on deliberately is spam_bot / success / Low at once.
   *
   * Only the last three came from a model. The rest are observations the
   * worker made during the call, which is why there is no `caller_phone` or
   * `caller_name` here -- `caller_number` and `lead_name` already hold those
   * exact facts and a second copy would be free to drift. */

  /** Which of the agent's numbers was dialled. Null for browser test calls. */
  called_number: string | null;
  call_status: "success" | "failed" | "incomplete" | null;
  transfer_attempted: boolean | null;
  callback_needed: boolean | null;
  has_error: boolean | null;
  error_message: string | null;
  /**
   * Who ended the call, and why. Observed during the call by whichever code
   * path ended it — never inferred afterwards from the transcript, and never
   * from `outcome`. See agent-worker's `CallState.claim_end` and migration 0025.
   *
   * `ended_by` answers a question none of the fields above do. A caller who hung
   * up mid-sentence and an agent that said goodbye both used to land as
   * `call_status: "incomplete"` with a null outcome — the same row for opposite
   * events. Note `"telephony"` is the line failing, which is emphatically not a
   * caller hangup and must not be shown as one.
   *
   * `end_reason` is a short slug (`end_call_tool`, `transferred`,
   * `caller_hung_up`, `spam_filter`, `sip_trunk_failure`, `worker_shutdown`,
   * `shutdown: …`). Intentionally open-ended, so treat an unrecognised value as
   * displayable text rather than assuming the set below is exhaustive.
   *
   * Both null on calls recorded before this existed, and on any call that ended
   * in a way nothing claimed — which is "we don't know", not any of the actors.
   */
  ended_by: EndedBy | null;
  end_reason: string | null;
  call_summary: string | null;
  /** Empty array = the analysis ran and found nothing substantive. Null = it
   * never ran (short transcript, timeout, provider outage). Different facts. */
  user_queries: string[] | null;
  priority: CallPriority | null;
  /**
   * The caller's name as the analysis model heard it. Deliberately separate from
   * `lead_name`, which the record_lead_info tool records during the call and
   * which is authoritative — this is an inference from a transcript that may
   * itself have misheard the name. Show which is which rather than collapsing
   * them; a guess must not be indistinguishable from a recorded fact.
   */
  caller_name: string | null;
  /** Which model produced caller_name / call_summary / user_queries / priority,
   * e.g. "deepseek-v4-flash". Stored per row so the UI can attribute those
   * fields honestly even after ANALYSIS_LLM is repointed. */
  analysis_model: string | null;
  created_at: string;
};

export const CALL_PRIORITIES = ["High", "Medium", "Low"] as const;
export type CallPriority = (typeof CALL_PRIORITIES)[number];

/** Who ended a call. Mirrors `EndedBy` in agent-worker/src/worker/models.py and
 * the check constraint in migration 0025 — keep all three in step. */
export const ENDED_BY = [
  "agent",
  "caller",
  "system",
  "telephony",
  "unknown",
] as const;
export type EndedBy = (typeof ENDED_BY)[number];

/** How each actor reads to a person. "System" and "telephony" are separated on
 * purpose: one is our software ending the call, the other is the phone network
 * dropping it, and only the second is anybody's fault outside this codebase. */
export const ENDED_BY_LABELS: Record<EndedBy, string> = {
  agent: "Agent",
  caller: "Caller",
  system: "System",
  telephony: "Line dropped",
  unknown: "Unknown",
};

/** One priced row of a call's cost, as written by pricing.py's `LineItem`. */
export type CostLine = {
  component: "stt" | "llm" | "tts" | "telephony";
  provider: string;
  model: string;
  quantity: number;
  unit: string;
  /** Null when no rate was configured for this model, in which case its cost is
   * missing from the call total rather than wrong -- shown as "unpriced". */
  rate_usd: number | null;
  cost_usd: number;
  unpriced?: boolean;
};

export type CostBreakdown = {
  lines: CostLine[];
  priced_at_rates: string;
  telephony_is_estimated: boolean;
};

/** The login allowlist -- see supabase/migrations/0003_allowed_users.sql. */
export type AllowedUser = {
  email: string;
  created_at: string;
};

/**
 * A number connected from a customer's own Twilio account -- see
 * supabase/migrations/0010_external_numbers.sql. `account_sid`/`auth_token`
 * are that Twilio account's credentials, kept so the number can later be
 * disconnected (detached from the trunk this row created for it).
 */
export type ExternalNumber = {
  external_number_id: string;
  phone_number: string;
  friendly_name: string;
  account_sid: string;
  auth_token: string;
  number_sid: string;
  trunk_sid: string;
  created_at: string;
};
