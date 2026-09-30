/**
 * Deepgram Aura voice catalog for the Voice ID picker on the agent voice
 * settings form. Deepgram has no "list voices" REST endpoint, so this is a
 * point-in-time copy of https://developers.deepgram.com/docs/tts-models --
 * refresh it there if Deepgram ships new voices and the picker looks stale.
 */

export type DeepgramVoice = {
  id: string;
  name: string;
  tier: "aura-2" | "aura-1";
  language: string;
  gender: "Feminine" | "Masculine";
  tags: string[];
};

function v(
  id: string,
  name: string,
  tier: DeepgramVoice["tier"],
  language: string,
  gender: DeepgramVoice["gender"],
  tags: string,
): DeepgramVoice {
  return { id, name, tier, language, gender, tags: tags.split(", ") };
}

export const DEEPGRAM_VOICES: DeepgramVoice[] = [
  // Aura-2 English
  v("aura-2-thalia-en", "Thalia", "aura-2", "English (American)", "Feminine", "Clear, Confident, Energetic, Enthusiastic"),
  v("aura-2-andromeda-en", "Andromeda", "aura-2", "English (American)", "Feminine", "Casual, Expressive, Comfortable"),
  v("aura-2-helena-en", "Helena", "aura-2", "English (American)", "Feminine", "Caring, Natural, Positive, Friendly, Raspy"),
  v("aura-2-apollo-en", "Apollo", "aura-2", "English (American)", "Masculine", "Confident, Comfortable, Casual"),
  v("aura-2-arcas-en", "Arcas", "aura-2", "English (American)", "Masculine", "Natural, Smooth, Clear, Comfortable"),
  v("aura-2-aries-en", "Aries", "aura-2", "English (American)", "Masculine", "Warm, Energetic, Caring"),
  v("aura-2-amalthea-en", "Amalthea", "aura-2", "English (Filipino)", "Feminine", "Engaging, Natural, Cheerful"),
  v("aura-2-asteria-en", "Asteria", "aura-2", "English (American)", "Feminine", "Clear, Confident, Knowledgeable, Energetic"),
  v("aura-2-athena-en", "Athena", "aura-2", "English (American, Mature)", "Feminine", "Calm, Smooth, Professional"),
  v("aura-2-atlas-en", "Atlas", "aura-2", "English (American, Mature)", "Masculine", "Enthusiastic, Confident, Approachable, Friendly"),
  v("aura-2-aurora-en", "Aurora", "aura-2", "English (American)", "Feminine", "Cheerful, Expressive, Energetic"),
  v("aura-2-callista-en", "Callista", "aura-2", "English (American)", "Feminine", "Clear, Energetic, Professional, Smooth"),
  v("aura-2-cora-en", "Cora", "aura-2", "English (American)", "Feminine", "Smooth, Melodic, Caring"),
  v("aura-2-cordelia-en", "Cordelia", "aura-2", "English (American, Young Adult)", "Feminine", "Approachable, Warm, Polite"),
  v("aura-2-delia-en", "Delia", "aura-2", "English (American, Young Adult)", "Feminine", "Casual, Friendly, Cheerful, Breathy"),
  v("aura-2-draco-en", "Draco", "aura-2", "English (British)", "Masculine", "Warm, Approachable, Trustworthy, Baritone"),
  v("aura-2-electra-en", "Electra", "aura-2", "English (American)", "Feminine", "Professional, Engaging, Knowledgeable"),
  v("aura-2-harmonia-en", "Harmonia", "aura-2", "English (American)", "Feminine", "Empathetic, Clear, Calm, Confident"),
  v("aura-2-hera-en", "Hera", "aura-2", "English (American)", "Feminine", "Smooth, Warm, Professional"),
  v("aura-2-hermes-en", "Hermes", "aura-2", "English (American)", "Masculine", "Expressive, Engaging, Professional"),
  v("aura-2-hyperion-en", "Hyperion", "aura-2", "English (Australian)", "Masculine", "Caring, Warm, Empathetic"),
  v("aura-2-iris-en", "Iris", "aura-2", "English (American, Young Adult)", "Feminine", "Cheerful, Positive, Approachable"),
  v("aura-2-janus-en", "Janus", "aura-2", "English (American, Southern)", "Feminine", "Southern, Smooth, Trustworthy"),
  v("aura-2-juno-en", "Juno", "aura-2", "English (American)", "Feminine", "Natural, Engaging, Melodic, Breathy"),
  v("aura-2-jupiter-en", "Jupiter", "aura-2", "English (American)", "Masculine", "Expressive, Knowledgeable, Baritone"),
  v("aura-2-luna-en", "Luna", "aura-2", "English (American, Young Adult)", "Feminine", "Friendly, Natural, Engaging"),
  v("aura-2-mars-en", "Mars", "aura-2", "English (American)", "Masculine", "Smooth, Patient, Trustworthy, Baritone"),
  v("aura-2-minerva-en", "Minerva", "aura-2", "English (American)", "Feminine", "Positive, Friendly, Natural"),
  v("aura-2-neptune-en", "Neptune", "aura-2", "English (American)", "Masculine", "Professional, Patient, Polite"),
  v("aura-2-odysseus-en", "Odysseus", "aura-2", "English (American)", "Masculine", "Calm, Smooth, Comfortable, Professional"),
  v("aura-2-ophelia-en", "Ophelia", "aura-2", "English (American)", "Feminine", "Expressive, Enthusiastic, Cheerful"),
  v("aura-2-orion-en", "Orion", "aura-2", "English (American)", "Masculine", "Approachable, Comfortable, Calm, Polite"),
  v("aura-2-orpheus-en", "Orpheus", "aura-2", "English (American)", "Masculine", "Professional, Clear, Confident, Trustworthy"),
  v("aura-2-pandora-en", "Pandora", "aura-2", "English (British)", "Feminine", "Smooth, Calm, Melodic, Breathy"),
  v("aura-2-phoebe-en", "Phoebe", "aura-2", "English (American)", "Feminine", "Energetic, Warm, Casual"),
  v("aura-2-pluto-en", "Pluto", "aura-2", "English (American)", "Masculine", "Smooth, Calm, Empathetic, Baritone"),
  v("aura-2-saturn-en", "Saturn", "aura-2", "English (American)", "Masculine", "Knowledgeable, Confident, Baritone"),
  v("aura-2-selene-en", "Selene", "aura-2", "English (American)", "Feminine", "Expressive, Engaging, Energetic"),
  v("aura-2-theia-en", "Theia", "aura-2", "English (Australian)", "Feminine", "Expressive, Polite, Sincere"),
  v("aura-2-vesta-en", "Vesta", "aura-2", "English (American)", "Feminine", "Natural, Expressive, Patient, Empathetic"),
  v("aura-2-zeus-en", "Zeus", "aura-2", "English (American)", "Masculine", "Deep, Trustworthy, Smooth"),

  // Aura-2 Spanish
  v("aura-2-celeste-es", "Celeste", "aura-2", "Spanish (Colombian)", "Feminine", "Clear, Energetic, Positive, Friendly, Enthusiastic"),
  v("aura-2-estrella-es", "Estrella", "aura-2", "Spanish (Mexican, Mature)", "Feminine", "Approachable, Natural, Calm, Comfortable, Expressive"),
  v("aura-2-nestor-es", "Nestor", "aura-2", "Spanish (Peninsular)", "Masculine", "Calm, Professional, Approachable, Clear, Confident"),
  v("aura-2-sirio-es", "Sirio", "aura-2", "Spanish (Mexican)", "Masculine", "Calm, Professional, Comfortable, Empathetic, Baritone"),
  v("aura-2-carina-es", "Carina", "aura-2", "Spanish (Peninsular)", "Feminine", "Professional, Raspy, Energetic, Breathy, Confident"),
  v("aura-2-alvaro-es", "Alvaro", "aura-2", "Spanish (Peninsular)", "Masculine", "Calm, Professional, Clear, Knowledgeable, Approachable"),
  v("aura-2-diana-es", "Diana", "aura-2", "Spanish (Peninsular)", "Feminine", "Professional, Confident, Expressive, Polite, Knowledgeable"),
  v("aura-2-aquila-es", "Aquila", "aura-2", "Spanish (Latin American)", "Masculine", "Expressive, Enthusiastic, Confident, Casual, Comfortable"),
  v("aura-2-selena-es", "Selena", "aura-2", "Spanish (Latin American, Young Adult)", "Feminine", "Approachable, Casual, Friendly, Calm, Positive"),
  v("aura-2-javier-es", "Javier", "aura-2", "Spanish (Mexican)", "Masculine", "Approachable, Professional, Friendly, Comfortable, Calm"),
  v("aura-2-agustina-es", "Agustina", "aura-2", "Spanish (Peninsular)", "Feminine", "Calm, Clear, Expressive, Knowledgeable, Professional"),
  v("aura-2-antonia-es", "Antonia", "aura-2", "Spanish (Argentine)", "Feminine", "Approachable, Enthusiastic, Friendly, Natural, Professional"),
  v("aura-2-gloria-es", "Gloria", "aura-2", "Spanish (Colombian, Young Adult)", "Feminine", "Casual, Clear, Expressive, Natural, Smooth"),
  v("aura-2-luciano-es", "Luciano", "aura-2", "Spanish (Mexican)", "Masculine", "Charismatic, Cheerful, Energetic, Expressive, Friendly"),
  v("aura-2-olivia-es", "Olivia", "aura-2", "Spanish (Mexican)", "Feminine", "Breathy, Calm, Casual, Expressive, Warm"),
  v("aura-2-silvia-es", "Silvia", "aura-2", "Spanish (Peninsular)", "Feminine", "Charismatic, Clear, Expressive, Natural, Warm"),
  v("aura-2-valerio-es", "Valerio", "aura-2", "Spanish (Mexican)", "Masculine", "Deep, Knowledgeable, Natural, Polite, Professional"),

  // Aura-2 Dutch
  v("aura-2-rhea-nl", "Rhea", "aura-2", "Dutch", "Feminine", "Caring, Knowledgeable, Positive, Smooth, Warm"),
  v("aura-2-sander-nl", "Sander", "aura-2", "Dutch", "Masculine", "Calm, Clear, Deep, Professional, Smooth"),
  v("aura-2-beatrix-nl", "Beatrix", "aura-2", "Dutch", "Feminine", "Cheerful, Enthusiastic, Friendly, Trustworthy, Warm"),
  v("aura-2-daphne-nl", "Daphne", "aura-2", "Dutch", "Feminine", "Calm, Clear, Confident, Professional, Smooth"),
  v("aura-2-cornelia-nl", "Cornelia", "aura-2", "Dutch", "Feminine", "Approachable, Friendly, Polite, Positive, Warm"),
  v("aura-2-hestia-nl", "Hestia", "aura-2", "Dutch", "Feminine", "Approachable, Caring, Expressive, Friendly, Knowledgeable"),
  v("aura-2-lars-nl", "Lars", "aura-2", "Dutch", "Masculine", "Breathy, Casual, Comfortable, Sincere, Trustworthy"),
  v("aura-2-roman-nl", "Roman", "aura-2", "Dutch", "Masculine", "Calm, Casual, Deep, Natural, Patient"),
  v("aura-2-leda-nl", "Leda", "aura-2", "Dutch", "Feminine", "Caring, Comfortable, Empathetic, Friendly, Sincere"),

  // Aura-2 French
  v("aura-2-agathe-fr", "Agathe", "aura-2", "French", "Feminine", "Charismatic, Cheerful, Enthusiastic, Friendly, Natural"),
  v("aura-2-hector-fr", "Hector", "aura-2", "French", "Masculine", "Confident, Empathetic, Expressive, Friendly, Patient"),

  // Aura-2 German
  v("aura-2-julius-de", "Julius", "aura-2", "German", "Masculine", "Casual, Cheerful, Engaging, Expressive, Friendly"),
  v("aura-2-viktoria-de", "Viktoria", "aura-2", "German", "Feminine", "Charismatic, Cheerful, Enthusiastic, Friendly, Warm"),
  v("aura-2-elara-de", "Elara", "aura-2", "German", "Feminine", "Calm, Clear, Natural, Patient, Trustworthy"),
  v("aura-2-aurelia-de", "Aurelia", "aura-2", "German (Young Adult)", "Feminine", "Approachable, Casual, Comfortable, Natural, Sincere"),
  v("aura-2-lara-de", "Lara", "aura-2", "German (Young Adult)", "Feminine", "Caring, Cheerful, Empathetic, Expressive, Warm"),
  v("aura-2-fabian-de", "Fabian", "aura-2", "German (Mature)", "Masculine", "Confident, Knowledgeable, Natural, Polite, Professional"),
  v("aura-2-kara-de", "Kara", "aura-2", "German (Young Adult)", "Feminine", "Caring, Empathetic, Expressive, Professional, Warm"),

  // Aura-2 Italian
  v("aura-2-livia-it", "Livia", "aura-2", "Italian", "Feminine", "Approachable, Cheerful, Clear, Engaging, Expressive"),
  v("aura-2-dionisio-it", "Dionisio", "aura-2", "Italian", "Masculine", "Confident, Engaging, Friendly, Melodic, Positive"),
  v("aura-2-melia-it", "Melia", "aura-2", "Italian", "Feminine", "Clear, Comfortable, Engaging, Friendly, Natural"),
  v("aura-2-elio-it", "Elio", "aura-2", "Italian", "Masculine", "Breathy, Calm, Professional, Smooth, Trustworthy"),
  v("aura-2-flavio-it", "Flavio", "aura-2", "Italian", "Masculine", "Confident, Deep, Empathetic, Professional, Trustworthy"),
  v("aura-2-maia-it", "Maia", "aura-2", "Italian (Young Adult)", "Feminine", "Caring, Energetic, Expressive, Professional, Warm"),
  v("aura-2-cinzia-it", "Cinzia", "aura-2", "Italian (Mature)", "Feminine", "Approachable, Friendly, Smooth, Trustworthy, Warm"),
  v("aura-2-cesare-it", "Cesare", "aura-2", "Italian", "Masculine", "Clear, Empathetic, Knowledgeable, Natural, Smooth"),
  v("aura-2-perseo-it", "Perseo", "aura-2", "Italian (Young Adult)", "Masculine", "Casual, Clear, Natural, Polite, Smooth"),
  v("aura-2-demetra-it", "Demetra", "aura-2", "Italian", "Feminine", "Calm, Comfortable, Patient"),

  // Aura-2 Japanese
  v("aura-2-fujin-ja", "Fujin", "aura-2", "Japanese", "Masculine", "Calm, Confident, Knowledgeable, Professional, Smooth"),
  v("aura-2-izanami-ja", "Izanami", "aura-2", "Japanese", "Feminine", "Approachable, Clear, Knowledgeable, Polite, Professional"),
  v("aura-2-uzume-ja", "Uzume", "aura-2", "Japanese (Young Adult)", "Feminine", "Approachable, Clear, Polite, Professional, Trustworthy"),
  v("aura-2-ebisu-ja", "Ebisu", "aura-2", "Japanese (Young Adult)", "Masculine", "Calm, Deep, Natural, Patient, Sincere"),
  v("aura-2-ama-ja", "Ama", "aura-2", "Japanese", "Feminine", "Casual, Comfortable, Confident, Knowledgeable, Natural"),

  // Aura 1 English (legacy tier, still callable)
  v("aura-asteria-en", "Asteria", "aura-1", "English (American)", "Feminine", "Clear, Confident, Knowledgeable, Energetic"),
  v("aura-luna-en", "Luna", "aura-1", "English (American, Young Adult)", "Feminine", "Friendly, Natural, Engaging"),
  v("aura-stella-en", "Stella", "aura-1", "English (American)", "Feminine", "Clear, Professional, Engaging"),
  v("aura-athena-en", "Athena", "aura-1", "English (British, Mature)", "Feminine", "Calm, Smooth, Professional"),
  v("aura-hera-en", "Hera", "aura-1", "English (American)", "Feminine", "Smooth, Warm, Professional"),
  v("aura-orion-en", "Orion", "aura-1", "English (American)", "Masculine", "Approachable, Comfortable, Calm, Polite"),
  v("aura-arcas-en", "Arcas", "aura-1", "English (American)", "Masculine", "Natural, Smooth, Clear, Comfortable"),
  v("aura-perseus-en", "Perseus", "aura-1", "English (American)", "Masculine", "Confident, Professional, Clear"),
  v("aura-angus-en", "Angus", "aura-1", "English (Irish)", "Masculine", "Warm, Friendly, Natural"),
  v("aura-orpheus-en", "Orpheus", "aura-1", "English (American)", "Masculine", "Professional, Clear, Confident, Trustworthy"),
  v("aura-helios-en", "Helios", "aura-1", "English (British)", "Masculine", "Professional, Clear, Confident"),
  v("aura-zeus-en", "Zeus", "aura-1", "English (American)", "Masculine", "Deep, Trustworthy, Smooth"),
];

export function findDeepgramVoice(id: string): DeepgramVoice | undefined {
  return DEEPGRAM_VOICES.find((voice) => voice.id === id);
}
