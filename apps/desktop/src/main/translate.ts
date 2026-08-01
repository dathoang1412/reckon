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

export async function translate(text: string): Promise<TranslationResult> {
  const { source, target } = detectDirection(text);
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${source}|${target}`;
  const res = await fetch(url);
  const json = await res.json();

  if (json.responseStatus !== 200 || !json.responseData?.translatedText) {
    throw new Error("Translation failed");
  }

  return {
    sourceText: text,
    sourceLang: source,
    targetText: json.responseData.translatedText,
    targetLang: target,
  };
}
