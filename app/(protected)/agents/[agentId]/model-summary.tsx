import Link from "next/link";

import { findDeepgramVoice } from "@/lib/deepgram-voices";
import { GEMINI_DEFAULT_VOICE, findGeminiVoice } from "@/lib/gemini-voices";
import type { Agent, LLMProvider } from "@/lib/types";

/**
 * Short, card-friendly version of sections.tsx's LLM_PROVIDER_LABELS -- that
 * one is written for a <select> option/tooltip, this is written to fit a
 * two-line summary card.
 */
const LLM_SUMMARY: Record<LLMProvider, { name: string; note: string }> = {
  gemini: { name: "Gemini Flash", note: "Fastest to first word -- default" },
  deepseek: { name: "DeepSeek", note: "v4 Flash -- cheaper, slower" },
  groq: { name: "Groq", note: "Llama 3.3 70B -- key currently rejected" },
  gemini_live: { name: "Gemini Live", note: "Realtime speech-to-speech" },
};

function PencilIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z" />
    </svg>
  );
}

/**
 * Deliberately no per-card accent colour: the identity allows one tertiary
 * accent per surface and never a set of them side by side, so these read as
 * three instances of the same card rather than a traffic light.
 */
function SummaryCard({
  label,
  title,
  subtitle,
  editHref,
}: {
  label: string;
  title: string;
  subtitle: string;
  editHref: string;
}) {
  return (
    <div className="group rounded-lg border border-line bg-surface px-4 py-3.5 shadow-sm transition-colors hover:border-brand/40">
      <div className="flex items-start justify-between gap-2">
        <span className="mono-kicker">{label}</span>
        <Link
          href={editHref}
          aria-label={`Edit ${label.toLowerCase()}`}
          className="rounded-md p-1 text-faint opacity-0 transition-opacity group-hover:opacity-100 hover:bg-canvas-alt hover:text-brand focus-visible:opacity-100"
        >
          <PencilIcon />
        </Link>
      </div>
      <p className="mt-1.5 truncate font-heading text-sm font-semibold text-strong">
        {title}
      </p>
      <p className="truncate text-xs text-muted">{subtitle}</p>
    </div>
  );
}

/**
 * Vapi-style "which models is this agent using" strip -- Transcriber/Model/
 * Voice, each linking its pencil to where it's actually configured (all three
 * live on the Voice & humanness tab, see sections.tsx's VoiceConfigForm).
 * Deliberately only shows fields this system actually has: no cost/latency
 * numbers, since nothing here measures those per-provider.
 */
export function AgentModelSummary({ agent }: { agent: Agent }) {
  const llm = LLM_SUMMARY[agent.llm_provider];
  const voice = agent.voice_id ? findDeepgramVoice(agent.voice_id) : undefined;
  const editHref = `/agents/${agent.agent_id}?tab=voice`;

  // Gemini Live is speech-to-speech: the worker builds no separate STT or TTS
  // stage for it at all, so naming Deepgram on either end would be wrong.
  const realtime = agent.llm_provider === "gemini_live";
  const geminiCharacter = findGeminiVoice(
    agent.gemini_voice ?? GEMINI_DEFAULT_VOICE,
  )?.character;

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <SummaryCard
        label="Transcriber"
        title={realtime ? "Built in" : "Deepgram"}
        subtitle={
          realtime
            ? "Gemini Live transcribes as it listens"
            : "Speech-to-text -- fixed for every agent"
        }
        editHref={editHref}
      />
      <SummaryCard
        label="Model"
        title={llm.name}
        subtitle={llm.note}
        editHref={editHref}
      />
      <SummaryCard
        label="Voice"
        title={
          realtime
            ? (agent.gemini_voice ?? GEMINI_DEFAULT_VOICE)
            : voice
              ? voice.name
              : "Worker default"
        }
        subtitle={
          realtime
            ? `Gemini Live prebuilt${geminiCharacter ? ` -- ${geminiCharacter}` : ""}`
            : voice
              ? `Deepgram (Aura) -- ${voice.language}`
              : "Deepgram (Aura)"
        }
        editHref={editHref}
      />
    </div>
  );
}
