// Maps this app's short language codes to BCP-47 tags for the OS-voice
// fallback below, so it picks a matching installed voice instead of
// falling back to a default one.
const LANG_TO_BCP47: Record<string, string> = {
  en: "en-US",
};

// getVoices() returns [] until the OS/browser has finished loading them
// asynchronously — cache the list and keep it fresh via voiceschanged
// instead of querying (and racing) on every speak() call.
let voices: SpeechSynthesisVoice[] = [];

function refreshVoices(): void {
  voices = window.speechSynthesis.getVoices();
}

if (typeof window !== "undefined" && window.speechSynthesis) {
  refreshVoices();
  window.speechSynthesis.onvoiceschanged = refreshVoices;
}

// Windows ships two tiers of voice for the same language: legacy SAPI5
// desktop voices (e.g. "Microsoft David") that sound robotic, and
// higher-quality "Natural"/"Online" voices if the user has installed one —
// but those are usually scoped to Narrator only and don't reach
// speechSynthesis at all, which is why Google TTS below is the primary
// path and this is just the offline fallback.
function pickVoice(bcp47: string): SpeechSynthesisVoice | undefined {
  const langPrefix = bcp47.split("-")[0].toLowerCase();
  const candidates = voices.filter((v) => v.lang.toLowerCase().startsWith(langPrefix));
  if (candidates.length === 0) return undefined;
  const natural = candidates.find((v) => /online|natural|neural/i.test(v.name));
  return natural ?? candidates.find((v) => v.lang.toLowerCase() === bcp47.toLowerCase()) ?? candidates[0];
}

function speakWithBrowserVoice(text: string, bcp47: string): void {
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = bcp47;
  const voice = pickVoice(bcp47);
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
}

// Reused/replaced across calls (rather than left to play out) so clicking a
// second speaker button cuts off the first instead of overlapping it —
// speechSynthesis.cancel() already gives the fallback path this behavior
// for free, this just matches it for the Google TTS path.
let currentAudio: HTMLAudioElement | null = null;

export async function speak(text: string, lang: string): Promise<void> {
  if (!text.trim() || lang === "vi") return;
  const bcp47 = LANG_TO_BCP47[lang] ?? lang;

  try {
    const base64 = await window.api.tts.speak(text, lang);
    currentAudio?.pause();
    currentAudio = new Audio(`data:audio/mpeg;base64,${base64}`);
    await currentAudio.play();
  } catch {
    // Offline, endpoint down, or rate-limited — fall back to whatever voice
    // the OS has instead of staying silent.
    speakWithBrowserVoice(text, bcp47);
  }
}
