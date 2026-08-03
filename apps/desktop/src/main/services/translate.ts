export interface TranslationResult {
  sourceText: string;
  sourceLang: string;
  targetText: string;
  // Alternative Vietnamese/English meanings for the same word, e.g. "bank"
  // -> ["ngân hàng", "bờ sông", ...]. Always includes targetText (first).
  // Only ever more than one entry for single dictionary words — phrases and
  // sentences fall back to just [targetText].
  targetMeanings: string[];
  targetLang: string;
}

const VIETNAMESE_CHARS =
  /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

function detectDirection(text: string): { source: string; target: string } {
  return VIETNAMESE_CHARS.test(text) ? { source: "vi", target: "en" } : { source: "en", target: "vi" };
}

// Segment shape from Google's translate_a/single endpoint: [translated, original, ...unused].
type GoogleTranslateSegment = [string, string, ...unknown[]];
// dt=bd (bilingual dictionary) entry: [partOfSpeech, terms[], detailedTerms, baseWord, index].
// Only present for single dictionary words — null for phrases/sentences.
type GoogleDictionaryEntry = [string, string[], ...unknown[]];
type GoogleTranslateResponse = [GoogleTranslateSegment[], GoogleDictionaryEntry[] | null, ...unknown[]];

interface GoogleTranslation {
  text: string;
  meanings: string[];
}

function dedupeMeanings(meanings: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const meaning of meanings) {
    // Google's dt=t and dt=bd payloads don't agree on Unicode normalization
    // for Vietnamese diacritics (NFC vs NFD) — without normalizing first,
    // visually-identical meanings from the two segments compare as distinct.
    const trimmed = meaning.trim().normalize("NFC");
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
    if (result.length >= 8) break;
  }
  return result;
}

// The same unofficial, unauthenticated endpoint translate.google.com's own
// web UI calls — full Google Translate quality with zero setup, but
// undocumented and can get IP-rate-limited without warning, hence the
// MyMemory fallback below.
async function translateWithGoogle(text: string, source: string, target: string): Promise<GoogleTranslation> {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${source}&tl=${target}&dt=t&dt=bd&q=${encodeURIComponent(text)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Google Translate HTTP ${res.status}`);

  const json = (await res.json()) as GoogleTranslateResponse;
  const segments = json[0];
  if (!Array.isArray(segments) || segments.length === 0) {
    throw new Error("Unexpected Google Translate response shape");
  }

  const translated = segments.map((segment) => segment[0]).join("");
  if (!translated) throw new Error("Empty Google Translate response");

  const dictionary = json[1];
  const meanings = Array.isArray(dictionary)
    ? dedupeMeanings([translated, ...dictionary.flatMap((entry) => entry[1] ?? [])])
    : [translated];

  return { text: translated, meanings };
}

interface MyMemoryResponse {
  responseStatus: number;
  responseData?: { translatedText?: string };
}

async function translateWithMyMemory(text: string, source: string, target: string): Promise<string> {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${source}|${target}`;
  const res = await fetch(url);
  const json = (await res.json()) as MyMemoryResponse;

  const translated = json.responseData?.translatedText;
  if (json.responseStatus !== 200 || !translated) {
    throw new Error("MyMemory translation failed");
  }
  return translated;
}

export async function translate(text: string): Promise<TranslationResult> {
  const { source, target } = detectDirection(text);

  let targetText: string;
  let targetMeanings: string[];
  try {
    const google = await translateWithGoogle(text, source, target);
    targetText = google.text;
    targetMeanings = google.meanings;
  } catch {
    targetText = await translateWithMyMemory(text, source, target);
    targetMeanings = [targetText];
  }

  return { sourceText: text, sourceLang: source, targetText, targetMeanings, targetLang: target };
}
