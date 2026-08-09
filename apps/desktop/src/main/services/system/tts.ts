// Same unofficial, unauthenticated endpoint translate.google.com's own
// "listen" button calls (see translate.ts) — full Google TTS voice quality
// with zero setup/API key, but undocumented and can get IP-rate-limited
// without warning, hence the renderer falls back to the OS voice on error.
const GOOGLE_TTS_URL = "https://translate.google.com/translate_tts";

// A browser User-Agent is required — the endpoint 403s on Node's default.
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

// The endpoint silently truncates/garbles past ~200 characters; callers only
// ever pass single words or short phrases from a vocab entry, so no
// chunking is needed here.
export async function synthesizeSpeech(text: string, lang: string): Promise<Buffer> {
  const url = `${GOOGLE_TTS_URL}?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang}&client=tw-ob`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Google TTS HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
