export interface DictionaryDefinition {
  partOfSpeech: string;
  definition: string;
  example?: string;
}

export interface DictionaryInfo {
  phonetic?: string;
  audioUrl?: string;
  definitions: DictionaryDefinition[];
}

interface FreeDictionaryPhonetic {
  text?: string;
  audio?: string;
}

interface FreeDictionaryMeaning {
  partOfSpeech: string;
  definitions: { definition: string; example?: string }[];
}

interface FreeDictionaryEntry {
  phonetics?: FreeDictionaryPhonetic[];
  meanings?: FreeDictionaryMeaning[];
}

// Free, keyless, English-only dictionary (api.dictionaryapi.dev) — used to
// enrich the popup with definitions/IPA/audio for whichever side of the
// lookup is English, since the Google/MyMemory translation alone is just a
// bare word swap with none of that. Best-effort: a miss (word not in this
// dictionary, or the API being down) just means no enrichment, not a
// failed lookup — the translation itself already succeeded independently.
export async function lookupEnglishWord(word: string): Promise<DictionaryInfo | null> {
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    if (!res.ok) return null;

    const entries = (await res.json()) as FreeDictionaryEntry[];
    const entry = entries[0];
    if (!entry) return null;

    const phonetics = entry.phonetics ?? [];
    const withAudio = phonetics.find((p) => p.audio);
    const withText = phonetics.find((p) => p.text) ?? withAudio;

    const definitions: DictionaryDefinition[] = (entry.meanings ?? []).flatMap((meaning) =>
      meaning.definitions.slice(0, 2).map((d) => ({
        partOfSpeech: meaning.partOfSpeech,
        definition: d.definition,
        example: d.example,
      })),
    );

    if (!withText?.text && !withAudio?.audio && definitions.length === 0) return null;

    // The API already wraps this in slashes (e.g. "/həˈləʊ/") — strip them
    // so callers can format it however they like instead of risking "//x//".
    const phonetic = withText?.text?.replace(/^\/|\/$/g, "");

    return {
      phonetic,
      audioUrl: withAudio?.audio,
      definitions: definitions.slice(0, 5),
    };
  } catch {
    return null;
  }
}
