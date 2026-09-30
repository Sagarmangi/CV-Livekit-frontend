"use client";

import { useMemo, useRef, useState } from "react";

import { DEEPGRAM_VOICES, findDeepgramVoice, type DeepgramVoice } from "@/lib/deepgram-voices";

/* Kept in step with the shared CONTROL in components/ui.tsx -- this is a
 * combobox rather than a plain <input>, so it can't use the Input primitive,
 * but it has to look identical to the fields around it. */
const CONTROL =
  "w-full rounded-md border border-input-line bg-input px-3 py-2 text-sm text-body transition-colors placeholder:text-faint focus:border-brand";

const MAX_RESULTS = 40;

function labelFor(voice: DeepgramVoice): string {
  return `${voice.name} -- ${voice.language}, ${voice.gender}`;
}

/** "male"/"female" are how people actually search; "Masculine"/"Feminine" don't contain either as a substring. */
const GENDER_ALIASES: Record<DeepgramVoice["gender"], string> = {
  Masculine: "male man",
  Feminine: "female woman",
};

function escapeRegExp(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matches(voice: DeepgramVoice, query: string): boolean {
  const haystack = `${voice.name} ${voice.id} ${voice.language} ${voice.gender} ${GENDER_ALIASES[voice.gender]} ${voice.tags.join(" ")}`.toLowerCase();
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  // Word-boundary prefix match per term -- "male" must not also match inside "female".
  return terms.every((term) => new RegExp(`\\b${escapeRegExp(term)}`).test(haystack));
}

/**
 * A searchable Deepgram Aura voice picker. Submits the same `voice_id` field
 * a plain text input would, so an operator can still paste a raw model name
 * that isn't in the catalog (e.g. a brand-new Deepgram release).
 */
export function VoicePicker({
  id,
  fieldName,
  defaultValue,
}: {
  id?: string;
  fieldName: string;
  defaultValue: string;
}) {
  const [voiceId, setVoiceId] = useState(defaultValue);
  const [query, setQuery] = useState(() => {
    const known = findDeepgramVoice(defaultValue);
    return known ? labelFor(known) : defaultValue;
  });
  const [open, setOpen] = useState(false);
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  // False right after a catalog selection (or on mount) -- true once the user
  // types again. Blur only falls back to raw-text-as-id when this is true, so
  // it doesn't clobber a just-picked model id with its own display label.
  const typedSinceSelect = useRef(false);

  /**
   * Everything matching the current query -- or the whole catalog when the box
   * is simply displaying a selected voice.
   *
   * That second case matters: after picking a voice the input holds its display
   * label ("Thalia -- English (American), Feminine"), and that label is a
   * terrible search string. `matches` splits on whitespace and requires each
   * term at a word boundary, so the "--" term matches nothing and the picker
   * claimed "no catalog match -- will be saved as a raw model name" about a
   * voice that was, in fact, selected from the catalog.
   */
  const matching = useMemo(() => {
    const term = query.trim();
    if (!term) return DEEPGRAM_VOICES;
    const isSelectionLabel = DEEPGRAM_VOICES.some((voice) => labelFor(voice) === term);
    if (isSelectionLabel) return DEEPGRAM_VOICES;
    return DEEPGRAM_VOICES.filter((voice) => matches(voice, term));
  }, [query]);

  const results = useMemo(() => matching.slice(0, MAX_RESULTS), [matching]);
  const totalMatches = matching.length;

  function selectVoice(voice: DeepgramVoice) {
    typedSinceSelect.current = false;
    setVoiceId(voice.id);
    setQuery(labelFor(voice));
    setOpen(false);
  }

  return (
    <div
      className="relative"
      onBlur={() => {
        // Delay so a click on a dropdown option (which also fires blur first) still registers.
        blurTimeout.current = setTimeout(() => {
          setOpen(false);
          // Only fall back to raw-text-as-id if the user actually typed since
          // the last catalog pick -- otherwise this would overwrite a good
          // voice_id with its own friendly display label.
          if (typedSinceSelect.current) setVoiceId(query.trim());
        }, 120);
      }}
      onFocus={() => {
        if (blurTimeout.current) clearTimeout(blurTimeout.current);
      }}
    >
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${fieldName}-listbox`}
        autoComplete="off"
        className={CONTROL}
        value={query}
        placeholder="Search voices by name, language, gender, or style…"
        onChange={(event) => {
          typedSinceSelect.current = true;
          setQuery(event.target.value);
          setVoiceId(event.target.value.trim());
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      <input type="hidden" name={fieldName} value={voiceId} />

      {open && (
        <div
          id={`${fieldName}-listbox`}
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border border-line bg-surface py-1 shadow-lg"
        >
          {/* Says whose catalog this is. There's exactly one TTS vendor in the
              worker, but an agent row can still carry a stale provider name
              from before that was true, so it's worth stating. */}
          <p className="mono-kicker sticky top-0 border-b border-divider bg-surface px-3 py-2">
            Deepgram Aura · {DEEPGRAM_VOICES.length} voices
          </p>
          {results.length === 0 && (
            <p className="px-3 py-2 text-sm text-muted">
              No catalog match -- saving will use &ldquo;{query.trim()}&rdquo; as a raw model name.
            </p>
          )}
          {results.map((voice) => (
            <button
              key={voice.id}
              type="button"
              role="option"
              aria-selected={voice.id === voiceId}
              className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left transition-colors hover:bg-canvas-alt"
              onMouseDown={(event) => {
                // Prevent the input's blur (which would fire before this click) from racing the selection.
                event.preventDefault();
                selectVoice(voice);
              }}
            >
              <span className="text-sm font-medium text-strong">
                {voice.name}{" "}
                <span className="font-normal text-muted">
                  &middot; {voice.language} &middot; {voice.gender}
                </span>
              </span>
              <span className="text-xs text-faint">
                {voice.tags.join(", ")} &middot; <span className="font-mono">{voice.id}</span>
              </span>
            </button>
          ))}
          {totalMatches > MAX_RESULTS && (
            <p className="border-t border-divider px-3 py-2 text-xs text-faint">
              {totalMatches - MAX_RESULTS} more match -- keep typing to narrow it down.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
