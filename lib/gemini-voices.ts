/**
 * Gemini Live prebuilt voice catalog, for the Voice picker when an agent's
 * conversation engine is Gemini Live.
 *
 * Like Deepgram, Gemini has no "list voices" endpoint -- the Live API takes a
 * `prebuiltVoiceConfig.voiceName` from a fixed set. This list is the set the
 * installed LiveKit plugin accepts, read off its own `Voice` literal
 * (`livekit/plugins/google/realtime/api_proto.py`), so the dashboard can never
 * offer a name the worker would reject. Refresh both together if the plugin is
 * upgraded.
 *
 * The descriptions come from Google's Live API voice documentation. They're the
 * only thing that makes this list pickable rather than 30 astronomy names.
 */

export type GeminiVoice = {
  /** Sent verbatim as the voice name -- this is also what we store in
   * `agents.voice_id`, same column the Deepgram model name uses. */
  id: string;
  /** Short character note, shown beside the name in the picker. */
  character: string;
};

export const GEMINI_VOICES: GeminiVoice[] = [
  { id: "Zephyr", character: "Bright" },
  { id: "Puck", character: "Upbeat" },
  { id: "Charon", character: "Informative" },
  { id: "Kore", character: "Firm" },
  { id: "Fenrir", character: "Excitable" },
  { id: "Leda", character: "Youthful" },
  { id: "Orus", character: "Firm" },
  { id: "Aoede", character: "Breezy" },
  { id: "Callirrhoe", character: "Easy-going" },
  { id: "Autonoe", character: "Bright" },
  { id: "Enceladus", character: "Breathy" },
  { id: "Iapetus", character: "Clear" },
  { id: "Umbriel", character: "Easy-going" },
  { id: "Algieba", character: "Smooth" },
  { id: "Despina", character: "Smooth" },
  { id: "Erinome", character: "Clear" },
  { id: "Algenib", character: "Gravelly" },
  { id: "Rasalgethi", character: "Informative" },
  { id: "Laomedeia", character: "Upbeat" },
  { id: "Achernar", character: "Soft" },
  { id: "Alnilam", character: "Firm" },
  { id: "Schedar", character: "Even" },
  { id: "Gacrux", character: "Mature" },
  { id: "Pulcherrima", character: "Forward" },
  { id: "Achird", character: "Friendly" },
  { id: "Zubenelgenubi", character: "Casual" },
  { id: "Vindemiatrix", character: "Gentle" },
  { id: "Sadachbia", character: "Lively" },
  { id: "Sadaltager", character: "Knowledgeable" },
  { id: "Sulafat", character: "Warm" },
];

/** The plugin's own default when no voice is configured. */
export const GEMINI_DEFAULT_VOICE = "Puck";

export function findGeminiVoice(id: string): GeminiVoice | undefined {
  return GEMINI_VOICES.find((voice) => voice.id === id);
}
