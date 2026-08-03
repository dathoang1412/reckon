// Maps this app's short language codes to BCP-47 tags so the OS picks a
// matching installed voice instead of falling back to a default one.
const LANG_TO_BCP47: Record<string, string> = {
  en: "en-US",
  vi: "vi-VN",
};

export function speak(text: string, lang: string): void {
  if (!text.trim()) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = LANG_TO_BCP47[lang] ?? lang;
  window.speechSynthesis.speak(utterance);
}
