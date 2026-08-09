import { ipcRenderer } from "electron";
import type {
  AiExample,
  AiRelatedWords,
  ChatMessage,
  GrammarCheckResult,
  QuizQuestion,
  TagSuggestion,
  VocabCandidate,
  VocabEntryRow,
} from "../types";

export const ai = {
  generateExamples: (id: string) => ipcRenderer.invoke("ai:generateExamples", id) as Promise<VocabEntryRow>,
  explainNuance: (id: string) => ipcRenderer.invoke("ai:explainNuance", id) as Promise<VocabEntryRow>,
  suggestRelatedWords: (id: string) => ipcRenderer.invoke("ai:suggestRelatedWords", id) as Promise<VocabEntryRow>,
  suggestTags: (id: string) => ipcRenderer.invoke("ai:suggestTags", id) as Promise<TagSuggestion>,
  quizQuestion: (id: string) => ipcRenderer.invoke("ai:quizQuestion", id) as Promise<QuizQuestion>,
  extractVocab: (paragraph: string) => ipcRenderer.invoke("ai:extractVocab", paragraph) as Promise<VocabCandidate[]>,
  // Preview variants: same Groq prompts, but work on raw text instead of
  // a saved vocabId and don't persist anything — used by the popup's AI
  // tabs before the word has been saved. `definition` (when passed) is
  // whichever of the dictionary/AI definitions the user picked (see
  // DefinitionChooser.tsx) — grounds the generation in that specific sense
  // instead of just the bare translation meanings.
  previewExamples: (sourceText: string, meanings: string[], definition?: string | null) =>
    ipcRenderer.invoke("ai:previewExamples", sourceText, meanings, definition) as Promise<AiExample[]>,
  previewNuance: (sourceText: string, meanings: string[], definition?: string | null) =>
    ipcRenderer.invoke("ai:previewNuance", sourceText, meanings, definition) as Promise<string>,
  previewRelatedWords: (
    sourceText: string,
    sourceLang: string,
    targetText: string,
    targetLang: string,
    definition?: string | null,
  ) =>
    ipcRenderer.invoke(
      "ai:previewRelatedWords",
      sourceText,
      sourceLang,
      targetText,
      targetLang,
      definition,
    ) as Promise<AiRelatedWords>,
  // AI-generated definition, offered alongside the free-dictionary one
  // right after a lookup (see DefinitionChooser.tsx) — preview-only, same
  // reasoning as the other preview* calls: there's no dedicated column for
  // "the AI's definition", only for whichever one the user picks (written
  // into the existing `definition` field via vocab.update/save).
  previewDefinition: (sourceText: string, meanings: string[]) =>
    ipcRenderer.invoke("ai:previewDefinition", sourceText, meanings) as Promise<string>,
  // Never persisted — works the same for a saved entry or a not-yet-saved
  // preview, so takes the word's info directly instead of a vocabId (see
  // WordChat.tsx, used from both VocabDetailModal and Popup.tsx).
  chatAboutWord: (
    sourceText: string,
    sourceLang: string,
    targetText: string,
    targetLang: string,
    meanings: string[],
    history: ChatMessage[],
  ) =>
    ipcRenderer.invoke(
      "ai:chatAboutWord",
      sourceText,
      sourceLang,
      targetText,
      targetLang,
      meanings,
      history,
    ) as Promise<string>,
  // Ctrl+Shift+G on selected text (see main/app/hotkey.ts) — also
  // callable directly on arbitrary text, not just via the global hotkey.
  checkGrammar: (sentence: string) => ipcRenderer.invoke("ai:checkGrammar", sentence) as Promise<GrammarCheckResult>,
};
