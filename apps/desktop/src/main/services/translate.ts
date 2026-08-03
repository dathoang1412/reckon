export interface TranslationResult {
  sourceText: string;
  sourceLang: string;
  targetText: string;
  targetLang: string;
}

const VIETNAMESE_CHARS =
  /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

function detectDirection(text: string): { source: string; target: string } {
  return VIETNAMESE_CHARS.test(text) ? { source: "vi", target: "en" } : { source: "en", target: "vi" };
}

// Segment shape from Google's translate_a/single endpoint: [translated, original, ...unused].
type GoogleTranslateSegment = [string, string, ...unknown[]];
type GoogleTranslateResponse = [GoogleTranslateSegment[], ...unknown[]];

// The same unofficial, unauthenticated endpoint translate.google.com's own
// web UI calls — full Google Translate quality with zero setup, but
// undocumented and can get IP-rate-limited without warning, hence the
// MyMemory fallback below.
async function translateWithGoogle(text: string, source: string, target: string): Promise<string> {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${source}&tl=${target}&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Google Translate HTTP ${res.status}`);

  const json = (await res.json()) as GoogleTranslateResponse;
  const segments = json[0];
  if (!Array.isArray(segments) || segments.length === 0) {
    throw new Error("Unexpected Google Translate response shape");
  }

  const translated = segments.map((segment) => segment[0]).join("");
  if (!translated) throw new Error("Empty Google Translate response");
  return translated;
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
  try {
    targetText = await translateWithGoogle(text, source, target);
  } catch {
    targetText = await translateWithMyMemory(text, source, target);
  }

  return { sourceText: text, sourceLang: source, targetText, targetLang: target };
}
